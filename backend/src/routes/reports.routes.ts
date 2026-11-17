import { Router } from 'express';
import multer from 'multer';
import { ReportsController } from '../controllers/reports.controller';
import { authGuard } from '../middlewares/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authGuard);

router.get('/recommendations', ReportsController.getRecommendations);
router.get('/recommendations/export', ReportsController.exportRecommendationsExcel);
router.get('/quarterly', ReportsController.getQuarterlySummary);
router.get('/quarterly/export', ReportsController.exportQuarterlySummaryExcel);
router.get('/uninspected', ReportsController.getUninspectedReport);
router.get('/uninspected/export', ReportsController.exportUninspectedExcel);

// Phụ lục KH 83/KH-CATP-PA04 (01, 02, 03)
router.get('/appendix-01', ReportsController.getAppendix01);
router.get('/appendix-01/export', ReportsController.exportAppendix01);
router.get('/appendix-02', ReportsController.getAppendix02);
router.get('/appendix-02/export', ReportsController.exportAppendix02);
router.post('/appendix-02/import', upload.single('file'), ReportsController.importAppendix02);
router.get('/appendix-03', ReportsController.getAppendix03);
router.get('/appendix-03/export', ReportsController.exportAppendix03);
router.post('/appendix-03/carry-over', ReportsController.carryOverAppendix03);

export default router;
