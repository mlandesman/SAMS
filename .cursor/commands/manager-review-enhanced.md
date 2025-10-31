# Manager Agent - Review Implementation Work (Enhanced with Auto-Archive)

As a Manager Agent, you will now review completed work from Implementation Agents. This ensures quality, adherence to requirements, and project alignment.

## Review Process

### 1. Synchronize Project State
First, ensure you have the latest project information:
- Check recent Memory Bank entries
- Review Implementation Plan progress
- Identify completed tasks for review

### 2. Review Checklist
For each completed task, evaluate:

#### Functionality Review
- Does it meet the task requirements?
- Are all acceptance criteria satisfied?
- Does it integrate properly with other components?
- Are edge cases handled appropriately?

#### Code Quality Review
- Is the code clean and readable?
- Does it follow project conventions?
- Are there appropriate comments?
- Is the logic clear and maintainable?

#### Technical Review
- Are best practices followed?
- Is the solution efficient?
- Are there any security concerns?
- Is error handling comprehensive?

#### Documentation Review
- Is the Memory Bank entry complete?
- Are implementation decisions documented?
- Is the code self-documenting where possible?
- Are any special considerations noted?

### 3. Feedback Categories

#### ✅ Approved
- Task fully meets requirements
- No significant issues found
- Ready for integration
- **TRIGGERS AUTOMATIC ARCHIVING**

#### 🔄 Minor Revisions Needed
- Small improvements required
- Non-blocking issues
- Can proceed with notes
- **NO AUTOMATIC ARCHIVING**

#### ❌ Major Revisions Required
- Significant issues found
- Requirements not met
- Needs rework before proceeding
- **NO AUTOMATIC ARCHIVING**

### 4. Providing Feedback

Structure your feedback as:
```markdown
## Task Review: [Task ID] - [Task Name]

### Summary
[Brief overview of the review outcome]

### Strengths
- [What was done well]
- [Positive aspects to maintain]

### Areas for Improvement
- [Specific issues found]
- [Required changes]

### Recommendations
- [Suggested approaches]
- [Best practices to follow]

### Next Steps
- [Specific actions needed]
- [Who should handle them]
```

### 5. Memory Bank Update
Log your review to Memory Bank:
- Create review entry in `Memory/Reviews/`
- Reference the task being reviewed
- Include feedback and decisions
- Note any follow-up tasks needed

### 6. AUTOMATIC ARCHIVING (For Approved Reviews Only) - MANDATORY

When a review is **APPROVED** without challenges, you MUST complete this full archiving workflow:

#### Step 1: Create Archive Directory Structure
```bash
# For completed phases/tasks, create organized archive
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm_session/Memory/Archive"

mkdir -p "[Phase_Name]_[Date]/Task_Assignments"
mkdir -p "[Phase_Name]_[Date]/Completion_Logs"
mkdir -p "[Phase_Name]_[Date]/Reviews"
mkdir -p "[Phase_Name]_[Date]/Test_Results"
```

**Example**: `Phase_3_Shared_Services_Extraction_2025-10-27/`

#### Step 2: Move Task Assignment Files (MOVE - prevents confusion)
```bash
# Move task assignments from /apm_session/ root to archive
# These are the files new agents might mistake as "not done yet"
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm_session"

mv Task_[Phase]*.md Memory/Archive/[Archive_Dir]/Task_Assignments/
```

**Why MOVE**: Task assignments in root confuse new agents who assume work is incomplete

#### Step 3: Copy Completion Logs to Archive (COPY - keep originals)
```bash
# Copy (don't move) completion logs - keep originals in Task_Completion_Logs/
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm_session/Memory"

cp Task_Completion_Logs/Task_[Phase]*_Complete*.md Archive/[Archive_Dir]/Completion_Logs/
```

**Why COPY**: Keep originals accessible for quick reference

