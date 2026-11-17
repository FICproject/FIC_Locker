export type PdfCategoryKey =
  | 'management'
  | 'editing'
  | 'convert_to'
  | 'convert_from'
  | 'security'
  | 'advanced';

export interface PdfToolItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: PdfCategoryKey;
  badge?: string;
  badgeColor?: string;
  circleColor: string;
  accentColor?: string;
  inputFormat: 'pdf' | 'images' | 'doc' | 'text' | 'any';
  allowMultipleFiles?: boolean;
}

export interface PdfCategoryGroup {
  key: PdfCategoryKey;
  title: string;
  description: string;
  tools: PdfToolItem[];
}

export interface SelectedFileItem {
  id: string;
  uri: string;
  name: string;
  sizeBytes: number;
  type: string;
  pageCount?: number;
  thumbnailUri?: string;
  isPdf?: boolean;
}

export interface PdfToolConfig {
  // Merge
  mergeOrder?: string[];
  // Split
  splitRange?: string; // e.g. "1-3, 5"
  splitMode?: 'ranges' | 'all' | 'custom';
  // Compress
  compressionLevel?: 'low' | 'medium' | 'high';
  // Rotate
  rotationAngle?: 90 | 180 | 270;
  rotationTarget?: 'all' | 'custom';
  selectedPageIndices?: number[];
  // Watermark
  watermarkText?: string;
  watermarkOpacity?: number;
  watermarkAngle?: 0 | 45 | 90;
  watermarkColor?: string;
  // Signature
  signatureUri?: string;
  signaturePosition?: 'bottom-right' | 'bottom-left' | 'center';
  // Text / Page Numbers
  customText?: string;
  textColor?: string;
  fontSize?: number;
  textPosition?: 'top' | 'center' | 'bottom';
  pageNumberFormat?: 'Page X of Y' | 'X / Y' | '#X';
  pageNumberPosition?: 'bottom-center' | 'bottom-right' | 'top-right';
  // Crop / Page size
  pageSize?: 'A4' | 'Letter' | 'A3' | 'Legal';
  cropMargin?: number;
  // Security
  password?: string;
  confirmPassword?: string;
  unlockPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  allowAnnotating?: boolean;
  signerName?: string;
  // OCR
  ocrLanguage?: string;
  // Custom Output Name
  outputFileName?: string;
}

export interface PdfProcessResult {
  success: boolean;
  fileUri: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: string;
  mimeType: string;
  pageCount: number;
  previewUri?: string;
  extractedText?: string;
  message?: string;
}
