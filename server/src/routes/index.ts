import { Router } from 'express'

import { authRouter }         from './auth.routes.js'
import { alliesRouter }       from './allies.routes.js'
import { aprobacionesRouter } from './aprobaciones.routes.js'
import { dashboardRouter }    from './dashboard.routes.js'
import { devRouter }          from './dev.routes.js'
import { healthRouter }       from './health.routes.js'
import { invoicesRouter }     from './invoices.routes.js'
import { paymentsRouter }     from './payments.routes.js'
import { usuariosRouter }     from './usuarios.routes.js'

export const apiRouter = Router()

apiRouter.use('/auth',      authRouter)
apiRouter.use(healthRouter)
apiRouter.use(alliesRouter)
apiRouter.use(aprobacionesRouter)
apiRouter.use(dashboardRouter)
apiRouter.use(devRouter)
apiRouter.use(invoicesRouter)
apiRouter.use(paymentsRouter)
apiRouter.use('/usuarios',  usuariosRouter)
