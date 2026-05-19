# ez-pixel-art

Super simple browser-based pixel-art editor. No build step, no dependencies, no framework — three files at the repo root (`index.html`, `app.js`, `style.css`) that you can also serve straight from `python3 -m http.server`.

**Live demo:** https://justinpearson.github.io/ez-pixel-art/

## Features

- Pencil, Fill (flood-fill), Eyedropper, Rectangle, Line, Selection tools
- Full RGBA: alpha slider + number input, palette swatches show transparency through a checkerboard, "α preview" toggle renders the canvas as a grayscale alpha mask
- "distinct colors" preview: each unique RGBA in the image is temporarily painted with a high-contrast hue so similar colors become trivially distinguishable (view-only, doesn't edit the image)
- Adjustable brush thickness (1–16) shared between pencil, line, and rectangle outline
- Live cursor click-preview for pencil/erase (hover shows what a click would paint)
- Selection modes: Rectangle, Row, Column, Contiguous color (flood), Same color (every pixel of that RGBA). Delete clears to α=0, Fill Sel / Enter recolours selected pixels
- In-canvas resize with shiftable sampling grid (collapsible Image Resize panel below the toolbar; live "32×32 → 16×16 · aspect locked · shift 1,0" summary in the header)
- Color Quantization panel: weighted k-means in CIE L\*a\*b\* space for k = 1..16 with mean ΔE/px per k, plus an interactive pixel-sets table (one row per distinct RGBA, sorted by count) with per-row Select / Replace and a bulk Quantize that atomically applies every row's mapping. Toggle between "snap centroids to closest pixel-set" (keeps real image colors) and using raw centroids (synthetic, α=255).
- Undo / redo (snapshot-based, 30 levels)
- Open / Save in PNG (preserves alpha), JPG (composites onto white), or hand-rolled BMP
- Keyboard shortcuts: **P**encil · **F**ill · **R**ect · **L**ine · **S**elect · P**i**ck · **E**rase · **U**ndo · **G**rid · Esc cancel · Enter fill selection · `+`/`−` zoom · Cmd-Z / Cmd-Shift-Z

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
