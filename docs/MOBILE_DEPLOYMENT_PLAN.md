# SAMS Mobile Deployment Plan

## Architecture Overview

### URLs
- Desktop: `sams.sandyland.com.mx`
- Mobile: `mobile.sams.sandyland.com.mx`
- Backend API: Same Firebase backend for both

### Benefits
1. **No App Store Required** - PWA can be installed directly from browser
2. **Single Backend** - One codebase for all business logic
3. **Independent Updates** - Deploy mobile and desktop separately
4. **Clean User Experience** - Mobile-optimized UI without desktop clutter

## Deployment Steps

### 1. Vercel Configuration
Create new Vercel project for mobile app:
```bash
cd frontend/sams-ui/mobile-app
vercel --prod
```

### 2. Domain Setup
In Vercel dashboard:
- Add custom domain: `mobile.sams.sandyland.com.mx`
- Configure DNS CNAME record

### 3. Environment Variables
Copy from main SAMS project:
- All `VITE_FIREBASE_*` variables
- Point to same Firebase project

### 4. PWA Manifest Updates
Update `mobile-app/public/manifest.json`:
```json
{
  "name": "SAMS Mobile",
  "short_name": "SAMS",
  "start_url": "https://mobile.sams.sandyland.com.mx/",
  "scope": "https://mobile.sams.sandyland.com.mx/",
  "display": "standalone"
}
```

## User Access Patterns

### General Users (Tenants)
- Dashboard (read-only financial overview)
- Exchange Rate Calculator
- Unit Reports (their unit only)
- Future: Project status, budgets (view only)

### Admin Users
- Everything general users have
- Add Expense functionality
- HOA Dues Payment receipts
- Future: Project management tools

## Mobile App Features

### Current Implementation
- Optimized touch interfaces
- Offline support via service worker
- Camera access for receipt photos
- Push notifications ready (when needed)

### Installation Instructions for Users
1. Visit `mobile.sams.sandyland.com.mx` on phone
2. iOS: Tap share button → "Add to Home Screen"
3. Android: Chrome menu → "Add to Home Screen"
4. App icon appears on home screen
5. Opens fullscreen without browser UI

## Technical Considerations

### Shared Components
- Authentication flows
- API client configuration  
- Firebase initialization
- Utility functions

### Mobile-Specific
- Touch-optimized UI components
- Simplified navigation
- Reduced data usage
- Aggressive caching for offline

### Maintenance Benefits
1. **Single Backend** - Fix once, works everywhere
2. **Shared Business Logic** - Calculations, validations in one place
3. **Independent Frontends** - Update mobile UX without affecting desktop
4. **Clear Separation** - No CSS conflicts or feature detection needed

## Alternative Approaches (Not Recommended)

### Why not URL parameters (`?mobile=true`)?
- Service worker conflicts
- Shared cache issues
- Complex routing logic
- Poor user experience

### Why not path-based (`/mobile`)?
- Still shares service worker scope
- Complicates deployment
- Less clean for PWA installation

### Why not responsive-only?
- Admin features too complex for responsive
- Different use cases need different UIs
- Mobile needs aggressive offline support
- Desktop users want full feature set

## Next Steps

1. Set up mobile subdomain in Vercel
2. Configure DNS records
3. Test PWA installation on iOS/Android
4. Create user installation guide
5. Plan progressive rollout to users