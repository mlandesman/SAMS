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

/**
 * Wire attachment UI from a transaction row.
 * Single document opens direct preview (setSingleDocPreviewId); multiple opens list dialog.
 */
export function openQueuedTransactionAttachments(
  tx,
  setAttachmentIds,
  setAttachmentOpen,
  setSingleDocPreviewId = null
) {
  const ids = getTransactionDocumentIds(tx.documents);
  if (!ids.length) return;
  if (ids.length === 1 && typeof setSingleDocPreviewId === 'function') {
    setSingleDocPreviewId(ids[0]);
    return;
  }
  setAttachmentIds(ids);
  setAttachmentOpen(true);
}
