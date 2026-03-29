/**
 * Normalize transaction.documents from API (string IDs, objects with id, or map-like object).
 */

export function getDocumentsArray(docs) {
  if (!docs) return [];
  if (Array.isArray(docs)) return docs;
  if (typeof docs === 'object') return Object.values(docs);
  return [];
}

export function getTransactionDocumentIds(documents) {
  return getDocumentsArray(documents)
    .map((item) => {
      if (item == null) return null;
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item.id) return item.id;
      return null;
    })
    .filter(Boolean);
}

export function getTransactionDocumentCount(documents) {
  return getTransactionDocumentIds(documents).length;
}
