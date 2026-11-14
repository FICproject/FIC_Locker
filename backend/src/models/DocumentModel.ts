import mongoose, { Schema, Document } from 'mongoose';

export interface IDocumentFileEntry {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  pageCount?: number;
  originalFilename?: string;
}

export interface IStoredDocument extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  documentType?: string;
  categoryId?: mongoose.Types.ObjectId | null;
  folderId?: mongoose.Types.ObjectId | null;
  tags: string[];
  files: IDocumentFileEntry[];
  totalSizeBytes: number;
  status: 'draft' | 'upload_pending' | 'uploading' | 'verifying' | 'available' | 'failed' | 'deleted';
  failureReason?: string;
  operationalNotes?: string;
  notes?: string;
  isFavourite?: boolean;
  isArchived?: boolean;
  expiryDate?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentFileEntrySchema = new Schema<IDocumentFileEntry>(
  {
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, default: 0 },
    checksum: { type: String },
    pageCount: { type: Number, default: 1 },
    originalFilename: { type: String },
  },
  { _id: false }
);

const StoredDocumentSchema = new Schema<IStoredDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    documentType: { type: String, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'DocumentCategory', default: null, index: true },
    folderId: { type: Schema.Types.ObjectId, default: null },
    tags: { type: [String], default: [] },
    files: { type: [DocumentFileEntrySchema], default: [] },
    totalSizeBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'upload_pending', 'uploading', 'verifying', 'available', 'failed', 'deleted'],
      default: 'upload_pending',
      index: true,
    },
    failureReason: { type: String },
    operationalNotes: { type: String },
    notes: { type: String },
    isFavourite: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    expiryDate: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { collection: 'documents', timestamps: true }
);

StoredDocumentSchema.index({ ownerId: 1, createdAt: -1 });
StoredDocumentSchema.index({ ownerId: 1, categoryId: 1 });

export const StoredDocument = mongoose.model<IStoredDocument>('StoredDocument', StoredDocumentSchema);

export interface IUploadSession extends Document {
  userId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId | null;
  storageKey?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  status: 'pending' | 'uploading' | 'verifying' | 'completed' | 'failed';
  failureCategory?: string;
  failureMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UploadSessionSchema = new Schema<IUploadSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'StoredDocument', default: null },
    storageKey: { type: String },
    fileName: { type: String },
    mimeType: { type: String },
    sizeBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'uploading', 'verifying', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    failureCategory: { type: String },
    failureMessage: { type: String },
  },
  { collection: 'upload_sessions', timestamps: true }
);

export const UploadSession = mongoose.model<IUploadSession>('UploadSession', UploadSessionSchema);

