import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, parsePagination, sendSuccess } from '../../utils/apiResponse';
import { AuditLog } from '../../models/AuditLog';

const router = Router();
router.use(authenticateAdmin);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const action = String(req.query.action || '').trim();
    const entityType = String(req.query.entityType || '').trim();
    const sourceApp = String(req.query.sourceApp || '').trim();
    const search = String(req.query.search || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const filter: Record<string, unknown> = {};
    if (action && action !== 'all') filter.action = action;
    if (entityType && entityType !== 'all') filter.entityType = entityType;
    if (sourceApp && sourceApp !== 'all') filter.sourceApp = sourceApp;
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      filter.createdAt = range;
    }
    if (search) {
      filter.$or = [
        { summary: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { entityId: { $regex: search, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return sendSuccess(
      res,
      logs.map((l) => ({
        ...l,
        _id: l._id.toString(),
        actorId: l.actorId.toString(),
      })),
      undefined,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      }
    );
  })
);

export default router;

