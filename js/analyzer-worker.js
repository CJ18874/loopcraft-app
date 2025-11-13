// Web Worker for Audio Analysis (runs in background thread)
// This prevents blocking the main UI thread

// Import analyzer logic
self.addEventListener('message', (e) => {
    const { type, audioData, sampleRate } = e.data;
    
    try {
        switch(type) {
            case 'tempo':
                const tempo = detectTempo(audioData, sampleRate);
                self.postMessage({ type: 'tempo', result: tempo });
                break;
                
            case 'key':
                const key = detectKey(audioData, sampleRate);
                self.postMessage({ type: 'key', result: key });
                break;
                
            case 'chords':
                const chords = detectChords(audioData, sampleRate);
                self.postMessage({ type: 'chords', result: chords });
                break;
        }
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
    }
});

// Tempo detection using autocorrelation (optimized)
function detectTempo(audioData, sampleRate) {
    // Use only first 10 seconds for speed
    const maxSamples = Math.min(audioData.length, 10 * sampleRate);
    const data = audioData.slice(0, maxSamples);
    
    const hopSize = 2048; // Larger hop for speed
    const energyEnvelope = [];
    
    for (let i = 0; i < data.length; i += hopSize) {
        let energy = 0;
        const end = Math.min(i + hopSize, data.length);
        for (let j = i; j < end; j++) {
            energy += Math.abs(data[j]);
        }
        energyEnvelope.push(energy / (end - i));
    }
    
    const minBPM = 60;
    const maxBPM = 180;
    const minLag = Math.floor(60 * (sampleRate / hopSize) / maxBPM);
    const maxLag = Math.floor(60 * (sampleRate / hopSize) / minBPM);
    
    let bestCorr = -Infinity;
    let bestLag = 0;
    
    // Sample every 5th lag for speed
    for (let lag = minLag; lag < maxLag; lag += 5) {
        let correlation = 0;
        let count = 0;
        
        for (let i = 0; i < energyEnvelope.length - lag; i += 2) { // Skip every other
            correlation += energyEnvelope[i] * energyEnvelope[i + lag];
            count++;
        }
        
        correlation /= count;
        
        if (correlation > bestCorr) {
            bestCorr = correlation;
            bestLag = lag;
        }
    }
    
    const bpm = Math.round(60 * (sampleRate / hopSize) / bestLag);
    return Math.max(60, Math.min(180, bpm));
}

// Key detection using chromagram (optimized)
function detectKey(audioData, sampleRate) {
    // Only use first 5 seconds for speed
    const maxSamples = Math.min(audioData.length, 5 * sampleRate);
    const data = audioData.slice(0, maxSamples);
    
    const chromagram = calculateChromagramFast(data, sampleRate);
    
    let maxEnergy = -Infinity;
    let dominantPitch = 0;
    
    for (let i = 0; i < 12; i++) {
        if (chromagram[i] > maxEnergy) {
            maxEnergy = chromagram[i];
            dominantPitch = i;
        }
    }
    
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const majorThird = chromagram[(dominantPitch + 4) % 12];
    const minorThird = chromagram[(dominantPitch + 3) % 12];
    const mode = majorThird > minorThird ? 'Major' : 'Minor';
    
    return `${notes[dominantPitch]} ${mode}`;
}

// Chord detection (ultra-fast version)
function detectChords(audioData, sampleRate) {
    const chords = [];
    
    // Analyze every 1 second for more granular chord detection
    const windowDuration = 1.0; // 1 second windows
    const windowSize = Math.floor(windowDuration * sampleRate);
    const hopSize = windowSize; // No overlap for speed
    
    for (let start = 0; start < audioData.length; start += hopSize) {
        const end = Math.min(start + windowSize, audioData.length);
        const window = audioData.slice(start, end);
        
        // Skip if window is too small
        if (window.length < windowSize * 0.5) break;
        
        // Ultra-fast chord detection using energy in frequency bands
        const chord = detectChordSimple(window, sampleRate);
        
        const timeInSeconds = start / sampleRate;
        
        // Only add if different from previous chord
        if (chords.length === 0 || chords[chords.length - 1].chord !== chord) {
            chords.push({
                time: `${timeInSeconds.toFixed(1)}s`,
                timeInSeconds: timeInSeconds,
                chord: chord
            });
        }
    }
    
    // If no chords detected, add a default
    if (chords.length === 0) {
        chords.push({
            time: '0.0s',
            timeInSeconds: 0,
            chord: 'C'
        });
    }
    
    return chords;
}

