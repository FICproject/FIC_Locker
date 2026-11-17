import { DocumentItem } from '../types';

/**
 * Normalizes document name for deduplication comparison:
 * e.g. "Ajj.pdf" -> "ajj", "Ajj" -> "ajj", " My Document .jpg " -> "my document"
 */
export const normalizeDocName = (name: string): string => {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\.(pdf|jpe?g|png|docx?|xlsx?|txt|zip)$/i, '')
    .trim();
};

/**
 * Checks if an ID is a permanent 24-character hex MongoDB ObjectId
 */
export const isMongoObjectId = (id?: string): boolean => {
  if (!id) return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Deduplicates an array of documents so each document is shown ONLY A SINGLE TIME.
 * It matches duplicates by:
 * 1. Exact _id
 * 2. Normalized name (e.g. "Ajj" and "Ajj.pdf")
 * 3. Exact localUri or storageKey
 *
 * When duplicates are merged:
 * - Prefers permanent server Mongo ObjectId over temporary doc_local_ IDs
 * - Preserves localUri and thumbnailUrl for instant local preview
 * - Preserves the latest updatedAt / createdAt
 */
export const deduplicateDocuments = <T extends Partial<DocumentItem>>(docs: T[]): T[] => {
  if (!Array.isArray(docs) || docs.length === 0) return [];

  const seenIds = new Set<string>();
  const seenNormNames = new Set<string>();
  const seenKeys = new Set<string>();
  const uniqueDocs: T[] = [];

  for (const doc of docs) {
    if (!doc) continue;

    const docId = (doc._id || '').trim();
    const rawName = doc.name || doc.originalFileName || '';
    const normName = normalizeDocName(rawName);
    const storageKey = (doc.storageKey || '').trim();
    const localUri = (doc.localUri || '').trim();

    // 1. Direct ID match
    if (docId && seenIds.has(docId)) {
      continue;
    }

    // 2. Normalized Name match (e.g., "Ajj" and "Ajj" or "Ajj.pdf")
    if (normName && seenNormNames.has(normName)) {
      const existing = uniqueDocs.find(
        (d) => normalizeDocName(d.name || d.originalFileName || '') === normName
      );
      if (existing) {
        // Upgrade temporary ID to real server ObjectId if available
        if (!isMongoObjectId(existing._id) && isMongoObjectId(doc._id)) {
          existing._id = doc._id;
          if (doc.storageKey) existing.storageKey = doc.storageKey;
          if (doc.status) existing.status = doc.status;
        }
        // Preserve localUri if existing doesn't have one
        if (!existing.localUri && doc.localUri) {
          existing.localUri = doc.localUri;
        }
        // Preserve thumbnailUrl if existing doesn't have one
        if (!existing.thumbnailUrl && doc.thumbnailUrl) {
          existing.thumbnailUrl = doc.thumbnailUrl;
        }
        // Preserve downloadUrl
        if (!existing.downloadUrl && doc.downloadUrl) {
          existing.downloadUrl = doc.downloadUrl;
        }
      }
      continue;
    }

    // 3. Exact storage key match
    if (storageKey && storageKey !== 'offline_pdf' && seenKeys.has(storageKey)) {
      continue;
    }

    // 4. Exact local URI match
    if (localUri && seenKeys.has(localUri)) {
      continue;
    }

    // Mark as seen
    if (docId) seenIds.add(docId);
    if (normName) seenNormNames.add(normName);
    if (storageKey && storageKey !== 'offline_pdf') seenKeys.add(storageKey);
    if (localUri) seenKeys.add(localUri);

    uniqueDocs.push({ ...doc });
  }

  return uniqueDocs;
};
