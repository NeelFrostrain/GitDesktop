# GitDesktop

> A high-performance, developer-first native Git GUI client and Commit-AI suite built with Tauri v2, Rust, React 19, TypeScript, and Tailwind CSS v4.

<!-- Metadata Row -->

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](#)
[![Status](https://img.shields.io/badge/status-in%20development-yellow)](#)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Private-darkred.svg)](#)
[![Platform](https://img.shields.io/badge/platform-win%20%7C%20mac%20%7C%20linux-777777)](#-distribution)
[![Node](https://img.shields.io/badge/node-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Rust](https://img.shields.io/badge/rust-1.80%2B-orange?logo=rust)](https://www.rust-lang.org/)

<!-- Tech Stack Row -->

[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-v5-4338CA)](https://github.com/pmndrs/zustand)
[![ESLint](https://img.shields.io/badge/ESLint-9-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-3.7-F7B93E?logo=prettier&logoColor=black)](https://prettier.io/)

---

## What It Does

**GitDesktop** is a lightning-fast, modern Git client engineered for speed, clean aesthetics, and complex developer workflows. Powered by a high-throughput **Rust backend** (`libgit2` + native Git subsystem) and a reactive **React 19 / Vite** UI, it eliminates Git bloat, manages multiple accounts, visualizes commit history graphs, performs interactive rebasing, tracks linked worktrees, and supercharges your commit workflow with **Commit-AI** (powered by Google Gemini Flash Lite models).

Supports **Windows**, **macOS**, and **Linux** with native OS keyring credential security, hardware-accelerated terminals, portable Git (MinGit) auto-provisioning, and zero-latency file watching.

**Tech Stack:** TypeScript · React 19 · Tauri v2 · Rust · Vite 6 · Tailwind CSS 4 · Zustand · Monaco Editor · xterm.js

---

## Core Features

### Commit-AI & Embedded AI Agent (Google Gemini)

- **Context-Aware Code Diff Analysis** — Reads staged and unstaged working tree diffs (and recent commits) to generate conventional, precise commit messages.
- **3 Curated Title Perspectives** — Delivers 3 distinct commit summaries with conventional commit types (`feat`, `fix`, `refactor`, `chore`, `perf`).
- **Multi-Format Technical Reports** — Choose between **Full Technical Report**, **Concise Bullet Points**, or **Title-Only** directly in the commit prompt.
- **TOON Token-Compression** — Encodes repository contexts, status tables, and file diffs in Token-Oriented Object Notation (TOON) for ultra-efficient token usage.
- **Multi-Key API Rotation Pool** — Configure multiple Google Gemini API keys with automated failover on rate limits (HTTP 429) or token expiration.
- **Model Fallback Engine** — Defaults to high-throughput models (`gemini-2.5-flash-lite`, `gemini-3.5-flash-lite`, `gemini-2.0-flash`) with automatic fallback to prevent workflow disruption.
- **Embedded AI Coding Assistant** — Chat panel capable of answering questions, running 1-click terminal commands (`\`\`\`bash`), generating files (`[FILE_WRITE]`), deleting files (`[FILE_DELETE]`), and assisting with conflict resolution.
- **AI Release Notes Generator** — Generates rich, categorized Markdown release changelogs from repository tag diffs and commit histories.

### Repository & Workspace Management

- **Multi-Repository Workspace** — Fast repository switcher with recent projects, favorite pins, folder discovery, and repository relocation.
- **Portable Git (MinGit) Auto-Provisioning** — Detects system Git runtime automatically; silently downloads and configures portable MinGit in the background if Git is missing.
- **Linked Git Worktrees** — Create, list, switch, and remove separate linked worktrees without branch checkout friction.
- **Git Submodules** — Inspect, sync, initialize, and update nested Git submodules across repositories.
- **Git LFS (Large File Storage)** — Track patterns, view tracked LFS files, lock/unlock assets, and monitor lock ownership.
- **Clean Tree Guards** — Enforces non-empty commit validation and prevents accidental blank commits.
- **Background Task Manager** — Asynchronous task runner with live download speed, byte progress metrics, and ETA calculator (`formatEta`) for long-running operations (clone, fetch, pull).

### Merge Requests & Pull Requests Workspace

- **Unified Code Review Hub** — Manage both **GitLab Merge Requests** and **GitHub Pull Requests** directly within the application.
- **Discussion Threads & Inline Annotations** — View discussions, add top-level comments, reply to file-specific code lines, and toggle approvals.
- **Diff & Commits Explorer** — Inspect commit lists and changed files with unified/split diffs before merging.
- **Configurable Merge Strategies** — Support for *Merge Commit*, *Squash and Merge*, and *Rebase and Merge* with branch deletion options.

### History, Rebase & Mutations

- **Visual Graph & Commit History** — Interactive topological commit graph traversal with bezier lane layout, author avatars, parent commit mapping, and tag annotations.
- **Interactive Rebase** — Visual rebase plan builder supporting `pick`, `reword`, `edit`, `squash`, `fixup`, `drop`, and drag-and-drop commit reordering.
- **Rebase State Machine** — Dedicated controls for rebase continuation, skipping conflicts, and aborting.
- **History Rewriting** — Direct amend, commit message modification, undo last commit, and multi-commit squashing.
- **Cherry-Pick Engine** — Cherry-pick single or multiple commits across branches with conflict handling.
- **Interactive Reflog** — Time-travel through reference logs with instant checkout and reset targets.

### Diff, Blame & Conflict Resolution

- **Monaco-Powered Diff Viewer** — High-performance side-by-side and unified diff views with syntax highlighting across 50+ languages.
- **Visual Image Diffing** — 2-up side-by-side, swipe slider, and onion-skin opacity modes for image asset changes.
- **Line-by-Line Blame** — Author, commit SHA, timestamp, and commit summary annotations per line with commit popovers.
- **Visual Conflict Resolver** — 3-way conflict viewer (ours vs. theirs vs. merged result) with 1-click accept actions.
- **Patch Management** — Export commit patches to disk or apply external `.patch` / `.diff` files.

### Stash & Branching

- **Visual Stash Manager** — List stashes, preview staged differences within each stash, and perform `apply`, `pop`, or `drop`.
- **Branch Management** — Create, checkout, rename, delete, and publish local and remote tracking branches.
- **Remote Synchronization** — Real-time Ahead/Behind commit counter with smart `Push`, `Pull`, `Sync`, and `Publish` actions.
- **Intelligent Push Error Parsing** — Formats upstream push rejections, protected branch rules, and secret protection warnings into clear, actionable notifications.

### Security & Multi-Account

- **OS Keyring Integration** — Securely encrypts and stores GitLab and GitHub Personal Access Tokens and OAuth credentials in Windows Credential Manager, macOS Keychain, or Linux Secret Service.
- **GitLab & GitHub Account Switcher** — Connect multiple GitLab (self-hosted & SaaS) and GitHub accounts with avatar synchronization.
- **Commit Verification & Signing** — Built-in GPG and SSH commit signing configuration, key discovery, and verification badges.
- **Author Identity Management** — Configure global or repo-local Git `user.name` and `user.email`.

### Terminal & Diagnostics

- **Integrated PTY Shell** — Built-in xterm.js terminal emulator with shell auto-detection (PowerShell, bash, zsh).
- **Smart Autocomplete** — Context-aware Git command and branch autocompletion suggestions.
- **Session History & Export** — Terminal command history tracking and exportable session logs.
- **Real-Time Live Application Log** — Streaming log viewer with chronologically sorted event streams, log level filters (Debug, Info, Warn, Error), and export capabilities.
- **Hardware GPU Acceleration** — WebGL-accelerated terminal canvas rendering.

### Contribution Analytics & Theming

- **Contribution Heatmap & Radar** — Year-long GitHub/GitLab-style contribution heatmaps and commit activity radar charts.
- **Curated Theme Presets** — *Commito Dark* (default obsidian), *GitLab Dark*, *GitHub Dark Dimmed*, *Synthwave*, *Monokai Pro*, and *Nord Dark*.
- **Full CSS Design Tokens** — In-app settings manager for adjusting UI scale, font families, and accent colors.
- **Compact UI Density** — Optimized sidebar and header dimensions designed for maximum code viewing area.

---

## Feature Summary

| Category                      | Features |
| :---------------------------- | :------: |
| **Commit-AI & Agent**         |    8     |
| **Repository & Workspaces**   |    8     |
| **Merge Requests & PRs**      |    6     |
| **History & Rebase**          |    8     |
| **Diff, Blame & Conflicts**   |    6     |
| **Stash & Branching**         |    6     |
| **Security & Authentication** |    5     |
| **Terminal & Live Logs**      |    5     |
| **Analytics & Theming**       |    6     |
| **Total Features**            |  **58**  |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                      │
│  React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Zustand  │
│  Monaco Diff Editor · xterm.js Terminal · Context Menus     │
│  Features: Commit-AI · MR Hub · Git Graph · Rebase · Stats  │
└────────────────────────┬────────────────────────────────────┘
                         │  Tauri 2 IPC (invoke / emit)
┌────────────────────────▼────────────────────────────────────┐
│                  Tauri Core Backend (Rust)                  │
│  src-tauri/src/                                             │
│  ├── commands/         ← Tauri IPC command bindings         │
│  ├── auth/             ← OS Keyring & Credential storage    │
│  ├── domain/           ← Accounts, PTY, Git Runtime, Store  │
│  ├── activity/         ← Contribution heatmap calculations  │
│  ├── integrations/     ← GitLab & GitHub API adapters       │
│  └── git/              ← Domain-driven Git backend modules  │
│      ├── ai/           ← Gemini Flash Lite & Release Notes  │
│      ├── commit/       ← Commit staging & GPG/SSH signing   │
│      ├── history/      ← Graph, blame, reflog, rebase       │
│      ├── workspace/    ← Status, diff, stash, worktrees     │
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
src-tauri/src/
├── activity/                  ← Contribution heatmap & activity calculation
├── auth/                      ← OS Keyring, GitHub & GitLab OAuth/PAT security
├── commands/                  ← Tauri IPC command handlers (40+ endpoints)
├── core/                      ← Shared logging bus, ring buffer & config
├── domain/                    ← Accounts, Git runtime (MinGit), Settings, PTY
│   ├── accounts/              ← Multi-account management & token persistence
│   ├── git_runtime/           ← MinGit detection, download & extraction
│   ├── settings/              ← Application preferences storage
│   └── terminal/              ← PTY process manager, history & autocomplete
├── git/                       ← Core Git engine modules
│   ├── ai/                    ← Gemini Flash Lite commit & release note prompts
│   ├── commit/                ← Commit staging, parent links, GPG/SSH signing
│   ├── config/                ← Local and global git config operations
│   ├── history/               ← Commit graph, blame, rebase, reflog, cherry-pick
│   ├── remote/                ← Push/pull, remotes, tags, releases, submodules, LFS
│   └── workspace/             ← Status, diff, stashes, patches, worktrees
├── integrations/              ← Cloud hosting providers (GitLab, GitHub, Bitbucket)
├── repos/                     ← Local repository registry, metadata & discovery
├── error.rs                   ← Application error definitions & codes
└── lib.rs                     ← Tauri builder, command registration & plugins
```

---

## Tech Stack

### Frontend

| Library | Version | Purpose |
| :--- | :--- | :--- |
| **React** | 19.0 | Component rendering & reactive UI with concurrent features |
| **TypeScript** | 5.8 | End-to-end type safety |
| **Vite** | 6.1 | Rapid bundler & Hot Module Replacement (HMR) |
| **Tailwind CSS** | 4.3 | High-performance CSS utility engine linked to design tokens |
| **Zustand** | 5.0 | Domain-segregated global state management stores |
| **Monaco Editor** | 4.7 | Split and unified code diff viewer with syntax highlighting |
| **xterm.js** | 6.0 | Hardware WebGL-accelerated terminal emulator |
| **Lucide React** | 0.475 | Clean, consistent iconography |
| **TanStack Query** | 5.66 | Asynchronous query caching and data synchronization |
| **TanStack Virtual** | 3.14 | Virtualized rendering of large file trees and commit logs |

### Backend (Rust / Tauri)

| Crate | Purpose |
| :--- | :--- |
| **tauri (v2)** | Lightweight native desktop shell, IPC bridge, and window management |
| **git2** | Native `libgit2` bindings for high-speed local git operations |
| **keyring** | Native OS secure credential storage (Windows / macOS / Linux) |
| **reqwest** | Async HTTP client for Gemini AI, GitLab, and GitHub REST/GraphQL APIs |
| **tokio** | Multi-threaded async runtime for non-blocking I/O and process execution |
| **serde / serde_json** | High-speed data serialization across IPC boundaries |
| **portable-pty** | Cross-platform pseudo-terminal manager for embedded shell |
| **zip** | Decompression engine for portable MinGit runtime setup |

---

## Getting Started

### Prerequisites

- **Node.js** (v20+) or **Bun** (v1.3+)
- **Rust toolchain** (1.80+) — [Install here](https://rustup.rs/)
- **Git** (v2.40+) *(Optional on Windows — GitDesktop will auto-download portable MinGit if missing)*
- Platform-specific dependencies:
  - **Windows**: Visual Studio C++ Build Tools & WebView2 runtime
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux (Ubuntu/Debian)**:
    ```bash
    sudo apt-get update && sudo apt-get install -y \
      libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev \
      libayatana-appindicator3-dev librsvg2-dev
    ```

### Installation & Setup

1. **Clone and install dependencies**:

   ```bash
   git clone <repo-url>
   cd gitlab-desktop

   # Using Bun (recommended)
   bun install

   # OR using npm
   npm install
   ```

2. **Start development server**:

   ```bash
   # Frontend + Tauri dev environment (hot reload)
   bun run dev:app

   # OR individual commands:
   bun run dev          # Vite dev server only (port 1420)
   bun run tauri dev    # Tauri desktop app with Rust backend
   ```

3. **Type checking & validation**:

   ```bash
   bun run typecheck    # TypeScript checking
   bun run lint         # ESLint v9 with React & TypeScript rules
   bun run format       # Prettier code formatting
   bun run test         # Vitest unit tests
   ```

4. **Verify Rust backend**:

   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

---

## Development Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `vite` | Start Vite dev server (React frontend only) |
| `dev:app` | `tauri dev` | Launch Tauri desktop app with hot reload |
| `build` | `tsc && vite build` | Production build (frontend bundle) |
| `build:app` | `tauri build` | Build desktop binary & installer |
| `typecheck` | `tsc --noEmit` | Check TypeScript without emitting |
| `test` | `vitest run` | Run all unit tests once |
| `lint` | `eslint --cache .` | Lint TypeScript & React files |
| `format` | `prettier --write .` | Format code with Prettier |
| `preview` | `vite preview` | Preview production build locally |

---

## Code Quality & Standards

### ESLint Configuration

The project uses **ESLint v9** with TypeScript, React, and React Hooks support.

- **Config file**: `eslint.config.js` (new flat config format)
- **Target files**: `src/**/*.{js,jsx,ts,tsx}`
- **Rules**: Recommended + React best practices + TypeScript strict mode
- **Run**: `bun run lint` or `bun run lint --fix`

**Key rules:**
- ✅ Disables `react/react-in-jsx-scope` (React 17+ doesn't require it)
- ✅ Warns on unused props (allow `_` prefix for intentional omissions)
- ✅ Enforces React Hooks rules
- ✅ Allows browser globals, Node.js globals, and React types
- ✅ Caches results for faster subsequent runs (`.eslintcache`)

### Prettier Configuration

Code formatting with **Prettier v3.7**.

- **Config file**: `.prettierrc.yaml`
- **Ignore file**: `.prettierignore`
- **Options**: 2-space indentation, single quotes, semicolons enabled, LF line endings, 100 character line width.
- **Run**: `bun run format`

---

## Production Build & Distribution

### Compile Desktop Binary

```bash
# Build production bundle for your current platform
bun run build:app
```

The compiled binaries and installers will be output to `src-tauri/target/release/bundle/`.

### Distribution Matrix

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
