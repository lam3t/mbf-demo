import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authGuard } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.get('/profile', authGuard, AuthController.getProfile);
router.post('/change-password', authGuard, AuthController.changePassword);

export default router;
