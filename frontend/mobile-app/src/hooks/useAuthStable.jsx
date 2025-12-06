import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  
  // Use refs to track state without causing re-renders
  const profileLoadedRef = useRef(false);
  const initializingRef = useRef(false);

  // Single, stable auth listener
  useEffect(() => {
    console.log('🚀 STABLE AUTH: Initializing auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔥 STABLE AUTH: State change', firebaseUser ? firebaseUser.email : 'No user');
      
      // Always update Firebase user immediately
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser && !profileLoadedRef.current && !initializingRef.current) {
        // Prevent concurrent profile loading
        initializingRef.current = true;
        console.log('📋 STABLE AUTH: Loading user profile...');
        
        try {
          // Wait a moment for Firebase token to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verify we have a token before making the API call
          const token = await firebaseUser.getIdToken();
          console.log('🔑 STABLE AUTH: Got Firebase token:', token ? 'Yes' : 'No');
          
          const { user } = await userAPI.getProfile();
          console.log('✅ STABLE AUTH: Profile loaded', user);
          
          setSamsUser(user);
          profileLoadedRef.current = true;
          
          // Set current client from user preferences or auto-select for single client users
          // Backend returns propertyAccess, but support clientAccess for backwards compatibility
          const clientAccess = user.clientAccess || user.propertyAccess || {};
          console.log('🎯 STABLE AUTH: Setting client from preferredClient:', user.preferredClient);
          console.log('🎯 STABLE AUTH: User clientAccess:', clientAccess);
          
          if (user.preferredClient) {
            setCurrentClient(user.preferredClient);
            console.log('✅ STABLE AUTH: Current client set to:', user.preferredClient);
          } else if (clientAccess && Object.keys(clientAccess).length > 0) {
            // Auto-select if user has only one client
            const availableClients = Object.keys(clientAccess);
            console.log('🎯 STABLE AUTH: Available clients:', availableClients);
            
            if (availableClients.length === 1) {
              const autoSelectedClient = availableClients[0];
              console.log('🎯 STABLE AUTH: Auto-selecting single client:', autoSelectedClient);
              setCurrentClient(autoSelectedClient);
              console.log('✅ STABLE AUTH: Auto-selected client set to:', autoSelectedClient);
            } else {
              console.log('⚠️ STABLE AUTH: Multiple clients available, user needs to select');
            }
          } else {
            console.log('⚠️ STABLE AUTH: No preferredClient or clientAccess/propertyAccess found in user profile');
          }
          
          setError(null);
        } catch (error) {
          console.error('❌ STABLE AUTH: Profile load failed', error);
          console.error('❌ STABLE AUTH: Error details:', {
            message: error.message,
            stack: error.stack,
            firebaseUser: firebaseUser ? 'Yes' : 'No',
            uid: firebaseUser?.uid
          });
          setError('Failed to load user profile: ' + error.message);
        } finally {
          initializingRef.current = false;
          setLoading(false);
        }
      } else if (!firebaseUser) {
        // User logged out - clear everything
        console.log('🧹 STABLE AUTH: Clearing user data');
        setSamsUser(null);
        setCurrentClient(null);
        setError(null);
        profileLoadedRef.current = false;
        initializingRef.current = false;
        setLoading(false);
      } else if (firebaseUser && profileLoadedRef.current) {
        // User already loaded, just ensure loading is false
        setLoading(false);
      }
    });

    return () => {
      console.log('🛑 STABLE AUTH: Cleaning up auth listener');
      unsubscribe();
    };
  }, []); // No dependencies - this listener should never be recreated


  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔐 STABLE AUTH: Attempting login', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ STABLE AUTH: Firebase login successful');
      
      // Profile will be loaded by the auth state listener
      return userCredential;
    } catch (error) {
      console.error('❌ STABLE AUTH: Login failed', error);
      
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
        default:
          if (error.message.includes('SAMS')) {
            errorMessage = error.message;
          }
          break;
      }
      
      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚪 STABLE AUTH: Logging out');
      await signOut(auth);
      
      // Clear cached data
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sams_mobile_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('⚠️ STABLE AUTH: Error clearing cache', error);
      }
      
    } catch (error) {
      console.error('❌ STABLE AUTH: Logout failed', error);
      setError('Logout failed. Please try again.');
      setLoading(false);
      throw error;
    }
  }, []);

  const selectClient = useCallback(async (clientId) => {
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
      
      console.log('🏢 STABLE AUTH: Client selected', clientId);
    } catch (error) {
      console.error('❌ STABLE AUTH: Client selection failed', error);
      setError('Failed to select client');
      throw error;
    }
  }, [samsUser]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-persist client selection for single-client users
  useEffect(() => {
    if (samsUser && currentClient && !samsUser.preferredClient) {
      // If user has a current client but no preferred client set, persist it
      const availableClients = Object.keys(samsUser.clientAccess || {});
      if (availableClients.length === 1 && availableClients[0] === currentClient) {
        console.log('🎯 STABLE AUTH: Auto-persisting single client selection:', currentClient);
        selectClient(currentClient).catch(error => {
          console.error('⚠️ STABLE AUTH: Failed to persist auto-selected client:', error);
        });
      }
    }
  }, [samsUser, currentClient, selectClient]);

  // Memoize computed properties to prevent re-renders
  const isAuthenticated = useMemo(() => !!(firebaseUser && samsUser), [firebaseUser, samsUser]);
  const isAdmin = useMemo(() => samsUser?.globalRole === 'admin' || samsUser?.globalRole === 'superAdmin', [samsUser?.globalRole]);
  const hasMultipleClients = useMemo(() => {
    return samsUser?.clientAccess && Object.keys(samsUser.clientAccess).length > 1;
  }, [samsUser?.clientAccess]);

  // Memoize the context value to prevent infinite re-renders
  const value = useMemo(() => ({
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
  }), [
    firebaseUser,
    samsUser,
    currentClient,
    hasMultipleClients,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    selectClient,
    login,
    logout,
    clearError
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