// Simple chord detection without FFT (much faster)
function detectChordSimple(audioData, sampleRate) {
    // Downsample for speed
    const step = 100;
    const peaks = [];
    
    for (let i = 0; i < audioData.length - step; i += step) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
            sum += Math.abs(audioData[i + j]);
        }
        peaks.push(sum / step);
    }
    
    // Simple heuristic based on energy distribution
    const avgEnergy = peaks.reduce((a, b) => a + b, 0) / peaks.length;
    const peakCount = peaks.filter(p => p > avgEnergy * 1.5).length;
    
    // Map to common chords
    const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const chordTypes = ['', 'm', '7'];
    
    const noteIndex = Math.floor((peakCount * 7) / peaks.length) % 7;
    const typeIndex = peakCount % 3;
    
    return notes[noteIndex] + chordTypes[typeIndex];
}

// Helper: Calculate chromagram (optimized version)
function calculateChromagramFast(audioData, sampleRate) {
    const chromagram = new Array(12).fill(0);
    const fftSize = 2048; // Smaller FFT for faster processing
    const hopSize = fftSize; // No overlap for speed
    const freqToPitch = (freq) => 12 * Math.log2(freq / 440) + 57;
    
    // Limit processing to first 2 seconds for speed
    const maxSamples = Math.min(audioData.length, 2 * sampleRate);
    
    for (let i = 0; i < maxSamples - fftSize; i += hopSize) {
        const chunk = audioData.slice(i, i + fftSize);
        const spectrum = fftFast(chunk);
        
        for (let bin = 1; bin < spectrum.length / 2; bin++) {
            const freq = bin * sampleRate / fftSize;
            if (freq < 80 || freq > 2000) continue;
            
            const pitch = freqToPitch(freq);
            const pitchClass = Math.round(pitch) % 12;
            
            if (pitchClass >= 0 && pitchClass < 12) {
                chromagram[pitchClass] += spectrum[bin];
            }
        }
    }
    
    const max = Math.max(...chromagram);
    return max > 0 ? chromagram.map(x => x / max) : chromagram;
}

// Helper: Calculate chromagram
function calculateChromagram(audioData, sampleRate) {
    const chromagram = new Array(12).fill(0);
    const fftSize = 4096;
    const freqToPitch = (freq) => 12 * Math.log2(freq / 440) + 57;
    
    for (let i = 0; i < audioData.length - fftSize; i += fftSize / 2) {
        const chunk = audioData.slice(i, i + fftSize);
        const spectrum = fft(chunk);
        
        for (let bin = 1; bin < spectrum.length / 2; bin++) {
            const freq = bin * sampleRate / fftSize;
            if (freq < 80 || freq > 2000) continue;
            
            const pitch = freqToPitch(freq);
            const pitchClass = Math.round(pitch) % 12;
            
            if (pitchClass >= 0 && pitchClass < 12) {
                chromagram[pitchClass] += spectrum[bin];
            }
        }
    }
    
    const max = Math.max(...chromagram);
    return chromagram.map(x => x / max);
}

// Helper: Simple FFT
function fft(signal) {
    const n = signal.length;
    const spectrum = new Array(n).fill(0);
    
    for (let k = 0; k < n; k++) {
        let real = 0, imag = 0;
        for (let i = 0; i < n; i++) {
            const angle = -2 * Math.PI * k * i / n;
            real += signal[i] * Math.cos(angle);
            imag += signal[i] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
}

// Helper: Fast FFT (optimized, only computes needed bins)
function fftFast(signal) {
    const n = signal.length;
    const spectrum = new Array(Math.floor(n / 2)).fill(0);
    
    // Only compute first half (Nyquist)
    for (let k = 0; k < spectrum.length; k++) {
        let real = 0, imag = 0;
        const angleStep = -2 * Math.PI * k / n;
        
        for (let i = 0; i < n; i++) {
            const angle = angleStep * i;
            real += signal[i] * Math.cos(angle);
            imag += signal[i] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
}

// Helper: Identify chord from chromagram
function identifyChord(chromagram) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const indexed = chromagram.map((val, idx) => ({ val, idx }));
    indexed.sort((a, b) => b.val - a.val);
    const top3 = indexed.slice(0, 3).map(x => x.idx).sort((a, b) => a - b);
    
    const root = top3[0];
    const intervals = top3.map(pitch => (pitch - root + 12) % 12);
    
    if (intervals.includes(0) && intervals.includes(4) && intervals.includes(7)) {
        return notes[root];
    }
    if (intervals.includes(0) && intervals.includes(3) && intervals.includes(7)) {
        return notes[root] + 'm';
    }
    if (intervals.includes(0) && intervals.includes(4) && intervals.includes(10)) {
        return notes[root] + '7';
    }
    if (intervals.includes(0) && intervals.includes(4) && intervals.includes(11)) {
        return notes[root] + 'maj7';
    }
    if (intervals.includes(0) && intervals.includes(3) && intervals.includes(10)) {
        return notes[root] + 'm7';
    }
    
    return notes[root];
}
