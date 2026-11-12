import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, parsePagination, sendSuccess } from '../../utils/apiResponse';
import { StoredDocument, UploadSession } from '../../models/DocumentModel';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';
import { generatePresignedDocumentUrl } from '../../services/s3Service';

const router = Router();
router.use(authenticateAdmin);

const accessUrlSchema = z.object({
  mode: z.enum(['preview', 'download']),
  fileIndex: z.number().int().min(0).default(0),
  reason: z.string().min(3).max(300).optional(),
});

const issueResolutionSchema = z.object({
  status: z.enum(['available', 'failed', 'deleted']).optional(),
  operationalNotes: z.string().max(1000),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const search = String(req.query.search || '').trim();
    const userId = String(req.query.userId || '').trim();
    const categoryId = String(req.query.categoryId || '').trim();
    const status = String(req.query.status || '').trim();

    const filter: Record<string, unknown> = {};
    if (userId) filter.ownerId = userId;
    if (categoryId) filter.categoryId = categoryId;
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { documentType: { $regex: search, $options: 'i' } },
      ];
    }

    const [docs, total] = await Promise.all([
      StoredDocument.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ownerId', 'fullName email')
        .populate('categoryId', 'name')
        .lean(),
      StoredDocument.countDocuments(filter),
    ]);

    const items = docs.map((d) => {
      const owner = d.ownerId as unknown as { _id?: unknown; fullName?: string; email?: string } | null;
      const category = d.categoryId as unknown as { _id?: unknown; name?: string } | null;
      return {
        _id: d._id.toString(),
        ownerId: owner?._id ? String(owner._id) : String(d.ownerId),
        ownerName: owner?.fullName,
        ownerEmail: owner?.email,
        name: d.name,
        documentType: d.documentType,
        categoryId: category?._id ? String(category._id) : d.categoryId ? String(d.categoryId) : undefined,
        categoryName: category?.name,
        folderId: d.folderId ? String(d.folderId) : undefined,
        tags: d.tags,
        files: d.files,
        totalSizeBytes: d.totalSizeBytes,
        status: d.status,
        failureReason: d.failureReason,
        operationalNotes: d.operationalNotes,
        expiryDate: d.expiryDate,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
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
  '/failed-uploads',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const filter = { status: 'failed' };

    const [sessions, total] = await Promise.all([
      UploadSession.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email')
        .lean(),
      UploadSession.countDocuments(filter),
    ]);

    const items = sessions.map((s) => {
      const user = s.userId as unknown as { _id?: unknown; fullName?: string; email?: string } | null;
      return {
        _id: s._id.toString(),
        userId: user?._id ? String(user._id) : String(s.userId),
        userName: user?.fullName,
        userEmail: user?.email,
        documentId: s.documentId ? s.documentId.toString() : undefined,
        fileName: s.fileName,
        mimeType: s.mimeType,
        sizeBytes: s.sizeBytes,
        status: s.status,
        failureCategory: s.failureCategory || 'upload_error',
        failureMessage: s.failureMessage || 'Upload did not complete verification.',
        createdAt: s.createdAt,
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
  '/:documentId',
  asyncHandler(async (req, res) => {
    const doc = await StoredDocument.findById(req.params.documentId)
      .populate('ownerId', 'fullName email phone status')
      .populate('categoryId', 'name')
      .lean();

    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }

    const owner = doc.ownerId as unknown as { _id?: unknown; fullName?: string; email?: string } | null;
    const category = doc.categoryId as unknown as { _id?: unknown; name?: string } | null;

    return sendSuccess(res, {
      _id: doc._id.toString(),
      ownerId: owner?._id ? String(owner._id) : String(doc.ownerId),
      ownerName: owner?.fullName,
      ownerEmail: owner?.email,
      name: doc.name,
      documentType: doc.documentType,
      categoryId: category?._id ? String(category._id) : undefined,
      categoryName: category?.name,
      tags: doc.tags,
      files: doc.files,
      totalSizeBytes: doc.totalSizeBytes,
      status: doc.status,
      failureReason: doc.failureReason,
      operationalNotes: doc.operationalNotes,
      expiryDate: doc.expiryDate,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  })
);

router.post(
  '/:documentId/access-url',
  asyncHandler(async (req, res) => {
    const body = accessUrlSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const doc = await StoredDocument.findById(req.params.documentId);
    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }

    const fileEntry = doc.files[body.fileIndex];
    if (!fileEntry || !fileEntry.storageKey) {
      throw new HttpError(404, 'Requested document file entry does not have a valid storage key.');
    }

    const signed = await generatePresignedDocumentUrl({
      storageKey: fileEntry.storageKey,
      mode: body.mode,
      filename: fileEntry.originalFilename || doc.name,
      mimeType: fileEntry.mimeType,
    });

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: body.mode === 'download' ? 'DOCUMENT_DOWNLOADED' : 'DOCUMENT_PREVIEWED',
      entityType: 'document',
      entityId: doc._id.toString(),
      summary: `Admin requested ${body.mode} access for document "${doc.name}"`,
      metadata: {
        ownerId: doc.ownerId.toString(),
        fileIndex: body.fileIndex,
        mimeType: fileEntry.mimeType,
        reason: body.reason || 'Administrative review',
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, {
      url: signed.url,
      expiresInSeconds: signed.expiresInSeconds,
      mimeType: fileEntry.mimeType,
      filename: fileEntry.originalFilename || doc.name,
    });
  })
);

router.patch(
  '/:documentId/issue',
  asyncHandler(async (req, res) => {
    const body = issueResolutionSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const doc = await StoredDocument.findById(req.params.documentId);
    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }

    const previousStatus = doc.status;
    if (body.status) {
      doc.status = body.status;
      if (body.status === 'deleted') {
        doc.deletedAt = new Date();
      }
    }
    doc.operationalNotes = body.operationalNotes;
    await doc.save();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'DOCUMENT_OPERATIONAL_ACTION',
      entityType: 'document',
      entityId: doc._id.toString(),
      summary: `Updated operational issue on document "${doc.name}" (${previousStatus} -> ${doc.status})`,
      metadata: { previousStatus, newStatus: doc.status, operationalNotes: body.operationalNotes },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { _id: doc._id.toString(), status: doc.status, operationalNotes: doc.operationalNotes });
  })
);

export default router;

