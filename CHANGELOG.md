# Changelog

All notable changes to this project are documented in this file.

## 2.0.0 - 2026-04-07

- Rebuilt the app architecture around a secure Electron boundary with `preload.js` and `contextIsolation`
- Replaced the old renderer logic with a standalone merge engine and test coverage
- Added N-way conflict grouping with sequential modal review
- Added duplicate detection with keep/remove review before export
- Preserved comments and blank lines around parsed settings in merged output
- Reworked the UI into a VS Code-inspired dark layout with better space usage and responsive sizing
- Added portable Windows packaging and refreshed project documentation
