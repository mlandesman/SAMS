/**
 * Browser stub for firebase-admin — mobile PWA imports DateService for date helpers only.
 * Real Timestamp behavior is unused on the client paths we call.
 */
const Timestamp = {
  fromDate: (d) => ({
    toDate: () => d,
    _seconds: Math.floor(d.getTime() / 1000),
  }),
};

export default {
  firestore: { FieldValue: {}, Timestamp },
};
