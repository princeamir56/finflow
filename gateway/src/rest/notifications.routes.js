import { Router } from 'express';
import { notificationClient } from '../config/grpc-clients.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { grpcErrorToHttp } from '../utils/grpc-error.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const list = await notificationClient.GetUserNotifications({
      user_id: req.user.id,
      limit,
      offset
    });
    res.json(list.notifications || []);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const notif = await notificationClient.MarkAsRead({
      notification_id: req.params.id,
      user_id: req.user.id
    });
    res.json(notif);
  } catch (err) {
    next(grpcErrorToHttp(err));
  }
});

export default router;
