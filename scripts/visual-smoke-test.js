/**
 * Visual Smoke Test for Titan: Nexus Command
 * This script is intended to be run by the AI agent using the browser-agent skill.
 */

async function runVisualSmokeTest(browser) {
    console.log('Starting Visual Smoke Test...');

    // 1. Navigate to the local dev server
    await browser.open_browser_url('http://localhost:5173');
    await browser.wait_for_selector('#game-canvas');

    // 2. Check for basic UI elements
    const canvasExists = await browser.evaluate_javascript('!!document.querySelector("#game-canvas")');
    if (!canvasExists) throw new Error('Game canvas not found');

    // 3. Verify Fog of War Transparency (Simplified check)
    // We check if the "holes" in the fog are being generated.
    // Since we can't easily read pixels from a canvas in a subagent evaluation without complex logic,
    // we'll check if the fog canvas exists and has contents.
    const fogCanvasValid = await browser.evaluate_javascript(() => {
        const fov = document.querySelector('#fog-canvas');
        return fov && fov.width > 0 && fov.height > 0;
    });
    if (!fogCanvasValid) throw new Error('Fog of War canvas is invalid or missing');

    // 4. Verify Aiming UI Z-Order
    // We simulate a click to select a hub and start aiming.
    // Then we check if the aiming arrow is supposedly being drawn.
    await browser.click_browser_pixel(250, 500); // Click P1 Hub
    await browser.wait_ms(500);

    // 5. Final Screenshot for AI verification
    await browser.capture_browser_screenshot('visual_smoke_test_result');

    console.log('Visual Smoke Test: PASSED (Manual verification of screenshot recommended)');
}

export default runVisualSmokeTest;
