---
description: initialize the project for development
---

This workflow is used to set up the development environment from scratch, ensuring all dependencies are installed and the system is ready for development.

### Prerequisites
- Ensure you are connected to the WSL environment (Ubuntu 24.04).

### Steps

1. **Install Dependencies**
   Install all necessary packages for the root, client, and server.
// turbo
   ```bash
   npm run install:all
   ```

2. **Verify Project Health**
   Run the linting suite to ensure the environment is clean and there are no immediate syntax errors.
   ```bash
   npm run lint
   ```

3. **Start Development Servers**
   Launch both the backend (Socket.io) and frontend (Vite) servers.
   ```bash
   npm run dev
   ```

### When to use
- After a fresh clone of the repository.
- After a major branch switch where dependencies might have changed.
- When troubleshooting environment-related build failures.
