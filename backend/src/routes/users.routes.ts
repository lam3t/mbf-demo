import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';

const router = Router();

router.use(authGuard);

router.get('/', UsersController.getAll);
router.get('/:id', UsersController.getById);
router.post('/', roleGuard('admin'), auditLogger('CREATE_USER', 'USERS'), UsersController.create);
router.put('/:id', roleGuard('admin'), auditLogger('UPDATE_USER', 'USERS'), UsersController.update);
router.patch('/:id/toggle-active', roleGuard('admin'), auditLogger('TOGGLE_USER_ACTIVE', 'USERS'), UsersController.toggleActive);

export default router;
