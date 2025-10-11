// scripts/schemaCrawler.js
const { getDb } = require('../src/firebase');  // or '../src/firebase' from scripts
const db = getDb();

let structureText = '';
let structureJson = {};

function appendToStructure(text, indentLevel = 0) {
  const indent = '  '.repeat(indentLevel);
  structureText += `${indent}${text}\n`;
}

async function crawlCollection(collectionRef, indentLevel = 0, jsonNode = {}) {
  const snapshot = await collectionRef.get();

  for (const doc of snapshot.docs) {
    if (doc.id === '_KEEP_') continue; // Skip _KEEP_ docs

    appendToStructure(`- ${doc.id}`, indentLevel);
    jsonNode[doc.id] = {};

    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      appendToStructure(`📁 ${subcol.id}/`, indentLevel + 1);
      jsonNode[doc.id][subcol.id] = {};
      await crawlCollection(subcol, indentLevel + 2, jsonNode[doc.id][subcol.id]);
    }
  }
}

async function main() {
  console.log('🔎 Firestore Database Structure:');

  const topLevelCollections = await db.listCollections();
  for (const collection of topLevelCollections) {
    appendToStructure(`- ${collection.id}`);
    structureJson[collection.id] = {};

    // Only crawl inside clients (skip auditLogs, contacts, etc.)
    if (collection.id === 'clients') {
      await crawlCollection(collection, 1, structureJson[collection.id]);
    }
  }

  console.log(structureText);
}

main().catch((error) => {
  console.error('❌ Error during crawl:', error);
});