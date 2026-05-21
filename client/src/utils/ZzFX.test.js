import { describe, it, expect, vi } from 'vitest';
import { zzfx, setZzfxContext, zzfxX } from './ZzFX';

describe('ZzFX Synthesizer', () => {
    it('sets context and plays sound successfully', () => {
        const mockChannelData = new Float32Array(100);
        const mockBuffer = {
            getChannelData: vi.fn().mockReturnValue(mockChannelData)
        };
        const mockBufferSource = {
            connect: vi.fn(),
            start: vi.fn()
        };
        const mockContext = {
            createBuffer: vi.fn().mockReturnValue(mockBuffer),
            createBufferSource: vi.fn().mockReturnValue(mockBufferSource),
            destination: {}
        };

        setZzfxContext(mockContext);
        expect(zzfxX).toBe(mockContext);

        const result = zzfx(0.5, 0, 440, 0.05, 0.05, 0.1);
        expect(result).toBe(mockBufferSource);
        expect(mockContext.createBuffer).toHaveBeenCalled();
        expect(mockBufferSource.connect).toHaveBeenCalledWith(mockContext.destination);
        expect(mockBufferSource.start).toHaveBeenCalled();
    });

    it('returns null if volume is zero or undefined', () => {
        const result = zzfx(0);
        expect(result).toBeNull();
    });
});
