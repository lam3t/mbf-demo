import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard);
router.get('/', roleGuard('admin', 'leader_pa04'), AuditController.getAll);

export default router;
