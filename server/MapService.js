import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAP_DIR = path.join(__dirname, '../shared/maps');

class MapService {
    constructor() {
        if (!fs.existsSync(MAP_DIR)) {
            fs.mkdirSync(MAP_DIR, { recursive: true });
        }
    }

    saveMap(name, data) {
        const fileName = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        const filePath = path.join(MAP_DIR, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return fileName;
    }

    listMaps() {
        if (!fs.existsSync(MAP_DIR)) return [];
        return fs.readdirSync(MAP_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
    }

    loadMap(name) {
        const filePath = path.join(MAP_DIR, `${name}.json`);
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
}

export const mapService = new MapService();
