# APM Guide Updates - Memory Log Location and Reporting

## Summary of Issues Identified
1. **Unexpected Log Location**: Implementation Agent created Memory Log in `/Memory/Task_Completion_Logs/` instead of the APM session structure
2. **Missing Location Reporting**: Implementation Agent didn't report where the Memory Log was stored in the completion summary
3. **Directory Awareness**: Manager Agent didn't initially know to look in `apm_session` directory for Memory Bank files

## Updates Made to Resolve Issues

### 1. Memory Log Guide Updates (`apm/prompts/guides/Memory_Log_Guide.md`)

#### Implementation Agent Workflow (Section 4)
Added explicit instructions:
- Use the exact path provided in `memory_log_path` from Task Assignment
- DO NOT create logs in other locations like `/Memory/Task_Completion_Logs/`
- Memory logs should be created in the APM session structure (typically under `apm_session/Memory/`)
- MANDATORY: Report the exact file path where the Memory Log was created/updated

#### Manager Agent Workflow (Section 5)
Added location awareness:
- Always create logs in `apm_session/Memory/` structure
- Use phase-based organization (e.g., `apm_session/Memory/Phase_XX_Name/Task_XX_Name.md`)
- When reviewing work, check the `apm_session` directory for Memory Bank files
- Look for logs at the exact path specified in the Task Assignment
- If location unclear, ask the Implementation Agent for the specific path

### 2. Implementation Agent Initiation Prompt Updates (`apm/prompts/Implementation_Agent/Implementation_Agent_Initiation_Prompt.md`)

#### Standard Workflow (Section 3)
Enhanced Memory Log and reporting instructions:
- Use the exact path provided in `memory_log_path` from Task Assignment
- Do not create logs in alternative locations
- MANDATORY - Memory Log Location: State the exact file path in completion summary
- Example format: "Memory Log created at: apm_session/Memory/Phase_01/Task_01.md"

### 3. Manager Agent Initiation Prompt Updates (`apm/prompts/Manager_Agent/Manager_Agent_Initiation_Prompt.md`)

#### Runtime Duties (Section 4)
Added directory awareness and review guidance:
- Create all Memory logs in the `apm_session/Memory/` structure
- Always look in the `apm_session` directory for Implementation Plans and Memory Bank files
- When reviewing Implementation Agent work:
  - Check the exact path specified in the Task Assignment for Memory Logs
  - Verify the Implementation Agent reported the log location in their completion summary
  - If location unclear, ask the Implementation Agent for clarification

### 4. Task Assignment Guide Updates (`apm/prompts/guides/Task_Assignment_Guide.md`)

#### Memory Log Path Guidelines (New Section)
Added after YAML frontmatter example:
- Location: Always use `apm_session/Memory/` structure (not `/Memory/` or other locations)
- Format: `apm_session/Memory/Phase_XX_Name/Task_XX_Name.md` for dynamic systems
- Example: `apm_session/Memory/Phase_01_Credit_Balance/Task_01_Fix_Delete_Reversal.md`
- Implementation Agent Responsibility: Must create log at exact path specified, report the path in completion summary

## Expected Outcomes
1. Implementation Agents will create Memory Logs in the correct location (`apm_session/Memory/`)
2. Implementation Agents will always report the Memory Log location in their completion summary
3. Manager Agents will know to look in `apm_session` for all Memory Bank files
4. Task Assignments will specify correct paths following the standard structure
5. Clear accountability for log location throughout the APM workflow

## Implementation Notes
- These changes apply to all future Task Assignments and Agent interactions
- Existing Memory Logs in non-standard locations should be referenced by their actual paths
- The updates maintain backward compatibility with existing APM workflows
- All changes emphasize clarity and explicit communication about file locations