# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repo.

## What this is

`ez-pixel-art` is a minimal single-page pixel-art editor written in vanilla HTML, CSS, and JavaScript. There is no build step, no package manager, no test framework, and no server-side component. The app is three files at the repo root: `index.html`, `app.js`, and `style.css`. Backlog docs live in `prompts/`.

## Running and "testing"

For a quick check, open `index.html` directly (`open index.html` on macOS). For previewing inside the Claude Desktop app, serve over HTTP from the repo root:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/`. The `.claude/launch.json` config "ez-pixel-art (static, python http.server)" wires this up for the preview tool. All state lives in memory; reloading the page discards the canvas.

## Regression tests

A pure-browser harness at `tests/index.html` loads the app in an iframe and runs scenario scripts against it. Open `http://localhost:8000/tests/` (or `open tests/index.html`) — it auto-runs on load and renders a pass/fail table with per-scenario canvas snapshots. Scenarios live in `tests/scenarios.js` as plain data (`{ label, description, chain?, run, assertions }`); add a new scenario by appending to that array — no harness changes needed. The `App` class in `tests/runner.js` is the seam for user actions (`click`, `drag`, `setAlpha`, `pressUndo`, etc.).

If you change `app.js` and the tests don't seem to reflect it, hard-reload the tests page (Cmd-Shift-R) — the iframe's HTML is cache-busted on each scenario but child scripts may still come from cache.

For manual smoke testing outside the harness, exercise each tool in the browser (pencil, eraser, fill, picker, undo/redo, resize, crop, open, save in each of PNG/JPG/BMP).

## Architecture

`app.js` is one IIFE. Everything is in module scope: DOM lookups, mutable state, helpers, and event wiring. There are no classes and no exports. When extending the app, follow the existing section-comment convention (`// ---------- Tools ----------`, etc.) rather than introducing modules or a framework.

The core mental model is two coordinate spaces tied together by `zoom`. The image space is defined by `artCanvas.width` and `artCanvas.height` (`imgW`, `imgH`), and all drawing happens here at 1 logical unit per pixel via `artCtx.fillRect(x, y, 1, 1)`. The display space is `imgW * zoom` / `imgH * zoom` set on `artCanvas.style.width/height`, with `image-rendering: pixelated` doing the nearest-neighbour upscale. The grid overlay's cell size is set via the `--cell` CSS custom property in `applyZoom()`, and the pointer-to-pixel conversion in `pointerToPixel()` divides by `zoom`.

Undo/redo is snapshot-based. `pushUndo()` calls `getImageData(0, 0, imgW, imgH)` and stores the whole `ImageData` on `undoStack` (capped at `MAX_UNDO = 30`). This is simple but memory-heavy for large canvases — keep that in mind before raising the cap or canvas-size limits. Each tool's entry point is responsible for calling `pushUndo()` *before* mutating the canvas, and for popping its own snapshot back off if it turns out to be a no-op (see how `fill` and `crop` do this).

Save formats are handled differently. PNG goes through `canvas.toBlob()`. JPG composites onto a white background first, since JPEG has no alpha. BMP is encoded by hand in `encodeBMP24()` — a 24-bit BGR encoder that pre-multiplies alpha against white and writes the BITMAPINFOHEADER manually. If you add a format or change pixel semantics, that encoder needs to be updated to match.

Import flow goes Open → `loadImage()` → `openImportDialog()` → preview canvas plus optional palette extraction → on accept, draw with `imageSmoothingEnabled = false` so resampling stays nearest-neighbour.

## Backlog: `prompts/`

`prompts/prompt-1.txt` is the original feature request that produced the current app. `prompts/prompt-2.txt` is a list of follow-up feature ideas (alpha channel everywhere, adjustable pencil size, rectangle/line tools, live-preview cursor, in-canvas resize with shiftable grid overlay, color-palette quantizer, selection tools, etc.) that are **not yet implemented**. Treat `prompt-2.txt` as a backlog when planning work, but per the user's global rules, **never edit any `prompt-*.txt` file** — these are human-authored requirements docs.

## Scratch area: `scratch/`

`scratch/` is gitignored and holds half-baked ideas, reference images, and experiments (e.g., `scratch/images/clawde-screenshot-*.{png,bmp,pxd}`). Put work-in-progress assets here so they don't clutter `git status`. When something is ready to ship, move it out of `scratch/` into the right place at the repo root and commit.
