/** Modo demo público (Vercel): sin Okta, sin API real ni datos de producción. */
export const isPortfolioDemo = import.meta.env.VITE_PORTFOLIO_DEMO === 'true'
