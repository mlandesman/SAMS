async function crawlCollection(collectionRef, indentLevel = 0, jsonNode = {}) {
  const snapshot = await collectionRef.get();

  for (const doc of snapshot.docs) {
    if (doc.id === '_KEEP_') {
      continue; // Skip _KEEP_ docs
    }

    const data = doc.data();
    const label = (data && data.name) ? `${doc.id} (${data.name})` : doc.id;

    appendToStructure(`- ${label}`, indentLevel);
    jsonNode[doc.id] = {};

    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      appendToStructure(`📁 ${subcol.id}/`, indentLevel + 1);
      jsonNode[doc.id][subcol.id] = {};
      await crawlCollection(subcol, indentLevel + 2, jsonNode[doc.id][subcol.id]);
    }
  }
}