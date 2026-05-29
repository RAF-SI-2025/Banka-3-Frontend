// Spec Banka2025-E2E.pdf p.8 "Obračun poreza ... omogući izvoz u PDF".
// Same browser-print approach as the transaction receipt
// ([[transaction-receipt.ts]]): open a new window with a self-
// contained styled HTML page + call window.print(). The browser's
// "Save as PDF" target produces the actual PDF.
//
// Renders one row per visible position with kind + display name +
// unpaid + paid-YTD, plus a totals row at the bottom. The supervisor
// applies the same filters (kind/name) before clicking export, so
// "what they see is what they get".

import { formatMoney } from '@/lib/format'

export interface PorezPosition {
  displayName?: string
  userKind?: string
  unpaidTaxRsd?: string
  paidTaxYtdRsd?: string
}

const KIND_LABEL: Record<string, string> = {
  USER_KIND_CLIENT: 'Klijent',
  USER_KIND_EMPLOYEE: 'Aktuar',
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sum(rows: PorezPosition[], pick: (r: PorezPosition) => string | undefined): string {
  let total = 0
  for (const r of rows) {
    total += Number(pick(r) ?? 0) || 0
  }
  return formatMoney(total.toFixed(4))
}

export function printPorezBoard(rows: PorezPosition[]): void {
  const dataRows = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.displayName ?? '—')}</td>
        <td>${escapeHtml(KIND_LABEL[r.userKind ?? ''] ?? r.userKind ?? '—')}</td>
        <td class="num">${escapeHtml(formatMoney(r.unpaidTaxRsd ?? '0'))}</td>
        <td class="num">${escapeHtml(formatMoney(r.paidTaxYtdRsd ?? '0'))}</td>
      </tr>`,
    )
    .join('')

  const totalsRow = `
    <tr class="totals">
      <td colspan="2">Ukupno (${rows.length} ${rows.length === 1 ? 'korisnik' : 'korisnika'})</td>
      <td class="num">${escapeHtml(sum(rows, (r) => r.unpaidTaxRsd))} RSD</td>
      <td class="num">${escapeHtml(sum(rows, (r) => r.paidTaxYtdRsd))} RSD</td>
    </tr>`

  const html = `<!doctype html>
<html lang="sr">
  <head>
    <meta charset="utf-8" />
    <title>Porez na kapitalni dobitak — izvoz</title>
    <style>
      :root { color-scheme: light only; }
      body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; padding: 40px; color: #111; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .subtle { color: #666; font-size: 12px; margin-bottom: 24px; }
      table { border-collapse: collapse; width: 100%; font-size: 13px; }
      thead th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #111; }
      thead th.num { text-align: right; }
      tbody td { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      tr.totals td { border-top: 2px solid #111; border-bottom: none; font-weight: 600; padding-top: 12px; }
      .footer { color: #666; font-size: 11px; margin-top: 24px; }
      @media print {
        body { padding: 20px; }
      }
    </style>
  </head>
  <body>
    <h1>Porez na kapitalni dobitak</h1>
    <div class="subtle">Banka 3 — izvoz stanja na ${escapeHtml(new Date().toLocaleString('sr-RS'))}</div>
    <table>
      <thead>
        <tr>
          <th>Korisnik</th>
          <th>Tip</th>
          <th class="num">Neuplaćeno (RSD)</th>
          <th class="num">Plaćeno YTD (RSD)</th>
        </tr>
      </thead>
      <tbody>${dataRows || '<tr><td colspan="4">Nema rezultata.</td></tr>'}</tbody>
      ${rows.length > 0 ? `<tfoot>${totalsRow}</tfoot>` : ''}
    </table>
    <div class="footer">Štampano: ${escapeHtml(new Date().toISOString())}</div>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 200));</script>
  </body>
</html>`

  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
