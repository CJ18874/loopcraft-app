# 🎵 Audio Looper - Web Edition

A powerful web-based audio looper with real-time waveform visualization, tempo detection, key detection, and chord analysis. Works on desktop, mobile, and tablets!

## ✨ Features

- 🎤 **Record Audio** - 5-second loop recording with visual feedback
- 🔊 **Playback** - Smooth audio playback with YouTube-style progress
- ➕ **Overdubbing** - Layer multiple recordings together
- 📊 **Waveform Visualization** - Real-time audio waveform display
- 🎼 **Musical Analysis**:
  - Tempo detection (BPM)
  - Key detection (Major/Minor)
  - Chord detection with timestamps
- 📂 **File Upload** - Load existing audio files (WAV, MP3, OGG, FLAC, M4A, AIFF)
- 📱 **Mobile Ready** - Works on all devices with responsive design
- 💾 **PWA Support** - Install as an app on your device

## 🚀 Quick Start

### Option 1: Open Locally

1. Simply open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)
2. Allow microphone access when prompted
3. Start recording!

**Note:** For microphone access, you may need to use a local server:

```bash
# Using Python
python -m http.server 8000

# Then visit: http://localhost:8000
```

### Option 2: Deploy to Web (FREE)

#### Deploy to GitHub Pages:

```bash
cd web-looper
git init
git add .
git commit -m "Audio Looper Web App"
git branch -M main
git remote add origin https://github.com/yourusername/audio-looper.git
git push -u origin main
```

Then enable GitHub Pages in Settings → Pages

#### Deploy to Netlify:

1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `web-looper` folder
3. Your app is live!

#### Deploy to Vercel:

```bash
cd web-looper
npx vercel
```

## 📱 Mobile Installation

### On Mobile (PWA):

1. Visit your deployed app URL
2. **iOS:** Tap Share → Add to Home Screen
3. **Android:** Tap Menu → Install App

The app will work offline after installation!

## 🎯 How to Use

1. **Record Loop:**
   - Click "🎤 Record Initial Loop"
   - Record for 5 seconds
   - Audio is automatically analyzed for tempo and key

2. **Play Loop:**
   - Click "▶️ Play Loop" to hear your recording
   - Watch the waveform progress in real-time

3. **Add Layers:**
   - Click "➕ Overdub Layer" to add more recordings
   - Each layer is mixed with the existing loop

4. **Detect Chords:**
   - Click "🎼 Detect Chords" to analyze harmonies
   - View chord progression with timestamps

5. **Load Audio:**
   - Click "📂 Load Audio File"
   - Upload WAV, MP3, OGG, FLAC, M4A, or AIFF files
   - File is analyzed automatically

6. **Clear:**
   - Click "🗑️ Clear Loop" to start over

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Audio:** Web Audio API, MediaRecorder API
- **Visualization:** WaveSurfer.js
- **Analysis:** Custom DSP algorithms (FFT, autocorrelation, chromagram)
- **Architecture:** Client-side only (no backend needed)

## 🌐 Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 📊 Features Comparison

| Feature | Python Desktop | Web Version |
|---------|---------------|-------------|
| Recording | ✅ | ✅ |
| Playback | ✅ | ✅ |
| Waveform | ✅ | ✅ |
| Tempo Detection | ✅ | ✅ |
| Key Detection | ✅ | ✅ |
| Chord Detection | ✅ | ✅ |
| Mobile Support | ❌ | ✅ |
| No Installation | ❌ | ✅ |
| Cross-Platform | ❌ | ✅ |
| Offline Mode | ❌ | ✅ (PWA) |

## 🔧 Customization

### Change Recording Duration:

Edit `js/audio-recorder.js`:

```javascript
this.duration = 5000; // Change to desired milliseconds
```

### Adjust Analysis Parameters:

Edit `js/audio-analyzer.js`:

```javascript
const minBPM = 60;  // Minimum tempo
const maxBPM = 180; // Maximum tempo
const windowSize = 2 * sampleRate; // Chord detection window
```

## 🐛 Troubleshooting

**Microphone not working:**
- Ensure HTTPS or localhost (required for microphone access)
- Check browser permissions
- Try a different browser

**No sound on playback:**
- Check system volume
- Ensure browser tab isn't muted
- Try headphones

**File upload fails:**
- Ensure file is a valid audio format
- Try converting to WAV or MP3
- Check file size (browser limits apply)

## 📄 License

Free to use and modify for personal and commercial projects.

## 🙏 Credits

Converted from Python tkinter desktop app to modern web application.

**Libraries Used:**
- WaveSurfer.js - Waveform visualization
- Web Audio API - Audio processing
- MediaRecorder API - Audio recording

---

**Enjoy making music loops! 🎵**
