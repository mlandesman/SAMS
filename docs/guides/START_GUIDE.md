# SAMS Project Startup Guide

This document explains how to start the SAMS application development environment.

## Quick Start

To start both backend and frontend servers with a single command, run:

```bash
./start_sams.sh
```

## VS Code Integration

For VS Code users, built-in tasks are available:

1. Press `Cmd+Shift+P` (or `Ctrl+Shift+P` on Windows/Linux)
2. Type "Tasks: Run Task" and select it
3. Choose one of the following tasks:
   - `Start SAMS (Backend + Frontend)` - Starts both servers
   - `Start Backend Only` - Runs just the backend server
   - `Start Frontend Only` - Runs just the frontend development server

You can also press `Cmd+Shift+B` (or `Ctrl+Shift+B` on Windows/Linux) to run the default build task, which is set to start both servers.

## Manual Startup

If you prefer to start the servers manually:

### Backend:
```bash
cd backend
npm start
```

### Frontend:
```bash
cd frontend/sams-ui
npm run dev
```

## Server Information

- Backend runs on: http://localhost:3001
- Frontend runs on: http://localhost:5173

## Troubleshooting

If you encounter errors like "Port already in use":

1. Find the process using the port:
   ```bash
   lsof -i:3001  # For backend
   lsof -i:5173  # For frontend
   ```

2. Kill the process:
   ```bash
   kill -9 <PID>
   ```

For Vite-specific issues, try clearing the Vite cache:
```bash
rm -rf frontend/sams-ui/node_modules/.vite
```
