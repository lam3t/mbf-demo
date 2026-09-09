import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authGuard } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.get('/login', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TNT Authentication Endpoint is active. Send a POST request with { username, password } to login.',
    uiLoginUrl: 'https://mbf-demo-nine.vercel.app/login'
  });
});
router.get('/profile', authGuard, AuthController.getProfile);
router.post('/change-password', authGuard, AuthController.changePassword);

export default router;
