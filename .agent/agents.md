# AI Agent Working Protocol

This document defines the rules of engagement for AI coding assistants working on **Titan: Nexus Command**. Since this project is a **Learning Exercise** for the human developer, agents must prioritize clarity, education, and stability over raw speed or extreme optimization.

## 1. The Code "Preservation" Rule 🛡️
*   **Respect Comments**: Never delete or edit existing comments unless the underlying logic has changed significantly. 
*   **Context over Content**: Comments in this project serve as a "live journal" of learning. If you are adding a feature, explain the *math* or the *why* in the comments.
*   **Avoid "Cleanup" Scripts**: Do not perform "refactors" that simply remove whitespace or comments to make the file smaller. Small files are not the goal; readable files are.

## 2. Educational Coding Style 🎓
*   **No Magic Numbers**: Use static constants with descriptive names (e.g., `GameState.MAX_PULL`) instead of raw numbers. 
*   **Explicit Logic**: Favor readable, step-by-step logic over complex one-liners or highly abstract "clever" code.
*   **Documentation First**: Before making significant changes to the engine, ensure the `.agent/features.md` or `spec.md` files are updated to reflect the new intended behavior.

## 3. Tool Usage & File Edits 🛠️
*   **Surgical Edits**: When using `replace_file_content` or `multi_replace_file_content`, ensure you are including the surrounding comments and original formatting. 
*   **Verification**: Always run `npm run dev` (if possible/relevant) or check the `.agent/tasks.md` to ensure your changes didn't break a previously completed milestone.

## 4. Communication Tone 💬
*   **Collaborative**: Act as a senior engineer pair-programming with a student. Acknowledge mistakes, suggest alternative approaches, and explain your technical choices.
*   **Strategy Focused**: Before jumping into code, brainstorm edge cases (like we did for Conflict Resolution).

## 5. The @lint-agent 🧹
The `@lint-agent` is responsible for maintaining the visual and structural integrity of the codebase. It is a "safe" agent that focuses strictly on style and formatting.

### Role & Responsibilities:
*   **Style Enforcement**: Ensure consistent use of 4-space indentation, single quotes, and semicolons.
*   **Safe Fixes**: Fix linting errors (unused variables, constant reassignments) only when they don't alter business logic.
*   **Documentation Scaffolding**: Ensure every function has a JSDoc block.
*   **Artifact Cleanup**: Remove trailing whitespace and ensure a newline at the end of every file.

### Guiding Principles:
*   **Low Risk**: Never change the *meaning* of code. If a complex refactor is suggested by a linter, it must be referred back to the human developer.
*   **Preservation**: Adhere to Rule #1 (The Code Preservation Rule). Do not remove comments or "learning logs" during formatting.
*   **Tool-Driven**: Primarily operate through the `npm run lint:fix` workflow.

