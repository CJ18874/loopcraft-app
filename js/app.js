// Main Application - Audio Looper Web App
class AudioLooperApp {
    constructor() {
        // Core modules
        this.recorder = new AudioRecorder();
        this.player = new AudioPlayer();
        this.analyzer = new AudioAnalyzer();
        
        // Web Worker for non-blocking analysis
        this.analysisWorker = null;
        try {
            this.analysisWorker = new Worker('js/analyzer-worker.js');
            this.setupWorkerListeners();
        } catch (error) {
            console.warn('Web Worker not available, using fallback:', error);
        }
        
        // State
        this.loopAudioBuffer = null;
        this.wavesurfer = null;
        this.isRecording = false;
        this.detectedChords = []; // Store chord timeline
        this.currentChordIndex = -1;
        this.countInActive = false;
        this.audioContext = null;
        this.metronomeInterval = null;
        this.metronomeNextClickTime = 0;
        this.metronomeIsPlaying = false;
        this.layers = []; // Array to store individual audio layers
        this.layerVolumes = []; // Volume for each layer (0.0 - 1.0)
        this.layerMuted = []; // Mute state for each layer
        this.undoStack = []; // Stack for undo functionality
        this.redoStack = []; // Stack for redo functionality (currently not exposed in UI)
        
        // UI Elements
        this.elements = {
            recordBtn: document.getElementById('recordBtn'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            overdubBtn: document.getElementById('overdubBtn'),
            detectChordsBtn: document.getElementById('detectChordsBtn'),
            loadBtn: document.getElementById('loadBtn'),
            clearBtn: document.getElementById('clearBtn'),
            fileInput: document.getElementById('fileInput'),
            statusText: document.getElementById('statusText'),
            recordTimer: document.getElementById('recordTimer'),
            tempoValue: document.getElementById('tempoValue'),
            keyValue: document.getElementById('keyValue'),
            currentTime: document.getElementById('currentTime'),
            totalTime: document.getElementById('totalTime'),
            progressBar: document.getElementById('progressBar'),
            progressSlider: document.getElementById('progressSlider'),
            chordsDisplay: document.getElementById('chordsDisplay'),
            chordsContainer: document.querySelector('.chords-container'),
            chordLabelsLayer: document.getElementById('chordLabelsLayer'),
            countInToggle: document.getElementById('countInToggle'),
            metronomeToggle: document.getElementById('metronomeToggle'),
            metronomeBpm: document.getElementById('metronomeBpm'),
            metronomeVolume: document.getElementById('metronomeVolume'),
            metronomeVolumeValue: document.getElementById('metronomeVolumeValue'),
            loopLength: document.getElementById('loopLength'),
            durationInfo: document.getElementById('durationInfo'),
            layersSection: document.getElementById('layersSection'),
            layersList: document.getElementById('layersList'),
            undoBtn: document.getElementById('undoBtn'),
            scaleNotesSection: document.getElementById('scaleNotesSection'),
            scaleNotes: document.getElementById('scaleNotes'),
            recordingIndicator: document.getElementById('recordingIndicator'),
            loopPositionMarker: document.getElementById('loopPositionMarker')
        };
        
        this.initWaveSurfer();
        this.attachEventListeners();
    }

    setupWorkerListeners() {
        this.analysisWorker.addEventListener('message', (e) => {
            const { type, result, error } = e.data;
            
            if (error) {
                console.error('Worker error:', error);
                return;
            }
            
            switch(type) {
                case 'tempo':
                    this.elements.tempoValue.textContent = `${result} BPM`;
                    console.log('Tempo detected:', result);
                    break;
                    
                case 'key':
                    this.elements.keyValue.textContent = result;
                    console.log('Key detected:', result);
                    this.displayScaleNotes(result);
                    this.updateStatus('✅ Analysis complete!', 'green');
                    break;
                    
                case 'chords':
                    console.log('Received chords from worker:', result);
                    this.detectedChords = result; // Store chords for real-time display
                    this.renderChordLabels(result); // Render floating chord labels
                    
                    // Render guitar diagrams
                    if (typeof renderGuitarDiagrams === 'function') {
                        renderGuitarDiagrams(result);
                    }
                    
                    let chordsText = '';
                    result.forEach(({ time, chord }) => {
                        chordsText += `${time}: ${chord}\n`;
                    });
                    this.elements.chordsDisplay.textContent = chordsText || 'No chords detected';
                    this.elements.chordsContainer.style.display = 'block';
                    this.updateStatus('✅ Chord detection complete!', 'green');
                    this.elements.detectChordsBtn.disabled = false;
                    break;
            }
        });
    }

    initWaveSurfer() {
        this.wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#2196F3',
            progressColor: '#FF5722',
            cursorColor: '#FF0000',
            barWidth: 2,
            barGap: 1,
            responsive: true,
            height: 300,
            normalize: true,
            backend: 'WebAudio'
        });

