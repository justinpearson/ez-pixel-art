# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repo.

## What this is

`ez-pixel-art` is a minimal single-page pixel-art editor written in vanilla HTML, CSS, and JavaScript. There is no build step, no package manager, no test framework, and no server-side component. The app is three files at the repo root: `index.html`, `app.js`, and `style.css`, plus an `assets/` directory that ships the default startup image (`clawde-screenshot-2.png`) loaded on first open so the editor isn't empty. Backlog docs live in `prompts/`.

The `<script src="app.js">` tag is wrapped in `document.write(... '?_t=' + Date.now() + ...)` to force a fresh fetch each load, because the bundled `python3 -m http.server` emits no cache headers and Chrome was otherwise serving very-stale copies in dev. If you replace the script tag, preserve that cache-bust.

## Running and "testing"

For a quick check, open `index.html` directly (`open index.html` on macOS). For previewing inside the Claude Desktop app, serve over HTTP from the repo root:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/`. The `.claude/launch.json` config "ez-pixel-art (static, python http.server)" wires this up for the preview tool. All state lives in memory; reloading the page discards the canvas.

## Regression tests

A pure-browser harness at `tests/index.html` loads the app in an iframe and runs scenario scripts against it. **Must be loaded over HTTP** (not `file://`) because the runner fetches `../index.html` to cache-bust child scripts and browsers block that across a null origin. With the python server running, visit `http://localhost:8000/tests/`. The page auto-runs on load and renders a pass/fail table with per-scenario canvas snapshots.

Scenarios live in `tests/scenarios.js` as plain data (`{ label, description, chain?, run, assertions }`); add a new scenario by appending to that array — no harness changes needed. The `App` class in `tests/runner.js` is the seam for user actions (`click`, `drag`, `setAlpha`, `pressUndo`, etc.). If you open the harness from `file://` it shows a clear error instead of failing every test.

`tests/index.html` cache-busts `scenarios.js` and `runner.js` via `document.write(... '?_t=' + Date.now() + ...)`. Without that, the browser would happily keep serving stale copies on reload and the visible row count would not match `tests/scenarios.js` on disk.

For manual smoke testing outside the harness, exercise each tool in the browser (Pencil, Eraser, Line, Rect, Fill, Pick, Select, undo/redo, resize, Auto-Crop, Crop to Selection, Open, Save in each of PNG/JPG/BMP).

## Architecture

`app.js` is one IIFE. Everything is in module scope: DOM lookups, mutable state, helpers, and event wiring. There are no classes and no exports. When extending the app, follow the existing section-comment convention (`// ---------- Tools ----------`, etc.) rather than introducing modules or a framework.

The core mental model is two coordinate spaces tied together by `zoom`. The image space is defined by `artCanvas.width` and `artCanvas.height` (`imgW`, `imgH`), and all drawing happens here at 1 logical unit per pixel via `artCtx.fillRect(x, y, 1, 1)`. The display space is `imgW * zoom` / `imgH * zoom` set on `artCanvas.style.width/height`, with `image-rendering: pixelated` doing the nearest-neighbour upscale. The grid overlay's cell size is set via the `--cell` CSS custom property in `applyZoom()`, and the pointer-to-pixel conversion in `pointerToPixel()` divides by `zoom`.

Undo/redo is snapshot-based. `pushUndo()` calls `getImageData(0, 0, imgW, imgH)` and stores the whole `ImageData` on `undoStack` (capped at `MAX_UNDO = 30`). This is simple but memory-heavy for large canvases — keep that in mind before raising the cap or canvas-size limits. Each tool's entry point is responsible for calling `pushUndo()` *before* mutating the canvas, and for popping its own snapshot back off if it turns out to be a no-op (see how `fill` and `crop` do this).

