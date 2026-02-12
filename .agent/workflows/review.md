---
description: Internal protocol for the agent to facilitate clean code reviews and handle diff context
---

# AI Code Review & Diff Protocol

Follow these steps to minimize user frustration with long-conversation diffs and the `Ctrl+L` context loss.

## 1. Handling Diffs and "What Changed?" Queries
When a user asks about changes (especially via `Ctrl+L` which may omit "old" code):
*   **DO NOT** ask the user to provide the previous version of the code.
*   **DO** use `git diff` or `git show HEAD:[path]` to compare the current state with the last commit or session start.
*   **DO** provide a clean, focused markdown diff in the chat if the user expresses frustration with the "Review Changes" UI tab.

## 2. Proactive "Clean Slate" Reminders
The "Review Changes" tab becomes cluttered over long sessions.
*   After completing a significant feature or a sub-task, summarize the changes clearly.
*   If the local file state is clean and we are at a natural stopping point, suggest that the user **start a new conversation thread** to reset their "Review Changes" tab.

## 3. Minimizing UI Noise
*   Before making many small changes across many files, explain the plan. This helps the user track the "Why" before the "Review Changes" tab gets flooded.
*   If the user is struggling with a "massive diff," offer to walk through the changes function-by-function using terminal output rather than the UI diff tool.