        // Handle waveform ready
        this.wavesurfer.on('ready', () => {
            const duration = this.wavesurfer.getDuration();
            this.elements.totalTime.textContent = this.formatTime(duration);
        });

        // Update time during playback
        this.wavesurfer.on('audioprocess', (time) => {
            this.elements.currentTime.textContent = this.formatTime(time);
            const duration = this.wavesurfer.getDuration();
            const progress = (time / duration) * 100;
            this.elements.progressBar.style.width = `${progress}%`;
            
            // Update loop position marker
            this.updateLoopPositionMarker(progress);
        });

        // Handle playback end
        this.wavesurfer.on('finish', () => {
            this.updateStatus('Ready to record!', 'blue');
            this.elements.progressBar.style.width = '0%';
            this.elements.currentTime.textContent = '0:00';
        });
    }

    attachEventListeners() {
        // Record button
        this.elements.recordBtn.addEventListener('click', () => this.handleRecord());
        
        // Play/Pause button
        this.elements.playPauseBtn.addEventListener('click', () => this.handlePlayPause());
        
        // Overdub button
        this.elements.overdubBtn.addEventListener('click', () => this.handleOverdub());
        
        // Undo button
        this.elements.undoBtn.addEventListener('click', () => this.handleUndo());
        
        // Detect chords button
        this.elements.detectChordsBtn.addEventListener('click', () => this.handleDetectChords());
        
        // Load button
        this.elements.loadBtn.addEventListener('click', () => {
            this.elements.fileInput.click();
        });
        
        // File input
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        
        // Clear button
        this.elements.clearBtn.addEventListener('click', () => this.handleClear());
        
        // Progress slider - seek through audio
        this.elements.progressSlider.addEventListener('input', (e) => this.handleSeek(e));
        
        // Metronome volume control
        this.elements.metronomeVolume.addEventListener('input', (e) => {
            this.elements.metronomeVolumeValue.textContent = `${e.target.value}%`;
        });
        
        // Metronome toggle
        this.elements.metronomeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startMetronome();
            } else {
                this.stopMetronome();
            }
        });
        
        // Loop length input
        this.elements.loopLength.addEventListener('input', (e) => {
            // Prevent changing loop length during recording
            if (this.isRecording) {
                this.updateStatus('⚠️ Cannot change loop length while recording', 'orange');
                e.target.value = this.currentRecordingLength || 5;
                return;
            }
            this.updateLoopLengthDisplay(e.target.value);
        });
        
        // Loop length preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Prevent changing loop length during recording
                if (this.isRecording) {
                    this.updateStatus('⚠️ Cannot change loop length while recording', 'orange');
                    return;
                }
                
                const seconds = parseInt(e.target.dataset.seconds);
                this.elements.loopLength.value = seconds;
                this.updateLoopLengthDisplay(seconds);
                
                // Update active state
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        // Listen to WaveSurfer play/pause events to sync button state
        if (this.wavesurfer) {
            this.wavesurfer.on('play', () => this.updatePlayPauseButton(true));
            this.wavesurfer.on('pause', () => this.updatePlayPauseButton(false));
            this.wavesurfer.on('finish', () => this.updatePlayPauseButton(false));
            
            // Update slider and chords as audio plays
            this.wavesurfer.on('audioprocess', () => {
                this.updateProgressSlider();
                this.updateCurrentChord();
            });
            this.wavesurfer.on('seeking', () => {
                this.updateProgressSlider();
                this.updateCurrentChord();
            });
        }
    }
    
    handleSeek(e) {
        if (!this.wavesurfer || !this.loopAudioBuffer) return;
        
        const seekPercent = parseFloat(e.target.value) / 100;
        this.wavesurfer.seekTo(seekPercent);
    }
    
    updateProgressSlider() {
        if (!this.wavesurfer) return;
        
        const progress = (this.wavesurfer.getCurrentTime() / this.wavesurfer.getDuration()) * 100;
        this.elements.progressSlider.value = progress || 0;
        
        // Also update the progress bar
        this.elements.progressBar.style.width = `${progress || 0}%`;
        
        // Update loop position marker
        this.updateLoopPositionMarker(progress);
        
        // Update time display
        const currentTime = this.wavesurfer.getCurrentTime() || 0;
        const totalTime = this.wavesurfer.getDuration() || 0;
        this.elements.currentTime.textContent = this.formatTime(currentTime);
        this.elements.totalTime.textContent = this.formatTime(totalTime);
    }
    
    updateLoopPositionMarker(progress) {
        if (this.loopAudioBuffer && this.elements.loopPositionMarker) {
            this.elements.loopPositionMarker.style.left = `${progress}%`;
        }
    }

    async handleRecord() {
        if (this.isRecording) {
            this.recorder.stopRecording();
            return;
        }

        // Check if count-in is enabled
        if (this.elements.countInToggle.checked) {
            await this.playCountIn();
        }

        this.isRecording = true;
        this.currentRecordingLength = parseInt(this.elements.loopLength.value);
        
        // Show recording indicator
        this.elements.recordingIndicator.style.display = 'flex';
        
        // Disable loop length controls during recording
        this.elements.loopLength.disabled = true;
        document.querySelectorAll('.preset-btn').forEach(btn => btn.disabled = true);
        
        this.elements.recordBtn.classList.add('recording');
        this.elements.recordBtn.innerHTML = '<span class="icon">⏹️</span> Stop Recording <span id="recordTimer" class="timer"></span>';
        this.updateStatus('🎤 Recording...', 'red');

        const loopLength = this.currentRecordingLength;
        const success = await this.recorder.startRecording(
            // Progress callback
            (secondsLeft) => {
                document.getElementById('recordTimer').textContent = `(${secondsLeft}s)`;
            },
            // Complete callback
            async (audioBuffer, audioBlob) => {
                this.isRecording = false;
                this.currentRecordingLength = null;
                
                // Hide recording indicator
                this.elements.recordingIndicator.style.display = 'none';
                
                // Re-enable loop length controls
                this.elements.loopLength.disabled = false;
                document.querySelectorAll('.preset-btn').forEach(btn => btn.disabled = false);
                
                this.elements.recordBtn.classList.remove('recording');
                this.elements.recordBtn.innerHTML = '<span class="icon">🎤</span> Record Initial Loop';
                
                // Initialize layers array with first layer
                this.layers = [this.recorder.applyFades(audioBuffer)];
                this.layerVolumes = [1.0]; // Full volume for first layer
                this.layerMuted = [false];
                
                // Clear undo/redo stacks for new recording
                this.undoStack = [];
                this.redoStack = [];
                this.updateUndoRedoButtons();
                
                this.loopAudioBuffer = this.layers[0];
                await this.loadAudioToWaveform(this.loopAudioBuffer);
                this.analyzeAudio(this.loopAudioBuffer);
                this.enableControls();
                this.updateLayerControls();
                this.updateStatus('✅ Recording complete!', 'green');
            },
            loopLength // Pass custom duration
        );

        if (!success) {
            this.isRecording = false;
            this.currentRecordingLength = null;
            
            // Hide recording indicator
            this.elements.recordingIndicator.style.display = 'none';
            
            // Re-enable loop length controls
            this.elements.loopLength.disabled = false;
            document.querySelectorAll('.preset-btn').forEach(btn => btn.disabled = false);
            this.elements.recordBtn.classList.remove('recording');
            this.elements.recordBtn.innerHTML = '<span class="icon">🎤</span> Record Initial Loop';
            this.updateStatus('❌ Failed to start recording', 'red');
        }
    }
    
    async playCountIn() {
        // Initialize audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const bpm = 120; // Default tempo
        const beatDuration = 60 / bpm; // Duration of one beat in seconds
        
        // Play 4 clicks
        for (let i = 1; i <= 4; i++) {
            this.updateStatus(`🎵 Count-in: ${i}...`, 'blue');
            this.playClick(i === 1); // First click is louder
            await this.sleep(beatDuration * 1000); // Convert to milliseconds
        }
        
        this.updateStatus('🎤 Recording starting...', 'blue');
    }
    
    playClick(isAccent = false) {
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // Create click sound
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Accent (first beat) is higher pitch and louder
        osc.frequency.value = isAccent ? 1200 : 800;
        gain.gain.value = isAccent ? 0.3 : 0.15;
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05); // Short click
        
        // Fade out to avoid clicking
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    startMetronome() {
        if (this.metronomeIsPlaying) return;
        
        // Initialize audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        this.metronomeIsPlaying = true;
        this.metronomeNextClickTime = this.audioContext.currentTime;
        this.scheduleMetronomeClicks();
    }
    
    scheduleMetronomeClicks() {
        if (!this.metronomeIsPlaying) return;
        
        const ctx = this.audioContext;
        const bpm = parseInt(this.elements.metronomeBpm.value) || 120;
        const secondsPerBeat = 60.0 / bpm;
        const scheduleAheadTime = 0.1; // Schedule 100ms ahead
        const currentTime = ctx.currentTime;
        
        // Schedule clicks that need to be played soon
        while (this.metronomeNextClickTime < currentTime + scheduleAheadTime) {
            this.playMetronomeClick(this.metronomeNextClickTime);
            this.metronomeNextClickTime += secondsPerBeat;
        }
        
        // Schedule next batch
        setTimeout(() => this.scheduleMetronomeClicks(), 25);
    }
    
    playMetronomeClick(time) {
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Get volume from slider (0-100)
        const volume = parseInt(this.elements.metronomeVolume.value) / 100;
        
        osc.frequency.value = 1000; // Fixed frequency for metronome
        gain.gain.value = 0.15 * volume; // Apply volume
        
        osc.start(time);
        osc.stop(time + 0.05); // Short click
        
        // Fade out to avoid clicking
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    }
    
    stopMetronome() {
        this.metronomeIsPlaying = false;
    }

    handlePlayPause() {
        if (!this.loopAudioBuffer) {
            console.warn('No audio buffer loaded');
            return;
        }
        
        if (!this.wavesurfer) {
            console.error('WaveSurfer not initialized');
            return;
        }
        
        // Check if wavesurfer is ready
        if (this.wavesurfer.getDuration() === 0) {
            console.error('WaveSurfer not ready - no duration');
            this.updateStatus('❌ Audio not loaded properly', 'red');
            return;
        }
        
        try {
            // Toggle play/pause
            this.wavesurfer.playPause();
            
            // Status will be updated by WaveSurfer event listeners
        } catch (error) {
            console.error('Playback error:', error);
            this.updateStatus('❌ Playback error', 'red');
        }
    }
    
    updatePlayPauseButton(isPlaying) {
        const btn = this.elements.playPauseBtn;
        if (isPlaying) {
            btn.innerHTML = '⏸️ Pause';
            btn.classList.add('playing');
            this.updateStatus('🔊 Playing loop...', 'blue');
        } else {
            btn.innerHTML = '▶️ Play Loop';
            btn.classList.remove('playing');
            if (this.loopAudioBuffer) {
                this.updateStatus('⏹️ Stopped', 'gray');
            }
        }
    }

    handlePlay() {
        if (!this.loopAudioBuffer) {
            console.warn('No audio buffer loaded');
            return;
        }
        
        if (!this.wavesurfer) {
            console.error('WaveSurfer not initialized');
            return;
        }
        
        // Check if wavesurfer is ready
        if (this.wavesurfer.getDuration() === 0) {
            console.error('WaveSurfer not ready - no duration');
            this.updateStatus('❌ Audio not loaded properly', 'red');
            return;
        }
        
        try {
            this.wavesurfer.play();
            this.updateStatus('🔊 Playing loop...', 'blue');
        } catch (error) {
            console.error('Playback error:', error);
            this.updateStatus('❌ Playback failed', 'red');
        }
    }

    async handleOverdub() {
        if (!this.loopAudioBuffer) return;

        // Get the base loop duration
        const baseLoopDuration = this.layers[0].duration;
        const currentLoopLength = parseInt(this.elements.loopLength.value);
        
        // Warn if trying to overdub with different length than base loop
        if (Math.abs(currentLoopLength - baseLoopDuration) > 0.1) {
            const proceed = confirm(
                `⚠️ Loop Length Mismatch!\n\n` +
                `Base loop: ${baseLoopDuration.toFixed(1)}s\n` +
                `Current setting: ${currentLoopLength}s\n\n` +
                `Overdubbing with a different length may cause sync issues.\n\n` +
                `Click OK to use ${baseLoopDuration.toFixed(1)}s (recommended)\n` +
                `Click Cancel to use ${currentLoopLength}s anyway`
            );
            
            if (proceed) {
                // Auto-adjust to base loop duration
                this.elements.loopLength.value = Math.round(baseLoopDuration);
                this.updateLoopLengthDisplay(Math.round(baseLoopDuration));
                
                // Update preset button active state
                document.querySelectorAll('.preset-btn').forEach(btn => {
                    if (parseInt(btn.dataset.seconds) === Math.round(baseLoopDuration)) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        }

        // Play count-in if enabled
        if (this.elements.countInToggle.checked) {
            await this.playCountIn();
        }

        this.isRecording = true;
        this.currentRecordingLength = loopLength;
        
        // Show recording indicator
        this.elements.recordingIndicator.style.display = 'flex';
        
        // Disable loop length controls during overdub recording
        this.elements.loopLength.disabled = true;
        document.querySelectorAll('.preset-btn').forEach(btn => btn.disabled = true);
        
        this.updateStatus('🎤 Recording overdub...', 'orange');
        this.elements.overdubBtn.disabled = true;

        const success = await this.recorder.startRecording(
            (secondsLeft) => {
                this.elements.statusText.textContent = `🎤 Recording overdub... (${secondsLeft}s)`;
            },
            async (audioBuffer) => {
                this.isRecording = false;
                this.currentRecordingLength = null;
                
                // Hide recording indicator
                this.elements.recordingIndicator.style.display = 'none';
                
                // Re-enable loop length controls
                this.elements.loopLength.disabled = false;
                document.querySelectorAll('.preset-btn').forEach(btn => btn.disabled = false);
                
                // Save current state to undo stack before making changes
                this.saveStateToUndo();
                
                // Add new layer to layers array
                const fadedBuffer = this.recorder.applyFades(audioBuffer);
                this.layers.push(fadedBuffer);
                this.layerVolumes.push(1.0); // Full volume for new layer
                this.layerMuted.push(false);
                
                // Clear redo stack when new action is performed
                this.redoStack = [];
                
                // Mix all layers with their respective volumes
                this.loopAudioBuffer = this.mixLayers();
                
                await this.loadAudioToWaveform(this.loopAudioBuffer);
                this.updateLayerControls();
                this.updateStatus('✅ Overdub complete!', 'green');
                this.elements.overdubBtn.disabled = false;
            },
            loopLength // Pass custom duration
        );

        if (!success) {
            this.isRecording = false;
            this.currentRecordingLength = null;
            
            // Hide recording indicator
            this.elements.recordingIndicator.style.display = 'none';
            
            // Re-enable loop length controls
            this.elements.loopLength.disabled = false;
            document.querySelectorAll('.preset-btn').forEach(btn => btn.disabled = false);
            
            this.updateStatus('❌ Failed to record overdub', 'red');
            this.elements.overdubBtn.disabled = false;
        }
    }
    
    handleUndo() {
        if (this.undoStack.length === 0) {
            this.updateStatus('⚠️ Nothing to undo', 'orange');
            return;
        }
        
        // Save current state to redo stack
        this.saveStateToRedo();
        
        // Restore previous state
        const previousState = this.undoStack.pop();
        this.layers = previousState.layers;
        this.layerVolumes = previousState.layerVolumes;
        this.layerMuted = previousState.layerMuted;
        
        // Re-mix audio
        this.loopAudioBuffer = this.mixLayers();
        this.loadAudioToWaveform(this.loopAudioBuffer);
        this.updateLayerControls();
        this.updateUndoRedoButtons();
        
        this.updateStatus('↩️ Undone - Last layer removed', 'green');
    }
    
    saveStateToUndo() {
        // Deep copy current state
        this.undoStack.push({
            layers: [...this.layers],
            layerVolumes: [...this.layerVolumes],
            layerMuted: [...this.layerMuted]
        });
        
        // Limit undo stack to 10 items to prevent memory issues
        if (this.undoStack.length > 10) {
            this.undoStack.shift();
        }
        
        this.updateUndoRedoButtons();
    }
    
    saveStateToRedo() {
        // Deep copy current state
        this.redoStack.push({
            layers: [...this.layers],
            layerVolumes: [...this.layerVolumes],
            layerMuted: [...this.layerMuted]
        });
        
        // Limit redo stack to 10 items
        if (this.redoStack.length > 10) {
            this.redoStack.shift();
        }
    }
    
    updateUndoRedoButtons() {
        // Enable undo button only if there's something to undo
        this.elements.undoBtn.disabled = this.undoStack.length === 0 || this.layers.length <= 1;
    }

    async handleDetectChords() {
        if (!this.loopAudioBuffer) return;

        this.updateStatus('🎼 Detecting chords...', 'purple');
        this.elements.detectChordsBtn.disabled = true;

        const audioData = this.loopAudioBuffer.getChannelData(0);
        const sampleRate = this.loopAudioBuffer.sampleRate;

        if (this.analysisWorker) {
            // Use Web Worker (non-blocking)
            this.analysisWorker.postMessage({
                type: 'chords',
                audioData: Array.from(audioData),
                sampleRate: sampleRate
            });
        } else {
            // Fallback to timeout
            setTimeout(() => {
                const chords = this.analyzer.detectChords(this.loopAudioBuffer);
                
                let chordsText = '';
                chords.forEach(({ time, chord }) => {
                    chordsText += `${time}: ${chord}\n`;
                });
                
                this.elements.chordsDisplay.textContent = chordsText || 'No chords detected';
                this.elements.chordsContainer.style.display = 'block';
                
                this.updateStatus('✅ Chord detection complete!', 'green');
                this.elements.detectChordsBtn.disabled = false;
            }, 100);
        }
    }

    async handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file size (50MB mobile, 100MB desktop)
        const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const MAX_FILE_SIZE = isMobile ? 50 * 1024 * 1024 : 100 * 1024 * 1024;
        
        if (file.size > MAX_FILE_SIZE) {
            const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
            const fileMB = (file.size / (1024 * 1024)).toFixed(1);
            alert(`❌ File too large!\n\nYour file: ${fileMB} MB\nMaximum allowed: ${maxMB} MB\n\n${isMobile ? 'Tip: Mobile devices have memory limits.' : 'Tip: Try a smaller file or compress your audio.'}`);
            event.target.value = '';
            return;
        }

        // Validate file type
        const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac', 'audio/m4a'];
        const validExtensions = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aiff'];
        
        const isValidType = validTypes.some(type => file.type.includes(type)) || 
                           validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        
        if (!isValidType) {
            alert('❌ Invalid file type!\n\nPlease upload an audio file:\n• WAV, MP3, OGG, FLAC, M4A, or AIFF\n\nYou cannot upload:\n• Documents (PDF, Word, etc.)\n• Images\n• Videos');
            event.target.value = '';
            return;
        }

        this.updateStatus('📂 Loading audio file...', 'blue');

        try {
            this.loopAudioBuffer = await this.recorder.loadAudioFile(file);
            console.log('Audio buffer loaded, duration:', this.loopAudioBuffer.duration);
            
            this.loopAudioBuffer = this.recorder.applyFades(this.loopAudioBuffer);
            
            // Initialize layers array with loaded file
            this.layers = [this.loopAudioBuffer];
            this.layerVolumes = [1.0];
            this.layerMuted = [false];
            
            // Clear undo/redo stacks for new file
            this.undoStack = [];
            this.redoStack = [];
            this.updateUndoRedoButtons();
            
            this.updateStatus('📊 Preparing waveform...', 'blue');
            await this.loadAudioToWaveform(this.loopAudioBuffer);
            
            this.enableControls();
            this.updateLayerControls();
            this.updateStatus(`✅ Loaded: ${file.name}`, 'green');
            
            // Analyze audio (non-blocking with Web Worker)
            this.analyzeAudio(this.loopAudioBuffer);
        } catch (error) {
            console.error('Failed to load file:', error);
            alert(`❌ Failed to load audio file:\n\n${error.message}`);
            this.updateStatus('❌ Failed to load file', 'red');
        }

        event.target.value = '';
    }

    handleClear() {
        if (!confirm('Are you sure you want to clear the current loop?')) return;

        // Stop metronome if playing
        if (this.metronomeIsPlaying) {
            this.elements.metronomeToggle.checked = false;
            this.stopMetronome();
        }

        this.loopAudioBuffer = null;
        this.layers = [];
        this.layerVolumes = [];
        this.layerMuted = [];
        this.undoStack = [];
        this.redoStack = [];
        this.detectedChords = [];
        this.currentChordIndex = -1;
        this.wavesurfer.empty();
        this.elements.tempoValue.textContent = '--';
        this.elements.keyValue.textContent = '--';
        this.elements.currentTime.textContent = '0:00';
        this.elements.totalTime.textContent = '0:00';
        this.elements.progressBar.style.width = '0%';
        this.elements.progressSlider.value = 0;
        this.elements.progressSlider.style.display = 'none';
        this.elements.loopPositionMarker.style.display = 'none';
        this.elements.chordLabelsLayer.innerHTML = '';
        this.elements.layersSection.style.display = 'none';
        this.elements.layersList.innerHTML = '';
        this.elements.scaleNotesSection.style.display = 'none';
        this.elements.scaleNotes.innerHTML = '';
        this.elements.chordsDisplay.textContent = 'Load or record audio to detect chords';
        this.elements.chordsContainer.style.display = 'none';
        this.disableControls();
        this.updateUndoRedoButtons();
        this.updateStatus('Ready to record!', 'blue');
    }

    async loadAudioToWaveform(audioBuffer) {
        try {
            console.log('Loading audio to waveform, duration:', audioBuffer.duration);
            
            // Convert AudioBuffer to Blob
            const blob = await this.player.audioBufferToBlob(audioBuffer);
            const url = URL.createObjectURL(blob);
            
            console.log('Created blob URL:', url);
            
            // Load into wavesurfer and wait for it to be ready
            await new Promise((resolve, reject) => {
                this.wavesurfer.once('ready', () => {
                    console.log('WaveSurfer ready, duration:', this.wavesurfer.getDuration());
                    resolve();
                });
                
                this.wavesurfer.once('error', (error) => {
                    console.error('WaveSurfer error:', error);
                    reject(error);
                });
                
                this.wavesurfer.load(url);
            });
            
            console.log('Audio successfully loaded to waveform');
            
            // Show the progress slider when audio is loaded
            this.elements.progressSlider.style.display = 'block';
            
            // Show the loop position marker
            this.elements.loopPositionMarker.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading audio to waveform:', error);
            throw error;
        }
    }

    analyzeAudio(audioBuffer) {
        this.updateStatus('🔍 Analyzing audio...', 'blue');
        
        // Extract audio data for worker
        const audioData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        if (this.analysisWorker) {
            // Use Web Worker (non-blocking)
            console.log('Using Web Worker for analysis');
            this.analysisWorker.postMessage({
                type: 'tempo',
                audioData: Array.from(audioData),
                sampleRate: sampleRate
            });
            
            this.analysisWorker.postMessage({
                type: 'key',
                audioData: Array.from(audioData),
                sampleRate: sampleRate
            });
        } else {
            // Fallback to async timeouts (slightly blocking but better than sync)
            console.log('Using fallback analysis');
            setTimeout(() => {
                try {
                    const tempo = this.analyzer.detectTempo(audioBuffer);
                    this.elements.tempoValue.textContent = `${tempo} BPM`;
                    console.log('Tempo detected:', tempo);
                } catch (error) {
                    console.error('Tempo detection error:', error);
                    this.elements.tempoValue.textContent = 'Error';
                }
            }, 100);

            setTimeout(() => {
                try {
                    const key = this.analyzer.detectKey(audioBuffer);
                    this.elements.keyValue.textContent = key;
                    console.log('Key detected:', key);
                    this.updateStatus('✅ Analysis complete!', 'green');
                } catch (error) {
                    console.error('Key detection error:', error);
                    this.elements.keyValue.textContent = 'Error';
                    this.updateStatus('⚠️ Analysis had errors', 'orange');
                }
            }, 200);
        }
    }

    enableControls() {
        this.elements.playPauseBtn.disabled = false;
        this.elements.overdubBtn.disabled = false;
        this.elements.clearBtn.disabled = false;
        this.elements.detectChordsBtn.style.display = 'flex';
        this.updateUndoRedoButtons();
    }

    disableControls() {
        this.elements.playPauseBtn.disabled = true;
        this.elements.overdubBtn.disabled = true;
        this.elements.undoBtn.disabled = true;
        this.elements.clearBtn.disabled = true;
        this.elements.detectChordsBtn.style.display = 'none';
    }

    updateStatus(text, color) {
        this.elements.statusText.textContent = text;
        this.elements.statusText.style.color = color;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    renderChordLabels(chords) {
        if (!chords || chords.length === 0 || !this.wavesurfer) {
            console.log('No chords to render');
            return;
        }
        
        console.log('Rendering chord labels with', chords.length, 'chords:', chords);
        
        const layer = this.elements.chordLabelsLayer;
        layer.innerHTML = ''; // Clear existing labels
        
        const duration = this.wavesurfer.getDuration();
        if (!duration) {
            console.log('No duration available');
            return;
        }
        
        console.log('Audio duration:', duration);
        
        chords.forEach((chord, index) => {
            const pill = document.createElement('div');
            pill.className = 'chord-pill';
            pill.dataset.chordIndex = index;
            pill.textContent = chord.chord;
            
            // Calculate position as percentage
            const position = (chord.timeInSeconds / duration) * 100;
            pill.style.left = `${position}%`;
            
            console.log(`Chord ${index}: ${chord.chord} at ${position.toFixed(2)}%`);
            
            // Click to seek
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.wavesurfer) {
                    this.wavesurfer.seekTo(chord.timeInSeconds / duration);
                }
            });
            
            layer.appendChild(pill);
        });
        
        console.log('Chord labels rendered successfully');
    }
    
    updateCurrentChord() {
        if (!this.detectedChords || this.detectedChords.length === 0 || !this.wavesurfer) {
            return;
        }
        
        const currentTime = this.wavesurfer.getCurrentTime();
        
        // Find current chord based on time
        let currentChordIndex = -1;
        for (let i = this.detectedChords.length - 1; i >= 0; i--) {
            if (currentTime >= this.detectedChords[i].timeInSeconds) {
                currentChordIndex = i;
                break;
            }
        }
        
        // Update if chord changed
        if (currentChordIndex !== this.currentChordIndex) {
            this.currentChordIndex = currentChordIndex;
            
            // Remove active class from all pills and diagrams
            document.querySelectorAll('.chord-pill').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.chord-diagram').forEach(d => d.classList.remove('active'));
            
            if (currentChordIndex >= 0) {
                const currentChord = this.detectedChords[currentChordIndex].chord;
                
                // Add active class to current pill
                const activePill = document.querySelector(`.chord-pill[data-chord-index="${currentChordIndex}"]`);
                if (activePill) {
                    activePill.classList.add('active');
                }
                
                // Add active class to current guitar diagram
                const activeDiagram = document.querySelector(`.chord-diagram[data-chord="${currentChord}"]`);
                if (activeDiagram) {
                    activeDiagram.classList.add('active');
                    // Scroll into view if needed
                    activeDiagram.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    }
    
    updateLoopLengthDisplay(seconds) {
        this.elements.durationInfo.textContent = `Duration: ${seconds}s`;
    }
    
    displayScaleNotes(keySignature) {
        if (!keySignature || keySignature === '--') {
            this.elements.scaleNotesSection.style.display = 'none';
            return;
        }
        
        // Parse key signature (e.g., "C Major", "A Minor")
        const parts = keySignature.split(' ');
        if (parts.length !== 2) {
            console.warn('Invalid key signature format:', keySignature);
            return;
        }
        
        const rootNote = parts[0];
        const mode = parts[1]; // "Major" or "Minor"
        
        // Get scale notes
        const scaleNotes = this.getScaleNotes(rootNote, mode);
        
        // Display scale notes
        this.elements.scaleNotes.innerHTML = '';
        scaleNotes.forEach((note, index) => {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'scale-note';
            
            // Highlight root note
            if (index === 0) {
                noteDiv.classList.add('root');
            }
            
            noteDiv.textContent = note;
            this.elements.scaleNotes.appendChild(noteDiv);
        });
        
        this.elements.scaleNotesSection.style.display = 'block';
    }
    
    getScaleNotes(rootNote, mode) {
        // All 12 notes in chromatic scale
        const allNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Find root note index
        let rootIndex = allNotes.indexOf(rootNote);
        if (rootIndex === -1) {
            console.warn('Invalid root note:', rootNote);
            return [];
        }
        
        // Define scale intervals (semitones from root)
        // Major: W-W-H-W-W-W-H (2-2-1-2-2-2-1)
        // Minor: W-H-W-W-H-W-W (2-1-2-2-1-2-2)
        const intervals = mode === 'Major' 
            ? [0, 2, 4, 5, 7, 9, 11] // Major scale
            : [0, 2, 3, 5, 7, 8, 10]; // Natural minor scale
        
        // Build scale
        const scale = intervals.map(interval => {
            const noteIndex = (rootIndex + interval) % 12;
            return allNotes[noteIndex];
        });
        
        return scale;
    }
    
    mixLayers() {
        if (this.layers.length === 0) return null;
        if (this.layers.length === 1) return this.layers[0];
        
        // Initialize audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
        }
        
        // Get the longest duration and maximum channels
        let maxLength = 0;
        let maxChannels = 1;
        
        this.layers.forEach(layer => {
            maxLength = Math.max(maxLength, layer.length);
            maxChannels = Math.max(maxChannels, layer.numberOfChannels);
        });
        
        // Create a new buffer for the mixed audio
        const mixedBuffer = this.audioContext.createBuffer(
            maxChannels,
            maxLength,
            this.audioContext.sampleRate
        );
        
        // Mix each channel
        for (let channel = 0; channel < maxChannels; channel++) {
            const mixedData = mixedBuffer.getChannelData(channel);
            
            // Mix all layers
            this.layers.forEach((layer, layerIndex) => {
                // Skip if muted
                if (this.layerMuted[layerIndex]) return;
                
                const volume = this.layerVolumes[layerIndex];
                const channelData = layer.getChannelData(Math.min(channel, layer.numberOfChannels - 1));
                
                for (let i = 0; i < channelData.length; i++) {
                    mixedData[i] += channelData[i] * volume;
                }
            });
        }
        
        return mixedBuffer;
    }
    
    updateLayerControls() {
        if (this.layers.length === 0) {
            this.elements.layersSection.style.display = 'none';
            return;
        }
        
        this.elements.layersSection.style.display = 'block';
        this.elements.layersList.innerHTML = '';
        
        this.layers.forEach((layer, index) => {
            const layerDiv = document.createElement('div');
            layerDiv.className = 'layer-control';
            
            const layerIcon = index === 0 ? '🎵' : '➕';
            const layerName = index === 0 ? 'Base' : `Layer ${index}`;
            
            layerDiv.innerHTML = `
                <div class="layer-label">
                    <span class="layer-icon">${layerIcon}</span>
                    <span>${layerName}</span>
                </div>
                <input type="range" class="layer-volume-slider" 
                       data-layer="${index}" 
                       min="0" max="100" 
                       value="${this.layerVolumes[index] * 100}">
                <span class="layer-volume-value">${Math.round(this.layerVolumes[index] * 100)}%</span>
                <button class="layer-mute-btn ${this.layerMuted[index] ? 'muted' : ''}" 
                        data-layer="${index}">
                    ${this.layerMuted[index] ? 'Muted' : 'Mute'}
                </button>
            `;
            
            this.elements.layersList.appendChild(layerDiv);
        });
        
        // Attach event listeners to new controls
        document.querySelectorAll('.layer-volume-slider').forEach(slider => {
            slider.addEventListener('input', (e) => this.handleLayerVolumeChange(e));
        });
        
        document.querySelectorAll('.layer-mute-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleLayerMuteToggle(e));
        });
    }
    
    handleLayerVolumeChange(e) {
        const layerIndex = parseInt(e.target.dataset.layer);
        const volume = parseFloat(e.target.value) / 100;
        
        this.layerVolumes[layerIndex] = volume;
        
        // Update volume display
        const volumeDisplay = e.target.nextElementSibling;
        volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
        
        // Re-mix and update waveform
        this.loopAudioBuffer = this.mixLayers();
        this.loadAudioToWaveform(this.loopAudioBuffer);
    }
    
    handleLayerMuteToggle(e) {
        const layerIndex = parseInt(e.target.dataset.layer);
        
        this.layerMuted[layerIndex] = !this.layerMuted[layerIndex];
        
        // Update button state
        if (this.layerMuted[layerIndex]) {
            e.target.classList.add('muted');
            e.target.textContent = 'Muted';
        } else {
            e.target.classList.remove('muted');
            e.target.textContent = 'Mute';
        }
        
        // Re-mix and update waveform
        this.loopAudioBuffer = this.mixLayers();
        this.loadAudioToWaveform(this.loopAudioBuffer);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AudioLooperApp();
    console.log('� LoopCraft - Initialized!');
});
