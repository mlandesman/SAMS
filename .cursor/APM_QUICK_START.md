# APM Quick Start Guide

## Getting Started with APM in Local SAMS

### Important Note
APM documentation is stored in **Google Drive**, not in the local code repository.

**Drive Location:**
```
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs
```

## Quick Navigation

### Using Aliases
```bash
# Jump to code
sams

# Jump to docs
sams-docs

# Jump to APM prompts
sams-docs && cd apm/prompts

# Jump to current session
sams-docs && cd apm_session
```

## Initialize APM Agents

### Implementation Agent
Use the `/newIA` command in Cursor:
```
/newIA
```
This will read prompts from:
`[Drive]/SAMS-Docs/apm/prompts/Implementation_Agent/`

### Manager Agent
Use the `/newMA` command in Cursor:
```
/newMA
```
This will read prompts from:
`[Drive]/SAMS-Docs/apm/prompts/Manager_Agent/`

## Common APM Tasks

### Check Current Implementation Plan
```bash
sams-docs
cat apm_session/Implementation_Plan.md
```

### View Active Issues
```bash
sams-docs
ls -la apm/memory/issues/
```

### View Active Tasks
```bash
sams-docs
ls -la apm/tasks/active/
```

### Check Resolved Issues
```bash
sams-docs
ls -la apm/memory/issues/resolved/
```

## Path Reference

All Cursor commands have been updated to use the full Drive path:
```
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/
```

See `APM_PATHS.md` in the project root for complete documentation.

## Troubleshooting

### Can't Find APM Files
1. Check Drive is mounted: `ls "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/"`
2. Verify SAMS-Docs exists: `sams-docs && pwd`
3. Check APM directory: `sams-docs && ls -la`

### Commands Not Working
1. Reload bash profile: `source ~/.bash_profile`
2. Test aliases: `alias | grep sams`
3. Manually navigate: `cd ~/Projects/SAMS`

---

**Quick Test:**
```bash
# Should show: ~/Projects/SAMS
sams && pwd

# Should show: [Drive]/SAMS-Docs
sams-docs && pwd
```

Last Updated: October 21, 2025

