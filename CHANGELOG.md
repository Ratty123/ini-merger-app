# Changelog

All notable changes to this project are documented in this file.

## 2.4.0 - 2026-04-08

- Added bulk duplicate actions for removing or preserving all duplicate groups at once
- Added automated structure actions for safe cleanup and one-click ConsoleVariables categorization
- Added a ConsoleVariables organizer that groups large flat cvar sections into readable category blocks
- Expanded section recommendation hints for common Unreal subsystems such as renderer, streaming, D3D12, Niagara, audio, input, and logging
- Changed portable build artifacts to versioned filenames to avoid stale Windows icon cache on repeated rebuilds
- Added test coverage for console-variable categorization

## 2.3.0 - 2026-04-08

- Added structural validation with a first-pass generic Unreal Engine section schema
- Added structural cleanup modes for warning-only review or safe removal of loose non-INI lines
- Added a structure review modal with line-level warnings and section placement hints
- Extended minimal cleanup to remove prose, divider rows, and other loose lines that are not valid INI assignments

## 2.2.0 - 2026-04-08

- Added cleanup modes for preserving comments, removing standalone comment blocks, or generating minimal output
- Added editor-style preview controls for line numbers, font size, and line spacing
- Added syntax-colored preview rendering with a denser VS Code-like editor layout
- Added autosave and session restore through `inimerger.cfg` beside the executable
- Added path-based profile persistence so saved sessions travel with the portable build
- Replaced the application icon with a more minimal Windows-ready icon set

## 2.1.0 - 2026-04-08

- Added search and filtering across conflicts, sections, and preview content
- Added section include/exclude filtering to build section-only merges
- Added merge rule presets for highest-priority, base-first, and preserve-all duplicate defaults
- Added local saved session profiles for reloading file stacks and review choices
- Added a diff preview mode against the preset-driven default merge
- Added bulk conflict actions, including preset resets and section-wide source application
- Expanded merge-engine coverage for section filters and preset-driven defaults

## 2.0.0 - 2026-04-07

- Rebuilt the app architecture around a secure Electron boundary with `preload.js` and `contextIsolation`
- Replaced the old renderer logic with a standalone merge engine and test coverage
- Added N-way conflict grouping with sequential modal review
- Added duplicate detection with keep/remove review before export
- Preserved comments and blank lines around parsed settings in merged output
- Reworked the UI into a VS Code-inspired dark layout with better space usage and responsive sizing
- Added portable Windows packaging and refreshed project documentation
