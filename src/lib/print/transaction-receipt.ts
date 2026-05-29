// Spec p.24 "Štampaj potvrdu — korisniku se downloaduje pdf sa svim
// detaljima transakcije". Browser-print approach: opens a new window
// with a self-contained styled receipt + calls window.print(), and
// the browser's "Save as PDF" target produces the actual PDF. No
// jspdf dependency or new server endpoint required.
//
// Receipt covers every Transaction field the client can see in the
// row + a few from the detail (payment code, reference, status).
// Diacritics use the document charset (UTF-8) directly; the print
// stylesheet is intentionally minimal so the browser's print dialog
// doesn't strip layout.

import type { v1Transaction } from '@/lib/api/generated/models/v1Transaction'
import { v1TransactionStatus } from '@/lib/api/generated/models/v1TransactionStatus'
import { formatAccountNumber, formatDateTime, formatMoney } from '@/lib/format'
import { txKindLabel, txStatusLabel } from '@/lib/labels'

function row(label: string, value: string): string {
  if (!value) return ''
  return `<tr><td class="label">${label}</td><td>${escapeHtml(value)}</td></tr>`
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function printTransactionReceipt(t: v1Transaction, viewingAccountId: string): void {
  const outflow = t.fromAccountId === viewingAccountId
  const direction = outflow ? 'Odliv' : 'Priliv'
  const amount = outflow ? t.fromAmount : t.toAmount
  const counterpartyNumber = outflow ? t.toAccountNumber : t.fromAccountNumber
  const counterpartyName = outflow ? t.recipientName : ''

  const statusLabel = t.status ? txStatusLabel[t.status as v1TransactionStatus] : ''
  const kindLabel = t.kind ? txKindLabel[t.kind] : ''

  const body = [
    row('Datum', t.createdAt ? formatDateTime(t.createdAt) : ''),
    row('Tip', kindLabel),
    row('Smer', direction),
    row('Iznos', amount ? formatMoney(amount) : ''),
    row('Drugi račun', counterpartyNumber ? formatAccountNumber(counterpartyNumber) : ''),
    row('Naziv primaoca', counterpartyName ?? ''),
    row('Svrha', t.purpose ?? ''),
    row('Šifra plaćanja', t.paymentCode ?? ''),
    row('Poziv na broj', t.referenceNumber ?? ''),
    row('Status', statusLabel),
    row('ID transakcije', t.id ?? ''),
  ]
    .filter(Boolean)
    .join('\n')

  const html = `<!doctype html>
<html lang="sr">
  <head>
    <meta charset="utf-8" />
    <title>Potvrda o transakciji</title>
    <style>
      :root { color-scheme: light only; }
      body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; padding: 40px; max-width: 640px; color: #111; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .subtle { color: #666; font-size: 12px; margin-bottom: 24px; }
      table { border-collapse: collapse; width: 100%; }
      td { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
      td.label { color: #666; width: 40%; font-weight: 500; }
      .footer { color: #666; font-size: 11px; margin-top: 32px; }
      @media print {
        body { padding: 20px; }
        .no-print { display: none !important; }
      }
    </style>
  </head>
  <body>
    <h1>Potvrda o transakciji</h1>
    <div class="subtle">Banka 3</div>
    <table>${body}</table>
    <div class="footer">Štampano: ${formatDateTime(new Date().toISOString())}</div>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 200));</script>
  </body>
</html>`

  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    // Pop-ups blocked. Fall back to a data: URL navigation — most
    // browsers honour that without the pop-up gate.
    window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
