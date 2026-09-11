import { Router } from 'express';
import { AlertsController } from '../controllers/alerts.controller';
import { authGuard } from '../middlewares/auth.middleware';

const router = Router();

router.use(authGuard);

router.get('/', AlertsController.getAll);
router.patch('/read-all', AlertsController.markAllAsRead);
router.patch('/:id/read', AlertsController.markAsRead);
router.post('/check-deadlines', AlertsController.triggerDeadlineCheck);

export default router;
