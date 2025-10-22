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

### 6. AUTOMATIC ARCHIVING (For Approved Reviews Only)

When a review is **APPROVED** without challenges, automatically:

1. **Update Implementation Plan**
   - Mark the issue/phase as COMPLETE or FIXED
   - Add completion date and resolution summary
   - Update progress percentage if applicable

2. **Archive Issue Files**
   Note: APM files are stored in Drive at:
   `/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS-Docs/apm/`
   
   ```bash
   mkdir -p [DRIVE_APM_PATH]/memory/issues/resolved
   mv [DRIVE_APM_PATH]/memory/issues/ISSUE-[ID].md [DRIVE_APM_PATH]/memory/issues/resolved/
   ```

3. **Update References**
   - Add (RESOLVED) tag to issue titles
   - Include archived location path
   - Update status to ✅ FIXED

4. **Move Task Files**
   ```bash
   mv [DRIVE_APM_PATH]/tasks/active/TASK-[ID].md [DRIVE_APM_PATH]/tasks/completed/
   mv [DRIVE_APM_PATH]/memory/tasks/TASK-[ID]-Complete.md [DRIVE_APM_PATH]/tasks/completed/
   ```

5. **Log Archive Action**
   - Note in review document that auto-archive was performed
   - Include list of files moved

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