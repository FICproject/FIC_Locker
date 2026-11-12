import mongoose, { Schema, Document } from 'mongoose';

export interface IDocumentCategory extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  isSystemDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentCategorySchema = new Schema<IDocumentCategory>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    description: { type: String, trim: true },
    icon: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    isSystemDefault: { type: Boolean, default: false },
  },
  { collection: 'document_categories', timestamps: true }
);

export const DocumentCategory = mongoose.model<IDocumentCategory>('DocumentCategory', DocumentCategorySchema);

