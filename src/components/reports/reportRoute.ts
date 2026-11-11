// URL pública de un reporte: /CATEGORIA/Reporte (ej. /CRM/Campana-Demo) = server/reports/CRM/Campana-Demo.html
const REPORT_PATH = /^\/([A-Za-z0-9-]+)\/([A-Za-z0-9-]+)\/?$/
const RETURN_TO_KEY = 'loyalty-return-to'

export interface ReportRoute {
  category: string
  slug: string
}

export function reportPath({ category, slug }: ReportRoute) {
  return `/${category}/${slug}`
}

export function parseReportPath(pathname: string): ReportRoute | null {
  const match = REPORT_PATH.exec(pathname)
  return match ? { category: match[1], slug: match[2] } : null
}

// El login con Okta pasa por /callback y vuelve a '/': guardamos el reporte pedido para volver a él.
export function rememberReturnTo(pathname: string) {
  if (parseReportPath(pathname)) sessionStorage.setItem(RETURN_TO_KEY, pathname)
  else sessionStorage.removeItem(RETURN_TO_KEY)
}

export function takeReturnTo(): ReportRoute | null {
  const pathname = sessionStorage.getItem(RETURN_TO_KEY)
  sessionStorage.removeItem(RETURN_TO_KEY)
  const route = pathname ? parseReportPath(pathname) : null
  if (route) window.history.replaceState({}, document.title, reportPath(route))
  return route
}
