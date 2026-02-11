---
description: how to run the project-wide lint and formatting agent
---

This workflow is used by the `@lint-agent` (or any agent) to ensure the codebase adheres to the project's design aesthetics and coding standards.

### Steps

1. **Scan the Project**
   Run the lint command to identify style violations across client, server, and shared directories.
   ```bash
   npm run lint
   ```

2. **Auto-Fix Style Issues**
   Apply automated fixes for formatting, indentation, and basic linting errors.
// turbo
   ```bash
   npm run lint:fix
   ```

3. **Verify JSDoc & Documentation**
   Manually check files that were modified to ensure JSDoc headers exist for all exported functions and classes. Ensure Rule #1 (Preservation) was respected.

4. **Summarize Changes**
   Provide the user with a list of files that were significantly modified and any linting errors that require manual intervention.

### When to use
- After completing a new feature.
- Before a major pull request/merge.
- When noticing inconsistent indentation or quoting styles.
