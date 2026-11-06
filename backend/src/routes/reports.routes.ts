import { Router } from 'express';
import { ReportsController } from '../controllers/reports.controller';
import { authGuard } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard);

router.get('/recommendations', ReportsController.getRecommendations);
router.get('/recommendations/export', ReportsController.exportRecommendationsExcel);
router.get('/quarterly', ReportsController.getQuarterlySummary);
router.get('/quarterly/export', ReportsController.exportQuarterlySummaryExcel);
router.get('/uninspected', ReportsController.getUninspectedReport);
router.get('/uninspected/export', ReportsController.exportUninspectedExcel);

export default router;
