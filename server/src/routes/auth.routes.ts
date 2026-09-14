import { Router } from 'express'

import {
  getMe,
  getOktaPublicConfig,
  loginWithEmail,
  selectRole,
  verifyGoogleToken,
  verifyOktaToken,
} from '../controllers/auth.controller.js'
import { authMiddleware } from '../middlewares/authJwt.middleware.js'

export const authRouter = Router()

authRouter.get('/okta-config', getOktaPublicConfig)
authRouter.post('/okta', verifyOktaToken)
authRouter.post('/verify', verifyGoogleToken)
authRouter.post('/login', loginWithEmail)
authRouter.post('/select-role', authMiddleware, selectRole)
authRouter.get('/me', authMiddleware, getMe)
