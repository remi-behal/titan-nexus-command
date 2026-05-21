// ZzFX - Zuper Zmall Zound Zynthesizer - MIT License - Copyright 2019 Frank Force
// https://github.com/KilledByAPixel/ZzFX

export let zzfxX = null; // Share AudioContext from AudioManager
export const setZzfxContext = (ctx) => { zzfxX = ctx; };

export const zzfx = (...t) => {
    if (!zzfxX) return null;
    
    // Volume (t[0]) must handle 0 and undefined
    let volume = t[0] === undefined ? 1 : t[0];
    if (volume <= 0) return null;

    let sampleRate = 44100,
        frequency = t[2] || 440,
        attack = t[3] || 0,
        sustain = t[4] || 0,
        release = t[5] || .1,
        bitpop = t[6] || 0,
        noise = t[7] || 0,
        sustainVolume = t[8] || 0,
        slide = t[9] || 0,
        deltaSlide = t[10] || 0,
        frequencyCutoff = t[11] || 0,
        frequencyCutoffSlide = t[12] || 0,
        pitchJump = t[13] || 0,
        pitchJumpTime = t[14] || 0,
        repeatTime = t[15] || 0,
        flangerDelay = t[16] || 0,
        flangerFeedback = t[17] || 0,
        volumeFeedback = t[18] || 0;

    let attackSamples = attack * sampleRate,
        sustainSamples = sustain * sampleRate,
        releaseSamples = release * sampleRate,
        totalSamples = attackSamples + sustainSamples + releaseSamples,
        time = 0,
        phase = 0,
        frequencySlide = 0,
        frequencyDeltaSlide = 0,
        noiseSeed = 0,
        pitchJumpSamples = pitchJumpTime * sampleRate,
        repeatSamples = repeatTime * sampleRate,
        repeatCounter = 0;

    const buffer = zzfxX.createBuffer(1, totalSamples, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < totalSamples; ++i) {
        if (repeatSamples && ++repeatCounter >= repeatSamples) {
            repeatCounter = 0;
            time = 0;
            phase = 0;
            frequencySlide = 0;
            frequencyDeltaSlide = 0;
            noiseSeed = 0;
        }

        // Apply slides
        frequencySlide += slide;
        frequencyDeltaSlide += deltaSlide;
        let currentFreq = frequency + frequencySlide;
        if (frequencyCutoff && currentFreq > frequencyCutoff) currentFreq = frequencyCutoff;
        if (frequencyCutoffSlide) frequency += frequencyCutoffSlide;

        // Apply pitch jump
        if (pitchJumpSamples && i > pitchJumpSamples) {
            currentFreq += pitchJump;
            pitchJumpSamples = 0;
        }

        // Compute phase and sample wave
        phase += (2 * Math.PI * currentFreq) / sampleRate;
        let sampleVal = Math.sin(phase);

        // Bitpop effect
        if (bitpop) {
            sampleVal = sampleVal > 0 ? 1 : -1;
        }

        // Noise synthesis
        if (noise) {
            noiseSeed = (noiseSeed + 1) % 1;
            sampleVal += (Math.random() * 2 - 1) * noise;
        }

        // Envelope multiplier
        let envVolume = 0;
        if (i < attackSamples) {
            envVolume = i / attackSamples;
        } else if (i < attackSamples + sustainSamples) {
            envVolume = 1 - (1 - sustainVolume) * ((i - attackSamples) / sustainSamples);
        } else {
            envVolume = sustainVolume * (1 - (i - attackSamples - sustainSamples) / releaseSamples);
        }

        // Final sample volume scaling
        let sample = sampleVal * envVolume * volume * 0.3;
        
        // Simple bounds clamping
        channelData[i] = sample < -1 ? -1 : sample > 1 ? 1 : sample;
    }

    const bufferSource = zzfxX.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(zzfxX.destination);
    bufferSource.start();
    return bufferSource;
};
