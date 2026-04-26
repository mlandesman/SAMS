# Desktop Localization Key Guide

This desktop app uses shared keyed strings from `desktopShellStrings.js` and runtime state from `DesktopLanguageContext`.

## Add new desktop copy
1. Add a key in `STRINGS.EN`.
2. Add the same key in `STRINGS.ES`.
3. Render via `useDesktopStrings()`:
   - `t('your.key')` for regular copy.
   - `menuLabel(activity, fallback)` for dynamic menu activity labels.

## Fallback behavior
- Missing selected-language key falls back to EN.
- Missing EN key returns deterministic fallback text: `[missing: your.key]`.
- When localization feature flag is OFF, lookup is legacy-safe and resolves EN only.

## Language state behavior
- Startup language seeds from authenticated user profile `preferredLanguage` when available.
- Manual toggles remain session-scoped (`sessionStorage`) after startup seed.
