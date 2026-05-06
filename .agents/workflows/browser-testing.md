---
description: how to perform reliable browser testing in WSL
---

# Browser Testing Workflow (WSL Mirrored)

When visual verification or console debugging is required, follow these steps:

1. **Ask User to Start the Bridge**:
   Stop and Ask User to Run `npx @dbalabka/chrome-wsl` in the terminal. Wait for user to indicate success

2. **Conduct Testing**:
   Use the `browser_subagent` or `read_browser_page` tools. They will automatically detect the bridge at `http://127.0.0.1:9222`.

_Note: Ensure the local development server (npm run dev) is running before step 2._