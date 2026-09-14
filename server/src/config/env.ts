import 'dotenv/config'

export const env = {
  clientOrigins: (process.env.CLIENT_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  host:      process.env.HOST      ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  nodeEnv:   process.env.NODE_ENV   ?? 'development',
  port:      Number(process.env.PORT ?? 8080),
  okta: {
    issuer:       process.env.OKTA_ISSUER?.trim() ?? '',
    clientId:     process.env.OKTA_CLIENT_ID?.trim() ?? '',
    clientSecret: process.env.OKTA_CLIENT_SECRET?.trim() ?? '',
    redirectUri:  process.env.OKTA_REDIRECT_URI?.trim() ?? '',
  },
}
