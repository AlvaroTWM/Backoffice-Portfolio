import { Router } from 'express'
import { getDashboardStats } from '../controllers/dashboard.controller.js'
import { authMiddleware } from '../middlewares/authJwt.middleware.js'

export const dashboardRouter = Router()

dashboardRouter.get('/dashboard/stats', authMiddleware, getDashboardStats)
