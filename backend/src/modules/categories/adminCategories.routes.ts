import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, sendSuccess } from '../../utils/apiResponse';
import { DocumentCategory } from '../../models/Category';
import { StoredDocument } from '../../models/DocumentModel';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';

const router = Router();
router.use(authenticateAdmin);

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  icon: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [categories, docCounts] = await Promise.all([
      DocumentCategory.find({}).sort({ name: 1 }).lean(),
      StoredDocument.aggregate([
        { $match: { status: { $ne: 'deleted' }, categoryId: { $ne: null } } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map(docCounts.map((c) => [String(c._id), c.count as number]));

    return sendSuccess(
      res,
      categories.map((c) => ({
        ...c,
        _id: c._id.toString(),
        documentCount: countMap.get(c._id.toString()) || 0,
      }))
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const category = await DocumentCategory.create({
      name: body.name,
      slug: toSlug(body.name),
      description: body.description,
      icon: body.icon,
      isActive: body.isActive,
      isSystemDefault: false,
    });

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'CATEGORY_CREATED',
      entityType: 'category',
      entityId: category._id.toString(),
      summary: `Created category "${category.name}"`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { ...category.toObject(), _id: category._id.toString(), documentCount: 0 }, 'Category created.', undefined, 201);
  })
);

router.patch(
  '/:categoryId',
  asyncHandler(async (req, res) => {
    const body = categorySchema.partial().parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const update: Record<string, unknown> = { ...body };
    if (body.name) {
      update.slug = toSlug(body.name);
    }

    const category = await DocumentCategory.findByIdAndUpdate(
      req.params.categoryId,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!category) {
      throw new HttpError(404, 'Category not found.');
    }

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'CATEGORY_UPDATED',
      entityType: 'category',
      entityId: category._id.toString(),
      summary: `Updated category "${category.name}"`,
      metadata: body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { ...category.toObject(), _id: category._id.toString() });
  })
);

router.delete(
  '/:categoryId',
  asyncHandler(async (req, res) => {
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const category = await DocumentCategory.findById(req.params.categoryId);
    if (!category) {
      throw new HttpError(404, 'Category not found.');
    }

    const linkedDocs = await StoredDocument.countDocuments({
      categoryId: category._id,
      status: { $ne: 'deleted' },
    });
    if (linkedDocs > 0) {
      throw new HttpError(
        409,
        `Cannot delete category "${category.name}" while ${linkedDocs} active document(s) reference it. Deactivate it instead.`
      );
    }

    await category.deleteOne();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'CATEGORY_DELETED',
      entityType: 'category',
      entityId: String(req.params.categoryId),
      summary: `Deleted category "${category.name}"`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { deleted: true }, 'Category deleted.');
  })
);

export default router;
