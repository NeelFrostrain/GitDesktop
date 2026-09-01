# Changelog

All notable changes to **Git Desktop** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.2] - 2026-09-01

### Added & Enhanced
- **Git Submodules Full Lifecycle Management**:
  - **Submodules Dashboard (`SubmodulesView`)**: Built a complete Git submodules management view with live search filtering, status tabs (`All`, `Active`, `Modified`, `Uninitialized`), and bulk actions (`Init All`, `Sync Remotes`, `Update Recursive`).
  - **Submodule Card Actions**: Each submodule card provides 1-click actions: **Open in Git Desktop** (switches active repository to the submodule), **Update** (syncs to pinned revision), **Pull Latest** (pulls upstream remote branch), **Copy Path/SHA**, and **Remove Submodule** (clean de-initialization and directory removal with confirmation).
  - **Add Submodule Modal (`AddSubmoduleModal`)**: Interactive dialog for cloning and registering new submodules into `.gitmodules` with auto-suggested destination paths and optional branch tracking.
  - **Header & Quick Navigation**: Added dedicated Submodules icon (📦) in the top toolbar, 3-dot dropdown menu, and Command Palette (`Ctrl+K` / `Ctrl+P`).
- **Rich Submodule Diff Inspector (`SubmoduleDiffView`)**:
  - Added dedicated submodule comparison diff view matching GitHub Desktop UX, displaying remote repository URL with external browser link, old $\rightarrow$ new commit SHA badges with copy buttons, and 1-click **Open repository** action.
- **Commit-AI Submodule Delta Detection**:
  - Enhanced AI commit message generation (`ai_commit.rs`) to detect submodule pointer movements, automatically creating descriptive submodule commit messages (e.g. `chore(submodule): update GitDesktop to 2c8b116`).
- **AI Model Resilience & Fallbacks**:
  - Expanded candidate models across Gemini Agent, Commit-AI, and Release-AI to `gemini-2.5-flash-lite`, `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.0-flash-lite`, and `gemini-1.5-flash` with automatic fallback recovery.

### Fixed & Improved
- **Production OAuth Authentication Flow**:
  - Fixed `[VALIDATION_ERROR] Invalid, expired, or mismatched OAuth state` caused by race conditions between local TCP loopback listeners and deep-link protocol handlers by adding a `RECENTLY_USED` session cache and resilient provider fallbacks in `oauth_pkce.rs`.
  - Added built-in fallback client credentials for GitHub, GitLab, and Bitbucket for zero-config production installations.
  - Injected build environment variables into production binaries via `scripts/build-app.ts`.
  - Added `https:` into Tauri CSP `connect-src` to allow secure cloud authentication.
- **Large Push & Git LFS Timeout Stability**:
  - Extended Git push timeout from 30s to 5 minutes (`300000ms`) and pull timeout to 3 minutes in `useRepositorySync.ts` to prevent premature timeout errors during large changeset pushes (300+ files) and large LFS binary uploads.
- **UI Uniformity & Alignment**:
  - Unified all toolbar and control bar button heights (`h-8`), padding, and font sizes across Submodules, Releases, and LFS dashboards.

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
