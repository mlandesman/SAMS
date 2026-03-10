import React, { createContext, useState, useContext, useEffect } from 'react';
import { getAuthInstance, loginWithEmailPassword, loginWithCustomToken, logout as firebaseLogout } from '../firebaseClient';
import { passkeyService, getDefaultDeviceName } from '../services/passkeyService';
import { onAuthStateChanged } from 'firebase/auth';
import LoginForm from '../components/LoginForm';
import PasswordChangeModal from '../components/PasswordChangeModal';
import { userAPI } from '../api/user';
import '../styles/SandylandModalTheme.css';
import '../components/LoginForm.css';

// Create authentication context
const AuthContext = createContext();

/**
 * Post-login passkey registration prompt. Rendered by AuthContext so it stays
 * mounted when LoginForm unmounts (currentUser set triggers LoginForm unmount).
 */
function PasskeyRegistrationPrompt({ user, onComplete, onDismiss }) {
  const [deviceName, setDeviceName] = useState(() => getDefaultDeviceName());
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!user?.email) return;
    setError('');
    setIsRegistering(true);
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      await passkeyService.startPasskeyRegistration(
        user.email,
        token,
        deviceName.trim() || getDefaultDeviceName(),
        null
      );
      onComplete(user);
    } catch (err) {
      const msg = err.name === 'NotAllowedError' || (err.message || '').toLowerCase().includes('cancel')
        ? 'Registration cancelled. You can set up a passkey later.'
        : (err.message || 'Registration failed.');
      setError(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDismiss = () => {
    onComplete(user);
  };

  return (
    <div
      className="sandyland-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && handleDismiss()}
    >
      <div className="sandyland-modal" onClick={(e) => e.stopPropagation()} style={{ width: '420px', maxWidth: '90vw' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">Set up a passkey for faster login</h2>
        </div>
        <div className="sandyland-modal-content">
          <p style={{ margin: '0 0 1rem 0', color: '#4a5568' }}>
            Register a passkey to sign in quickly next time with your fingerprint or face.
          </p>
          <div className="form-group">
            <label htmlFor="passkey-prompt-device">Device name:</label>
            <input
              type="text"
              id="passkey-prompt-device"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. MacBook Pro"
              className="login-form-input"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
        <div className="sandyland-modal-buttons">
          <button
            className="sandyland-btn sandyland-btn-secondary"
            onClick={handleDismiss}
            disabled={isRegistering}
          >
            Maybe later
          </button>
          <button
            className="sandyland-btn sandyland-btn-primary"
            onClick={handleRegister}
            disabled={isRegistering}
          >
            {isRegistering ? 'Registering...' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Authentication provider component to wrap the application
 * @param {Object} props Component properties
 * @param {React.ReactNode} props.children Child components
 */
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [samsUser, setSamsUser] = useState(null); // Add SAMS user profile with roles
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [passwordChangeUser, setPasswordChangeUser] = useState(null);
  const [passkeyPromptUser, setPasskeyPromptUser] = useState(null);
  const auth = getAuthInstance();

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? `Logged in as ${user.email}` : 'Not logged in');
      setCurrentUser(user);
      
      if (user) {
        // Load SAMS user profile with comprehensive role and client access data
        try {
          console.log('🔄 Loading SAMS user profile with role data...');
          const profileResponse = await userAPI.getProfile();
          console.log('📋 Raw profile response:', profileResponse);
          
          // Extract user data from response (handle different response formats)
          const samsUserProfile = profileResponse.user || profileResponse.data || profileResponse;
          
          
          // Validate required user structure
          if (!samsUserProfile.email) {
            console.warn('⚠️ User profile missing email, using Firebase user email');
            samsUserProfile.email = user.email;
          }
          
          // Ensure propertyAccess object exists
          if (!samsUserProfile.propertyAccess) {
            console.warn('⚠️ User profile missing propertyAccess, initializing empty object');
            samsUserProfile.propertyAccess = {};
          }
          
          // Ensure globalRole exists
          if (!samsUserProfile.globalRole) {
            console.warn('⚠️ User profile missing globalRole, defaulting to "user"');
            samsUserProfile.globalRole = 'user';
          }
          
          // Check if user must change password
          if (samsUserProfile.mustChangePassword) {
            console.log('🔑 User must change password before proceeding');
            setRequiresPasswordChange(true);
            setPasswordChangeUser({
              email: samsUserProfile.email,
              name: samsUserProfile.name,
              uid: user.uid
            });
          } else {
            setRequiresPasswordChange(false);
            setPasswordChangeUser(null);
          }
          
          console.log('✅ SAMS user profile loaded with structure:', {
            email: samsUserProfile.email,
            globalRole: samsUserProfile.globalRole,
            propertyAccess: Object.keys(samsUserProfile.propertyAccess || {}),
            preferredClient: samsUserProfile.preferredClient,
            mustChangePassword: samsUserProfile.mustChangePassword,
            accountState: samsUserProfile.accountState
          });
          
          setSamsUser(samsUserProfile);
        } catch (error) {
          console.error('❌ Failed to load SAMS user profile:', error);
          
          // Create a basic user profile structure if API fails
          console.log('🔄 Creating fallback user profile...');
          const fallbackProfile = {
            email: user.email,
            name: user.displayName || user.email,
            globalRole: 'user', // Default to user role for security
            propertyAccess: {},
            preferredClient: null,
            isActive: true
          };
          
          setSamsUser(fallbackProfile);
          setError('Failed to load full user profile. Some features may not be available.');
        }
      } else {
        // Clear SAMS user data on logout
        setSamsUser(null);
      }
      
      setLoading(false);
    });
    
    // Handle browser/tab close events
    const handleBeforeUnload = () => {
      console.log('Browser closing - clearing auth state and local storage');
      // Clear any localStorage items that should not persist
      localStorage.removeItem('selectedClient');
      // We don't need to explicitly clear auth since we're using browserSessionPersistence
    };
    
    // Add event listener for tab/browser close
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup subscriptions
    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [auth]);

  // Login function (password)
  async function login(email, password) {
    try {
      setError('');
      console.log(`Attempting to login with email: ${email}`);
      const userCredential = await loginWithEmailPassword(email, password);
      console.log('Login successful:', userCredential.user);
      
      return userCredential;
    } catch (error) {
      console.error('Login error:', error.code, error.message);
      setError(error.userMessage || 'Failed to login. Please check your credentials.');
      throw error;
    }
  }

  // Login function (passkey)
  async function loginWithPasskey(email) {
    try {
      setError('');
      const result = await passkeyService.startPasskeyLogin(email);
      await loginWithCustomToken(result.token);
      // onAuthStateChanged fires automatically; profile load continues unchanged
      return { user: result.user };
    } catch (error) {
      if (import.meta.env.DEV) console.error('Passkey login error:', error);
      setError(error.message || 'Passkey sign-in failed. Try password or try again.');
      throw error;
    }
  }

  // Logout function
  const logout = async () => {
    try {
      // Clear all localStorage data before logout
      localStorage.removeItem('selectedClient');
      localStorage.removeItem('samsUserProfile');
      localStorage.removeItem('transactionFilter');
      
      // Clear all sessionStorage data (including HOA cache)
      sessionStorage.clear();
      
      // Clear all auth-related state
      setCurrentUser(null);
      setSamsUser(null);
      setRequiresPasswordChange(false);
      setPasswordChangeUser(null);
      setError('');
      
      // Perform Firebase logout
      await firebaseLogout();
      
      // Navigate to root URL instead of reloading
      window.location.href = '/';
      
      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      setError('Failed to logout. Please try again.');
      return false;
    }
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setShowLoginForm(false);
    setPasskeyPromptUser(null);
  };

  const handleShowPasskeyPrompt = (user) => {
    setPasskeyPromptUser(user);
  };

  const handlePasswordChanged = async () => {
    // Clear password change requirement
    setRequiresPasswordChange(false);
    setPasswordChangeUser(null);
    
    // Reload user profile to get updated data
    if (currentUser) {
      try {
        const profileResponse = await userAPI.getProfile();
        const samsUserProfile = profileResponse.user || profileResponse.data || profileResponse;
        setSamsUser(samsUserProfile);
      } catch (error) {
        console.error('Failed to reload user profile after password change:', error);
      }
    }
  };

  const value = {
    currentUser,
    samsUser, // Add SAMS user profile with roles
    loading,
    login,
    loginWithPasskey,
    logout,
    error,
    setError,
    showLogin: () => setShowLoginForm(true),
    hideLogin: () => setShowLoginForm(false),
    isAuthenticated: !!currentUser,
    requiresPasswordChange,
    passwordChangeUser,
    clearPasswordChangeRequirement: () => {
      setRequiresPasswordChange(false);
      setPasswordChangeUser(null);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {(showLoginForm || (!loading && !currentUser)) && (
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onShowPasskeyPrompt={handleShowPasskeyPrompt}
        />
      )}
      {requiresPasswordChange && passwordChangeUser && (
        <PasswordChangeModal
          open={requiresPasswordChange}
          user={passwordChangeUser}
          onPasswordChanged={handlePasswordChanged}
          onClose={() => {}} // Prevent closing - user must change password
        />
      )}
      {!loading && !requiresPasswordChange && children}
      {passkeyPromptUser && (
        <PasskeyRegistrationPrompt
          user={passkeyPromptUser}
          onComplete={handleLoginSuccess}
        />
      )}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use the authentication context
 * @returns {Object} Authentication context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
