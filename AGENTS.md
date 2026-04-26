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
- Use `SAMS-Docs/Agile/Sprint_Groups.md` and `SAMS-Docs/Agile/Roadmap_and_Timeline.md` as canonical sprint/roadmap references for this cycle.

## Implementation Scope Guard

- Transaction notes localization scope is limited to backend transaction surfaces and migration tooling.
- In-scope data fields are only `notes` mirrors: top-level `notes_es` and `allocations[].notes_es`.
- Transactions or allocations without `notes` are ignored.
- Do not expand scope to translate `vendorName`, `accountName`, `paymentMethod`, or category names in this cycle.
- `_archive` directories are always read-only references and never valid implementation targets.

## Translation Pipeline Rules

- Backend localization changes are allowed only when backward compatibility is preserved for existing consumers.
- Any language-aware backend behavior must default to English when language input is missing or invalid.
- Do not remove legacy response fields relied on by existing clients; additive localized behavior is preferred.
- Use deterministic translation first for known SAMS-generated/hardcoded note text; use DeepL fallback only for unresolved strings.
- Preserve all ALL-CAPS tokens verbatim during deterministic translation (for example, `HOA`).
- Use compact quarter notation (`Tn`) in generated note text.
- Keep source `notes` unchanged; persist only additive `notes_es` mirrors (no extra metadata fields).

## Read/Write Contract Rules

- Transaction create/update paths must persist `notes_es` only for note fields that changed.
- Transaction read and recent-transactions read paths must return persisted note companions and must not call runtime free-form DeepL translation for notes.
- Keep auth, routing, permissions, and business logic behavior unchanged unless explicitly required by approved scope.

## Backfill Operational Safety

- Backfill must support `--dry-mode` and `--prod`.
- Backfill must be idempotent: skip any note location where `notes_es` already exists; safe reruns are required.
- Use conservative batched and spaced translation requests with retry/backoff and jitter for 429 responses; honor `Retry-After` when available.
- Stop safely on hard quota limits and provide output that supports resume in later runs.

## Validation and Evidence

- Required evidence includes dry-run count output and live-run count output from migration execution.
- Verify create/update behavior only translates note fields that changed.
- Verify transaction and recent-transactions read behavior no longer depends on runtime note translation.

## Version Control Conventions

- Base branch: `main`.
- Branch naming convention: `<type>/<short-description>` where `type` is one of `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- Commit naming convention: `<type>(optional-scope): <description>` using the same `type` set.
- APM workspace convention: `.apm/` remains untracked in git and is managed/archived locally via APM CLI workflow.

} //APM_RULES
```
