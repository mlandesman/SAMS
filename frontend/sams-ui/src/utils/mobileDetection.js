// Emergency mobile detection utility for production PWA fix
// This provides JavaScript-based detection as backup when CSS media queries fail

export const isMobileDevice = () => {
  // Check multiple conditions for mobile detection
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // User agent detection
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUserAgent = mobileRegex.test(userAgent);
  
  // Screen size detection
  const isMobileScreen = window.innerWidth <= 768;
  
  // Touch capability detection
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Combine checks with priority on user agent and screen size
  return isMobileUserAgent || (isMobileScreen && hasTouchScreen);
};

export const forceProductionMobileMode = () => {
  // Check if we're in development mode with mobile testing
  const isDevMobileTesting = window.location.hostname === 'localhost' && 
    (window.location.search.includes('mobile=true') || window.innerWidth <= 768);
  
  // Apply in production OR when testing mobile in development
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' || isDevMobileTesting) {
    const isMobile = isMobileDevice();
    
    // Debug logging for production troubleshooting
    console.log('Mobile Detection Debug:', {
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      isMobileDevice: isMobile,
      hostname: window.location.hostname,
      touchCapable: 'ontouchstart' in window || navigator.maxTouchPoints > 0
    });
    
    if (isMobile) {
      // Force mobile mode by adding class to body
      document.body.classList.add('force-mobile-mode');
      
      // Store mobile state
      window.SAMS_IS_MOBILE = true;
      
      // Dispatch custom event for components that need to know
      window.dispatchEvent(new CustomEvent('sams-mobile-detected', { detail: { isMobile: true } }));
    }
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', forceProductionMobileMode);
  
  // Also check on resize in case device orientation changes
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(forceProductionMobileMode, 250);
  });
}