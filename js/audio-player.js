// Audio Player Module with Progress Tracking
class AudioPlayer {
    constructor() {
        this.audioContext = null;
        this.sourceNode = null;
        this.audioBuffer = null;
        this.startTime = 0;
        this.pauseTime = 0;
        this.isPlaying = false;
        this.animationFrame = null;
        this.onProgressCallback = null;
        this.onEndCallback = null;
    }

    initialize() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
        }
    }

    loadBuffer(audioBuffer) {
        this.audioBuffer = audioBuffer;
        this.initialize();
    }

    play(onProgress, onEnd) {
        if (!this.audioBuffer) {
            console.error('No audio buffer loaded');
            return;
        }

        this.stop(); // Stop any existing playback
        this.initialize();

        this.onProgressCallback = onProgress;
        this.onEndCallback = onEnd;

        // Create source node
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.connect(this.audioContext.destination);

        // Handle playback end
        this.sourceNode.onended = () => {
            this.isPlaying = false;
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            if (this.onEndCallback) {
                this.onEndCallback();
            }
        };

        // Start playback
        this.sourceNode.start(0);
        this.startTime = this.audioContext.currentTime;
        this.isPlaying = true;

        // Start progress tracking
        this.updateProgress();
    }

    updateProgress() {
        if (!this.isPlaying || !this.audioBuffer) return;

        const currentTime = this.audioContext.currentTime - this.startTime;
        const duration = this.audioBuffer.duration;
        const progress = Math.min((currentTime / duration) * 100, 100);

        if (this.onProgressCallback) {
            this.onProgressCallback(currentTime, duration, progress);
        }

        if (currentTime < duration) {
            this.animationFrame = requestAnimationFrame(() => this.updateProgress());
        }
    }

    stop() {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
            } catch (e) {
                // Already stopped
            }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        this.isPlaying = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    getDuration() {
        return this.audioBuffer ? this.audioBuffer.duration : 0;
    }

    async audioBufferToBlob(audioBuffer) {
        // Convert AudioBuffer to WAV Blob
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numberOfChannels * 2;
        const sampleRate = audioBuffer.sampleRate;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length, true);

        // Write audio data
        const channels = [];
        for (let i = 0; i < numberOfChannels; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }

        let offset = 44;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    cleanup() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// Export for use in main app
window.AudioPlayer = AudioPlayer;
