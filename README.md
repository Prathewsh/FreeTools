# FreeTools by MGE - In-Browser Media Studio & Tool Repo

A high-performance, privacy-first local media processing suite and developer toolkit built with Angular. All image, audio, video, and data operations execute 100% directly inside browser memory via Canvas, Web Audio, and MediaRecorder APIs. No files or telemetry are transmitted to external servers.

### The Story Behind This

I got tired of searching for simple tools online only to deal with the same frustrating pattern every single time: websites forcing you to create an account, locking basic downloads behind paywalls, slapping watermarks across your files, or giving you nothing more than a tiny preview.

So I decided to build the toolkit I actually wanted and give it away for free. No signups, no subscriptions, no tracking, and no server uploads, everything executes directly in your browser.

This is just the beginning. I'll keep building and adding more tools to replace every bloated, paywalled utility out there.

---

## Features

### 1. Background Remover

- **Extraction Engines**:
  - **Auto Smart AI**: Border-connected BFS flood-fill matting that protects foreground subjects (clothing, teeth, skin, eyes) while isolating edges.
  - **Color-Key Eyedropper**: Sample any custom background color directly on the canvas.
- **Controls & Adjustments**:
  - Interactive split comparison slider with instant dual-canvas rendering.
  - Adjustable tolerance threshold (5% - 80%) and edge feather softness.
  - Color halo despill filtering for edge/hair clarity.
  - Edge antialiasing and smoothing.
  - Touchup brush with "Keep" and "Erase" modes.
- **Backdrop Replacements**:
  - Transparent PNG alpha cutout.
  - Solid studio backgrounds.
  - DSLR bokeh depth blur.
  - Studio cyberpunk gradient.
  - Custom image backdrop compositing.
- **Export & Transfer**: Instant PNG download, direct clipboard copy, and one-click transfer into the Image Manipulator.

---

### 2. Image Manipulator & Studio

- **Crop & Aspect Ratio**:
  - Interactive crop box with mouse drag and corner resize handles.
  - Aspect ratio presets: Free, 1:1 Square, 16:9 Widescreen, 4:3 Standard, 9:16 Story, 3:2, and Circle Avatar.
- **Resize**:
  - Width and height inputs with proportional aspect lock toggle.
  - One-click presets (1080p, 720p, 512x512) and percentage scaling.
- **Rotate & Flip**:
  - 90-degree clockwise / counter-clockwise rotations.
  - Horizontal and vertical flips with non-destructive live preview.
- **Filters & Effects**:
  - Presets: Noir B&W, Cyberpunk, Vintage, Dramatic, Warm, Cold.
  - Fine adjustment sliders: Brightness, Contrast, Saturation, and Unsharp Mask convolution.
  - "Bake Filters" permanently into canvas history.
- **Watermark**:
  - Custom text, font color, positioning (corner presets or center), and opacity control.
- **Export Options**:
  - Formats: WebP (compact), JPEG (standard), and PNG (lossless).
  - Configurable compression quality slider with dynamic file size estimation.
  - Multi-state undo and redo history stack.

---

### 3. Basic Video Editor

- **Clipping & Trimming**:
  - Interactive start and end trim sliders with live timestamp formatting.
  - "Start at cursor" and "End at cursor" one-click markers.
- **Playback & Audio Controls**:
  - Variable preview speed (0.5×, 1×, 1.5×, 2×).
  - Volume slider and option to mute exported audio track.
- **Transforms & Capture**:
  - 90-degree incremental rotation.
  - Horizontal and vertical flipping.
  - Instant frame capture saved locally as PNG.
- **Client-Side Export**:
  - Real-time WebM video rendering via HTML5 Canvas and MediaRecorder APIs.

---

### 4. Audio Cutter & Trimmer

- **High-DPI Waveform Engine**:
  - Canvas-based peak visualization with timestamp grid and playhead tracking.
  - Draggable start and end trim handles with window-bound tracking.
- **Cut Operations**:
  - **Trim & Keep Selection**: Retains only the selected segment.
  - **Delete & Splice**: Cuts out the selected segment and joins remaining parts seamlessly.
- **Playback & Effects**:
  - Play selection, play full track, toggle loop, and stop.
  - Playback speed multiplier (0.75x, 1.0x, 1.25x, 1.5x).
  - Linear fade-in and fade-out envelope curves (0 to 3.0 seconds).
  - Volume boost adjustment (0.1x to 3.0x).
- **Audio Input & Export**:
  - Decodes MP3, WAV, FLAC, OGG, and M4A via `AudioContext.decodeAudioData`.
  - In-browser microphone recording.
  - Lossless 16-bit PCM RIFF WAV exporter.

---

### 5. Batch Converter & Compressor

- Multi-file drag-and-drop queue for bulk processing.
- Format conversion across WebP, JPEG, and PNG.
- Sequential processing via browser canvas.
- Optional maximum dimension constraints (e.g. 1920px max width).
- Real-time compression savings calculator showing percentage file reduction.
- Individual file download or bulk batch download.

---

### 6. Color Palette Generator

- Extracts dominant colors from any uploaded image using median/quantization analysis.
- Interactive canvas pixel eyedropper with one-click hex code clipboard copying.

---

### 7. JSON Formatter & Viewer

- **Formatting & Validation**:
  - Beautify with customizable indentation (2 spaces, 4 spaces, tabs).
  - Compact minification.
  - Alphabetical key sorting (A–Z and Z–A).
  - Instant syntax error detection with error message banner.
- **Inspection & Tree View**:
  - Collapsible interactive tree viewer with nested object/array traversal.
  - Live search filtering across keys and values.
  - Type badges (string, number, boolean, null, object, array).
- **Import & Export**:
  - Drag-and-drop file upload, file download, and one-click clipboard copy.

---

## Technical Stack

- **Framework**: Angular 22 (Standalone Components, Signals, Computed Values)
- **Styling**: SCSS with design tokens matching a dark matte aesthetic
- **Audio Processing**: Web Audio API (`AudioContext`, `AudioBuffer`, custom WAV PCM encoder)
- **Image Processing**: HTML5 Canvas 2D API (`OffscreenCanvas`, pixel manipulation, convolution matrices)
- **Video Processing**: MediaStream / MediaRecorder API, HTML5 Canvas 2D frame manipulation
- **Zero Dependencies for Processing**: No server backend or external third-party SDK dependencies required.

---

## Getting Started

### Prerequisites

- Node.js 22.22.3+, 24.15.0+, or 26+ (matching Angular CLI requirements).
- npm or yarn

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Development Server

Run the development server locally:

```bash
npm start
# or
npx ng serve --port 4200
```

Open your browser and navigate to `http://localhost:4200/`.

### Production Build

To create an optimized production build:

```bash
npm run build
```

Build outputs are generated in the `dist/` directory.

---

## License

MIT License. Free for personal and commercial use.
