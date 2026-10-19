# Contributing to FreeTools

Thank you for your interest in contributing to FreeTools! This project exists to provide free, privacy-respecting, and fast utilities that run entirely on the user's device.

---

## Core Principles

Every tool added or modified in FreeTools must adhere to these foundational rules:

1. **100% Client-Side**: All processing (decoding, encoding, transforming, analyzing) must execute in the browser.
2. **Zero Uploads & Zero Telemetry**: User files, data, and usage metrics must never be transmitted to any remote server or external API.
3. **No Paywalls or Forced Logins**: FreeTools remains completely free and unrestricted.
4. **Performance & Clean UI**: Maintain fast startup, responsive interaction, and align with the minimalist matte dark UI design system.

---

## How Can I Contribute?

### 1. Reporting Bugs
- Search existing [Issues](https://github.com/Prathewsh/FreeTools/issues) to verify if the issue was already reported.
- Open a new issue with a clear title, description, steps to reproduce, and browser/OS details.

### 2. Requesting or Proposing a Tool
- If you ran into a paywalled or frustrating web utility that should be part of FreeTools, open an issue labeled as a tool request.
- Outline what the tool should do, typical inputs/outputs, and suitable browser APIs (e.g. Canvas, Web Audio, WebAssembly).

### 3. Submitting Code

#### Development Setup

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/FreeTools.git
   cd FreeTools
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```
   Open `http://localhost:4200/` in your browser.

4. **Run tests**:
   ```bash
   npm test
   ```

#### Adding a New Tool

1. Generate or create your standalone component in `src/app/components/<tool-name>/`.
2. Register the tool metadata in `src/app/app.ts` (`tools` list and `ToolTab` type).
3. Mount the component conditionally in `src/app/app.html`.
4. Use existing design tokens and container classes (`.simple-tool-card`, `.card-header`, `.card-footer`, buttons, and inputs) defined in `src/styles.scss`.
5. Update `README.md` with documentation for the new tool.

#### Pull Request Guidelines

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes and commit with concise, descriptive commit messages.
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request targeting the `main` branch.
5. Provide a summary of changes and screenshots/recordings if UI changes were made.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to prathewshsureshbabu@gmail.com.
