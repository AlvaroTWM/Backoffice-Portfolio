import { Router } from 'express'

import { getHealth } from '../controllers/health.controller.js'

export const healthRouter = Router()

// NullPlatform/K8s suele probear /api/health/ (con trailing slash)
healthRouter.get(['/health', '/health/'], getHealth)
