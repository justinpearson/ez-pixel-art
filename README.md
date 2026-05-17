# ez-pixel-art

Super simple browser-based pixel-art editor. No build step, no dependencies, no framework — three files at the repo root (`index.html`, `app.js`, `style.css`) that you can also serve straight from `python3 -m http.server`.

**Live demo:** https://justinpearson.github.io/ez-pixel-art/

## Features

- Pencil, Fill (flood-fill), Eyedropper, Rectangle, Line, Selection tools
- Full RGBA: alpha slider + number input, palette swatches show transparency through a checkerboard, "α preview" toggle renders the canvas as a grayscale alpha mask
- Adjustable brush thickness (1–16) shared between pencil, line, and rectangle outline
- Live cursor click-preview for pencil/erase (hover shows what a click would paint)
- Rectangular selection with Delete (clears to α=0) and Fill Sel (recolours selected pixels)
- Palette quantizer: reduce the image to the N most-common colors with nearest-neighbour remapping
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
