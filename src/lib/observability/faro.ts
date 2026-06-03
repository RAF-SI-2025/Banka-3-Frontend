// Grafana Faro initialization.
//
// Pushes traces + Web events (errors, vitals, navigation) to the
// in-cluster Alloy OTLP HTTP receiver, exposed externally at
// https://otel.urosevicvuk.dev. Alloy forwards traces to Tempo and
// logs/events to Loki; everything lands in the same Grafana so a
// browser-side trace links back to the gateway → user/bank/trading
// gRPC spans via the W3C traceparent header the
// TracingInstrumentation propagates to backend XHR calls.
//
// CORS is handled in Alloy's otelcol.receiver.otlp config and the
// gateway's CORS allowlist for `traceparent` / `tracestate` /
// `baggage` request headers.
//
// Sampling: 100% in dev/test, 10% in prod via __FARO_SAMPLE_RATE__.
// Vite injects the build mode so we can tune by env.
import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'

// Vite replaces these at build time; defaults match `npm run dev` so
// devs see traces in the cluster without setting anything.
const FARO_URL = import.meta.env.VITE_FARO_URL ?? 'https://otel.urosevicvuk.dev/v1/traces'
const FARO_APP_NAME = 'banka-frontend'
const FARO_ENV = import.meta.env.MODE
const FARO_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0-dev'

// Origins the TracingInstrumentation will inject a W3C traceparent
// header on. The browser receives a CORS-allowed origin from Envoy
// Gateway for the gateway hostnames below. Without this list, the
// trace ID isn't passed to the backend and frontend spans show up as
// orphans in Tempo.
const BACKEND_ORIGINS: (string | RegExp)[] = [
  /^https:\/\/banka\.raf-project\.com/,
  /^https:\/\/api\.raf-project\.com/,
  // localhost during `npm run dev` against a port-forwarded gateway.
  /^http:\/\/localhost:\d+/,
]

export function initFaro() {
  if (typeof window === 'undefined') return // SSR guard; we don't SSR but be defensive.
  if (!FARO_URL) return // explicit opt-out via empty env.

  try {
    initializeFaro({
      url: FARO_URL,
      app: {
        name: FARO_APP_NAME,
        version: FARO_VERSION,
        environment: FARO_ENV,
      },
      instrumentations: [
        ...getWebInstrumentations({
          captureConsole: false, // we ship via slog/logger upstream; double-capture is noise.
        }),
        new TracingInstrumentation({
          instrumentationOptions: {
            propagateTraceHeaderCorsUrls: BACKEND_ORIGINS,
          },
        }),
      ],
    })
  } catch (err) {
    // Faro failures must never break the app. Worst case: no telemetry.
    console.warn('faro init failed', err)
  }
}
