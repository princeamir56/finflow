import { Router } from 'express';
import { transactionClient } from '../config/grpc-clients.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { grpcErrorToHttp } from '../utils/grpc-error.js';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req, res, next) => {
  try {
    const { currency } = req.body || {};
    const account = await transactionClient.CreateAccount({
      user_id: req.user.id,
      currency: currency || 'EUR'
    });
    res.status(201).json(account);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

router.get('/', async (req, res, next) => {
  try {
    const list = await transactionClient.GetUserAccounts({ user_id: req.user.id });
    res.json(list.accounts || []);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const account = await transactionClient.GetAccount({ account_id: req.params.id });
    res.json(account);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

export default router;
