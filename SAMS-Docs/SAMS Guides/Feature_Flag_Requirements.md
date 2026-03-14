SAMS Engineering Rules — Branching, Integration, Feature Flags, and Deployment Discipline

Purpose

These rules exist to prevent semantic drift bugs (code runs but produces wrong values), especially in shared finance logic (UPC, credit balances, statements, allocations, currency conversions). These rules apply to all implementation agents, all PRs, and all deployments.

⸻

1) Branch Discipline

1.1 Main branch rule
	•	main must always be production-safe and deployable.
	•	Never commit directly to main.

1.2 One branch = one feature
	•	Every feature or fix must be done in its own branch:
	•	feature/<short-name>
	•	fix/<short-name>
	•	Avoid “mega branches” containing multiple unrelated tasks.

1.3 PR required
	•	Every merge to main must be through a Pull Request (PR), even for solo development.
	•	The PR must clearly describe what changed, why it changed, and what is potentially impacted downstream.

⸻

2) Shared Contract Discipline (Most Important)

2.1 Shared core logic is a contract
	•	Any shared core calculation output is treated as an API contract.
	•	Do not change the meaning of an existing output field silently.

2.2 No “shape-shifting” return objects
	•	Shared core functions must not toggle semantics based on the caller.
	•	If different consumers require different interpretations:
	•	shared core returns raw canonical data only
	•	wrappers/formatters build consumer-specific outputs

2.3 Wrapper pattern required
	•	Implement wrapper functions when downstream consumers differ in expectations:
	•	e.g. UPC preview wrapper vs Statement wrapper
	•	Backend core should return normalized truth; wrapper applies filtering and semantic interpretation.

2.4 Changes to shared logic require impact review
	•	Any changes to shared logic MUST include a review of downstream consumers:
	•	statements
	•	UPC preview
	•	budget/runway graphs
	•	payment application logic
	•	credit balance logic
	•	exports / PDFs

⸻

3) Integration Rule (Prevent Subtle Breakage)

3.1 Must integrate before merge

Before merging any PR into main, the branch MUST be updated with the latest main:
	•	Merge or rebase main into feature branch BEFORE final testing and merge.

3.2 Why this matters

This prevents semantic drift where:
	•	branch A changes shared function contract
	•	branch B still assumes old behavior
	•	merge compiles but produces wrong values

3.3 Required integration process
	•	Update branch with main:
	•	git fetch origin
	•	git merge origin/main (or git rebase origin/main)
	•	Resolve conflicts
	•	Re-test feature after integration

⸻

4) Feature Flags Policy (SAMS-Specific)

4.1 Why flags exist in SAMS

Feature flags are used to:
	•	safely merge incomplete work
	•	isolate new modules (Polls/Voting/Projects)
	•	protect backend + shared contracts
	•	prevent accidental writes or semantic changes during rollout

4.2 When flags are REQUIRED

Use a feature flag when:
	•	adding a new module with new data model or collections
	•	modifying shared finance logic (UPC, statements, credit balances)
	•	introducing new backend routes that may destabilize production
	•	introducing migrations or new data writes
	•	adding scheduled/background jobs

4.3 What must be gated

For new modules behind flags:
	•	UI navigation / buttons
	•	backend routes (return feature disabled)
	•	Firestore writes
	•	scheduled jobs / triggers

4.4 Feature flags are temporary by default

Unless explicitly marked as client configuration, feature flags must be removed after rollout.

⸻

5) Feature Flag Removal Standard (Prevent Code Bloat)

5.1 Two-release rule

Temporary feature flags follow the “Two-release rule”:
	1.	Release N: code ships behind flag
	2.	Release N: flag enabled in prod
	3.	Release N+1: remove flag + dead code

5.2 Billing-cycle stability rule (SAMS financials)

For shared finance logic:
	•	flag must remain available for rollback until at least one full statement/billing cycle is confirmed correct
	•	after confirmation, remove the flag in next deployment

5.3 Permanent flags vs temporary flags
	•	Temporary dev flags: MUST be removed
	•	Client configuration flags: may remain indefinitely
	•	e.g. client.enableMultiOwner, client.enableWhatsAppNotices

5.4 Flag cleanup is mandatory

Every deployment cycle must include a check:
	•	“Are any temporary flags permanently ON?”
If yes → remove flag and old branch logic.

⸻

6) Deployment Safety Rules

6.1 Deploy only from main
	•	Production deployments must be from main only.

6.2 No partial merges
	•	Never merge partially complete changes into main unless they are protected by a feature flag that prevents all activation paths.

6.3 Semantic correctness is part of deployment readiness
	•	A deployment is not considered successful merely because it compiles.
	•	Ensure changes do not silently alter numeric meaning:
	•	currency units
	•	credit balance treatment
	•	sign conventions
	•	allocation rules
	•	rounding rules

⸻

7) Optional Future Testing Guidance (Not required today)

7.1 Golden fixtures recommended

When feasible, implement fixture-based golden tests:
	•	canonical raw calculation outputs
	•	wrapper outputs (statement wrapper, UPC preview wrapper)

7.2 Goldens must not depend on live Firestore
	•	use emulator, seeded fixtures, or exported JSON snapshots for stable inputs

⸻

8) Agent Behavior Requirements

