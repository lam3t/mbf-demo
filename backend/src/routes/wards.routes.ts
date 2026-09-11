import { Router } from 'express';
import { WardsController } from '../controllers/wards.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard);

router.get('/', WardsController.getAll);
router.get('/:idOrCode', WardsController.getByIdOrCode);

// CR-06 / PROMPT 13: Ward Inspection Alerts & Notice Sending
router.get('/:wardId/inspection-alerts', WardsController.getInspectionAlerts);
router.post(
  '/:wardId/inspection-alerts/:inspectionId/mark-notice-sent',
  roleGuard('officer_ward', 'leader_tnt', 'officer_tnt', 'admin'),
  WardsController.markNoticeSent
);

export default router;
