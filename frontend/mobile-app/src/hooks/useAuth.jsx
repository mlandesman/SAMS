import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from '../services/firebase';
import { userAPI } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [samsUser, setSamsUser] = useState(null);
  const [currentClient, setCurrentClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Firebase auth state listener with improved stability
  useEffect(() => {
    let mounted = true;
    let profileLoaded = false;
    
    console.log('🚀 Initializing auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) {
        console.log('⚠️ Component unmounted, skipping auth update');
        return;
      }
      
      console.log('🔥 Auth state change:', {
        email: firebaseUser ? firebaseUser.email : 'No user',
        profileLoaded,
        uid: firebaseUser ? firebaseUser.uid : null
      });
      
      // Always set the firebase user immediately
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser && !profileLoaded) {
        console.log('📋 Loading SAMS user profile...');
        try {
          const { user } = await userAPI.getProfile();
          if (!mounted) return;
          
          setSamsUser(user);
          
          // Set current client from user preferences
          if (user.preferredClient) {
            setCurrentClient(user.preferredClient);
          }
          
          console.log('✅ SAMS user profile loaded:', user);
          profileLoaded = true;
          setAuthInitialized(true);
        } catch (error) {
          console.error('❌ Error fetching SAMS user profile:', error);
          if (mounted) {
            setError('Failed to load user profile');
          }
        }
      } else if (!firebaseUser) {
        console.log('🧹 Clearing user data on logout');
        if (mounted) {
          setSamsUser(null);
          setCurrentClient(null);
          setError(null);
          profileLoaded = false;
          setAuthInitialized(false);
        }
      }
      
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      console.log('🛑 Cleaning up auth listener');
      mounted = false;
      unsubscribe();
    };
  }, []); // No dependencies to prevent recreation

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      // Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase login successful:', userCredential.user.email);
      
      // SAMS user profile will be loaded by the auth state listener
      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = 'Invalid password.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          if (error.message.includes('SAMS')) {
            errorMessage = error.message;
          }
          break;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await signOut(auth);
      console.log('Logout successful');
      
      // Clear local state
      setSamsUser(null);
      setCurrentClient(null);
      
      // Clear cached data
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sams_mobile_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('Error clearing cache on logout:', error);
      }
      
    } catch (error) {
      console.error('Logout error:', error);
      setError('Logout failed. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const selectClient = async (clientId) => {
    try {
      await userAPI.selectClient(clientId);
      setCurrentClient(clientId);
      
      // Update the SAMS user profile with new preferred client
      if (samsUser) {
        setSamsUser(prev => ({
          ...prev,
          preferredClient: clientId
        }));
      }
      
      console.log('Client selected:', clientId);
    } catch (error) {
      console.error('Error selecting client:', error);
      setError('Failed to select client');
      throw error;
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Computed properties
  const isAuthenticated = !!(firebaseUser && samsUser);
  const isAdmin = samsUser?.globalRole === 'admin' || samsUser?.globalRole === 'superAdmin';
  const hasMultipleClients = samsUser?.clientAccess && Object.keys(samsUser.clientAccess).length > 1;

  const value = {
    // User data
    firebaseUser,
    samsUser,
    user: samsUser, // Main user object for backwards compatibility
    
    // Client context
    currentClient,
    selectClient,
    hasMultipleClients,
    
    // Auth state
    loading,
    error,
    isAuthenticated,
    isAdmin,
    
    // Auth actions
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
