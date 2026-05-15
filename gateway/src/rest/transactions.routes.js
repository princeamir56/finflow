import { Router } from 'express';
import { transactionClient } from '../config/grpc-clients.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { grpcErrorToHttp } from '../utils/grpc-error.js';

const router = Router();
router.use(authMiddleware);

router.post('/deposit', async (req, res, next) => {
  try {
    const { account_id, amount, description } = req.body || {};
    const tx = await transactionClient.Deposit({ account_id, amount, description });
    res.status(201).json(tx);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

router.post('/withdraw', async (req, res, next) => {
  try {
    const { account_id, amount, description } = req.body || {};
    const tx = await transactionClient.Withdraw({ account_id, amount, description });
    res.status(201).json(tx);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

router.post('/transfer', async (req, res, next) => {
  try {
    const { from_account_id, to_account_id, amount, description } = req.body || {};
    const tx = await transactionClient.Transfer({
      from_account_id,
      to_account_id,
      amount,
      description
    });
    res.status(201).json(tx);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

router.get('/account/:id', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const list = await transactionClient.GetHistory({
      account_id: req.params.id,
      limit,
      offset
    });
    res.json(list.transactions || []);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

export default router;
