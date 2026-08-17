---
title: Dev Environment
type: reference
tags: [movie-roulette, setup]
---

# Dev Environment

What's needed to work on each track, and what's actually on the machine. Checked
**2026-08-17**.

## The short version

**The web app needs nothing installed.** No build step, no dependencies, no local
server — edit the files, `git push`, GitHub Pages rebuilds in about a minute. That
simplicity is a feature; see [[Architecture]].

**The mobile app needs a real toolchain**, and the long pole is Xcode, not code.

## Machine state

| | Status | Needed for |
| --- | --- | --- |
| Node v26.4.0 / npm 11 | ✅ | both |
| git + `gh` CLI (authenticated) | ✅ | both |
| VS Code | ✅ installed | mobile |
| `code` shell command | ❌ not on PATH | convenience |
| Xcode command line tools | ✅ | mobile |
| **Xcode.app** | ❌ **not installed** | **iOS Simulator** |
| **Android Studio** | ❌ not installed | Android emulator |
| watchman | ❌ not installed | Expo / Metro |
| EAS CLI | ❌ not installed | mobile builds |

## Before starting M3

Ordered by how long they take, not importance:

1. **Xcode.app** — 10+ GB from the App Store, needs your password. The command
   line tools already present are *not* enough for a simulator. Start this
   download before you need it; discovering it on the evening you want to test is
   the classic own-goal.
2. **Android Studio** — smaller, same idea. Install at least one emulator image.
3. `brew install watchman` — Metro complains without it.
4. `npm i -g eas-cli && eas login` — builds and store submissions.
5. VS Code: install the **Claude Code extension**, and `⌘⇧P → Shell Command:
   Install 'code' command in PATH`.

### Node version caveat

The machine is on **Node 26**, which is ahead of the LTS line Expo and Metro
target. Nothing is known to be broken — but if Expo behaves strangely at M3, pin
an LTS with `nvm` *before* debugging anything else. It's the cheapest thing to
rule out.

## Editor choice

Not either/or: Claude Code runs as a **VS Code extension** and as a CLI, so
switching windows doesn't mean switching tools.

- **Web track:** the current setup is fine. A handful of dependency-free files,
  and the working loop is "spot a bug on your phone → fix → push → refresh". An
  editor doesn't improve that.
- **Mobile track:** use VS Code. React Native without a TypeScript language server
  means finding wrong props at runtime on a phone instead of as you type. Add
  ESLint, Prettier, and the Expo tooling.

## Simulator control

Once Xcode.app exists, the iOS Simulator can be driven directly from Claude Code —
build, launch, tap, swipe, screenshot. That means mobile changes get verified the
same way web changes are today, instead of "please check this on your phone".

This is a concrete reason to install Xcode **before** M3 rather than during it.

Related: [[ROADMAP]] · [[Release Process]] · [[ADR 0001 Mobile Stack]]
