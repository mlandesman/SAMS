# AGENTS.md

Canonical agent-facing entry point for the SAMS workspace. Read this file first. Consult the cross-referenced source documents below for full detail.

## House Rules

The four documents below remain authoritative for their respective domains. This file does not duplicate their content — it links to them. When a House Rule and a source document conflict, the source document wins; report the conflict via your Task report.

| Source document | Path | What it covers | When to consult |
|-----------------|------|----------------|-----------------|
| Root collaboration guidelines | `/Users/michael/Projects/SAMS/CLAUDE.md` | `_archive` directive, collaboration principles (challenge, push back, think critically) | Before challenging a request, when deciding whether code is in active use |
| Cursor engineering rules | `/Users/michael/Projects/SAMS/.cursorrules` | SAMS engineering rules (ES6 modules only, America/Cancun timezone, Firebase Auth headers, domain-specific routing) | When making any change that could affect production code paths (this APM v1.0.1 base setup project does NOT touch production code, but consult if surprised) |
| SAMS-Docs path conventions | `/Users/michael/Projects/SAMS/SAMS-Docs/CLAUDE.md` | Path conventions, `memory_log_path` convention, document creation rules, the broken Google Drive history | When creating any task assignment, memory log, completion log, or handover document |
| SAMS engineering standards | `/Users/michael/Projects/SAMS/.apm/SAMS Guides/CRITICAL_CODING_GUIDELINES.md` | Engineering standards for SAMS code | When touching production code (out of scope for the APM v1.0.1 base setup project) |
| APM communication skill | `/Users/michael/Projects/SAMS/.cursor/skills/apm-communication/SKILL.md` | Agent-to-agent communication, file-based Message Bus protocol, Agent Slug Format, bus identity standards | Whenever sending a Task, Report, or Handoff message |
| Canonical module index | `/Users/michael/Projects/SAMS/ACTIVE_MODULES.md` | Source of truth for which directories and files are in active use across the SAMS workspace | When verifying whether a path is current or stale |

## APM Rules

```text
APM_RULES {

## Workspace Conventions

- All file paths in your output must be absolute (starting with `/Users/michael/Projects/SAMS/`) or workspace-relative. Never reference paths under `/Users/michael/Library/CloudStorage/GoogleDrive-...` — Google Drive sync is broken on macOS 26 and those paths do not resolve.
- `SAMS-Docs/` is a subdirectory inside the SAMS git repository at `/Users/michael/Projects/SAMS/SAMS-Docs/`. It is not a separate repository.
- The canonical mobile app path is `/Users/michael/Projects/SAMS/frontend/mobile-app/`. The path `frontend/sams-ui/mobile-app/` is documented as stale; treat any reference to it as a stale reference to be corrected, not as an alternative location.

## Read-Only Boundaries

Treat the following as read-only unless your Task explicitly authorizes modification. If a Task appears to require modifying any of these without explicit authorization, stop and escalate via your Task report.

- APM v1.0.1 framework files: `.cursor/apm-guides/`, `.cursor/commands/apm-1` through `apm-9`, `.cursor/skills/apm-communication/`, `.cursor/agents/apm-archive-explorer.md`.
- `.apm/archives/session-2026-04-21-001/` and any other subdirectory under `.apm/archives/`. Read for verification only.
- All production code: `frontend/`, `backend/`, `functions/`, `shared/`, `scripts/`.
- Any `_archive` directory anywhere in the workspace (per the SAMS rule that no code from `_archive` is in active use).

## APM v1.0.1 Vocabulary

- Use v1.0.1 vocabulary in all writing: Planner, Manager, Worker; commands `apm-1-initiate-planner` through `apm-9-recover`; Task, Stage, Spec, Plan, Tracker, Memory Index, Bus, Handoff.
- Do not use v0.5 vocabulary in new content: "Manager Agent", "Implementation Agent", "Memory Agent", "Implementation Plan", "renewMA", "renewIA", "Task Assignment Prompt".
- When you encounter v0.5 vocabulary in source documents you are explicitly editing per your Task, update or annotate it as your Task's Guidance directs. Never carry v0.5 vocabulary forward into new content you author.

## Authority and Escalation Discipline

- When your Task grants execute-authority for a destructive operation (branch deletion, GitHub issue closure, file deletion, content removal), apply that authority only to cases that meet the clear-classification criteria specified in the Task's Guidance.
- For any case that is ambiguous against those criteria, do not act. Add the case to your Task report under an "Escalations" or "Ambiguous Cases" section with: subject, observed state, why it is ambiguous, recommended action, and your rationale.
- Prefer preserving content when in doubt. The cost of preserving an extra file, branch, or issue is much lower than the cost of losing something the User wanted retained.

## Verification Before Destruction

- Before any destructive operation (deletion, closure, removal, mass-edit), capture the pre-state as evidence: file lists via `git status --short` or `ls`, branch lists via `git branch -a`, issue lists via `gh issue list --json ...`, file contents you are about to overwrite via Read.
- After the operation, capture the post-state with the same command shape.
- Both snapshots are part of your Task report's evidence record. Reports without evidence are incomplete.

## Out-of-Scope Guard

- For any Task in the APM v1.0.1 Base Setup project, do not modify production code under `frontend/`, `backend/`, `functions/`, `shared/`, or `scripts/`.
- Do not invoke any deploy command: no `deploySams.sh`, no `firebase deploy`, no `vercel`, no `npm run deploy:*`.
- If a Task appears to require either of the above, stop and escalate via your Task report. The project Spec scopes this work as workspace-and-metadata only.

## Markdown Editing Conventions

- When editing existing markdown documents (e.g., `Roadmap_and_Timeline.md`, `Sprint_Groups.md`, `CLAUDE.md`, `ACTIVE_MODULES.md`), preserve the existing structural conventions: heading levels, table column orders, schedule-note prefix patterns, list styles, footer separators.
- Do not introduce new top-level section structure unless your Task explicitly authorizes it.
- For chronological notes (e.g., Roadmap schedule notes, completion log rows), follow the existing date-prefix and ordering pattern visible immediately above your insertion point.
- When prepending content (e.g., deprecation notice headers), insert above the existing content without modifying it. The existing content's bytes below your insertion should be preserved exactly.

## Memory Log Location

- Task completion logs for this workspace are written to `/Users/michael/Projects/SAMS/SAMS-Docs/apm_session/Memory/Task_Completion_Logs/<Task_Name>_<YYYY-MM-DD>.md`.
- The `.apm/memory/index.md` file is the v1.0.1-required Memory Index that points outward to those logs. New task completion logs continue going to the SAMS-Docs path; the Memory Index references them.

## Version Control Conventions

- Base branch is `main` for this repository unless explicitly overridden by the User.
- Branch naming convention: `type/short-description`.
- Commit message convention: `type(scope): description`.
- Preferred commit types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

## User Collaboration

- Challenge requests that seem suboptimal, unclear, or potentially problematic. Do not agree by default.
- When you encounter ambiguity in a Task, ask the User a focused clarifying question rather than proceeding on assumption.
- When you find a better approach than what's specified, surface it with reasoning and ask before proceeding.
- Never claim success without documented evidence the User can verify: file paths, commit SHAs, command outputs, screenshots, or other artifacts.
- Be honest about what was done versus what was deferred or escalated. Partial success is success-with-caveats; report the caveats.

} //APM_RULES
```
