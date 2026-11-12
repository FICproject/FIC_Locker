import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, parsePagination, sendSuccess } from '../../utils/apiResponse';
import { SupportTicket } from '../../models/SupportTicket';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';

const router = Router();
router.use(authenticateAdmin);

const updateTicketSchema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  assignedTo: z.string().max(100).optional(),
  resolutionNotes: z.string().max(2000).optional(),
});

const replySchema = z.object({
  message: z.string().min(1).max(2000),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
});

router.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const status = String(req.query.status || '').trim();
    const priority = String(req.query.priority || '').trim();
    const search = String(req.query.search || '').trim();

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (search) {
      filter.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email')
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);

    const items = tickets.map((t) => {
      const user = t.userId as unknown as { _id?: unknown; fullName?: string; email?: string } | null;
      return {
        ...t,
        _id: t._id.toString(),
        userId: user?._id ? String(user._id) : String(t.userId),
        userName: user?.fullName,
        userEmail: user?.email,
      };
    });

    return sendSuccess(res, items, undefined, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  })
);

router.get(
  '/tickets/:ticketId',
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.ticketId)
      .populate('userId', 'fullName email phone status')
      .lean();
    if (!ticket) {
      throw new HttpError(404, 'Support ticket not found.');
    }

    const user = ticket.userId as unknown as { _id?: unknown; fullName?: string; email?: string } | null;
    return sendSuccess(res, {
      ...ticket,
      _id: ticket._id.toString(),
      userId: user?._id ? String(user._id) : String(ticket.userId),
      userName: user?.fullName,
      userEmail: user?.email,
    });
  })
);

router.patch(
  '/tickets/:ticketId',
  asyncHandler(async (req, res) => {
    const body = updateTicketSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.ticketId,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!ticket) {
      throw new HttpError(404, 'Support ticket not found.');
    }

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'SUPPORT_TICKET_UPDATED',
      entityType: 'support_ticket',
      entityId: ticket._id.toString(),
      summary: `Updated ticket ${ticket.ticketNumber} (${Object.keys(body).join(', ')})`,
      metadata: body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { ...ticket.toObject(), _id: ticket._id.toString() });
  })
);

router.post(
  '/tickets/:ticketId/reply',
  asyncHandler(async (req, res) => {
    const body = replySchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) {
      throw new HttpError(404, 'Support ticket not found.');
    }

    ticket.replies.push({
      senderRole: 'admin',
      senderName: admin.name,
      message: body.message,
      createdAt: new Date(),
    });
    if (body.status) {
      ticket.status = body.status;
    } else if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    await ticket.save();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'SUPPORT_TICKET_REPLIED',
      entityType: 'support_ticket',
      entityId: ticket._id.toString(),
      summary: `Replied to support ticket ${ticket.ticketNumber}`,
      metadata: { status: ticket.status },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { ...ticket.toObject(), _id: ticket._id.toString() });
  })
);

export default router;

