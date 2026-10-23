# FreeTools - In Browser Media Studio & Tool Repo

A high-performance, privacy-first local media processing suite and developer toolkit built with Angular. All image, audio, video, PDF, document, and data operations execute 100% directly inside browser memory via Canvas, Web Audio, MediaRecorder, and WebAssembly / WASM APIs. Local file processing does not upload your files. Network tools make direct requests to the selected website or public data provider; see the security tools below.

### The Story Behind This

I got tired of searching for simple tools online only to deal with the same frustrating pattern every single time: websites forcing you to create an account, locking basic downloads behind paywalls, slapping watermarks across your files, or giving you nothing more than a tiny preview.

So I decided to build the toolkit I actually wanted and give it away for free. No signups, no subscriptions, no tracking, and no file uploads. Processing runs in your browser; live lookup tools use public network services.

This is just the beginning. I'll keep building and adding more tools to replace every bloated, paywalled utility out there.

Wanna download your own generated models from Meshy? I have that too: [GrabThatMesh](https://github.com/Prathewsh/GrabThatMesh).

Modern Geometric ( MGE ) is my team btw for those who are wondering about that. check it out here : [MGE](https://github.com/Mgeometric).

---

## Tool Suite Overview

### 1. PDF Tools

- **PDF Studio & Merger**:
  - **Word-Style Document Editor**: Live rich-text drafting canvas with bold, italic, headings, lists, typography selection (Sans, Serif, Monospace), and direct vector PDF export.
  - **PDF Import**: Open existing PDF documents directly into the editor sheet with automatic layout extraction.
  - **Merge PDFs**: Select multiple PDF documents, re-order pages, and merge into a single consolidated file.
  - **Split & Extract**: Extract specific page ranges (e.g. `1-3, 5`) with instant single or multi-page export.
  - **Rotate Pages**: 90°, 180°, and 270° orientation corrections across all pages.
  - **Metadata Editor**: View and update PDF title, author, subject, and keywords without altering document contents.
- **PDF Signature Studio**:
  - Draw handwritten signatures with variable stroke width.
  - Type stylized signatures or upload signature images.
  - Interactive drag-and-drop placement, scaling, and rotation on any page of loaded PDF documents.

---

### 2. Image Tools

- **Background Remover**:
  - **Auto Smart AI**: Border-connected flood-fill matting isolating subjects while preserving hair and translucent borders.
  - **Color-Key Eyedropper**: Sample custom background colors directly on canvas.
  - **Controls**: Interactive split comparison slider, tolerance threshold (5% - 80%), edge feathering, despill filtering, touchup keep/erase brush.
  - **Backdrops**: Transparent alpha cutout, solid studio colors, DSLR bokeh depth blur, cyberpunk gradient, custom image backdrop compositing.
  - **Export & Transfer**: Instant PNG download, direct clipboard copy, and one-click transfer into the Image Studio.
- **Screenshot Studio**:
  - Capture browser-visible windows (`getDisplayMedia`) or drop screenshots.
  - Markup annotations: arrows, boxes, circles, freehand draw, and numbered step badges.
  - Redaction tool: pixelate and blur sensitive credentials or private text.
  - Device mockup wrapper: macOS window frame and minimal browser border.
- **Image Studio**:
  - **Crop & Aspect Ratio**: Freeform and fixed aspect ratio presets (1:1, 16:9, 4:3, 9:16, 3:2, circle avatar).
  - **Resize**: Proportional aspect ratio lock, resolution presets (1080p, 720p, 512×512), percentage scaling.
  - **Rotate & Flip**: 90-degree rotations, horizontal/vertical flipping with non-destructive live preview.
  - **Filters & Effects**: Presets (Noir B&W, Cyberpunk, Vintage, Dramatic, Warm, Cold), sliders for brightness, contrast, saturation, unsharp mask.
  - **Watermark**: Custom text, typography, color, corner/center positioning, and opacity controls.
  - **Export**: WebP, JPEG, and PNG with dynamic compression quality and live file size estimation.
- **Image Compressor**:
  - In-browser bulk image compression for JPEG, PNG, WebP, GIF, and BMP.
  - Real-time compression savings comparison with target size control.
- **Color Replacer**:
  - Select and replace any target color across an entire PNG or graphic with adjustable delta-E color tolerance.
- **Animation Studio (GIF Tools)**:
  - Create animated GIF loops and sprite sheets from multi-frame image sequences.
  - Control frame rate (FPS), reverse sequences, and loop parameters.
- **Color Palette Generator**:
  - Extracts dominant palette schemes and swatches from graphics using quantization.
  - Interactive canvas pixel eyedropper with one-click HEX/RGB copying.

---

### 3. Video & Audio

- **Video Editor**:
  - Interactive start and end trim sliders with live timestamp markers.
  - Variable preview playback speed (0.5×, 1×, 1.5×, 2×).
  - Volume control with track muting for export.
  - 90-degree incremental rotation and horizontal/vertical flipping.
  - Instant full-resolution video frame capture saved locally as PNG.
  - Client-side WebM rendering via HTML5 Canvas and MediaRecorder APIs.
- **Audio Studio & Converter**:
  - **Format Converter**: Encode and cross-convert between MP3, WAV, OGG, FLAC, and AAC.
  - **Track Mixer**: Multi-track project combiner with per-track volume sliders and second-accurate delay offsets.
  - **Silence Remover**: Silence detector with configurable dB threshold and duration, one-click silent gap stripping.
  - **Normalizer & Meter**: Peak dBFS, RMS energy analysis, and studio normalization ($-0.1$, $-0.5$, $-1.0$, $-2.0\text{ dBFS}$).
  - **Pitch & Equalizer**: Semitone pitch shifting and 3-band digital EQ (Bass, Mids, Treble).
  - **Live Visualizer & Spectrogram**: Real-time oscilloscope, frequency bars, and waterfall spectrogram.
  - **Waveform Cutter**: Trim, slice, delete & splice, fade in/out curves, and lossless 16-bit PCM WAV export.

---

### 4. File Converters

- **Batch Converter**:
  - Multi-file drag-and-drop queue for bulk image conversions.
  - Cross-conversion between WebP, JPEG, and PNG.
  - Maximum dimension downscaling (e.g., 1920px max width).
  - Bulk ZIP download or individual file saves.
- **Base64 Tool**:
  - Encode & decode text strings and raw binary files / images to Base64 data URLs.
  - Live data URL preview with instant copy.

---

### 5. Text & Writing Tools

- **Text Tools & Cleaner**:
  - Case converters (UPPERCASE, lowercase, Title Case, camelCase, kebab-case, snake_case).
  - Live statistics: word count, character count, sentence count, reading time estimation.
  - Line sorter (alphabetical, length, reverse), deduplication, whitespace trim, and regex find & replace.
- **Markdown Studio**:
  - Side-by-side Markdown writing sheet with instant rendered HTML preview.
  - Insert shortcuts for tables, headings, checklists, blockquotes, code blocks, and links.
  - Word, character, and line metrics with `.md` and `.html` file export.
- **Lorem Ipsum Builder**:
  - Generate customizable placeholder text by paragraphs, sentences, or word counts.
  - Optional HTML markup tags (`<p>`, `<ul>`, `<h3>`).

---

### 6. Developer Tools

- **Data Faker**:
  - Generates realistic synthetic datasets (names, emails, phone numbers, job titles, companies, cities, countries, dates, UUIDs).
  - Export instant datasets as JSON, CSV, or raw SQL `INSERT` statements up to 500 records.
- **Breakpoint Previewer**:
  - Preview any website or web app at common viewport dimensions (iPhone SE, iPhone 15 Pro, iPad Mini, iPad Pro 11", Laptop, Full HD Desktop).
  - Responsive orientation flip (Portrait / Landscape) in simulated device chrome.
- **JSON Formatter & Tree**:
  - Beautify with custom indentation (2 spaces, 4 spaces, tabs) or compact minification.
  - Alphabetical key sorting (A–Z and Z–A).
  - Interactive collapsible tree view with deep-search filtering across keys and values.
  - Real-time syntax error validation.
- **JSON Diff & CSV**:
  - Side-by-side structural comparison of two JSON payloads with highlighted additions, deletions, and modifications.
  - Two-way JSON to CSV table parser and exporter.
- **Binary & Bitwise Operations**:
  - Text to binary string conversion.
  - Radix base converter (Binary, Octal, Decimal, Hexadecimal).
  - Live bitwise calculator (`AND`, `OR`, `XOR`, `NOT`, bit-shifts).
- **Unicode & Symbols**:
  - Character code point and HTML entity inspector (`&#...;`, `\u...`).
  - Categorized palette of 250+ technical, mathematical, and typography symbols with instant copy.
- **QR Code Generator**:
  - High-resolution client-side QR code generator with adjustable error correction levels (L, M, Q, H).
  - Custom foreground and background colors with direct PNG export.

---

### 7. Calculators & Finance

- **Math & Statistics**:
  - **Dynamic Matrix Calculator**: Custom arbitrary dimension matrix operations ($2\times 2$, $3\times 3$, $4\times 4$, $6\times 6$, up to $10\times 10$ and non-square sizes like $7\times 9$).
    - Matrix multiplication ($A \times B$), addition, subtraction, scalar multiplication, and transpose ($A^T$).
    - $N\times N$ Determinant ($|A|$) and Matrix Inverse ($A^{-1}$) via Gaussian elimination and Gauss-Jordan solvers.
    - Quick presets, Identity fill, Random number fill (-9 to 9), and Zero fill.
  - **Scientific Expression Evaluator**: Real-time parser supporting trigonometric functions (`sin`, `cos`, `tan`, `asin`, `acos`, `atan`), logarithms (`log`, `ln`), square/cube roots, powers (`^`), and mathematical constants ($\pi$, $e$).
  - **Descriptive Statistics**: Instant calculation of Mean, Median, Min, Max, Range, Sample Variance ($s^2$), and Standard Deviation ($s$).
  - **Fractions & Ratios**: Addition, subtraction, multiplication, and division with automated GCD reduction and decimal approximations.
  - **Primes & Number Theory**: Primality testing, prime factorization tree, Greatest Common Divisor (GCD), and Least Common Multiple (LCM).
  - **Geometry & Volume**: 2D/3D area, circumference, perimeter, and volume calculators for circles, rectangles, triangles, spheres, and cylinders.
  - **Percentage Tools**: Instant percentage calculation and percentage difference / percentage change tracker.
- **Time & Clocks**:
  - Unix epoch timestamp converter (seconds and milliseconds to human datetime and vice versa).
  - World time zone converter.
  - High-precision split stopwatch and countdown timer.
  - Date difference duration calculator.

---

### 8. Pickers & Utilities

- **Wheel of Chance**:
  - Interactive canvas prize wheel with custom segments, labels, and colors.
  - Physics-based spin deceleration.
  - Automatic elimination mode for fair sweepstakes, team draws, and raffle giveaways.

---

### 9. SEO Tools

- **Robots.txt Generator**:
  - Visual builder for crawler directives by User-agent (`*`, Googlebot, Bingbot, etc.).
  - Configure Allow and Disallow paths, Crawl-delay, Host, and Sitemap links with live syntax generation and download.
- **Article to Markdown**:
  - Converts raw web articles, blog posts, and HTML into clean, sanitized Markdown format.
  - Strips advertisement junk, tracker scripts, and navigation clutter.

---

### 10. Security & Privacy

- **PHP2Shell Checker**:
  - Inspect a site URL, paste HTTP response headers, or check a PHP version / `php -v` banner locally.
  - Recognizes PHP and `mod_php` banners, `X-PHP-Version`, session-cookie hints, and possible Windows server signatures. Shows detection evidence, handles redirect header chains, and flags conflicting versions.
  - Compares versions against the PHP2Shell advisories for [CVE-2026-109618](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) and [CVE-2026-109619](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp): fixes in 8.2.35, 8.3.36, 8.4.27 and 8.5.12. Invalid, incomplete, prerelease and unlisted versions remain unverified.
  - URL mode requests headers directly from the entered target, with a GET fallback if HEAD is unsupported. Browser CORS restrictions can hide or block headers; a quoted cURL helper lets you collect headers yourself and paste them locally.
  - Passive version assessment only: it does not execute exploit payloads. PHP2Shell affects web-serving PHP across platforms, including FPM, mod_php, CGI, FrankenPHP and LiteSpeed. Vendor backports may retain older version banners; verify the installed package and restart PHP workers. PHP 7.4, 8.0 and 8.1 have source backports rather than new upstream releases. This tool cannot determine whether a site was already compromised. A matching baseline is not a general security certification; use a current supported release.
  - Includes the [23 October session upload progress follow-up](https://www.php.net/archive/2026.php): keep `session.upload_progress.enabled=0` until the applicable fix; meeting the PHP2Shell version baseline does not certify all configurations as safe.
- **Breach Radar (Major Breaches & CVE Radar)**:
  - Browse curated historical breach records and notable CVEs, filter by category or keyword, and inspect incident details and remediation notes.
  - Look up a CVE ID and refresh recent CVE disclosures through the [CIRCL Vulnerability-Lookup API](https://vulnerability.circl.lu/api/).
  - Displays available descriptions, CVSS scores, publication dates, weakness information and advisory links, with timeout and retry feedback.
  - The historical catalog is bundled locally. Opening the tool loads the recent feed; live searches send the entered CVE ID to CIRCL. Public APIs and target sites receive ordinary request metadata, including your IP address. No breach-account or email lookup is performed.
- **File Crypto Studio**:
  - Encrypt and decrypt any file (images, documents, archives, videos) 100% in-browser via Web Crypto SubtleCrypto.
  - Authenticated encryption using AES-256-GCM with a 128-bit integrity authentication tag and random 96-bit initialization vectors.
  - Passphrase-derived keys using PBKDF2 (SHA-256) with configurable iterations (100,000 to 600,000 rounds) and 128-bit random salts.
- **Certificate Inspector**:
  - Live public Certificate Transparency (CT) log queries or direct X.509 PEM/CRT file/paste inspection.
  - Inspect Common Name (CN), Subject Alternative Names (SANs), Issuer Authorities, validity periods, countdowns, serial numbers, and SHA-256 fingerprints.
- **PDF Security Inspector**:
  - Static structural analysis of PDF documents without executing external code.
  - Dissect PDF object dictionaries to detect embedded JavaScript (`/JavaScript`, `/JS`), auto-execution triggers (`/OpenAction`, `/AA`), binary launches (`/Launch`), Optional Content Groups (OCG hidden layers), and smuggled payloads (`/EmbeddedFiles`).
- **Cryptographic Hash Generator**:
  - Computes SHA-256, SHA-384, SHA-512, and SHA-1 checksums for raw text and binary files via the Web Crypto API.
- **Metadata Remover**:
  - Strips EXIF metadata, camera serial numbers, GPS geo-coordinates, author names, and timestamps from images before sharing.
- **Archive Explorer**:
  - Client-side ZIP and archive inspector.
  - Inspect file listings, directory hierarchies, and compressed file sizes without extraction.
  - Security warning heuristics detecting disguised executables (e.g. `.exe` disguised inside archives).
- **Password Studio**:
  - Cryptographically secure pseudorandom password and passphrase generator (`crypto.getRandomValues`).
  - Brute-force entropy analyzer estimating crack time against offline and online attack speeds.

---

### 11. AI Tools

- **Verifiable AI & Metadata Inspector**:
  - Verifies embedded Content Credentials (C2PA) manifests and JUMBF cryptographic boxes.
  - Scans raw image chunks for Stable Diffusion / ComfyUI / Automatic1111 prompts, negative prompts, CFG scales, and sampler parameters.
  - Detects Midjourney, OpenAI DALL-E, and Adobe Firefly metadata tags.
  - Verifies authentic camera hardware EXIF without relying on inaccurate generative heuristics.

---

### 12. Design & Color Tools

- **CSS Clip-Path Builder**:
  - Interactive polygon vertex dragger, circle/ellipse presets, star, trapezoid, and custom coordinate manipulation with live CSS code snippet generation.
- **CSS Gradient Generator**:
  - Linear and radial gradient designer with multiple color stops, position control, and rotation angle slider.
  - Instant CSS code snippet copy.
- **Box Shadow Generator**:
  - Design layered, inset, and soft drop shadows with horizontal/vertical offsets, blur, spread radius, and opacity controls.
  - Clean preview backdrop with instant production CSS export.
- **Colour Converter**:
  - Real-time conversion across HEX, RGB, HSL, and CMYK color spaces.
  - Built-in WCAG 2.1 contrast ratio checker for accessibility compliance.

---

### 13. Networking

- **IP Address Checker**:
  - Check your global IPv4 and IPv6 address, Autonomous System Number (ASN), ISP organization, and routing subnet.
  - Geolocation details including city, region, country, coordinates, and local timezone.
  - Live browser connection link metrics (downlink speed, RTT latency, protocol version).
- **Network Speed Test**:
  - Real-time in-browser internet broadband speed test inspired by fast.com.
  - Measures live download throughput, upload bandwidth, unloaded latency (ping), and jitter buffer without telemetry or external tracking.

---

## Technical Stack

- **Framework**: Angular 22 (Standalone Components, Signals, Computed Values, `@if` / `@for` control flow)
- **Styling**: SCSS with design tokens matching a dark matte studio aesthetic (`#1b1c20`, `#141519`, `#c1e993`)
- **Iconography**: LineIcons Free CDN vector suite
- **PDF Engine**: `pdf-lib` and `pdfjs-dist` for client-side PDF synthesis, parsing, and rendering
- **Audio Processing**: Web Audio API (`AudioContext`, `AudioBuffer`, custom WAV PCM encoder)
- **Image Processing**: HTML5 Canvas 2D API (`OffscreenCanvas`, pixel manipulation, convolution matrices)
- **Video Processing**: MediaStream / MediaRecorder API, HTML5 Canvas 2D frame manipulation
- **Browser-Based Processing**: Local tools run in browser memory; live certificate and vulnerability lookups depend on public APIs.

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

## Issues & Requesting New Tools

Found a bug or want a specific tool added?
- **Report an Issue**: If something is broken or misbehaving, open a bug report on the [Issues page](https://github.com/Prathewsh/FreeTools/issues) with reproduction steps and browser details.
- **Request a Tool**: If there is an online utility you're tired of paying for or having to log in to use, submit a tool request on [GitHub Issues](https://github.com/Prathewsh/FreeTools/issues).

---

## Contributing

Contributions and community-built tools are welcome. Please read our [Contributing Guide](CONTRIBUTING.md) for development setup, PR guidelines, and tool creation rules.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/my-new-tool`).
3. Commit your changes (`git commit -m 'Add new tool'`).
4. Push to the branch (`git push origin feature/my-new-tool`).
5. Open a Pull Request.

> **Note**: All tools must preserve the core philosophy—client-side processing without file uploads or telemetry. Clearly document any public API dependencies and what live lookup requests send.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free community. By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

This project is licensed under the MIT License. Free for personal and commercial use. See [LICENSE](LICENSE) for details.
