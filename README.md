# Loyalty Backoffice — Portfolio Demo

Versión **pública** del backoffice de gestión de deudas y pagos de aliados, pensada para portafolio y despliegue en **Vercel**.

- Sin Okta, sin base de datos ni credenciales reales.
- Datos de ejemplo en memoria (nombres de comercios ficticios).
- Misma UI que el producto interno: dashboard, aliados, aprobaciones, reportes y usuarios.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrí `http://localhost:5173` y usá **Iniciar sesión** (modo demo).

## Deploy en Vercel (cuenta de equipo / no personal)

1. Creá un repo nuevo en GitHub/GitLab y subí **solo** esta carpeta (`loyalty-backoffice-portfolio`).
2. En Vercel: **Add New Project** → importá el repo.
3. Framework: **Vite** (o dejá que detecte `vercel.json`).
4. (Opcional) Variable de entorno `VITE_PORTFOLIO_DEMO=true` — por defecto el demo ya está activo sin Okta.
5. Deploy.

No configures `DATABASE_URL`, Okta ni secretos: no se usan en este modo.

## Qué no incluye esta copia

- Conexión a PostgreSQL / Prisma en runtime (el código del `server/` queda como referencia de arquitectura full-stack).
- Importación masiva por Excel (pestaña oculta en demo).
- Datos, dominios o marcas del entorno corporativo.

## Stack

React 19, TypeScript, Vite, Tailwind CSS, Chart.js, Express + Prisma (referencia en `/server`).

---

Proyecto de demostración. Los montos y aliados son ficticios.
