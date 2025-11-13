// Audio Recorder Module
class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.duration = 5000; // 5 seconds
        this.recordingTimer = null;
        this.audioContext = null;
    }

    async initialize() {
        try {
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
            
            return true;
        } catch (error) {
            console.error('Failed to get microphone access:', error);
            alert('Please allow microphone access to record audio.');
            return false;
        }
    }

    async startRecording(onProgress, onComplete, customDuration = null) {
        if (!this.stream) {
            const initialized = await this.initialize();
            if (!initialized) return false;
        }

        // Use custom duration if provided, otherwise use default
        const recordingDuration = customDuration !== null ? customDuration * 1000 : this.duration;

        this.audioChunks = [];
        
        // Create MediaRecorder
        const options = { mimeType: 'audio/webm' };
        
        // Try different mime types for compatibility
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'audio/ogg';
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/mp4';
            }
        }
        
        this.mediaRecorder = new MediaRecorder(this.stream, options);

        // Collect audio data
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        // Handle recording stop
        this.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
            const audioBuffer = await this.blobToAudioBuffer(audioBlob);
            onComplete(audioBuffer, audioBlob);
        };

        // Start recording
        this.mediaRecorder.start();

        // Progress timer
        let elapsed = 0;
        const interval = 100; // Update every 100ms
        this.recordingTimer = setInterval(() => {
            elapsed += interval;
            const remaining = Math.max(0, recordingDuration - elapsed);
            const seconds = (remaining / 1000).toFixed(1);
            onProgress(seconds);

            if (elapsed >= recordingDuration) {
                this.stopRecording();
            }
        }, interval);

        return true;
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    async blobToAudioBuffer(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
        }
        
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    }

    async loadAudioFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
        }
        
        try {
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            return audioBuffer;
        } catch (error) {
            throw new Error('Failed to decode audio file. Please ensure it\'s a valid audio format (MP3, WAV, OGG, etc.)');
        }
    }

    // Mix/overdub two audio buffers
    mixAudioBuffers(buffer1, buffer2) {
        const length = Math.max(buffer1.length, buffer2.length);
        const channels = Math.max(buffer1.numberOfChannels, buffer2.numberOfChannels);
        const sampleRate = buffer1.sampleRate;
        
        const mixedBuffer = this.audioContext.createBuffer(channels, length, sampleRate);
        
        for (let channel = 0; channel < channels; channel++) {
            const outputData = mixedBuffer.getChannelData(channel);
            const input1 = buffer1.getChannelData(Math.min(channel, buffer1.numberOfChannels - 1));
            const input2 = buffer2.getChannelData(Math.min(channel, buffer2.numberOfChannels - 1));
            
            for (let i = 0; i < length; i++) {
                const sample1 = i < buffer1.length ? input1[i] : 0;
                const sample2 = i < buffer2.length ? input2[i] : 0;
                
                // Mix with normalization to prevent clipping
                outputData[i] = (sample1 + sample2) * 0.7;
            }
        }
        
        return mixedBuffer;
    }

    // Apply fade in/out to prevent clicks
    applyFades(audioBuffer) {
        const fadeLength = Math.floor(0.005 * audioBuffer.sampleRate); // 5ms fade
        
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const data = audioBuffer.getChannelData(channel);
            
            // Fade in
            for (let i = 0; i < fadeLength; i++) {
                data[i] *= i / fadeLength;
            }
            
            // Fade out
            for (let i = 0; i < fadeLength; i++) {
                const idx = data.length - fadeLength + i;
                data[idx] *= (fadeLength - i) / fadeLength;
            }
        }
        
        return audioBuffer;
    }

    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
    }
}

// Export for use in main app
window.AudioRecorder = AudioRecorder;
