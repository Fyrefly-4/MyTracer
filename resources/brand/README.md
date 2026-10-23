# Approved MyTracer brand assets

Selected design: **6 Original** (not 6A or 6B). Green: #214C3D; milk: #F5F1E7.

MyTracer-app-icon.svg is byte-identical to the approved MyTracer-06-C2-icon.svg master. MyTracer-mark-green.svg preserves that geometry, removes the square background, and uses green for transparent renderer use.

The 256px RGBA PNG is an Inkscape export of the app-icon SVG. MyTracer.ico contains exact native PNG exports at 16, 24, 32, 48, 64, 128 and 256px. No font files are included.

The original icon assets are copied unchanged from the approved final asset package; their hashes below were verified against its manifest.

## SHA-256

- `MyTracer-app-icon.svg`: `de2de9c30685658a9386b9cd9d25e8a64f120b2845c356359ae2a9e82df6f327`
- `MyTracer-mark-green.svg`: `423ae11ae60313dc82a38a36f7b86993bac1878399f86906cfaa2c66460df925`
- `MyTracer-app-icon-256.png`: `b8cf3ba6c2a7cdd6d089a03b78033036a801c569be8796ec4b36a555c8a14162`
- `MyTracer.ico`: `1c3cb84268259ee67fa74c15be40eb7b0a7acdf6562a58b969487c370c80fdf3`

## Consumers and exports

- `MyTracer-app-icon.svg`: approved standalone icon master, do not redraw.
- `MyTracer-mark-green.svg`: retained standalone transparent sprout master.
- `MyTracer-app-icon-256.png`: Electron BrowserWindow icon. The `?asset` import resolves the resources directory relative to the built main module; the packaging file list includes this PNG inside app.asar. Neither development nor packaged paths depend on the working directory.
- `MyTracer.ico`: Windows executable, NSIS installer/header and uninstaller. Start Menu shortcuts use the installed executable icon; desktop shortcut policy stays unchanged.

To reproduce raster exports, install Python 3 and Inkscape, then run `python tools/brand/export.py /tmp/mytracer-brand-export` from the repository root (on Windows, choose a temporary Windows directory). The script exports each native size directly from the master and assembles the seven PNG frames into ICO without resizing intermediate rasters. Compare the output before replacing the approved files; Inkscape versions can change encoding or rendering. SVG masters are never modified by the script. Do not commit temporary exports, the source ZIP, previews, or unused wordmarks.

## C1 wordmark

`MyTracer-wordmark-green.svg` is the finalized original C1 sprout + MyTracer lockup supplied by the owner. Preserve every path, transform, stroke and the original arched T, including the 800 × 260 intrinsic size and `viewBox="0 0 717 210"`. Do not retype, redraw, crop or stretch the lettering.

`MyTracer-wordmark-milk.svg` differs only in green paint (`#214C3D` → `#F5F1E7`) and its descriptive title. Use green on light backgrounds and milk on dark backgrounds. The current light app uses green in the titlebar above the sidebar (120 × 39 CSS px) and the existing About area (240 × 78 CSS px); README uses a responsive `picture` with milk for dark mode and green as the default (400 × 130). Keep `alt="MyTracer"` on consumer images. Resize the full SVG proportionally through layout only; retain its built-in whitespace.

These are illustration assets, not UI fonts or replacements for the app, tray or installer icons. Normal interface typography and icon exports remain unchanged. Only these two final SVG variants belong in source control; keep preview boards and discarded designs outside the repository.