Save formats are handled differently. PNG goes through `canvas.toBlob()`. JPG composites onto a white background first, since JPEG has no alpha. BMP is encoded by hand in `encodeBMP24()` — a 24-bit BGR encoder that pre-multiplies alpha against white and writes the BITMAPINFOHEADER manually. If you add a format or change pixel semantics, that encoder needs to be updated to match.

Import flow goes Open → `loadImage()` → `openImportDialog()` → preview canvas → on accept, draw with `imageSmoothingEnabled = false` so resampling stays nearest-neighbour.

## Collapsible panels (Draw, Color Quantization, Image Resize)

Three feature areas live below the toolbar as collapsible `<section>` panels sharing the `.panel-toggle` styling — a header with a rotating caret and a live summary that stays visible when the body is collapsed (`#draw-body`, `#quant-body`, `#resize-body` toggle a `hidden` class). Use the same pattern for any future feature that needs more space than a toolbar group affords. The summary line should advertise the most useful current state ("32×32" for resize, "5 distinct colors · k = 3 · mode: snap" for quantization) so users don't have to expand the panel to know what it would do.

The **Draw** panel (`#draw-panel`) holds the drawing tools (`#tools` with Pencil → Eraser → Line → Rect → Fill, in order of "pixel power"), the shape options (`#shape-options` with the brush-thickness input and Filled checkbox), and the colour section (`#color-section` with picker / alpha slider / RGBA readout / Pick button). It starts expanded; pressing `D` toggles it. Keep the inner `#tools`, `#shape-options`, and `#color-section` IDs intact — the regression tests query them directly. There is no palette swatch grid — it was removed; the only way to set a colour is the `<input type="color">` picker plus the alpha slider, or the eyedropper.

The **Color Quantization** panel is built on a "pixel-set" abstraction (`analyzePixelSets()` returns one entry per distinct RGBA, sorted by count, α=0 excluded). Weighted k-means runs in CIE L\*a\*b\* space (`rgbToLab`, `labToRgb`) for k = 1..min(distinct, 16) with a deterministic seeded k-means++ init — the same image always yields the same clustering. `quantizedColorsFor()` derives the N proposed colors per k either by snapping each centroid to the closest existing pixel-set (preserves real image colors and alpha) or by converting the LAB centroid directly back to sRGB at α=255. Quantize commits the mappings via `applyMappings()`, which uses a single-pass remap from an `ImageData` snapshot — so swap cycles like A→B + B→A behave as a swap rather than iterating to a fixed point. The panel's body has `resize: vertical` so users can drag it taller when reading long pixel-set tables.

The **Image Resize** panel auto-enters resize mode (draws the green grid overlay on `#resize-grid-overlay`) when expanded and exits when collapsed. On expand the proposed W/H default to one-fifth of the current dimensions so the overlay doesn't have to stroke thousands of gridlines on a freshly-loaded image. Apply commits and collapses; Esc or clicking the header again collapses without applying.

The panel has a `#resize-mode` selector with two modes. **Output size** — the user types the final `w`/`h`. **Pixel size** — the user types the W×H of one resized pixel in current-pixel units (`#resize-px-w`/`#resize-px-h`); the output dimensions are then `ceil(imgW / cellW)` etc. Both modes funnel through `getResizeParams()`, which always returns `{ mode, w, h, cw, ch, sx, sy }` where `cw`/`ch` are the cell size in current pixels (`imgW/w` in output mode, the typed integer in pixel mode). `drawResizeGrid()` strokes lines at multiples of `cw`/`ch`, and `resampleByCell(w, h, cw, ch, sx, sy)` samples source pixel `(floor(i*cw + sx), floor(j*ch + sy))` for each output pixel — so in pixel mode the grid cells and the sampling are exactly the typed size. `syncResizeModeFields()` shows `#resize-output-fields` or `#resize-pixel-fields` to match the mode. Each mode has its own "Lock aspect" checkbox: `#resize-keep-aspect` ties output W/H to the source image's aspect ratio, and `#resize-px-keep-aspect` (on by default) keeps the resized pixel square by mirroring `#resize-px-w` ↔ `#resize-px-h`.

