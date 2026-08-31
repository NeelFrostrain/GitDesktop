# Changelog

All notable changes to **Git Desktop** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.1] - 2026-08-31

### Added & Enhanced
- **Diff Viewer Automatic Word Wrapping**:
  - Implemented dynamic line wrapping (`whitespace-pre-wrap break-all`) across both Split (Side-by-Side) and Unified diff views so long lines (cryptographic signatures, hashes, URLs, JSON tokens, long strings) are 100% visible without horizontal truncation or ellipses.
  - Integrated TanStack Virtual dynamic element height measurement (`measureElement`) to dynamically calculate and allocate precise row heights for multi-line wrapped content.
  - Styled line numbers and addition/deletion indicator columns to vertically align to the top of wrapped lines with full row stretching.
- **Automated Release Pipeline (`scripts/build-app.ts`)**:
  - Built an automated release build script that packages production Tauri binaries (`.msi`, `.exe`), signs them with Ed25519 key signatures (`.sig`), and outputs clean assets to a versioned directory (`release-v0.1.1/`).
  - Added automated `latest.json` updater manifest generator for instant auto-updater deployments.
- **Automatic App Startup Update Checker**:
  - Added automated background check on app launch to query GitHub releases for available updates.
  - Designed an interactive dark-themed Update Modal showing version notes, download progress bar with byte metrics, and single-click restart & install.
- **Git LFS (Large File Storage) Manager**:
  - Redesigned the LFS workspace dashboard with quick file pattern tracking presets (`*.psd`, `*.zip`, `*.mp4`, etc.), binary file locks management, and working tree OID inspection.
- **Interactive Release Management**:
  - Redesigned the Create/Edit Release modal with AI-powered release note changelog drafting, binary asset attachment dropzone, and multi-tag switching.

### Fixed & Improved
- **Terminal & Editor Font Rendering**:
  - Fixed production font rendering discrepancies by bundling and pinning `@fontsource/jetbrains-mono` and `@fontsource/inter` across all environments.
- **Diff Layout Consistency**:
  - Cleaned up diff header toolbar layout to maximize vertical and horizontal viewing space for code reviews.

---

## [0.1.0] - 2026-08-30

### Initial Release
- **Git Desktop Core**:
  - High-performance local Git desktop client powered by Rust (`src-tauri`) and React 19 + TypeScript frontend.
  - Unified and Split Side-by-Side Diff views with TanStack Virtual virtualization for massive commits (30k+ lines).
  - Visual Branching, Interactive Staging, Graph View, and Stash Manager.
  - Built-in mini code editor with syntax highlighting and instant file saving.
  - Dark IDE aesthetic tailored with curated CSS variables and responsive glassmorphism.
