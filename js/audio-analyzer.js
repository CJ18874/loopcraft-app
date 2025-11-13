// Audio Analyzer Module - Tempo, Key, and Chord Detection
class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
    }

    initialize() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
        }
    }

    // Detect tempo (BPM) using autocorrelation
    detectTempo(audioBuffer) {
        this.initialize();
        
        const audioData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Calculate energy envelope
        const hopSize = 512;
        const energyEnvelope = [];
        
        for (let i = 0; i < audioData.length; i += hopSize) {
            let energy = 0;
            for (let j = 0; j < hopSize && i + j < audioData.length; j++) {
                energy += Math.abs(audioData[i + j]);
            }
            energyEnvelope.push(energy / hopSize);
        }
        
        // Find peaks in energy envelope
        const minBPM = 60;
        const maxBPM = 180;
        const minLag = Math.floor(60 * (sampleRate / hopSize) / maxBPM);
        const maxLag = Math.floor(60 * (sampleRate / hopSize) / minBPM);
        
        let bestCorr = -Infinity;
        let bestLag = 0;
        
        for (let lag = minLag; lag < maxLag; lag++) {
            let correlation = 0;
            let count = 0;
            
            for (let i = 0; i < energyEnvelope.length - lag; i++) {
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
        return Math.max(60, Math.min(180, bpm)); // Clamp between 60-180 BPM
    }

    // Detect musical key using chromagram
    detectKey(audioBuffer) {
        this.initialize();
        
        const audioData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Calculate chromagram (12 pitch classes)
        const chromagram = this.calculateChromagram(audioData, sampleRate);
        
        // Find dominant pitch class
        let maxEnergy = -Infinity;
        let dominantPitch = 0;
        
        for (let i = 0; i < 12; i++) {
            if (chromagram[i] > maxEnergy) {
                maxEnergy = chromagram[i];
                dominantPitch = i;
            }
        }
        
        // Map pitch class to note name
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Determine if major or minor based on third
        const majorThird = chromagram[(dominantPitch + 4) % 12];
        const minorThird = chromagram[(dominantPitch + 3) % 12];
        
        const mode = majorThird > minorThird ? 'Major' : 'Minor';
        
        return `${notes[dominantPitch]} ${mode}`;
    }

    // Calculate chromagram (pitch class profile)
    calculateChromagram(audioData, sampleRate) {
        const chromagram = new Array(12).fill(0);
        const fftSize = 4096;
        const freqToPitch = (freq) => 12 * Math.log2(freq / 440) + 57; // A4 = 440Hz = MIDI 69
        
        // Process audio in chunks
        for (let i = 0; i < audioData.length - fftSize; i += fftSize / 2) {
            const chunk = audioData.slice(i, i + fftSize);
            const spectrum = this.fft(chunk);
            
            // Map frequency bins to pitch classes
            for (let bin = 1; bin < spectrum.length / 2; bin++) {
                const freq = bin * sampleRate / fftSize;
                if (freq < 80 || freq > 2000) continue; // Focus on musical range
                
                const pitch = freqToPitch(freq);
                const pitchClass = Math.round(pitch) % 12;
                
                if (pitchClass >= 0 && pitchClass < 12) {
                    chromagram[pitchClass] += spectrum[bin];
                }
            }
        }
        
        // Normalize
        const max = Math.max(...chromagram);
        return chromagram.map(x => x / max);
    }

    // Simple FFT implementation
    fft(signal) {
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

    // Detect chords in audio
    detectChords(audioBuffer) {
        this.initialize();
        
        const audioData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        // Analyze in 2-second windows
        const windowSize = 2 * sampleRate;
        const chords = [];
        
        for (let start = 0; start < audioData.length; start += windowSize) {
            const end = Math.min(start + windowSize, audioData.length);
            const window = audioData.slice(start, end);
            
            const chromagram = this.calculateChromagram(window, sampleRate);
            const chord = this.identifyChord(chromagram);
            
            const timeStart = start / sampleRate;
            const timeEnd = end / sampleRate;
            
            chords.push({
                time: `${timeStart.toFixed(1)}s - ${timeEnd.toFixed(1)}s`,
                chord: chord
            });
        }
        
        return chords;
    }

    // Identify chord from chromagram
    identifyChord(chromagram) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Find top 3 pitch classes
        const indexed = chromagram.map((val, idx) => ({ val, idx }));
        indexed.sort((a, b) => b.val - a.val);
        const top3 = indexed.slice(0, 3).map(x => x.idx).sort((a, b) => a - b);
        
        // Check common chord patterns
        const root = top3[0];
        const intervals = top3.map(pitch => (pitch - root + 12) % 12);
        
        // Major triad: root, major third (4), perfect fifth (7)
        if (intervals.includes(0) && intervals.includes(4) && intervals.includes(7)) {
            return notes[root];
        }
        
        // Minor triad: root, minor third (3), perfect fifth (7)
        if (intervals.includes(0) && intervals.includes(3) && intervals.includes(7)) {
            return notes[root] + 'm';
        }
        
        // Dominant 7th: root, major third (4), perfect fifth (7), minor seventh (10)
        if (intervals.includes(0) && intervals.includes(4) && intervals.includes(10)) {
            return notes[root] + '7';
        }
        
        // Major 7th: root, major third (4), perfect fifth (7), major seventh (11)
        if (intervals.includes(0) && intervals.includes(4) && intervals.includes(11)) {
            return notes[root] + 'maj7';
        }
        
        // Minor 7th: root, minor third (3), perfect fifth (7), minor seventh (10)
        if (intervals.includes(0) && intervals.includes(3) && intervals.includes(10)) {
            return notes[root] + 'm7';
        }
        
        // Default to root note if no clear pattern
        return notes[root];
    }

    // Format time in MM:SS
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Export for use in main app
window.AudioAnalyzer = AudioAnalyzer;
