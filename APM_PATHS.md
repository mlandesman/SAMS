# APM Documentation Paths

## Overview
⚠️ **CRITICAL CHANGE**: APM (Agent Process Management) documentation and prompts have been **PERMANENTLY MOVED** from Google Drive to local storage due to macOS 26 sync issues.

**ALWAYS USE LOCAL PATH**: `/Users/michael/Projects/SAMS-Docs`  
**NEVER USE GOOGLE DRIVE** (broken/unreliable)

## Path Reference

### Full Path (for scripts and absolute references)
```
/Users/michael/Projects/SAMS-Docs
```

### ~~OLD Google Drive Path~~ (DO NOT USE - BROKEN)
```
~~/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs~~
```

### Directory Structure

```
SAMS-Docs/
├── apm/
│   ├── prompts/
│   │   ├── Implementation_Agent/
│   │   ├── Manager_Agent/
│   │   └── guides/
│   ├── memory/
│   │   ├── issues/
│   │   │   ├── resolved/
│   │   │   └── [active-issues].md
│   │   └── tasks/
│   ├── tasks/
│   │   ├── active/
│   │   └── completed/
│   └── [other APM files]
├── apm_session/
│   ├── Implementation_Plan.md
│   └── [session files]
└── [other documentation]
```

## Quick Access

### Using Aliases (bash/zsh)
```bash
# Jump to SAMS code
sams

# Jump to SAMS docs (LOCAL)
sams-docs

# Jump to APM prompts
sams-docs && cd apm/prompts

# Jump to APM session
sams-docs && cd apm_session
```

### From Code Repository
When referencing APM files from Cursor/Claude commands, **ALWAYS use local paths**:
```
/Users/michael/Projects/SAMS-Docs/apm/prompts/Implementation_Agent
```

**NEVER USE**:
```
~~/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/...~~
```

## Updated Files

The following Cursor command files have been updated with correct Drive paths:
- `.cursorrules` - Main repository rules
- `.cursor/commands/newIA.md` - Initialize Implementation Agent
- `.cursor/commands/newMA.md` - Initialize Manager Agent
- `.cursor/commands/renewIA.md` - Renew Implementation Agent
- `.cursor/commands/renewMA.md` - Renew Manager Agent
- `.cursor/commands/manager-review-enhanced.md` - Manager review process

## Why This Structure?

### Code in Local Storage (`~/Projects/SAMS`)
✅ **Fast** - No Drive sync delays  
✅ **Git-friendly** - Clean repository operations  
✅ **IDE Performance** - Immediate file access  
✅ **Build Speed** - Faster npm installs and builds  

### Docs in Local Storage (`~/Projects/SAMS-Docs`)
✅ **Reliable** - No sync issues or corruption  
✅ **Fast** - Immediate file access  
✅ **Stable** - No cloud connectivity problems  
⚠️ **Manual Backup** - Requires manual backup strategy  

## Migration Notes

**Date: October 21, 2025**
- Moved code from Drive to local storage
- Created SAMS-Docs directory for documentation
- Updated all Cursor command references
- Added shell aliases for quick navigation
- Preserved Git history in new location

**Date: November 3, 2025** ⚠️ **CRITICAL**
- **PERMANENTLY MOVED SAMS-Docs from Google Drive to local storage**
- Reason: Google Drive sync broken on macOS 26 (file corruption, sync failures)
- Updated ALL references from Google Drive to `/Users/michael/Projects/SAMS-Docs`
- Updated `.cursorrules`, all `.cursor/commands`, APM_PATHS.md, shell aliases
- Added warnings to prevent future Google Drive usage
- **THIS IS PERMANENT UNTIL GOOGLE FIXES DRIVE**

---

Last Updated: November 3, 2025

