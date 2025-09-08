# SAMS Mobile Deployment Checklist

## Pre-Deployment
- [ ] Test on physical iOS device
- [ ] Test on physical Android device
- [ ] Verify offline functionality
- [ ] Test "Add to Home Screen" flow
- [ ] Ensure all icons are present

## Vercel Setup
- [ ] Run `vercel` in this directory
- [ ] Set project name: `sams-mobile`
- [ ] Configure environment variables:
  - VITE_FIREBASE_API_KEY
  - VITE_FIREBASE_AUTH_DOMAIN
  - VITE_FIREBASE_PROJECT_ID
  - VITE_FIREBASE_STORAGE_BUCKET
  - VITE_FIREBASE_MESSAGING_SENDER_ID
  - VITE_FIREBASE_APP_ID
  - VITE_USE_EMULATOR=false

## Domain Configuration
- [ ] Add custom domain in Vercel: `mobile.sams.sandyland.com.mx`
- [ ] Update DNS records (CNAME to cname.vercel-dns.com)
- [ ] Wait for SSL certificate provisioning
- [ ] Test HTTPS access

## Post-Deployment
- [ ] Verify PWA installation on iOS
- [ ] Verify PWA installation on Android
- [ ] Test core features:
  - [ ] Login
  - [ ] Dashboard view
  - [ ] Exchange rate calculator
  - [ ] Unit reports
- [ ] Create user installation guide
