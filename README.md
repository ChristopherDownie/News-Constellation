# NewSqhere

**Immersive 3D live news exploration.**

NewSqhere transforms the way you consume news by placing 48 live broadcast streams into an interactive 3D constellation. Orbit, zoom, and fly through a sphere of glowing nodes — each one a real, 24/7 news outlet streaming via YouTube. As you approach a source, its audio fades in spatially; zoom away and it fades out, replaced by the ambient hum of the news universe.

![NewSqhere Screenshot](https://img.shields.io/badge/Status-Active%20Development-blue)

---

## ✨ Features

- **3D News Constellation** — 48 live news outlets arranged as glowing nodes inside a bounding sphere, connected by edge networks built with k-nearest-neighbor clustering and inter-cluster bridges.
- **Spatial Audio Mixing** — Stream volumes are driven by camera proximity. Sources grow louder as you fly closer and fade to silence as you move away, with stereo panning based on the camera's orientation.
- **YouTube Live Streams** — Each node embeds a hidden YouTube IFrame player (via the YT IFrame API) for real 24/7 broadcast feeds from outlets like NBC News, Al Jazeera, Sky News, Bloomberg, DW News, and many more.
- **Audio-Reactive Visualizers** — Each hub node is wrapped in a procedurally animated sphere whose vertices displace outward based on simulated frequency data, creating an organic "breathing" effect.
- **Focus Mode & Deep Dive** — Double-click any source to fly in, watch its live video stream, see related headlines, and read a real-time transcript.
- **Live Transcription & Topic Detection** — When focused on a stream, the Web Speech API transcribes the broadcast audio in real time. A keyword-scoring topic detector analyzes the transcript and displays a live topic badge (Politics, Economy, World Affairs, Tech & Science, Breaking, General).
- **Dark & Light Themes** — Full theme toggle that updates the 3D scene, dust particles, edges, node labels, and UI panels.
- **Ambient Soundscape** — A layered sine-wave drone hum plays from the moment you enter, with a procedural woosh sound tied to camera movement speed.
- **Animated Tutorial** — A brief animated overlay teaches navigation controls before revealing the 3D world.
- **Search & Sources Panel** — Search across all outlet names and headlines; browse all sources in a sidebar and click to fly to any node.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D Rendering | [Three.js](https://threejs.org/) with `InstancedMesh`, custom shaders, and `OrbitControls` |
| Audio | YouTube IFrame API, Web Audio API (oscillators, filters, stereo panning), Web Speech API |
| Procedural Generation | [simplex-noise](https://github.com/jwagner/simplex-noise.js) for organic drift and frequency simulation |
| Build Tool | [Vite](https://vitejs.dev/) |
| Language | TypeScript |

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/newsqhere.git
cd newsqhere

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser, click **Enter**, and explore.

---

## ⚠️ Known Limitations

### Audio Transcription of Multiple Streams

NewSqhere's live transcription feature relies on the **Web Speech API** (`webkitSpeechRecognition`), which uses the device's **microphone** as its audio input. This introduces several inherent constraints:

1. **Single-source transcription only** — The Web Speech API can only maintain **one active recognition session** at a time. You cannot run parallel transcription instances for multiple streams simultaneously. Transcription is therefore only available when focused on a single source in Deep Dive mode.

2. **Requires speaker-to-mic loopback** — Because the Speech API listens through the microphone, it can only transcribe audio that is physically playing through the user's speakers (or headphones with pass-through). If the system volume is low or muted, the transcript will be empty. This also means **ambient room noise** can interfere with transcription accuracy.

3. **No direct audio stream access** — YouTube IFrame embeds do not expose a raw audio stream or `MediaStream` that could be piped directly into a `SpeechRecognition` instance or a Web Audio `AnalyserNode`. The IFrame API only provides volume control and playback state — not the underlying audio data. This is a fundamental browser security/sandboxing restriction on cross-origin iframes.

4. **Browser compatibility** — The Web Speech API is only fully supported in Chromium-based browsers (Chrome, Edge, Brave). Firefox and Safari have limited or no support for continuous speech recognition.

5. **YouTube Error 150 (Embedding Restrictions)** — Some live streams are restricted by their owners from being embedded on third-party sites. These streams will fail to load and will show as unavailable. This is not a bug but a content restriction set by the stream publisher.

### What would be needed for multi-stream transcription

True simultaneous transcription of multiple streams would require one of the following approaches:
- **Server-side transcription** using a service like Google Cloud Speech-to-Text, AWS Transcribe, or OpenAI Whisper, where each stream's audio is captured and transcribed independently on the backend.
- **Direct audio stream access** via a protocol that exposes raw audio (e.g., HLS/DASH manifests parsed client-side), bypassing the YouTube IFrame sandbox entirely.
- **Browser extension with tab audio capture** using `chrome.tabCapture` or `getDisplayMedia()` to capture the audio output and route it to a Speech Recognition instance — though this still limits you to one capture stream at a time.

---

## 📁 Project Structure

```
src/
├── main.ts              # Core app — scene setup, animation loop, audio, UI events
├── graph.ts             # Procedural graph generation (nodes, edges, clusters)
├── youtubePlayer.ts     # YouTube IFrame API manager for all live streams
├── audioVisualizer.ts   # Per-node audio-reactive sphere visualizer
├── topicDetector.ts     # Keyword-scoring topic detector for transcripts
├── landingParticles.ts  # Landing page particle animation
├── style.css            # All styles including themes, panels, and animations
index.html               # App shell with all UI panels and overlays
```

---

## 📄 License

MIT
