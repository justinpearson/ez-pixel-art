# ez-pixel-art

Super simple browser-based pixel-art editor. No build step, no dependencies, no framework — three files at the repo root (`index.html`, `app.js`, `style.css`) that you can also serve straight from `python3 -m http.server`.

**Live demo:** https://justinpearson.github.io/ez-pixel-art/

## Features

- Pencil, Eraser, Line, Rect, Fill (flood-fill), Eyedropper, Selection tools — the drawing tools, brush thickness, Filled toggle, and the current-colour controls all live in a collapsible **Draw** panel
- Eraser is a true tool that paints `RGBA(0,0,0,0)` regardless of the current colour, so flipping back to Pencil resumes painting in whatever colour was selected
- Full RGBA: alpha slider + number input, a current-colour preview chip that shows transparency through a checkerboard, "alpha preview" toggle renders the canvas as a grayscale alpha mask
- "distinct colors" preview: each unique RGBA in the image is temporarily painted with a high-contrast hue so similar colors become trivially distinguishable (view-only, doesn't edit the image)
- Adjustable brush thickness (1–16, shortcuts `,` / `.`) shared between pencil, eraser, line, and rectangle outline
- Live cursor click-preview for pencil/eraser (hover shows what a click would paint)
- Selection modes: Rectangle, Row, Column, Contiguous color (flood), Same color (every pixel of that RGBA). The selection is shown as a merged blue outline drawn AROUND the selected pixels so colours stay visible. Delete clears to α=0, Fill Selection / Enter recolours selected pixels, and "Crop to Selection" trims the canvas to the selection's bounding box
- Auto-Crop trims a uniform border off the canvas — whether the border is transparent OR a solid background colour (the background colour is read from pixel 0,0)
- In-canvas resize with shiftable sampling grid (collapsible Image Resize panel below the toolbar). Resize by **output size** (type the final W×H) or by **pixel size** (type the W×H of one resized pixel, in current pixels — e.g. "3×5" makes the green grid cells exactly 3 wide and 5 tall). Both modes have a "Lock aspect" checkbox, on by default — in pixel-size mode it keeps the resized pixel square. Live "124×94 → 42×19 · pixel 3×5" summary in the header; the grid is drawn as medium-thick lines on the cell boundaries.
- Color Quantization panel: weighted k-means in CIE L\*a\*b\* space for k = 1..16 with mean ΔE/px per k, plus an interactive pixel-sets table (one row per distinct RGBA, sorted by count) with per-row Select / Replace and a bulk Quantize that atomically applies every row's mapping. Toggle between "snap centroids to closest pixel-set" (keeps real image colors) and using raw centroids (synthetic, α=255). The panel's height is user-resizable (drag the bottom-right corner).
- Undo / redo (snapshot-based, 30 levels) — also re-fits the view to the restored canvas size
- Zoom is a number input; `−` / `=` keys still adjust it
- Open / Save in PNG (preserves alpha), JPG (composites onto white), or hand-rolled BMP. The app starts with a default `clawde-screenshot-2.png` so you can poke at the editor immediately.
- Keyboard shortcuts:
  - Tools: **P**encil · **E**raser · **L**ine · **R**ect · **F**ill · **S**elect · Pic**k**
  - Panels: **D** = Draw · **I** = Image Resize · Color **Q**uantization
  - Edit: **Z** = Undo (also Cmd/Ctrl+Z) · **X** = Redo (also Cmd/Ctrl+Shift+Z) · **Y** = Auto-Crop · **C** = Crop to Selection · Enter = Fill Selection · Delete = clear selection
  - View: **G** = Grid · **A** = alpha preview · distinc**t** colors · `+` / `−` zoom
  - Misc: `,` / `.` thickness · **N** = New · **O** = Open · Sa**v**e (also Cmd/Ctrl+S) · Esc cancel
  - Tapping a shortcut briefly pulses the activated control so it's obvious what fired

## Running it locally

Open `index.html` directly in a browser (`open index.html` on macOS) and you're done.

For the regression-test harness (and for previewing inside tools that need an HTTP origin), serve the repo root:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/`.

## Regression tests

```
http://localhost:8000/tests/
```

Auto-runs on load. The harness loads the app in an iframe and runs the scenarios in `tests/scenarios.js` against it, rendering a pass/fail table with per-scenario canvas snapshots. Each new feature lands as a test-first commit followed by an implementation commit — see the git log for the TDD pairs.

## License

MIT — see [LICENSE](LICENSE).
