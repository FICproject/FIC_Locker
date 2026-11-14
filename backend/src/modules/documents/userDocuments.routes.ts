import { Router, Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { asyncHandler, HttpError } from '../../utils/apiResponse';
import { StoredDocument } from '../../models/DocumentModel';
import { DocumentCategory } from '../../models/Category';
import { User } from '../../models/User';
import { DEFAULT_USER_ID } from '../../scripts/bootstrap';

export const userDocumentsRouter = Router();

async function resolveCurrentUser(): Promise<any> {
  let user = await User.findOne({ status: { $ne: 'deleted' } });
  if (!user) {
    user = await User.create({
      _id: DEFAULT_USER_ID,
      fullName: 'Dhanu Sri',
      email: 'dhanu.sri@gmail.com',
      status: 'active',
      isEmailVerified: true,
      storageUsedBytes: 0,
      totalDocuments: 0,
    });
  }
  return user;
}

function formatDocument(doc: any) {
  const isPdf =
    doc.documentType === 'pdf' ||
    doc.files?.[0]?.mimeType?.includes('pdf') ||
    doc.name.toLowerCase().endsWith('.pdf');
  const isImage =
    doc.name.toLowerCase().endsWith('.png') ||
    doc.name.toLowerCase().endsWith('.jpg') ||
    doc.name.toLowerCase().endsWith('.jpeg');
  const fileType = isPdf ? 'pdf' : (isImage ? 'jpg' : 'other');

  let categoryName = 'Personal Documents';
  if (doc.categoryId && typeof doc.categoryId === 'object' && doc.categoryId.name) {
    categoryName = doc.categoryId.name;
  } else if (typeof doc.categoryId === 'string') {
    categoryName = doc.categoryId;
  }

  return {
    _id: doc._id.toString(),
    userId: doc.ownerId ? doc.ownerId.toString() : 'usr_default',
    name: doc.name,
    originalFileName: doc.files?.[0]?.originalFilename || doc.name,
    fileType,
    mimeType: doc.files?.[0]?.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
    fileSizeBytes: doc.totalSizeBytes || doc.files?.[0]?.sizeBytes || 1572864,
    storageKey: doc.files?.[0]?.storageKey || `documents/${doc.name}`,
    category: categoryName,
    folderId: doc.folderId ? doc.folderId.toString() : null,
    tags: doc.tags || [],
    notes: doc.notes || doc.operationalNotes || '',
    expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString() : undefined,
    isFavourite: !!doc.isFavourite,
    isArchived: !!doc.isArchived,
    status: doc.status === 'draft' ? 'pending' : (doc.status || 'available'),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

const uploadAuthSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileSizeBytes: z.number().min(1).default(1572864),
  mimeType: z.string().default('image/jpeg'),
  category: z.string().optional().default('Personal Documents'),
  tags: z.array(z.string()).optional().default([]),
  folderId: z.string().nullable().optional(),
  notes: z.string().optional(),
  expiryDate: z.string().optional(),
});

// 1. Request Upload Authorization
userDocumentsRouter.post(
  '/upload-auth',
  asyncHandler(async (req: Request, res: Response) => {
    const body = uploadAuthSchema.parse(req.body);
    const user = await resolveCurrentUser();

    // Resolve or find Category
    let category = await DocumentCategory.findOne({
      $or: [{ name: body.category }, { slug: body.category.toLowerCase().replace(/\s+/g, '-') }],
    });
    if (!category && body.category) {
      category = await DocumentCategory.findOne({});
    }

    const fileExt = body.fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const isPdf = fileExt === 'pdf' || body.mimeType.includes('pdf');
    const docId = new mongoose.Types.ObjectId();
    const storageKey = `documents/${docId.toString()}-${body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const doc = await StoredDocument.create({
      _id: docId,
      ownerId: user._id,
      name: body.fileName,
      documentType: isPdf ? 'pdf' : fileExt,
      categoryId: category?._id || null,
      folderId: body.folderId ? new mongoose.Types.ObjectId(body.folderId) : null,
      tags: body.tags || [],
      files: [
        {
          storageKey,
          mimeType: body.mimeType,
          sizeBytes: body.fileSizeBytes,
          originalFilename: body.fileName,
          pageCount: 1,
        },
      ],
      totalSizeBytes: body.fileSizeBytes,
      status: 'available',
      notes: body.notes,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
    });

    await User.findByIdAndUpdate(user._id, {
      $inc: { storageUsedBytes: body.fileSizeBytes, totalDocuments: 1 },
    });

    const host = req.get('host') || 'localhost:5000';
    return res.json({
      success: true,
      uploadUrl: `http://${host}/api/v1/documents/upload-payload`,
      storageKey,
      documentId: doc._id.toString(),
      headers: {},
      expiresInSeconds: 3600,
      document: formatDocument(doc),
    });
  })
);

