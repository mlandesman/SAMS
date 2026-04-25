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

## Implementation Scope Guard

- Mobile implementation scope is limited to `frontend/mobile-app/**`.
- Desktop UI implementation under `frontend/sams-ui/**` is out of scope for this project and must not be modified.
- `_archive` directories are always read-only references and never valid implementation targets.
- Use `ACTIVE_MODULES.md` and entry-point tracing to confirm active paths before changing code.

## Language and Localization Rules

- Supported UI languages in this project are only `EN` and `ES`.
- The hamburger language choice is the single user control for language behavior; do not add downstream screen-level toggles.
- In selected-language mode, all in-scope translatable visible text should resolve to that language when available.
- If localized content is unavailable, render the existing source value rather than blocking UI behavior.

## Backend Contract and Translation Rules

- Backend localization changes are allowed only when backward compatibility is preserved for existing consumers.
- Any language-aware backend behavior must default to English when language input is missing or invalid.
- Do not remove legacy response fields relied on by existing clients; additive localized behavior is preferred.
- For bulk free-form localization (notes/descriptions/context text), use batched translation patterns (extract, dedupe, batch, remap) and avoid per-record translation calls.
- Translation failures (quota, timeout, auth, service error) must degrade gracefully to source text without breaking primary data retrieval.

## Feature Flag and Safety Rules

- New localization behavior must be gated by a feature flag with clear ON/OFF behavior.
- Keep auth, routing, permissions, and business logic behavior unchanged unless explicitly required by approved scope.
- Do not run deploy commands as part of implementation work in this project.

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

## Validation and Evidence

- Validation must include EN and ES checks across all in-scope mobile routes and major user-visible text surfaces.
- Provide explicit proof that desktop UI files under `frontend/sams-ui/**` were not modified.
- Store language reference tables and validation artifacts in `SAMS-Docs/Agile/PRDs/`.
- Treat final wording review for Spanish quality as a stakeholder review step (Michael and Sandra).

} //APM_RULES
```
