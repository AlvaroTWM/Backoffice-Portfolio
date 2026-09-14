FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Instalar dependencias del frontend
COPY package*.json ./
RUN npm install

# Copiar código fuente del frontend
COPY . .

# URLs relativas (/api/...) — mismo origen que sirve Express en el contenedor.
# Okta: pasar build-args / env en CI (NullPlatform Parameters → build).
ARG VITE_OKTA_CLIENT_ID
ARG VITE_OKTA_ISSUER
ARG VITE_OKTA_REDIRECT_URI
ENV VITE_API_URL=
ENV VITE_OKTA_CLIENT_ID=$VITE_OKTA_CLIENT_ID
ENV VITE_OKTA_ISSUER=$VITE_OKTA_ISSUER
ENV VITE_OKTA_REDIRECT_URI=$VITE_OKTA_REDIRECT_URI
RUN npm run build


FROM node:20-alpine AS backend-builder

WORKDIR /app/server

RUN apk add --no-cache openssl

# Instalar dependencias del backend
COPY server/package*.json ./
RUN npm ci

# Compilar backend (prisma generate necesita URL formal, no conexión real)
COPY server/tsconfig.json ./
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./prisma.config.ts
COPY server/src ./src
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
# Si el client ya viene en el context (generate local), solo tsc — evita descarga de engines.
# En CI/NullPlatform normalmente no está y corre prisma generate.
RUN if [ -f src/generated/prisma/client.ts ]; then npx tsc; else npx prisma generate && npx tsc; fi


FROM node:20-alpine AS runner

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

RUN apk add --no-cache openssl

# Dependencias de runtime del backend
COPY server/package*.json ./
RUN npm ci --omit=dev

# Backend compilado (incluye client Prisma en dist/generated)
COPY --from=backend-builder /app/server/dist ./dist

# Frontend buildeado (queda en /app/frontend-dist)
COPY --from=frontend-builder /app/frontend/dist /app/frontend-dist
RUN chmod -R 755 /app/frontend-dist

EXPOSE 8080

CMD ["node", "dist/server.js"]
