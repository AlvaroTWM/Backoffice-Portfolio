import type { ReportCategory } from '../loyaltyBackend'

/** Reportes de ejemplo para la demo pública (sin datos ni marcas reales). */
export const PORTFOLIO_REPORTS: ReportCategory[] = [
  {
    name: 'CRM',
    reports: [{ category: 'CRM', slug: 'Campana-Demo', title: 'Campaña Demo' }],
  },
  {
    name: 'LOYALTY',
    reports: [{ category: 'LOYALTY', slug: 'Resumen-Aliados', title: 'Resumen Aliados' }],
  },
]

function page(title: string, subtitle: string, rows: [string, string, string][]) {
  const body = rows
    .map(([a, b, c]) => `<tr><td>${a}</td><td class="num">${b}</td><td class="num">${c}</td></tr>`)
    .join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;margin:0;padding:32px;background:#F4F1EA;color:#0A1614}
  .card{max-width:860px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 8px 30px rgba(11,61,54,.08)}
  h1{margin:0 0 4px;font-size:26px} p{margin:0 0 20px;color:#6E6B66}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:left}
  th{background:#0B3D36;color:#fff;font-weight:600} .num{text-align:right}
  .tag{display:inline-block;margin-bottom:16px;padding:4px 10px;border-radius:999px;background:#C4FFD4;color:#0B3D36;font-size:12px;font-weight:700}
</style></head><body><div class="card">
<span class="tag">Datos ficticios · demo</span>
<h1>${title}</h1><p>${subtitle}</p>
<table><thead><tr><th>Segmento</th><th class="num">Clientes</th><th class="num">Conversión</th></tr></thead>
<tbody>${body}</tbody></table></div></body></html>`
}

const HTML: Record<string, string> = {
  'CRM/Campana-Demo': page('Campaña Demo', 'Resultados de una campaña de fidelización de ejemplo.', [
    ['Nuevos clientes', '1.240', '18,4 %'],
    ['Clientes recurrentes', '3.980', '27,1 %'],
    ['Reactivados', '615', '9,8 %'],
  ]),
  'LOYALTY/Resumen-Aliados': page('Resumen Aliados', 'Actividad de aliados del programa (ejemplo).', [
    ['Gastronomía', '2.310', '21,0 %'],
    ['Retail', '1.875', '16,2 %'],
    ['Servicios', '940', '11,5 %'],
  ]),
}

export function getPortfolioReportHtml(category: string, slug: string): string {
  const html = HTML[`${category}/${slug}`]
  if (!html) {
    const err = new Error('Reporte no encontrado.') as Error & { status?: number }
    err.status = 404
    throw err
  }
  return html
}
