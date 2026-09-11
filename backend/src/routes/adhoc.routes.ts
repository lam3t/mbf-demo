import { Router } from 'express';
import { AdhocController } from '../controllers/adhoc.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';

const router = Router();

router.use(authGuard);

router.get('/', AdhocController.getAll);
router.get('/:id', AdhocController.getById);

router.post(
  '/',
  auditLogger('CREATE_ADHOC_REQUEST', 'ADHOC_REQUESTS'),
  AdhocController.create
);

router.post(
  '/:id/approve',
  roleGuard('admin', 'leader_mbf', 'officer_mbf'),
  auditLogger('APPROVE_ADHOC_REQUEST', 'ADHOC_REQUESTS'),
  AdhocController.approve
);

router.post(
  '/:id/reject',
  roleGuard('admin', 'leader_mbf', 'officer_mbf'),
  auditLogger('REJECT_ADHOC_REQUEST', 'ADHOC_REQUESTS'),
  AdhocController.reject
);

export default router;
