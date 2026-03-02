---
description: how to perform reliable browser testing in WSL
---

# Browser Testing Workflow (WSL Mirrored)

When visual verification or console debugging is required, follow these steps:

1. **Start the Bridge**:
// turbo
Run `yes y | npx @dbalabka/chrome-wsl` in the terminal. Wait for the green "✅ DevTools reachable" check.

2. **Conduct Testing**:
Use the `browser_subagent` or `read_browser_page` tools. They will automatically detect the bridge at `http://127.0.0.1:9222`.

3. **Cleanup**:
// turbo
Once testing is finished, run `npx @dbalabka/chrome-wsl --stop` to close the tunnel and the Chrome instance. Wait to see "✅ Stopped socat forwarding for port 9222."

*Note: Ensure the local development server (npm run dev) is running before starting the bridge.*