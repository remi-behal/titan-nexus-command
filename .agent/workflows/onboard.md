---
description: bring a new agent up to speed on the project context
---

This workflow is used when starting a new conversation or when a new agent joins the project to ensure they have the necessary context, understand the rules of engagement, and know the current development status.

### Steps

1. **Protocol Awareness**
   Read the working protocol to understand the rules of engagement (e.g., preservation of comments, educational coding style).
   ```bash
   cat .agent/agents.md
   ```

2. **Project Understanding**
   Review the core documentation to understand the architecture, tech stack, and monorepo structure.
   ```bash
   cat README.md
   cat .agent/spec.md
   ```

3. **Status Check**
   Inspect the current task list and feature roadmap to identify the active phase and remaining objectives.
   ```bash
   cat .agent/tasks.md
   cat .agent/features.md
   ```

4. **Codebase Exploration**
   List the files in the key directories to understand the current file structure.
   ```bash
   ls -R client/src server/ shared/
   ```

5. **Recent Context**
   Check for recent conversation summaries or knowledge items (KIs) to see if there are any ongoing discussions or documented patterns.
   *(Agent: Use your system tools to check for KIs and recent logs if applicable)*

### When to use
- At the start of a new conversation session.
- When an agent is unsure about the project rules or current priorities.
- When resuming work after a significant break.
