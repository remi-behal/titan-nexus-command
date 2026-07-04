import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mapService } from './MapService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAP_DIR = path.join(__dirname, '../shared/maps');

describe('MapService', () => {
    const testMapName = 'temp_test_map_for_service';
    const testMapData = {
        width: 2000,
        height: 2000,
        resources: [{ id: 'res_1', x: 100, y: 100, value: 5 }],
        lakes: [],
        mountains: [],
        playerBases: [
            { id: 'p1', x: 250, y: 500, owner: 'player1' },
            { id: 'p2', x: 750, y: 500, owner: 'player2' }
        ]
    };

    afterEach(() => {
        // Clean up test map if it exists
        const fileName = `${testMapName}.json`;
        const filePath = path.join(MAP_DIR, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    });

    it('should save and load a custom map', () => {
        const filename = mapService.saveMap(testMapName, testMapData);
        expect(filename).toBe(`${testMapName}.json`);

        const loaded = mapService.loadMap(testMapName);
        expect(loaded).toBeDefined();
        expect(loaded.width).toBe(2000);
        expect(loaded.resources[0].id).toBe('res_1');
    });

    it('should delete a custom map and return true, or false if not found', () => {
        mapService.saveMap(testMapName, testMapData);
        
        const deleted = mapService.deleteMap(testMapName);
        expect(deleted).toBe(true);

        const loaded = mapService.loadMap(testMapName);
        expect(loaded).toBeNull();

        const deleteAgain = mapService.deleteMap(testMapName);
        expect(deleteAgain).toBe(false);
    });
});
