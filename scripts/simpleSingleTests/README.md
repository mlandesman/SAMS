# Firebase Authentication & Firestore Tests

This directory contains simple, isolated tests to understand Firebase authentication and Firestore permissions outside of the SAMS application context. These tests will help identify if issues are related to Firebase configuration, security rules, or the environment.

## Test Files

1. `test1_unauthenticated_write.js`: Attempts to write to Firestore without any authentication. This should fail if your security rules are configured correctly to require authentication for writes.

2. `test2_authenticated_write.js`: First authenticates with Firebase using email/password, then attempts to write to Firestore. This should succeed if your security rules allow authenticated users to write.

3. `browser_test.html`: A simple HTML page that allows testing Firebase authentication and Firestore operations in a browser environment. This helps distinguish between problems specific to Node.js versus browser environments.

## Running the Tests

### Node.js Tests

Run both Node.js tests using the provided script:

```bash
cd /path/to/simpleSingleTests
./run_tests.sh
```

### Browser Test

Simply open the `browser_test.html` file in a web browser:

```bash
# Using open command on macOS
open browser_test.html

# Or just navigate to the file in your file explorer and open it
```

## Expected Results

- **Unauthenticated write**: Should fail with a permission-denied error if your security rules are configured correctly
- **Authenticated write**: Should succeed if your Firebase project is correctly configured and your security rules allow authenticated writes
- **Browser test**: Should allow you to sign in, read from Firestore (which is allowed for everyone), and write to Firestore only when authenticated

## Troubleshooting

If the tests fail, check:

1. Firebase configuration (API keys, project IDs, etc.)
2. Firestore security rules
3. Firebase Authentication settings in the Firebase console
4. Network connectivity
5. Any specific Firebase service limitations or quotas

For Node.js specific issues, you might need to set up the Firebase Admin SDK or adjust your configuration approach.
