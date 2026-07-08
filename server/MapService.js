import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateMapConfig } from '../shared/utils/MapValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAP_DIR = path.join(__dirname, '../shared/maps');
const READY_MAP_DIR = path.join(__dirname, '../shared/ready_maps');

class MapService {
    constructor() {
        if (!fs.existsSync(MAP_DIR)) {
            fs.mkdirSync(MAP_DIR, { recursive: true });
        }
        if (!fs.existsSync(READY_MAP_DIR)) {
            fs.mkdirSync(READY_MAP_DIR, { recursive: true });
        }
    }

    saveMap(name, data) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new Error('Map name must be a non-empty string');
        }
        const validated = validateMapConfig(data);
        const fileName = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        const filePath = path.join(MAP_DIR, fileName);
        fs.writeFileSync(filePath, JSON.stringify(validated, null, 2));
        return fileName;
    }

    deleteMap(name) {
        if (typeof name !== 'string') return false;
        const fileName = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        const filePath = path.join(MAP_DIR, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    }

    listMaps() {
        if (!fs.existsSync(MAP_DIR)) return [];
        return fs
            .readdirSync(MAP_DIR)
            .filter((f) => f.endsWith('.json'))
            .map((f) => f.replace('.json', ''));
    }

    listReadyMaps() {
        if (!fs.existsSync(READY_MAP_DIR)) return [];
        return fs
            .readdirSync(READY_MAP_DIR)
            .filter((f) => f.endsWith('.json'))
            .map((f) => f.replace('.json', ''));
    }

    loadMap(name) {
        if (typeof name !== 'string') return null;
        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filePath = path.join(MAP_DIR, `${safeName}.json`);
        if (!fs.existsSync(filePath)) return null;
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return validateMapConfig(raw);
        } catch (e) {
            console.error(`[MapService] Failed to load/validate custom map ${name}:`, e.message);
            return null;
        }
    }

    loadReadyMap(name) {
        if (typeof name !== 'string') return null;
        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filePath = path.join(READY_MAP_DIR, `${safeName}.json`);
        if (!fs.existsSync(filePath)) return null;
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return validateMapConfig(raw);
        } catch (e) {
            console.error(`[MapService] Failed to load/validate ready map ${name}:`, e.message);
            return null;
        }
    }
}

export const mapService = new MapService();
