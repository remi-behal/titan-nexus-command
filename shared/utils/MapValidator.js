export function validateMapConfig(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Map data must be a valid JSON object');
    }

    const width = Number(data.width);
    const height = Number(data.height);
    if (isNaN(width) || width < 500 || width > 5000) {
        throw new Error('Map width must be a number between 500 and 5000');
    }
    if (isNaN(height) || height < 500 || height > 5000) {
        throw new Error('Map height must be a number between 500 and 5000');
    }

    const cleaned = {
        width,
        height,
        resources: [],
        lakes: [],
        mountains: [],
        playerBases: [],
        modifiers: {
            windEnabled: !!data.modifiers?.windEnabled
        }
    };

    if (data.playerBases !== undefined) {
        if (!Array.isArray(data.playerBases)) {
            throw new Error('playerBases must be an array');
        }
        if (data.playerBases.length > 8) {
            throw new Error('A map cannot have more than 8 player bases');
        }
        for (const base of data.playerBases) {
            const bx = Number(base.x);
            const by = Number(base.y);
            if (isNaN(bx) || bx < 0 || bx > width || isNaN(by) || by < 0 || by > height) {
                throw new Error('Player base coordinates must be valid numbers within map bounds');
            }
            const owner = String(base.owner || '');
            if (!/^player[1-8]$/.test(owner)) {
                throw new Error('Player base owner must be player1 through player8');
            }
            cleaned.playerBases.push({
                id: String(base.id || `p${cleaned.playerBases.length + 1}`).substring(0, 16),
                x: bx,
                y: by,
                owner
            });
        }
    }

    if (data.resources !== undefined) {
        if (!Array.isArray(data.resources)) {
            throw new Error('resources must be an array');
        }
        if (data.resources.length > 1000) {
            throw new Error('Too many resources (max 1000)');
        }
        for (const res of data.resources) {
            const rx = Number(res.x);
            const ry = Number(res.y);
            if (isNaN(rx) || rx < 0 || rx > width || isNaN(ry) || ry < 0 || ry > height) {
                throw new Error('Resource coordinates must be valid numbers within map bounds');
            }
            const type = String(res.type || 'STANDARD');
            if (type !== 'STANDARD' && type !== 'SUPER') {
                throw new Error('Resource type must be STANDARD or SUPER');
            }
            cleaned.resources.push({
                id: String(res.id || `res_${Math.random()}`).substring(0, 24),
                x: rx,
                y: ry,
                type,
                energy: Number(res.energy || 0),
                regenerationRate: Number(res.regenerationRate || 0),
                maxEnergy: Number(res.maxEnergy || 0),
                size: Number(res.size || 0)
            });
        }
    }

    if (data.lakes !== undefined) {
        if (!Array.isArray(data.lakes)) {
            throw new Error('lakes must be an array');
        }
        if (data.lakes.length > 100) {
            throw new Error('Too many lakes (max 100)');
        }
        for (const lake of data.lakes) {
            const lx = Number(lake.x);
            const ly = Number(lake.y);
            const radius = Number(lake.radius);
            if (isNaN(lx) || lx < 0 || lx > width || isNaN(ly) || ly < 0 || ly > height) {
                throw new Error('Lake coordinates must be valid numbers within map bounds');
            }
            if (isNaN(radius) || radius <= 0 || radius > 1000) {
                throw new Error('Lake radius must be a number between 0 and 1000');
            }
            cleaned.lakes.push({
                id: String(lake.id || `lake_${Math.random()}`).substring(0, 24),
                x: lx,
                y: ly,
                radius
            });
        }
    }

    if (data.mountains !== undefined) {
        if (!Array.isArray(data.mountains)) {
            throw new Error('mountains must be an array');
        }
        if (data.mountains.length > 100) {
            throw new Error('Too many mountains (max 100)');
        }
        for (const mtn of data.mountains) {
            const mx = Number(mtn.x);
            const my = Number(mtn.y);
            const radius = Number(mtn.radius);
            if (isNaN(mx) || mx < 0 || mx > width || isNaN(my) || my < 0 || my > height) {
                throw new Error('Mountain coordinates must be valid numbers within map bounds');
            }
            if (isNaN(radius) || radius <= 0 || radius > 1000) {
                throw new Error('Mountain radius must be a number between 0 and 1000');
            }
            cleaned.mountains.push({
                id: String(mtn.id || `mtn_${Math.random()}`).substring(0, 24),
                x: mx,
                y: my,
                radius
            });
        }
    }

    return cleaned;
}
