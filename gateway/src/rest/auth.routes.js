import { Router } from 'express';
import { authClient } from '../config/grpc-clients.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { grpcErrorToHttp } from '../utils/grpc-error.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body || {};
    const result = await authClient.Register({ email, password, full_name });
    res.status(201).json(result);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const result = await authClient.Login({ email, password });
    res.json(result);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await authClient.GetUser({ user_id: req.user.id });
    res.json(user);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

export default router;
