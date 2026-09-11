import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard);
router.get('/', roleGuard('admin', 'leader_mbf'), AuditController.getAll);
router.get('/:id/diff', roleGuard('admin', 'leader_mbf'), AuditController.getDiff);

export default router;
