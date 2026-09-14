/**
 * Modo demo público (Vercel): sin Okta, sin API real.
 * Por defecto activo en este repo; desactivar solo con VITE_PORTFOLIO_DEMO=false en el build.
 */
export const isPortfolioDemo = String(import.meta.env.VITE_PORTFOLIO_DEMO ?? 'true') !== 'false'
