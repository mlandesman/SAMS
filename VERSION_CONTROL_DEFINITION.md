# Version Control for Production Deployment

## Problem
We have struggled recently with out-of-sync Frontend and Backend code causing delays in testing and root cause analysis.  It will become more complex when we start deploying the PWA again with shared components.  We need to ensure that each of the primary modules -- Backend, Frontend UI and PWA -- have a clearly displayed, verifiable version number with dates and deployment hash or version information.

## Current State
We have changed how we deploy multiple times in the past.  Recently we have been deploying Frontend and Backend through Vercel but an Agent's attempt to fix the version numbering system last night moved the Frontend to a Firebase deployment bypassing the Vercel model all in an effort to get it's version information to display properly.

### Setting Version Number
A prior agent added the ability to `bump` the NPM build to add the version number (major `1.0.0`, minor `1.1.0` and hot-fix `1.1.1`).  It is unclear to me where these version numbers are set (which JSON file, for example Vercel, package, etc).

### Version Displays
* **Status Bar:** Bottom of all screens has a Status Bar that currently shows Prod vs Development but is always displaying v0.0.1.
* **About Modal:** Clicking on the Status Bar brings up a formatted About Modal that still shows July 2025 deployment (first one we tried) with incorrect version information and no verification methods (Vercel hash or other verifiable version confirmation).
* **Version Check Code:** An agent yesterday built or expanded a version comparison modules that display when you log in.  That has properly displayed the Backend version but has failed to show the Frontend version number as desired.
* **Version Hotkey:** The same agent, when the pop-up modal wasn't working, built a keyboard shortcut (`Shift + Ctrl + V`) to display the same Version Check modal.

## Objective
1. Set versions numbers when deploying simply by instructing Cursor Agent to bump to a specific, 1-up level of Major, Minor or Fix.
2. Ensure that versions across all projects (Frontend, Backend PWA) either match or have documented a "current" version that is compatible.
3. Implement the industry best practice for How to number, Where to number and How to ensure compatible components.
4. A User-level About screen and Status Bar for simple version checking with a more robust, developer-level display for debugging purposes.
5. A very clear way to know if the code we deployed is the code we are running in Production.

## Limitations & Requirements
* Industry best methods, tools and practiced must be used.
* No restrictions on the way we deploy.
    * Vercel direct
    * Firebase direct
    * BASH command through the Agent with a mandatory procedure to follow
    * Push to GH for Vercel deployment
    * Other
* Forced version documentation and deployment method to follow for all Agents.
* While the version numbers don't have to match as it is likely we can push new frontend code that doesn't require a backend modification, we need a solid method of knowing if the codebase is compatible and matchs what we have in Dev when we Deploy.