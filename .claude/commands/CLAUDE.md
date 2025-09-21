# APM Claude Code Commands

This directory contains project-specific slash commands for the Agentic Project Management (APM) framework. These commands enable efficient multi-agent coordination in Claude Code.

## Usage

In Claude Code, use these commands with the `/project:` prefix:

```
/project:apm-init-manager
/project:task-prompt task-2.1
/project:memory-read Phase_1/Task_1.1_Log.md
```

## Available Commands

### Agent Initialization
- `/project:newIA` - Initialize as Implementation Agent

## Command Arguments
Some commands accept arguments using `$ARGUMENTS`:
- `newIA` - Optional task assignment text or path to a task file

## Quick Start Example

### Manager Agent (Instance 1)

### Implementation Agent (Instance 2)

## Best Practices

1. Always initialize your agent role first
2. Let the Manager coordinate all planning
3. Log all significant work to Memory Bank
4. Prepare handovers before hitting context limits
