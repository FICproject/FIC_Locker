import { Router, Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { asyncHandler, HttpError } from '../../utils/apiResponse';
import { StoredDocument } from '../../models/DocumentModel';
import { DocumentCategory } from '../../models/Category';
import { User } from '../../models/User';
import { DEFAULT_USER_ID } from '../../scripts/bootstrap';

export const userDocumentsRouter = Router();

import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

async function resolveCurrentUser(req?: Request): Promise<any> {
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7).trim();
      const secret = env.jwtAdminAccessSecret || 'user_jwt_secret_doc_scanner_saas';
      const decoded = jwt.verify(token, secret) as any;
      if (decoded?.sub) {
        const u = await User.findById(decoded.sub);
        if (u) return u;
      }
    } catch {}
  }

  let user = await User.findOne({ status: { $ne: 'deleted' } });
  if (!user) {
    user = await User.create({
      _id: DEFAULT_USER_ID,
      fullName: 'User',
      email: 'user@ficlocker.com',
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
    ocrText: doc.ocrText || '',
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
  ocrText: z.string().optional(),
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
      $or: [
        { name: { $regex: new RegExp(`^${body.category.trim()}$`, 'i') } },
        { slug: body.category.toLowerCase().replace(/\s+/g, '-') },
      ],
    });
    if (!category && body.category?.trim()) {
      const catSlug = body.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      category = await DocumentCategory.create({
        name: body.category.trim(),
        slug: catSlug || `cat-${Date.now()}`,
        description: `${body.category.trim()} documents`,
        icon: 'folder',
      });
    }

    const fileExt = body.fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const isPdf = fileExt === 'pdf' || body.mimeType.includes('pdf');
    const docId = new mongoose.Types.ObjectId();
    const storageKey = `documents/${docId.toString()}-${body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Prevent duplicate documents: If a document with this name already exists for this user, reuse and update it
    const existingDoc = await StoredDocument.findOne({
      ownerId: user._id,
      name: body.fileName,
      status: { $ne: 'deleted' },
    });

    const host = req.get('host') || 'localhost:5000';

    if (existingDoc) {
      existingDoc.categoryId = category?._id || existingDoc.categoryId;
      if (body.folderId) existingDoc.folderId = new mongoose.Types.ObjectId(body.folderId);
      if (body.tags?.length) existingDoc.tags = body.tags;
      if (body.fileSizeBytes) existingDoc.totalSizeBytes = body.fileSizeBytes;
      if (body.notes) existingDoc.notes = body.notes;
      if (body.ocrText) existingDoc.ocrText = body.ocrText;
      existingDoc.status = 'available';
      await existingDoc.save();

      return res.json({
        success: true,
        documentId: existingDoc._id.toString(),
        storageKey: existingDoc.files?.[0]?.storageKey || storageKey,
        uploadUrl: `http://${host}/api/v1/documents/${existingDoc._id.toString()}/upload-binary`,
        fields: {},
        expiresIn: 3600,
      });
    }

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
      ocrText: body.ocrText || '',
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
    });

    await User.findByIdAndUpdate(user._id, {
      $inc: { storageUsedBytes: body.fileSizeBytes, totalDocuments: 1 },
    });

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
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
        { ocrText: { $regex: q, $options: 'i' } },
      ];
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

    // Deduplicate items so each document is returned only a single time
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    const uniqueItems: typeof items = [];
    for (const item of items) {
      const normName = (item.name || '').trim().toLowerCase().replace(/\.[a-zA-Z0-9]+$/, '');
      if (!seenIds.has(item._id) && (!normName || !seenNames.has(normName))) {
        seenIds.add(item._id);
        if (normName) seenNames.add(normName);
        uniqueItems.push(item);
      }
    }
    items = uniqueItems;

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

// 8b. Rename Document
userDocumentsRouter.patch(
  '/:id/rename',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new HttpError(400, 'Valid document name is required.');
    }
    const doc = await StoredDocument.findByIdAndUpdate(
      req.params.id,
      { $set: { name: name.trim() } },
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

// 8c. Update Document OCR Text
userDocumentsRouter.patch(
  '/:id/ocr',
  asyncHandler(async (req: Request, res: Response) => {
    const { ocrText } = req.body;
    const doc = await StoredDocument.findByIdAndUpdate(
      req.params.id,
      { $set: { ocrText: String(ocrText || '') } },
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

// 11. Sample File Preview / Download for Admin or Client
userDocumentsRouter.get('/sample-file/:filename', (req: Request, res: Response) => {
  const filename = String(req.params.filename || 'document.pdf');
  res.setHeader('Content-Type', filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  const minimalPdf =
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF';
  res.send(Buffer.from(minimalPdf));
});
