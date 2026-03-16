const fs = require('fs');
const path = require('path');

// Paths relative to project root
const MD_FILES = [
    '.agents/defenses.md',
    '.agents/weapons.md',
    '.agents/structures.md'
];
const STATS_FILE = 'shared/constants/EntityStats.js';
const SPEEDS_FILE = 'shared/constants/LaunchSpeeds.js';

function validate() {
    console.log('--- Stat Validation Start ---');

    // 1. Load JS Stats via regex (simpler than full parser)
    const statsContent = fs.readFileSync(path.join(process.cwd(), STATS_FILE), 'utf8');
    const speedsContent = fs.readFileSync(path.join(process.cwd(), SPEEDS_FILE), 'utf8');

    // Map of Speed Tiers
    const speedTiers = {};
    const speedMatches = speedsContent.matchAll(/(\w+):\s*(\d+)/g);
    for (const match of speedMatches) {
        speedTiers[match[1]] = parseInt(match[2]);
    }

    // 2. Scan MD files
    let hasWarnings = false;

    MD_FILES.forEach(file => {
        const fullPath = path.join(process.cwd(), file);
        if (!fs.existsSync(fullPath)) return;

        const content = fs.readFileSync(fullPath, 'utf8');
        const sections = content.split('###');

        sections.forEach(section => {
            const titleMatch = section.match(/^([^-\n]+)/);
            if (!titleMatch) return;

            const title = titleMatch[1].trim().toUpperCase().replace(/ /g, '_');

            // Try to find matching key in ENTITY_STATS
            // Special cases for naming mismatches
            let statsKey = title;
            if (title === 'DUMB_BOMB') statsKey = 'WEAPON';
            if (title === 'HUBS') statsKey = 'HUB';
            if (title === 'STARTER_HUB') statsKey = 'HUB';

            // Extract block of stats from the JS
            const jsBlockRegex = new RegExp(`${statsKey}:\\s*\\{([^}]+)\\}`, 's');
            const jsMatch = statsContent.match(jsBlockRegex);

            if (jsMatch) {
                const jsStatsStr = jsMatch[1];

                // Check common stats
                const checks = [
                    { name: 'Range', key: 'range' },
                    { name: 'Health', key: 'hp' },
                    { name: 'Health', key: 'hp' }, // Duplicate for different naming
                    { name: 'Launch Cost', key: 'cost' },
                    { name: 'Damage', key: 'damageFull' }
                ];

                checks.forEach(check => {
                    const mdRegex = new RegExp(`\\* \\*\\*${check.name}\\*\\*:\\s*(\\d+)`);
                    const mdMatch = section.match(mdRegex);

                    if (mdMatch) {
                        const mdVal = parseInt(mdMatch[1]);
                        const jsRegex = new RegExp(`${check.key}:\\s*(\\d+)`);
                        const jsStatMatch = jsStatsStr.match(jsRegex);

                        if (jsStatMatch) {
                            const jsVal = parseInt(jsStatMatch[1]);
                            if (mdVal !== jsVal) {
                                console.warn(`[WARNING] ${file}: ${title} "${check.name}" mismatch! MD: ${mdVal}, Code: ${jsVal}`);
                                hasWarnings = true;
                            }
                        }
                    }
                });

                // Check Speed
                const speedRegex = /Speed\*\*: [^\(]+\((\d+) px\/tick\)/i;
                const mdSpeedMatch = section.match(speedRegex);
                if (mdSpeedMatch) {
                    const mdSpeed = parseInt(mdSpeedMatch[1]);
                    const jsSpeedRegex = /speed:\s*SPEED_TIERS\.(\w+)/;
                    const jsSpeedMatch = jsStatsStr.match(jsSpeedRegex);
                    if (jsSpeedMatch) {
                        const tier = jsSpeedMatch[1];
                        const jsSpeed = speedTiers[tier];
                        if (mdSpeed !== jsSpeed) {
                            console.warn(`[WARNING] ${file}: ${title} "Speed" mismatch! MD: ${mdSpeed} (${tier}?), Code: ${jsSpeed}`);
                            hasWarnings = true;
                        }
                    }
                }
            }
        });
    });

    if (!hasWarnings) {
        console.log('✅ All monitored stats are in sync.');
    } else {
        console.log('❌ Documentation mismatches found.');
        // Don't exit 1 yet as requested "warn me"
    }
    console.log('--- Stat Validation End ---');
}

validate();
