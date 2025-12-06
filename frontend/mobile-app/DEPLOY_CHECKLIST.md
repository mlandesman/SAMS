# SAMS Mobile Deployment Checklist

## Pre-Deployment
- [ ] Test on physical iOS device
- [ ] Test on physical Android device
- [ ] Verify offline functionality
- [ ] Test "Add to Home Screen" flow
- [ ] Ensure all icons are present
- [ ] Build PWA: `cd frontend/mobile-app && npm run build`

## Firebase Setup
- [ ] Ensure Firebase CLI is installed: `npm install -g firebase-tools`
- [ ] Login to Firebase: `firebase login`
- [ ] Select production project: `firebase use sams-sandyland-prod`
- [ ] Create mobile hosting site (if not exists): `firebase hosting:sites:create sams-mobile`
- [ ] Apply hosting target: `firebase target:apply hosting mobile sams-mobile`
- [ ] Verify `.firebaserc` has mobile target configured

## Domain Configuration
- [ ] Add custom domain in Firebase Console: `mobile.sams.sandyland.com.mx`
- [ ] Update DNS records (instructions provided by Firebase)
- [ ] Wait for SSL certificate provisioning (automatic)
- [ ] Test HTTPS access

## Deployment
- [ ] Run deployment script: `./frontend/mobile-app/deploy.sh`
- [ ] OR deploy manually: `firebase deploy --only hosting:mobile`
- [ ] Verify deployment success in Firebase Console

## Post-Deployment
- [ ] Verify PWA loads at: https://sams-mobile.web.app
- [ ] Verify PWA installation on iOS
- [ ] Verify PWA installation on Android
- [ ] Test core features:
  - [ ] Login
  - [ ] Dashboard view
  - [ ] Exchange rate calculator
  - [ ] Unit reports
- [ ] Test API connectivity (no CORS errors)
- [ ] Create user installation guide
