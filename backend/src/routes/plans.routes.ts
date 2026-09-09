import { Router } from 'express';
import { PlansController } from '../controllers/plans.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';

const router = Router();

router.use(authGuard);

router.get('/', PlansController.getAll);
router.get('/pending-grid', PlansController.getPendingGrid);
router.get('/:id', PlansController.getById);
router.get('/:id/quota-check', PlansController.checkQuota);

router.post('/', auditLogger('CREATE_PLAN', 'PLANS'), PlansController.create);
router.put('/:id/items', auditLogger('UPDATE_PLAN_ITEMS', 'PLANS'), PlansController.updateItems);
router.post('/:id/submit', auditLogger('SUBMIT_PLAN', 'PLANS'), PlansController.submit);

// Approve / Reject (TNT Roles)
router.post(
  '/:id/approve',
  roleGuard('admin', 'leader_tnt', 'officer_tnt'),
  auditLogger('APPROVE_PLAN', 'PLANS'),
  PlansController.approve
);

router.post(
  '/:id/reject',
  roleGuard('admin', 'leader_tnt', 'officer_tnt'),
  auditLogger('REJECT_PLAN', 'PLANS'),
  PlansController.reject
);

router.post(
  '/approve-bulk',
  roleGuard('admin', 'leader_tnt', 'officer_tnt'),
  auditLogger('APPROVE_BULK_PLANS', 'PLANS'),
  PlansController.approveBulk
);

export default router;
