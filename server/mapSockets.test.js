import { describe, it, expect, vi } from 'vitest';
import { mapService } from './MapService.js';
import { registerGameHandlers } from './sockets/GameHandlers.js';

describe('Map Socket Handlers', () => {
    it('should return a merged list of ready and custom maps as objects', () => {
        const mockSocket = {
            on: vi.fn(),
            emit: vi.fn()
        };
        const mockIo = { emit: vi.fn() };
        const mockContext = { game: { phase: 'PLANNING' }, lockedIn: {}, turnActions: {} };

        // Stub MapService lists
        const listReadySpy = vi.spyOn(mapService, 'listReadyMaps').mockReturnValue(['map_a']);
        const listSpy = vi.spyOn(mapService, 'listMaps').mockReturnValue(['map_custom']);

        registerGameHandlers(mockSocket, mockIo, mockContext, {});

        // Retrieve room:listMaps handler
        const listMapsHandler = mockSocket.on.mock.calls.find(c => c[0] === 'room:listMaps')[1];
        listMapsHandler();

        expect(mockSocket.emit).toHaveBeenCalledWith('room:mapsUpdate', [
            { id: 'map_a', name: 'map a', isCustom: false },
            { id: 'map_custom', name: 'map custom', isCustom: true }
        ]);

        listReadySpy.mockRestore();
        listSpy.mockRestore();
    });
});