#### Step 4: Copy Manager Reviews to Archive (COPY - keep originals)
```bash
# Copy (don't move) manager reviews - keep originals in Reviews/
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm_session/Memory"

cp Reviews/Manager_Review_[Phase]*.md Archive/[Archive_Dir]/Reviews/
cp Reviews/Phase_[X]_Complete_Handoff*.md Archive/[Archive_Dir]/Reviews/
```

**Why COPY**: Keep originals for reference, archive for organization

#### Step 5: Move Summary Documents to Archive (MOVE)
```bash
# Move phase/project summary documents from /apm_session/ root to archive
cd "/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm_session"

mv [PHASE]_MANAGER_REVIEW_COMPLETE_SUMMARY.md Memory/Archive/[Archive_Dir]/
mv [PHASE]_COMPLETION_SUMMARY.md Memory/Archive/[Archive_Dir]/ (if exists)
```

#### Step 6: Create Archive README
Create comprehensive README in archive directory explaining:
- What was accomplished (deliverables, metrics)
- Why it's archived (phase complete)
- What remains active (production code locations)
- Archive contents (organized by subdirectory)
- References to Implementation Plan and Project Tracking

#### Step 7: Update Implementation Plan
```markdown
# Mark phase/task as COMPLETE with:
- ✅ COMPLETE status and date
- Duration (actual vs estimated)
- Deliverables summary
- Testing results
- Quality rating (⭐⭐⭐⭐⭐)
- Documentation references (completion log, review)
- Strategic value/impact
```

#### Step 8: Update PROJECT_TRACKING_MASTER.md
```markdown
# Add new milestone entry:
### ✅ [Phase Name] Complete - [Date]
- Achievement summary
- Deliverables breakdown
- Testing and quality metrics
- Strategic impact
- Documentation references
```

#### Step 9: Create Archive Log Entry
Create or append to: `Memory/ARCHIVE_LOG_[YYYY-MM-DD].md`

Document:
- What was archived
- Where it was moved to
- Why it was archived
- Archive structure created
- Files moved vs copied

#### Step 10: Update TODO List
Mark all related TODOs as completed

---

### MANDATORY ARCHIVING CHECKLIST (For Approved Reviews)

Use this checklist for EVERY approved review:

- [ ] Archive directory created: `/Memory/Archive/[Phase_Name]_[Date]/`
- [ ] Subdirectories created: `Task_Assignments/`, `Completion_Logs/`, `Reviews/`
- [ ] Task assignments MOVED to archive (prevents agent confusion)
- [ ] Completion logs COPIED to archive (originals kept)
- [ ] Manager reviews COPIED to archive (originals kept)
- [ ] Summary documents MOVED to archive
- [ ] Archive README.md created
- [ ] Implementation_Plan.md updated with completion
- [ ] PROJECT_TRACKING_MASTER.md updated with milestone
- [ ] Archive log entry created/updated
- [ ] TODO list updated
- [ ] GitHub issues reviewed and updated if applicable

**ALL items must be checked before claiming "Auto-Archive Complete"**

### 7. Communication
After review:
- For APPROVED: Confirm auto-archive completion
- For REVISIONS: Create new task assignments
- Communicate blockers or risks
- Adjust timeline if necessary

## Review Best Practices
- Be constructive and specific
- Focus on requirements and quality
- Provide actionable feedback
- Recognize good work
- Consider project constraints
- Think about long-term maintainability

## After Review
1. Update Memory Bank with review results
2. If APPROVED: Verify auto-archive completed successfully
3. If REVISIONS: Create revision tasks
4. Update project tracking
5. Plan next steps

## Auto-Archive Summary
The auto-archive feature activates ONLY when:
- Review result is ✅ APPROVED
- No challenges or revisions needed
- User has tested and confirmed working

This keeps the workspace clean and prevents resolved issues from appearing in future APM-SYNC operations.

Begin the review process by checking recent completed work in the Memory Bank.