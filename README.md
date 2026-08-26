# GitDesktop

> A high-performance, developer-first native Git GUI client and Commit-AI suite built with Tauri v2, Rust, React 19, and TypeScript.

<!-- Metadata Row -->

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](#)
[![Status](https://img.shields.io/badge/status-ready-brightgreen)](#)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Private-darkred.svg)](#)
[![Platform](https://img.shields.io/badge/platform-win%20%7C%20mac%20%7C%20linux-777777)](#-distribution)
[![CI](https://img.shields.io/badge/CI-passing-2ea44f?logo=github-actions&logoColor=white)](#)

<!-- Tech Stack Row -->

[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.80%2B-DEA584?logo=rust&logoColor=black)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-v5-4338CA)](https://github.com/pmndrs/zustand)

---

## What It Does

**GitDesktop** is a lightning-fast, modern Git client engineered for speed, clean aesthetics, and complex developer workflows. Powered by a high-throughput **Rust backend** (`libgit2` + native Git subsystem) and a reactive **React 19 / Vite** UI, it eliminates Git bloat, manages multiple accounts, visualizes commit history graphs, performs interactive rebasing, tracks linked worktrees, and supercharges your commit workflow with **Commit-AI** (powered by Google Gemini Flash Lite models).

Supports **Windows**, **macOS**, and **Linux** with native OS keyring credential security, hardware-accelerated terminals, and zero-latency file watching.

**Tech Stack:** TypeScript · React 19 · Tauri v2 · Rust · Vite 6 · Tailwind CSS 4 · Zustand · Monaco Editor · xterm.js

---

## Core Features

### Commit-AI Engine (Google Gemini Flash Lite)

- **Context-Aware Code Diff Analysis** — Reads staged and unstaged working tree diffs (and recent commits) to generate conventional, precise commit messages.
- **3 Curated Title Perspectives** — Delivers 3 distinct commit summaries with conventional commit types (`feat`, `fix`, `refactor`, `chore`, `perf`).
- **Multi-Format Technical Reports** — Choose between **Full Technical Report**, **Concise Bullet Points**, or **Title-Only** directly in the commit prompt.
- **Multi-Key API Rotation Pool** — Configure multiple Google Gemini API keys with automated failover on rate limits (HTTP 429) or token expiration.
- **Model Fallback Engine** — Defaults to high-throughput models (`gemini-2.5-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.0-flash-lite`, `gemini-2.0-flash`) with automatic fallback to prevent workflow disruption.
- **One-Click Apply** — Seamless in-sidebar commit flow with direct title selection and instant form population.

### Repository & Workspace Management

- **Multi-Repository Workspace** — Fast repository switcher with recent projects, favorite pins, and folder discovery.
- **Linked Git Worktrees** — Create, list, switch, and remove separate linked worktrees without branch checkout friction.
- **Git Submodules** — Inspect, sync, and update nested Git submodules across repositories.
- **Git LFS (Large File Storage)** — Track patterns, view tracked LFS files, lock/unlock assets, and monitor lock ownership.
- **Clean Tree Guards** — Enforces non-empty commit validation and prevents accidental blank commits.

### History, Rebase & Mutations

- **Visual Graph & Commit History** — Line-by-line graph traversal with author avatar attribution, parent commit mapping, and tag annotations.
- **Interactive Rebase** — Visual rebase plan builder supporting `pick`, `reword`, `edit`, `squash`, `fixup`, `drop`, and commit reordering.
- **Rebase State Machine** — Dedicated controls for rebase continuation, skipping conflicts, and aborting.
- **History Rewriting** — Direct amend, commit message modification, and multi-commit squashing.
- **Cherry-Pick Engine** — Cherry-pick single or multiple commits across branches with conflict handling.
- **Interactive Reflog** — Time-travel through reference logs with instant checkout and reset targets.

### Diff, Blame & Conflict Resolution

- **Monaco-Powered Diff Viewer** — High-performance side-by-side and unified diff views with syntax highlighting.
- **Line-by-Line Blame** — Author, commit SHA, timestamp, and commit summary annotations per line.
- **Visual Conflict Resolver** — 3-way conflict viewer (ours vs. theirs vs. merged result) with 1-click accept actions.
- **Patch Management** — Export commit patches to disk or apply external `.patch` / `.diff` files.

### Stash & Branching

- **Visual Stash Manager** — List stashes, preview staged differences within each stash, and perform `apply`, `pop`, or `drop`.
- **Branch Management** — Create, checkout, rename, delete, and publish local and remote tracking branches.
- **Remote Synchronization** — Real-time Ahead/Behind commit counter with smart `Push`, `Pull`, `Sync`, and `Publish` actions.
- **Intelligent Push Error Parsing** — Formats upstream push rejections, protected branch rules, and secret protection warnings into clear, actionable notifications.

### Security & Multi-Account

- **OS Keyring Integration** — Securely encrypts and stores GitLab and GitHub Personal Access Tokens in Windows Credential Manager, macOS Keychain, or Linux Secret Service.
- **GitLab & GitHub Account Switcher** — Connect multiple GitLab (self-hosted & SaaS) and GitHub accounts with avatar synchronization.
- **Commit Verification & Signing** — Built-in GPG and SSH commit signing configuration and verification badges.
- **Author Identity Management** — Configure global or repo-local Git `user.name` and `user.email`.

### Terminal & Diagnostics

- **Integrated PTY Shell** — Built-in xterm.js terminal emulator with shell auto-detection (PowerShell, bash, zsh).
- **Real-Time Live Application Log** — Streaming log viewer with chronologically sorted event streams, log level filters, and export capabilities.
- **Hardware GPU Acceleration** — WebGL-accelerated terminal canvas rendering.

### Appearance & Theming

- **Dark & Custom Themes** — Precision dark mode with curated token palettes and high-contrast styling.
- **Full CSS Design Tokens** — In-app settings manager for adjusting UI scale, font families, and accent colors.
- **Compact UI Density** — Optimized sidebar and header dimensions designed for maximum code viewing area.

---

## Feature Summary

| Category                     | Features |
| :--------------------------- | :------: |
| **Commit-AI Engine**         |    6     |
| **Repository & Workspaces**  |    8     |
| **History & Rebase**         |    8     |
| **Diff, Blame & Conflicts**  |    6     |
| **Stash & Branching**        |    6     |
| **Security & Authentication**|    5     |
| **Terminal & Live Logs**     |    4     |
| **Theming & Design Tokens**  |    5     |
| **Total Features**           |  **48**  |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                      │
│  React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Zustand  │
│  Monaco Diff Editor · xterm.js Terminal · Context Menus    │
│  Features: Commit-AI · History Graph · Rebase · Settings    │
└────────────────────────┬────────────────────────────────────┘
                         │  Tauri 2 IPC (invoke / emit)
┌────────────────────────▼────────────────────────────────────┐
│                  Tauri Core Backend (Rust)                  │
│  src-tauri/src/                                             │
│  ├── commands/         ← Tauri IPC command bindings         │
│  ├── auth/             ← OS Keyring & Credential storage    │
│  └── git/              ← Domain-driven Git backend modules  │
│      ├── ai/           ← Commit-AI Groq prompt & HTTP engine│
│      ├── commit/       ← Commit creation, staging & signing │
│      ├── history/      ← Graph, blame, reflog, rebase       │
│      ├── workspace/    ← Status, diff, stash, patch         │
│      ├── remote/       ← Fetch, pull, push, LFS, tags       │
│      └── config/       ← Git config reader & writer         │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────────────────┐
│  libgit2 Subsystem  │   │  Native Git CLI Process Manager │
│  Fast repository,   │   │  Complex network remotes, SSH   │
│  trees & diffs      │   │  signing, LFS & interactive CLI │
└─────────────────────┘   └─────────────────────────────────┘
```

### Module Organization

The Rust backend is structured into modular domain subsystems:

```
src-tauri/src/git/
├── ai/
│   ├── ai_commit.rs           ← Groq API completion, token budgeting & auto-fallback
│   └── mod.rs
├── commit/
│   ├── commit.rs              ← Commit staging, tree validation & parent linking
│   ├── signing.rs             ← GPG & SSH commit signing
│   └── mod.rs
├── history/
│   ├── history.rs             ← Commit graph traversal & log parsing
│   ├── blame.rs               ← Line-by-line blame extraction
│   ├── reflog.rs              ← Reflog inspection & navigation
│   ├── rebase.rs              ← Interactive rebase engine
│   ├── cherry_pick.rs         ← Cherry-pick execution
│   ├── history_rewrite.rs     ← Squash, edit, reword, drop mutations
│   └── mod.rs
├── workspace/
│   ├── status.rs              ← Working tree status & untracked file discovery
│   ├── diff.rs                ← Diff generation (staged, unstaged, commit)
│   ├── stash.rs               ← Stash list, diff, pop, apply, drop
│   ├── patch.rs               ← Patch export & application
│   ├── worktree.rs            ← Linked worktree management
│   └── mod.rs
├── remote/
│   ├── remote.rs              ← Remote URL handling, push, pull, fetch, auth args
│   ├── tags.rs                ← Tag list, create, delete, push
│   ├── submodules.rs          ← Submodule sync & status
│   ├── lfs.rs                 ← Git LFS lock and file management
│   └── mod.rs
├── config/
│   ├── config.rs              ← Local & global git config get/set
│   └── mod.rs
└── mod.rs                     ← Clean submodule exports
```

---

## Tech Stack

### Frontend

| Library | Version | Purpose |
| :--- | :--- | :--- |
| **React** | 19.0 | Component rendering & reactive UI |
| **TypeScript** | 5.8 | Full type safety |
| **Vite** | 6.1 | Rapid bundler & HMR |
| **Tailwind CSS** | 4.3 | High-performance CSS utility engine |
| **Zustand** | 5.0 | Global state management stores |
| **Monaco Editor** | 4.7 | Code diff & editor viewer |
| **xterm.js** | 6.0 | Hardware-accelerated terminal emulator |
| **Lucide React** | 0.475 | Clean icon set |
| **TanStack Query** | 5.66 | Async query caching |

### Backend (Rust / Tauri)

| Crate | Purpose |
| :--- | :--- |
| **tauri (v2)** | Lightweight native desktop shell & IPC |
| **git2** | Native `libgit2` bindings for high-speed local git operations |
| **keyring** | Native OS secure credential storage (Windows / macOS / Linux) |
| **reqwest** | Async HTTP client for Groq AI API & cloud services |
| **tokio** | Async runtime for non-blocking I/O and worker tasks |
| **serde / serde_json** | High-speed data serialization |
| **portable-pty** | Cross-platform pseudo-terminal manager for embedded shell |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+) or [Bun](https://bun.sh/)
- [Rust toolchain](https://rustup.rs/) (1.80+)
- Platform build dependencies:
  - **Windows**: Visual Studio C++ Build Tools & WebView2 runtime
  - **macOS**: Xcode Command Line Tools
  - **Linux (Ubuntu/Debian)**:
    ```bash
    sudo apt-get update && sudo apt-get install -y \
      libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
    ```

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   # or
   bun install
   ```

2. **Start Tauri dev environment**:
   ```bash
   npm run tauri dev
   # or
   bun run tauri dev
   ```

3. **Run frontend typechecking**:
   ```bash
   npm run typecheck
   # or
   bun run typecheck
   ```

4. **Verify Rust backend**:
   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

---

## Production Build

### Compile Desktop Binary

```bash
# Build production bundle for your current platform
npm run tauri build
```

The compiled binaries and installers will be output to `src-tauri/target/release/bundle/`.

---

## Distribution

| Platform | Package Format | Architecture | Status |
| :--- | :--- | :--- | :--- |
| **Windows** | NSIS Installer (`.exe`), `.msi` | x64 | **Stable** |
| **macOS** | Disk Image (`.dmg`), App Bundle (`.app`) | Universal (Apple Silicon & Intel) | **Stable** |
| **Linux** | AppImage (`.AppImage`), Debian Package (`.deb`) | x64 | **Stable** |

Automated multi-platform builds are packaged via GitHub Actions workflows in `.github/workflows/`.

---

## License

Copyright (c) 2026 Neel Frostrain. All rights reserved.
Private repository & proprietary software.
