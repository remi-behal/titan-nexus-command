import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zzfx, setZzfxContext, zzfxX } from './ZzFX';

describe('ZzFX Synthesizer', () => {
    beforeEach(() => {
        setZzfxContext(null);
    });

    it('sets context and plays sound successfully', () => {
        const mockChannelData = new Float32Array(100000);
        const mockBuffer = {
            getChannelData: vi.fn().mockReturnValue(mockChannelData)
        };
        const mockBufferSource = {
            connect: vi.fn().mockReturnValue({ connect: vi.fn() }),
            start: vi.fn(),
            playbackRate: { value: 1 }
        };
        const mockContext = {
            createBuffer: vi.fn().mockReturnValue(mockBuffer),
            createBufferSource: vi.fn().mockReturnValue(mockBufferSource),
            createGain: vi.fn().mockReturnValue({
                gain: { value: 1 },
                connect: vi.fn()
            }),
            destination: {}
        };

        // Stub StereoPannerNode globally for the test environment
        const mockPanner = {};
        vi.stubGlobal(
            'StereoPannerNode',
            vi.fn().mockImplementation(() => mockPanner)
        );

        setZzfxContext(mockContext);
        expect(zzfxX).toBe(mockContext);

        const result = zzfx(0.5, 0, 440, 0.05, 0.05, 0.1);
        expect(result).toBe(mockBufferSource);
        expect(mockContext.createBuffer).toHaveBeenCalled();
        expect(mockBufferSource.connect).toHaveBeenCalledWith(mockPanner);
        expect(mockBufferSource.start).toHaveBeenCalled();
    });

    it('returns null if volume is zero or undefined', () => {
        const result = zzfx(0);
        expect(result).toBeNull();
    });
});
