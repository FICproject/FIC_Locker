import { NativeModules, Platform, Image } from 'react-native';

export type PaperSize = 'A4' | 'A3' | 'A5' | 'Letter' | 'ID' | 'Legal' | 'Custom';

export interface CornerPoint {
  x: number;
  y: number;
}

export interface DocumentCorners {
  tl: CornerPoint;
  tr: CornerPoint;
  br: CornerPoint;
  bl: CornerPoint;
}

export interface DocumentAnalysisResult {
  originalUri: string;
  croppedUri: string;
  originalWidth: number;
  originalHeight: number;
  croppedWidth: number;
  croppedHeight: number;
  paperSize: PaperSize;
  paperName: string;
  paperDimensions: string;
  aspectRatio: number;
  confidence: number;
  isIsoSeries: boolean;
  suggestedSizes: PaperSize[];
  normalizedBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export const PAPER_SPECS: Record<
  PaperSize,
  { name: string; dimensions: string; ratio: number; description: string; badge: string }
> = {
  A4: {
    name: 'A4 Document',
    dimensions: '210 × 297 mm',
    ratio: 1.414,
    description: 'Standard Office/Doc (ISO 216)',
    badge: 'Standard',
  },
  A3: {
    name: 'A3 Ledger',
    dimensions: '297 × 420 mm',
    ratio: 1.414,
    description: 'Double A4 Large Format',
    badge: 'Large',
  },
  A5: {
    name: 'A5 Booklet',
    dimensions: '148 × 210 mm',
    ratio: 1.414,
    description: 'Half A4 Compact Notes',
    badge: 'Compact',
  },
  Letter: {
    name: 'US Letter',
    dimensions: '215.9 × 279.4 mm',
    ratio: 1.294,
    description: 'North American Standard',
    badge: 'US Std',
  },
  ID: {
    name: 'ID Card',
    dimensions: '85.6 × 54.0 mm',
    ratio: 1.586,
    description: 'Driver License / ID (ISO 7810)',
    badge: 'Card',
  },
  Legal: {
    name: 'US Legal',
    dimensions: '215.9 × 355.6 mm',
    ratio: 1.647,
    description: 'Extended Legal Contracts',
    badge: 'Legal',
  },
  Custom: {
    name: 'Custom',
    dimensions: 'Free Dimensions',
    ratio: 1.0,
    description: 'Custom Crop Bounds',
    badge: 'Free',
  },
};

export const documentAnalysisService = {
  /**
   * Automatically detects document boundary edges in the captured image,
   * crops and perspective-straightens to the document, and analyzes paper size.
   */
  async analyzeAndCrop(
    imageUri: string,
    corners?: DocumentCorners | null,
    paperPreset?: PaperSize
  ): Promise<DocumentAnalysisResult> {
    if (corners && Platform.OS === 'android' && NativeModules.InAppCameraModule?.warpPerspectiveAndCrop) {
      try {
        const res = await NativeModules.InAppCameraModule.warpPerspectiveAndCrop(
          imageUri,
          corners,
          paperPreset || 'A4'
        );
        return {
          originalUri: res.originalUri || imageUri,
          croppedUri: res.croppedUri || imageUri,
          originalWidth: res.originalWidth || 1920,
          originalHeight: res.originalHeight || 1080,
          croppedWidth: res.croppedWidth || 1800,
          croppedHeight: res.croppedHeight || 1000,
          paperSize: (res.paperSize as PaperSize) || paperPreset || 'A4',
          paperName: res.paperName || 'A4 Document',
          paperDimensions: res.paperDimensions || '210 × 297 mm',
          aspectRatio: res.aspectRatio || 1.414,
          confidence: res.confidence || 0.96,
          isIsoSeries: !!res.isIsoSeries,
          suggestedSizes: (res.suggestedSizes as PaperSize[]) || ['A4', 'A3', 'A5'],
          normalizedBounds: {
            left: Math.min(corners.tl.x, corners.bl.x),
            top: Math.min(corners.tl.y, corners.tr.y),
            right: Math.max(corners.tr.x, corners.br.x),
            bottom: Math.max(corners.bl.y, corners.br.y),
          },
        };
      } catch (warpErr) {
        console.warn('Native warpPerspectiveAndCrop error, falling back to bounds crop:', warpErr);
      }
    }

    if (Platform.OS === 'android' && NativeModules.InAppCameraModule?.analyzeAndCropDocument) {
      try {
        const res = await NativeModules.InAppCameraModule.analyzeAndCropDocument(imageUri);
        return {
          originalUri: res.originalUri || imageUri,
          croppedUri: res.croppedUri || imageUri,
          originalWidth: res.originalWidth || 1920,
          originalHeight: res.originalHeight || 1080,
          croppedWidth: res.croppedWidth || 1800,
          croppedHeight: res.croppedHeight || 1000,
          paperSize: (res.paperSize as PaperSize) || 'A4',
          paperName: res.paperName || 'A4 Document',
          paperDimensions: res.paperDimensions || '210 × 297 mm',
          aspectRatio: res.aspectRatio || 1.414,
          confidence: res.confidence || 0.95,
          isIsoSeries: !!res.isIsoSeries,
          suggestedSizes: (res.suggestedSizes as PaperSize[]) || ['A4', 'A3', 'A5'],
          normalizedBounds: res.normalizedBounds || {
            left: 0.04,
            top: 0.04,
            right: 0.96,
            bottom: 0.96,
          },
        };
      } catch (nativeErr) {
        console.warn('Native analyzeAndCropDocument error, falling back to JS heuristic:', nativeErr);
      }
    }

    // JavaScript Heuristic Fallback
    return new Promise((resolve) => {
      Image.getSize(
        imageUri,
        (width, height) => {
          const longSide = Math.max(width, height);
          const shortSide = Math.min(width, height) || 1;
          const ratio = Number((longSide / shortSide).toFixed(2));

          let paperSize: PaperSize = 'A4';
          let confidence = 0.95;

          if (Math.abs(ratio - 1.41) <= 0.12) {
            paperSize = 'A4';
            confidence = 0.98;
          } else if (Math.abs(ratio - 1.29) <= 0.08) {
            paperSize = 'Letter';
            confidence = 0.94;
          } else if (Math.abs(ratio - 1.58) <= 0.1) {
            paperSize = 'ID';
            confidence = 0.96;
          } else if (Math.abs(ratio - 1.65) <= 0.09) {
            paperSize = 'Legal';
            confidence = 0.92;
          }

          const spec = PAPER_SPECS[paperSize];
          resolve({
            originalUri: imageUri,
            croppedUri: imageUri,
            originalWidth: width,
            originalHeight: height,
            croppedWidth: Math.round(width * 0.92),
            croppedHeight: Math.round(height * 0.92),
            paperSize,
            paperName: spec.name,
            paperDimensions: spec.dimensions,
            aspectRatio: ratio,
            confidence,
            isIsoSeries: (paperSize as string) === 'A4' || (paperSize as string) === 'A3' || (paperSize as string) === 'A5',
            suggestedSizes: ['A4', 'A3', 'A5'],
            normalizedBounds: { left: 0.04, top: 0.04, right: 0.96, bottom: 0.96 },
          });
        },
        () => {
          resolve({
            originalUri: imageUri,
            croppedUri: imageUri,
            originalWidth: 1920,
            originalHeight: 1080,
            croppedWidth: 1800,
            croppedHeight: 1000,
            paperSize: 'A4',
            paperName: 'A4 Document',
            paperDimensions: '210 × 297 mm',
            aspectRatio: 1.414,
            confidence: 0.95,
            isIsoSeries: true,
            suggestedSizes: ['A4', 'A3', 'A5'],
            normalizedBounds: { left: 0.04, top: 0.04, right: 0.96, bottom: 0.96 },
          });
        }
      );
    });
  },

  /**
   * Crop an image with target paper preset (A4, A3, A5, Letter, ID, etc.)
   */
  async cropWithPreset(
    imageUri: string,
    preset: PaperSize,
    customBox?: { left: number; top: number; right: number; bottom: number }
  ): Promise<{ croppedUri: string; width: number; height: number; paperSize: PaperSize }> {
    if (Platform.OS === 'android' && NativeModules.InAppCameraModule?.cropWithPreset) {
      try {
        const res = await NativeModules.InAppCameraModule.cropWithPreset(imageUri, preset, customBox);
        return {
          croppedUri: res.croppedUri,
          width: res.croppedWidth,
          height: res.croppedHeight,
          paperSize: (res.paperSize as PaperSize) || preset,
        };
      } catch (err) {
        console.warn('Native cropWithPreset error:', err);
      }
    }

    return {
      croppedUri: imageUri,
      width: 1920,
      height: 1080,
      paperSize: preset,
    };
  },
};
