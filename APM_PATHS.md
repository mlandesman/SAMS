# APM Documentation Paths

## Overview
APM (Agent Process Management) documentation and prompts are stored in **Google Drive** for accessibility across devices, while the code repository is stored **locally** for performance.

## Path Reference

### Full Path (for scripts and absolute references)
```
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs
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

# Jump to SAMS docs in Drive
sams-docs

# Jump to APM prompts
sams-docs && cd apm/prompts

# Jump to APM session
sams-docs && cd apm_session
```

### From Code Repository
When referencing APM files from Cursor/Claude commands, use full paths:
```
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm/prompts/Implementation_Agent
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

### Docs in Drive (`SAMS-Docs/`)
✅ **Accessible** - Available on all devices  
✅ **Synced** - Automatic cloud backup  
✅ **Collaborative** - Easy to share and access  
✅ **Historical** - Preserved across machines  

## Migration Notes

Date: October 21, 2025
- Moved code from Drive to local storage
- Created SAMS-Docs directory for documentation
- Updated all Cursor command references
- Added shell aliases for quick navigation
- Preserved Git history in new location

---

Last Updated: October 21, 2025

