// src/views/AuthTestView.jsx
import React from 'react';
import FirestoreAuthTest from '../components/FirestoreAuthTest';

const AuthTestView = () => {
  return (
    <div className="auth-test-view">
      <h1>Authentication Test</h1>
      <p>Use this page to test authentication and Firestore operations.</p>
      <FirestoreAuthTest />
    </div>
  );
};

export default AuthTestView;
