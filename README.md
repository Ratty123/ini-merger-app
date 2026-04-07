# INI Merger

INI Merger is a desktop Electron utility for combining Unreal-style INI files into a single output while keeping file precedence explicit. It includes grouped conflict review, duplicate review, preserved comments around settings, and a live merged preview in a VS Code-like dark UI.

## Highlights

- Secure Electron setup with `contextIsolation`, a preload bridge, and blocked external navigation
- Drag-to-reorder file stack so precedence is visible and editable
- N-way scalar conflict review with sequential modal walkthrough
- Duplicate detection with keep/remove decisions before export
- Comment and blank-line preservation around parsed settings
- Live merged preview that updates as review choices change
- Portable Windows build output through `electron-builder`

## Workflow

1. Add one or more INI files.
2. Reorder files so lower files override higher ones.
3. Click `Build Merge`.
4. Review conflicts if multiple scalar values exist.
5. Review duplicates if matching entries were collapsed.
6. Save the merged output.

## Project Structure

- `main.js`: Electron window lifecycle, IPC handlers, navigation guards
- `preload.js`: minimal renderer API bridge
- `index.html`: app shell and modal structure
- `styles.css`: VS Code-inspired dark theme and responsive layout
- `src/core/merge-engine.js`: parser, merge model, serialization, conflict and duplicate selection
- `src/renderer/app.js`: renderer state, UI rendering, modal flows
- `test/merge-engine.test.js`: merge engine coverage
- `build/icon.png`: source icon for Windows packaging
- `CHANGELOG.md`: release history

## Development

### Prerequisites

- Node.js 18 or newer
- npm

### Install

```bash
npm install
```

### Run

```bash
npm start
```

### Test

```bash
npm test
```

### Build Portable EXE

```bash
npm run dist
```

The portable executable is written to `dist/INIMerger.exe`.

## Notes

- The renderer only gets file open/save capabilities through `preload.js`.
- External web navigation and new windows are blocked by the main process.
- Repeatable Unreal-style entries are handled separately from scalar conflicts.

## License

This project is licensed under the MIT License. See `LICENSE`.