// 2. Confirm Upload
userDocumentsRouter.post(
  '/:id/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await StoredDocument.findById(req.params.id).populate('categoryId');
    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }
    doc.status = 'available';
    await doc.save();

    return res.json({
      success: true,
      document: formatDocument(doc),
    });
  })
);

// 3. List Documents
userDocumentsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { search, fileType, category, isFavourite, isArchived, folderId } = req.query;

    const filter: Record<string, unknown> = {
      status: { $ne: 'deleted' },
    };

    if (search && typeof search === 'string' && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    if (String(isFavourite) === 'true') {
      filter.isFavourite = true;
    }

    if (String(isArchived) === 'true') {
      filter.isArchived = true;
    } else if (String(isArchived) === 'false') {
      filter.isArchived = { $ne: true };
    }

    if (folderId && typeof folderId === 'string') {
      filter.folderId = folderId;
    }

    const docs = await StoredDocument.find(filter)
      .sort({ createdAt: -1 })
      .populate('categoryId', 'name')
      .lean();

    let items = docs.map(formatDocument);

    if (fileType && typeof fileType === 'string') {
      const targetType = fileType.toLowerCase();
      if (targetType === 'pdf') {
        items = items.filter((d) => d.fileType === 'pdf');
      } else if (targetType === 'jpg' || targetType === 'images' || targetType === 'image') {
        items = items.filter((d) => d.fileType === 'jpg' || d.fileType === 'png' || d.fileType === 'jpeg');
      } else if (targetType === 'others') {
        items = items.filter((d) => d.fileType !== 'pdf' && d.fileType !== 'jpg' && d.fileType !== 'png');
      }
    }

    if (category && typeof category === 'string' && category.trim()) {
      items = items.filter((d) => d.category.toLowerCase().includes((category as string).toLowerCase()));
    }

    return res.json({
      success: true,
      documents: items,
      total: items.length,
    });
  })
);

// 4. Get Document By ID
userDocumentsRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await StoredDocument.findById(req.params.id).populate('categoryId');
    if (!doc || doc.status === 'deleted') {
      throw new HttpError(404, 'Document not found.');
    }
    return res.json({
      success: true,
      document: formatDocument(doc),
    });
  })
);

// 5. Toggle Favourite
userDocumentsRouter.patch(
  '/:id/favourite',
  asyncHandler(async (req: Request, res: Response) => {
    const { isFavourite } = req.body;
    const doc = await StoredDocument.findByIdAndUpdate(
      req.params.id,
      { $set: { isFavourite: !!isFavourite } },
      { new: true }
    ).populate('categoryId');

    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }
    return res.json({
      success: true,
      document: formatDocument(doc),
    });
  })
);

// 6. Archive Document
userDocumentsRouter.patch(
  '/:id/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await StoredDocument.findByIdAndUpdate(
      req.params.id,
      { $set: { isArchived: true } },
      { new: true }
    ).populate('categoryId');

    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }
    return res.json({
      success: true,
      document: formatDocument(doc),
    });
  })
);

// 7. Restore Document
userDocumentsRouter.patch(
  '/:id/restore',
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await StoredDocument.findByIdAndUpdate(
      req.params.id,
      { $set: { isArchived: false } },
      { new: true }
    ).populate('categoryId');

    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }
    return res.json({
      success: true,
      document: formatDocument(doc),
    });
  })
);

// 8. Move Document
userDocumentsRouter.patch(
  '/:id/move',
  asyncHandler(async (req: Request, res: Response) => {
    const { folderId } = req.body;
    const doc = await StoredDocument.findByIdAndUpdate(
      req.params.id,
      { $set: { folderId: folderId ? new mongoose.Types.ObjectId(folderId) : null } },
      { new: true }
    ).populate('categoryId');

    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }
    return res.json({
      success: true,
      document: formatDocument(doc),
    });
  })
);

// 9. Delete Document
userDocumentsRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await StoredDocument.findById(req.params.id);
    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }
    doc.status = 'deleted';
    doc.deletedAt = new Date();
    await doc.save();

    await User.findByIdAndUpdate(doc.ownerId, {
      $inc: { totalDocuments: -1 },
    });

    return res.json({
      success: true,
      message: 'Document deleted successfully.',
    });
  })
);

// 10. Download URL
userDocumentsRouter.get(
  '/:id/download',
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await StoredDocument.findById(req.params.id);
    if (!doc || doc.status === 'deleted') {
      throw new HttpError(404, 'Document not found.');
    }
    const host = req.get('host') || 'localhost:5000';
    return res.json({
      success: true,
      downloadUrl: `http://${host}/api/v1/documents/${doc._id}/preview`,
      expiresInSeconds: 3600,
    });
  })
);
