// src/components/FirestoreAuthTest.jsx
import { useState } from 'react';
import { collection, addDoc, getDocs, query, limit } from 'firebase/firestore';
import { getDb } from '../firebaseClient';
import { useAuth } from '../context/AuthContext';
import './FirestoreAuthTest.css';

export default function FirestoreAuthTest() {
  const { currentUser } = useAuth();
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const db = getDb();

  // Function to create a test document
  async function testWriteToFirestore() {
    try {
      setLoading(true);
      
      const testData = {
        message: 'Test document from SAMS UI',
        timestamp: new Date(),
        userId: currentUser ? currentUser.uid : 'unauthenticated'
      };
      
      // Log the status and attempt to write
      const message = currentUser 
        ? `Attempting write as authenticated user: ${currentUser.email}`
        : 'Attempting write as unauthenticated user';
      
      console.log(message);
      setTestResults(prev => [...prev, { type: 'info', message }]);
      
      // Try to write to two different collections
      let results = [];
      
      try {
        // First try writing to test_documents (should follow default security rules)
        const docRef = await addDoc(collection(db, 'test_documents'), testData);
        results.push({
          type: 'success',
          message: `✅ Successfully wrote to test_documents collection. Document ID: ${docRef.id}`
        });
      } catch (error) {
        results.push({
          type: 'error',
          message: `❌ Failed to write to test_documents: ${error.message}`
        });
      }
      
      try {
        // Then try writing to clients/MTC/transactions (should follow client rules)
        const docRef = await addDoc(collection(db, 'clients/MTC/transactions'), {
          ...testData,
          amount: -50.00,
          category: 'Test',
          vendor: 'Auth Test',
          date: new Date(),
          notes: 'Test from SAMS UI'
        });
        results.push({
          type: 'success',
          message: `✅ Successfully wrote to clients/MTC/transactions. Document ID: ${docRef.id}`
        });
      } catch (error) {
        results.push({
          type: 'error',
          message: `❌ Failed to write to clients/MTC/transactions: ${error.message}`
        });
      }
      
      // Update the UI with results
      setTestResults(prev => [...prev, ...results]);
      
    } catch (error) {
      console.error('Test failed:', error);
      setTestResults(prev => [...prev, { 
        type: 'error', 
        message: `❌ General error: ${error.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  }

  // Function to read test documents
  async function testReadFromFirestore() {
    try {
      setLoading(true);
      
      const message = 'Attempting to read from Firestore...';
      console.log(message);
      setTestResults(prev => [...prev, { type: 'info', message }]);
      
      // Try reading from test_documents
      const q = query(collection(db, 'test_documents'), limit(5));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setTestResults(prev => [...prev, { 
          type: 'info', 
          message: 'No documents found in test_documents collection' 
        }]);
      } else {
        setTestResults(prev => [...prev, { 
          type: 'success', 
          message: `Found ${querySnapshot.size} documents in test_documents collection` 
        }]);
        
        querySnapshot.forEach(doc => {
          setTestResults(prev => [...prev, { 
            type: 'info', 
            message: `Document ID: ${doc.id} - ${JSON.stringify(doc.data())}` 
          }]);
        });
      }
      
    } catch (error) {
      console.error('Read test failed:', error);
      setTestResults(prev => [...prev, { 
        type: 'error', 
        message: `❌ Error reading from Firestore: ${error.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  }

  // Function to clear test results
  function clearResults() {
    setTestResults([]);
  }

  return (
    <div className="firestore-test-container">
      <h2>Firestore Authentication Tests</h2>
      
      <div className="auth-status">
        <strong>Authentication Status:</strong> {currentUser ? `Logged in as ${currentUser.email}` : 'Not logged in'}
      </div>
      
      <div className="test-actions">
        <button 
          onClick={testWriteToFirestore} 
          disabled={loading}
        >
          Test Write to Firestore
        </button>
        
        <button 
          onClick={testReadFromFirestore} 
          disabled={loading}
        >
          Test Read from Firestore
        </button>
        
        <button 
          onClick={clearResults} 
          disabled={loading}
        >
          Clear Results
        </button>
      </div>
      
      <div className="test-results">
        <h3>Test Results</h3>
        {testResults.length === 0 ? (
          <p>No tests run yet</p>
        ) : (
          <ul>
            {testResults.map((result, index) => (
              <li key={index} className={result.type}>
                {result.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
