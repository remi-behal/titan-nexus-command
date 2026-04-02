const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../client/src/components/GameBoard.jsx');

// Contexts to track independently
const CONTEXTS = ['ctx', 'fctx', 'offscreenCtx'];

function validateCanvasStack(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Independent depths for each context
    const depths = {};
    CONTEXTS.forEach(c => depths[c] = 0);

    let errors = 0;

    console.log(`Validating Canvas Stack in: ${filePath}`);

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        CONTEXTS.forEach(ctxName => {
            const saveRegex = new RegExp(`${ctxName}\\.save\\(`, 'g');
            const restoreRegex = new RegExp(`${ctxName}\\.restore\\(`, 'g');

            const saves = (line.match(saveRegex) || []).length;
            const restores = (line.match(restoreRegex) || []).length;

            if (saves > 0 || restores > 0) {
                depths[ctxName] += saves - restores;

                if (depths[ctxName] < 0) {
                    console.error(`ERROR [${ctxName}]: Stack Underflow at line ${lineNum}: ${line.trim()}`);
                    errors++;
                    // Reset to avoid cascading errors for this line
                    depths[ctxName] = 0;
                }
            }
        });
    });

    // Final check for each context
    CONTEXTS.forEach(ctxName => {
        if (depths[ctxName] !== 0) {
            console.error(`ERROR [${ctxName}]: Mismatched Canvas Stack! Final Depth: ${depths[ctxName]}. Check for missing .restore() calls.`);
            errors++;
        }
    });

    if (errors > 0) {
        console.error(`\nValidation FAILED with ${errors} error(s).`);
        process.exit(1);
    } else {
        console.log('Canvas Stack Validation: PASSED (All contexts balanced)');
    }
}

validateCanvasStack(targetFile);