All Cursor implementation agents MUST:
	•	follow the above rules automatically
	•	proactively warn when a change touches shared contracts
	•	recommend wrappers instead of toggling shared core semantics
	•	use feature flags for incomplete modules and contract evolution
	•	include flag cleanup tasks once feature is stable

⸻

9) Feature Flag Implementation Pattern

9.1 Flag storage location

Feature flags are **system-level** (deployment/code-version scoped, not per-client). Stored in Firestore at:
```
system/featureFlags
```
The `system` collection holds system-wide config (backup, nightlyScheduler, featureFlags, etc.).

Document structure:
```javascript
{
  // Module-level flags (isolate entire features)
  polls: { enabled: false, enabledAt: null },
  projects: { enabled: true, enabledAt: "2026-01-29" },
  
  // Finance-logic flags (protect shared contracts)
  newPenaltyCalculation: { enabled: false, enabledAt: null },
  
  // Metadata
  lastUpdated: Timestamp,
  updatedBy: "michael@landesman.com"
}
```

9.2 Backend flag checking

Create utility at `functions/backend/utils/featureFlags.js`:
```javascript
import { getDb } from '../firebase.js';

let cachedFlags = null;
let cacheExpiry = 0;
const CACHE_TTL = 60000; // 1 minute

export async function getFeatureFlags() {
  const now = Date.now();
  if (cachedFlags && now < cacheExpiry) return cachedFlags;
  
  const db = await getDb();
  const doc = await db.doc('system/featureFlags').get();
  cachedFlags = doc.exists ? doc.data() : {};
  cacheExpiry = now + CACHE_TTL;
  return cachedFlags;
}

export async function isFeatureEnabled(featureName) {
  const flags = await getFeatureFlags();
  return flags[featureName]?.enabled === true;
}
```

9.3 Frontend flag checking

Flags are loaded once at app init and cached in context:
```javascript
// In App.jsx or FeatureFlagContext
const [featureFlags, setFeatureFlags] = useState({});

useEffect(() => {
  fetchFeatureFlags().then(setFeatureFlags);
}, []);

// Usage in components
const pollsEnabled = featureFlags.polls?.enabled;
```

9.4 Gating patterns

**Backend route gating:**
```javascript
router.get('/clients/:clientId/polls', async (req, res) => {
  if (!await isFeatureEnabled('polls')) {
    return res.status(404).json({ error: 'Feature not available' });
  }
  // ... normal handler
});
```

**Frontend navigation gating:**
```jsx
{featureFlags.polls?.enabled && (
  <NavItem to="/polls">Polls</NavItem>
)}
```

**Firestore write gating:**
```javascript
if (!await isFeatureEnabled('polls')) {
  throw new Error('Polls feature is disabled');
}
await db.collection('clients').doc(clientId).collection('polls').add(pollData);
```

⸻

10) PR Review Flow

10.1 Standard flow

1. **Implementation Agent** creates feature branch and implements
2. **Implementation Agent** creates PR with description
3. **Manager Agent** reviews using `manager-review-enhanced` workflow
4. **Michael** performs final review and approves/merges
5. **Michael** decides when to deploy to production

10.2 What PRs must include

- Clear description of what changed
- List of files modified
- Impact assessment (what downstream consumers are affected)
- Feature flag status (if applicable)
- Testing performed

⸻

11) Hotfix Exception Path

11.1 When to use hotfix path

Use only for:
- Production is broken (critical bug)
- Data integrity at risk
- User-facing functionality completely blocked

11.2 Hotfix process

1. Create branch: `hotfix/<issue-number>-<short-name>`
2. Implement minimal fix only (no feature work)
3. Create PR with abbreviated review
4. Manager Agent reviews (expedited)
5. Michael approves and merges
6. Deploy immediately to production
7. Document in hotfix log

11.3 Hotfix rules

- Fix ONLY the immediate issue
- No refactoring or "while we're here" changes
- Must still pass linting
- Document the fix in Implementation_Plan.md after deployment

⸻

12) Current Feature Flag Inventory

| Flag Name | Status | Added | Purpose | Remove After |
|-----------|--------|-------|---------|--------------|
| polls | ON | 2026-03-14 | Polls/Voting module | First billing cycle after enable |
| projects | REMOVED | 2026-01-29 | Projects/Bids module | Flag wrappers removed in Sprint 235 (was ON since 2026-01-29) |
| projectPaymentsInUPC | OFF | 2026-03-07 | Project assessment payments in UPC | First billing cycle after enable |

**Note:** This table must be updated when flags are added or removed.

⸻

13) Release Cadence

13.1 Cadence type

SAMS uses **Sprint/Feature-based releases**, not calendar-based.

13.2 Release triggers

A release happens when:
- A sprint is complete and approved
- A feature is complete and stable
- A hotfix is required
- Mobile testing requires production deployment

13.3 Release checklist

Before deploying:
- [ ] All PRs merged to main
- [ ] Main branch tested
- [ ] Changelog finalized (`deploySams.sh` handles this)
- [ ] Feature flags configured correctly
- [ ] Temporary flags reviewed for cleanup

⸻

Document Metadata

**Created:** February 4, 2026
**Location:** `/SAMS-Docs/SAMS Guides/Feature_Flag_Requirements.md`
**Audience:** All Manager and Implementation Agents
**Review:** Manager Agents MUST read this before creating task assignments