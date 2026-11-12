import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { adminEventBus, AdminChangeEvent } from '../../services/adminEventBus';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();
router.use(authenticateAdmin);

router.get('/version', (_req, res) => {
  return sendSuccess(res, adminEventBus.getState());
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const initial = adminEventBus.getState();
  res.write(`event: init\ndata: ${JSON.stringify(initial)}\n\n`);

  const onChange = (evt: AdminChangeEvent) => {
    res.write(`event: change\ndata: ${JSON.stringify(evt)}\n\n`);
  };

  adminEventBus.on('change', onChange);
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    adminEventBus.off('change', onChange);
  });
});

export default router;

