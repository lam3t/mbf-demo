import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authGuard } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard);

router.get('/summary', DashboardController.getSummary);
router.get('/progress-by-day', DashboardController.getProgressByDay);
router.get('/overdue-ranking', DashboardController.getOverdueRanking);
router.get('/compliance-pie', DashboardController.getCompliancePie);
router.get('/violations-geo', DashboardController.getViolationsGeo);
router.get('/by-domain', DashboardController.getByDomain);
router.get('/ranking', DashboardController.getRanking);

export default router;
