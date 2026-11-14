import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { DocumentCategory } from '../models/Category';
import { StoredDocument } from '../models/DocumentModel';
import { User } from '../models/User';
import { DEFAULT_USER_ID } from '../scripts/bootstrap';

export const userSharedRouter = Router();

// 1. Categories
const CATEGORY_PALETTE = ['#6C47FF', '#4F46E5', '#7C3AED', '#2563EB', '#E11D48', '#059669', '#D97706', '#0D9488', '#EC4899', '#3B82F6'];

userSharedRouter.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await DocumentCategory.find({ isActive: { $ne: false } })
      .sort({ isSystemDefault: -1, name: 1 })
      .lean();
    const formatted = categories.map((c, index) => ({
      _id: c._id.toString(),
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      description: c.description || '',
      icon: c.icon || 'folder',
      color: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
      isSystemDefault: !!c.isSystemDefault,
      isActive: c.isActive !== false,
    }));
    return res.json({ success: true, categories: formatted, data: formatted });
  })
);

// 2. Folders
userSharedRouter.get(
  '/folders',
  asyncHandler(async (_req: Request, res: Response) => {
    return res.json({ success: true, folders: [] });
  })
);

// 3. Storage Info
userSharedRouter.get(
  '/storage/info',
  asyncHandler(async (_req: Request, res: Response) => {
    const user = await User.findOne({ status: { $ne: 'deleted' } });
    const docs = await StoredDocument.find({ status: { $ne: 'deleted' } }).lean();

    const totalBytes = docs.reduce((sum, d) => sum + (d.totalSizeBytes || 0), 0);
    const quotaBytes = 500 * 1024 * 1024; // 500 MB Free Plan
    const availableBytes = Math.max(0, quotaBytes - totalBytes);
    const usedPercentage = quotaBytes > 0 ? Number(((totalBytes / quotaBytes) * 100).toFixed(1)) : 0;

    return res.json({
      success: true,
      storage: {
        planName: 'Free',
        quotaBytes,
        usedBytes: totalBytes,
        availableBytes,
        usedPercentage,
        documentCount: docs.length,
        failedUploadCount: 0,
      },
    });
  })
);

// 4. Reminders
userSharedRouter.get(
  '/reminders',
  asyncHandler(async (_req: Request, res: Response) => {
    return res.json({ success: true, reminders: [] });
  })
);

// 5. Support Tickets
userSharedRouter.get(
  '/support/tickets',
  asyncHandler(async (_req: Request, res: Response) => {
    return res.json({ success: true, tickets: [] });
  })
);

