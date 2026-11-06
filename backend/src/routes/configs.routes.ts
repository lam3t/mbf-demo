import { Router } from 'express';
import { ConfigsController } from '../controllers/configs.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';

const router = Router();

router.use(authGuard);

router.get('/quota', ConfigsController.getQuotas);
router.post('/quota', roleGuard('admin'), auditLogger('SAVE_QUOTA', 'CONFIGS'), ConfigsController.saveQuota);

router.get('/cutoff', ConfigsController.getCutoffs);
router.post('/cutoff', roleGuard('admin'), auditLogger('SAVE_CUTOFF', 'CONFIGS'), ConfigsController.saveCutoff);

router.get('/inspection-deadline-days', ConfigsController.getInspectionDeadlineDays);
router.put('/inspection-deadline-days', roleGuard('admin'), auditLogger('SAVE_INSPECTION_DEADLINE_DAYS', 'CONFIGS'), ConfigsController.saveInspectionDeadlineDays);
router.post('/inspection-deadline-days', roleGuard('admin'), auditLogger('SAVE_INSPECTION_DEADLINE_DAYS', 'CONFIGS'), ConfigsController.saveInspectionDeadlineDays);

router.get('/workflows', ConfigsController.getWorkflows);
router.post('/workflows', auditLogger('SAVE_WORKFLOW', 'CONFIGS'), ConfigsController.saveWorkflow);
router.put('/workflows/:id', auditLogger('UPDATE_WORKFLOW', 'CONFIGS'), ConfigsController.saveWorkflow);
router.delete('/workflows/:id', auditLogger('DELETE_WORKFLOW', 'CONFIGS'), ConfigsController.deleteWorkflow);

router.get('/permissions', ConfigsController.getPermissions);
router.put('/permissions', auditLogger('SAVE_PERMISSIONS', 'CONFIGS'), ConfigsController.savePermissions);

export default router;

