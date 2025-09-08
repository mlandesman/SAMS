# Fix for ServerTimestamp Error

## The Problem
```
Error: Couldn't serialize object of type "ServerTimestampTransform" (found in field "updated")
```

This happens when using `admin.firestore.FieldValue.serverTimestamp()` with `.add()` method.

## The Fix

In the import script, find lines like:
```javascript
// WRONG - causes error with .add()
const categoryDocument = {
  name: categoryData.Categories,
  updated: admin.firestore.FieldValue.serverTimestamp()
};
await categoriesRef.add(categoryDocument);
```

Change to:
```javascript
// CORRECT - use set() with explicit ID
const categoryRef = categoriesRef.doc();
await categoryRef.set({
  name: categoryData.Categories,
  updated: admin.firestore.FieldValue.serverTimestamp()
});
const categoryId = categoryRef.id;
```

OR use Date object:
```javascript
// ALTERNATIVE - use Date instead of serverTimestamp
const categoryDocument = {
  name: categoryData.Categories,
  updated: new Date()
};
const categoryRef = await categoriesRef.add(categoryDocument);
```

## For the IA fixing this:

1. In `importCategoriesWithCRUD` function around line 80-82
2. In `importVendorsWithCRUD` function around line 173-175
3. Change from `.add()` with serverTimestamp to `.doc().set()` pattern
4. OR change `serverTimestamp()` to `new Date()`

This is a Firebase SDK limitation - serverTimestamp doesn't work with .add()