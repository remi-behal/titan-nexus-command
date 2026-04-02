const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../client/src/components/GameBoard.jsx');

function validateCanvasStack(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let stackDepth = 0;
    let errors = 0;

    console.log(`Validating Canvas Stack in: ${filePath}`);

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Count saves and restores
        const saves = (line.match(/ctx\.save\(/g) || []).length;
        const restores = (line.match(/ctx\.restore\(/g) || []).length;

        // Skip fogCanvas for now, or track it separately if needed
        // const fSaves = (line.match(/fctx\.save\(/g) || []).length;
        // const fRestores = (line.match(/fctx\.restore\(/g) || []).length;

        if (saves > 0 || restores > 0) {
            stackDepth += saves - restores;
            if (stackDepth < 0) {
                console.error(`ERROR: Canvas Stack Underflow at line ${lineNum}: ${line.trim()}`);
                errors++;
            }
        }
    });

    if (stackDepth !== 0) {
        console.error(`ERROR: Mismatched Canvas Stack! Final Depth: ${stackDepth}. Check for missing ctx.restore() calls.`);
        errors++;
    }

    if (errors > 0) {
        process.exit(1);
    } else {
        console.log('Canvas Stack Validation: PASSED');
    }
}

validateCanvasStack(targetFile);