## Selection + resize overlays draw in display coordinates

`#selection-overlay` and `#resize-grid-overlay` are sized to the *display* resolution (`imgW * zoom`) rather than image resolution, set in `applyZoom()`. They stroke lines along pixel boundaries (the merged outline for selections, gridlines for the resize grid) so the marks sit AROUND pixels rather than ON them — pixel colours stay visible inside a selection. Anything that changes `zoom` or the canvas dimensions must re-call `drawSelectionFromMask()` and `drawResizeGrid()`. The hover overlay still draws at image resolution + nearest-neighbour upscale because it stamps full pixels, not edges.

## Keyboard shortcuts and shortcut pulse

Most shortcuts live in the single `keydown` listener at the bottom of `app.js`. After firing, each handler calls `pulse(el)` on the activated control, which toggles a `.pulse` class for a short CSS animation. Repeats are visible because `pulse()` removes the class, forces a reflow with `void el.offsetWidth`, then re-adds it. Cmd/Ctrl modifiers are checked before the bare-key switch so `Cmd-S` saves and `Cmd-Z` undos without colliding with `S` (Select) or `Z` (undo). `D` toggles the Draw panel, `Q` the Color Quantization panel, and `I` the Image Resize panel; `K` is the Pick tool. `V` saves, `C` is Crop to Selection, `Y` is Auto-Crop, `T` toggles the distinct-colors preview, `A` the alpha preview. When you change a shortcut, keep the bolded letter in the matching button/label markup in sync — `tests/scenarios.js` asserts on it.

## Auto-Crop trims a uniform border, not just transparency

`cropToContent()` reads the background colour from pixel (0,0) and crops to the bounding box of every pixel that differs from it. This trims a solid-colour border (e.g. the white background around the default mascot) as well as a transparent one. If the whole image is the background colour it returns `false` and the click is a no-op.

## Diagnostic preview canvases

`#art-alpha-preview` (grayscale of α channel) and `#art-distinct-preview` (each distinct RGBA recoloured with a high-contrast hue) are stacked on top of `#art` and shown via the two checkboxes in the toolbar. They're mutually exclusive — turning one on flips the other off and unchecks its box. Both refresh via `refreshPreviews()`, which is wired into every canvas-mutating code path that already updates the alpha preview.

## Backlog: `prompts/`

`prompts/prompt-1.txt` is the original feature request that produced the current app. `prompts/prompt-2.txt` is a list of follow-up feature ideas, most of which are now shipped (alpha channel, brush size, rect/line tools, live cursor preview, in-canvas resize, palette quantizer, all selection modes, recolor selection). `prompts/prompt-3.txt` is the spec for the distinct-colors preview + interactive pixel-sets quantizer + k-means analysis — now shipped. `prompts/prompt-4.txt` is the misc-polish bundle (Draw panel, Eraser tool, Auto-Crop / Crop to Selection, merged selection outline, default startup image, expanded keyboard shortcuts, etc.) — now shipped. `prompts/prompt-5.txt` is a small follow-up tweak list (shortcut re-bindings, save-format selector moved right of Save, Thickness/Filled relocated into the Draw panel, Auto-Crop fixed to trim solid backgrounds, palette swatch grid removed) — now shipped. Treat the `prompt-*.txt` files as a backlog when planning new work, but per the user's global rules, **never edit any `prompt-*.txt` file** — these are human-authored requirements docs.

## Scratch area: `scratch/`

`scratch/` is gitignored and holds half-baked ideas, reference images, and experiments (e.g., `scratch/images/clawde-screenshot-*.{png,bmp,pxd}`). Put work-in-progress assets here so they don't clutter `git status`. When something is ready to ship, move it out of `scratch/` into the right place at the repo root and commit.
