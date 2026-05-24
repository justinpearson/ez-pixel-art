'use strict';

(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- DOM ----------
  const artCanvas     = $('#art');
  const artCtx        = artCanvas.getContext('2d', { willReadFrequently: true });
  const previewCanvas = $('#art-alpha-preview');
  const previewCtx    = previewCanvas.getContext('2d');
  const distinctCanvas = $('#art-distinct-preview');
  const distinctCtx    = distinctCanvas.getContext('2d');
  const hoverCanvas   = $('#hover-overlay');
  const hoverCtx      = hoverCanvas.getContext('2d');
  const selectionCanvas = $('#selection-overlay');
  const selectionCtx    = selectionCanvas.getContext('2d');
  const resizeGridCanvas = $('#resize-grid-overlay');
  const resizeGridCtx    = resizeGridCanvas.getContext('2d');
  const stage         = $('#canvas-stage');
  const gridOverlay   = $('#grid-overlay');
  const wrap          = $('#canvas-wrap');

  // ---------- State ----------
  let imgW = 32, imgH = 32;
  let zoom = 16;
  const MIN_ZOOM = 1, MAX_ZOOM = 64;
  let currentColor = [203, 110, 74, 255];   // rgba of #cb6e4aff
  let currentTool  = 'pencil';

  const undoStack = [];
  const redoStack = [];
  const MAX_UNDO  = 30;


  // ---------- Color helpers ----------
  function hexToRgba(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) : 255;
    return [r, g, b, a];
  }
  function rgbToHex6([r, g, b]) {
    const h = n => n.toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }

  // ---------- Canvas sizing ----------
  function setCanvasSize(w, h) {
    imgW = w;
    imgH = h;
    artCanvas.width  = w;
    artCanvas.height = h;
    previewCanvas.width  = w;
    previewCanvas.height = h;
    distinctCanvas.width  = w;
    distinctCanvas.height = h;
    hoverCanvas.width    = w;
    hoverCanvas.height   = h;
    // Selection + resize grid overlays are sized in display pixels (set in
    // applyZoom) so we can stroke crisp 2-3px lines along pixel boundaries.
    artCtx.imageSmoothingEnabled = false;
    if (selection && selection.mask.length !== w * h) selection = null;
    applyZoom();
    if (typeof renderResizeSummary === 'function') renderResizeSummary();
    syncSelectionDependentUI();
  }
  function applyZoom() {
    const cssW = imgW * zoom;
    const cssH = imgH * zoom;
    artCanvas.style.width  = cssW + 'px';
    artCanvas.style.height = cssH + 'px';
    previewCanvas.style.width  = cssW + 'px';
    previewCanvas.style.height = cssH + 'px';
    distinctCanvas.style.width  = cssW + 'px';
    distinctCanvas.style.height = cssH + 'px';
    hoverCanvas.style.width    = cssW + 'px';
    hoverCanvas.style.height   = cssH + 'px';
    // Display-resolution backing buffers for the overlays that draw lines on
    // pixel edges. Reassigning .width/.height also clears the canvas, so the
    // redraw calls below are required to put the strokes back.
    selectionCanvas.width  = cssW;
    selectionCanvas.height = cssH;
    selectionCanvas.style.width  = cssW + 'px';
    selectionCanvas.style.height = cssH + 'px';
    resizeGridCanvas.width  = cssW;
    resizeGridCanvas.height = cssH;
    resizeGridCanvas.style.width  = cssW + 'px';
    resizeGridCanvas.style.height = cssH + 'px';
    stage.style.width      = cssW + 'px';
    stage.style.height     = cssH + 'px';
    gridOverlay.style.setProperty('--cell', zoom + 'px');
    const zi = $('#zoom-input');
    if (zi) zi.value = zoom;
    drawSelectionFromMask();
    if (typeof drawResizeGrid === 'function') drawResizeGrid();
    updateStatus();
  }
  function fitZoom() {
    const availW = wrap.clientWidth  - 40;
    const availH = wrap.clientHeight - 40;
    let z = Math.floor(Math.min(availW / imgW, availH / imgH));
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z || 1));
    zoom = z;
    applyZoom();
  }

  // ---------- Pointer math ----------
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < imgW && y < imgH;
  function pointerToPixel(e) {
    const r = artCanvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left) / zoom),
      y: Math.floor((e.clientY - r.top)  / zoom),
    };
  }

  // ---------- Tool helpers ----------
  const paintPixelBuf = artCtx.createImageData(1, 1);
  function paintPixel(x, y, ctx = artCtx, rgba = currentColor) {
    if (!inBounds(x, y)) return;
    paintPixelBuf.data[0] = rgba[0];
    paintPixelBuf.data[1] = rgba[1];
    paintPixelBuf.data[2] = rgba[2];
    paintPixelBuf.data[3] = rgba[3];
    ctx.putImageData(paintPixelBuf, x, y);
  }

  function lineBresenham(x0, y0, x1, y1, fn) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      fn(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 <  dx) { err += dx; y0 += sy; }
    }
  }

  function floodFill(sx, sy) {
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    const si = (sy * imgW + sx) * 4;
    const tr = d[si], tg = d[si+1], tb = d[si+2], ta = d[si+3];
    const [nr, ng, nb, na] = currentColor;
    if (tr === nr && tg === ng && tb === nb && ta === na) return false;
    const stack = [sx | 0, sy | 0];
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < 0 || y < 0 || x >= imgW || y >= imgH) continue;
      const i = (y * imgW + x) * 4;
      if (d[i] !== tr || d[i+1] !== tg || d[i+2] !== tb || d[i+3] !== ta) continue;
      d[i] = nr; d[i+1] = ng; d[i+2] = nb; d[i+3] = na;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    artCtx.putImageData(id, 0, 0);
    return true;
  }

  function pickColor(x, y, switchToPencil = true) {
    const px = artCtx.getImageData(x, y, 1, 1).data;
    if (px[3] === 0) return;
    currentColor = [px[0], px[1], px[2], px[3]];
    syncColorUI();
    if (switchToPencil) setTool('pencil');
  }

  // ---------- Shape helpers ----------
  function getFilled()    { return $('#rect-filled').checked; }
  function getThickness() {
    const n = parseInt($('#shape-thickness').value, 10);
    return Math.max(1, Number.isFinite(n) ? n : 1);
  }
  function setThickness(n) {
    const v = Math.max(1, Math.min(16, n | 0));
    $('#shape-thickness').value = String(v);
  }
  function stamp(cx, cy, size, ctx, rgba) {
    if (size <= 1) { paintPixel(cx, cy, ctx, rgba); return; }
    const half = Math.floor(size / 2);
    for (let dy = -half; dy <= size - 1 - half; dy++)
      for (let dx = -half; dx <= size - 1 - half; dx++)
        paintPixel(cx + dx, cy + dy, ctx, rgba);
  }
  function drawRect(p0, p1, filled, thickness) {
    const minX = Math.min(p0.x, p1.x), maxX = Math.max(p0.x, p1.x);
    const minY = Math.min(p0.y, p1.y), maxY = Math.max(p0.y, p1.y);
    if (filled) {
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++)
          paintPixel(x, y);
      return;
    }
    const t = Math.max(1, Math.min(
      thickness,
      Math.floor((maxX - minX + 2) / 2),
      Math.floor((maxY - minY + 2) / 2),
    ));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x - minX < t || maxX - x < t || y - minY < t || maxY - y < t) {
          paintPixel(x, y);
        }
      }
    }
  }
  function drawLine(p0, p1, thickness) {
    lineBresenham(p0.x, p0.y, p1.x, p1.y, (x, y) => stamp(x, y, thickness));
  }

  // ---------- Tool registry ----------
  const ERASER_RGBA = [0, 0, 0, 0];
  const tools = {
    pencil: {
      cursor: 'cell',
      lastPx: null,
      onDown(p) {
        pushUndo();
        this.lastPx = p;
        stamp(p.x, p.y, getThickness());
      },
      onMove(p) {
        if (!this.lastPx) return;
        if (this.lastPx.x === p.x && this.lastPx.y === p.y) return;
        const size = getThickness();
        lineBresenham(this.lastPx.x, this.lastPx.y, p.x, p.y, (x, y) => stamp(x, y, size));
        this.lastPx = p;
      },
      onUp()     { this.lastPx = null; },
      onCancel() { this.lastPx = null; },
      onHover(p) {
        clearHoverOverlay();
        const rgba = currentColor[3] === 0
          ? [128, 128, 128, 180]   // erase marker (zero-alpha pencil)
          : currentColor;
        stamp(p.x, p.y, getThickness(), hoverCtx, rgba);
      },
    },
    eraser: {
      // Pencil-shaped tool that always writes RGBA(0,0,0,0). Independent of
      // the user's current color/alpha so switching to Pencil afterwards
      // restores their palette pick.
      cursor: 'cell',
      lastPx: null,
      onDown(p) {
        pushUndo();
        this.lastPx = p;
        stamp(p.x, p.y, getThickness(), artCtx, ERASER_RGBA);
      },
      onMove(p) {
        if (!this.lastPx) return;
        if (this.lastPx.x === p.x && this.lastPx.y === p.y) return;
        const size = getThickness();
        lineBresenham(this.lastPx.x, this.lastPx.y, p.x, p.y, (x, y) => stamp(x, y, size, artCtx, ERASER_RGBA));
        this.lastPx = p;
      },
      onUp()     { this.lastPx = null; },
      onCancel() { this.lastPx = null; },
      onHover(p) {
        clearHoverOverlay();
        stamp(p.x, p.y, getThickness(), hoverCtx, [220, 90, 90, 180]);
      },
    },
    fill: {
      cursor: 'cell',
      onDown(p) {
        pushUndo();
        if (!floodFill(p.x, p.y)) undoStack.pop();
      },
    },
    picker: {
      cursor: 'crosshair',
      onDown(p) { pickColor(p.x, p.y); },
    },
    rect: {
      cursor: 'crosshair',
      start: null,
      before: null,
      onDown(p) {
        this.start = p;
        this.before = snapshot();
      },
      onMove(p) {
        if (!this.start) return;
        artCtx.putImageData(this.before, 0, 0);
        drawRect(this.start, p, getFilled(), getThickness());
      },
      onUp(p) {
        if (!this.start) return;
        artCtx.putImageData(this.before, 0, 0);
        drawRect(this.start, p, getFilled(), getThickness());
        pushUndoSnap(this.before);
        this.start = null;
        this.before = null;
      },
      onCancel() {
        if (!this.start) return;
        artCtx.putImageData(this.before, 0, 0);
        this.start = null;
        this.before = null;
      },
    },
    line: {
      cursor: 'crosshair',
      start: null,
      before: null,
      onDown(p) {
        this.start = p;
        this.before = snapshot();
      },
      onMove(p) {
        if (!this.start) return;
        artCtx.putImageData(this.before, 0, 0);
        drawLine(this.start, p, getThickness());
      },
      onUp(p) {
        if (!this.start) return;
        artCtx.putImageData(this.before, 0, 0);
        drawLine(this.start, p, getThickness());
        pushUndoSnap(this.before);
        this.start = null;
        this.before = null;
      },
      onCancel() {
        if (!this.start) return;
        artCtx.putImageData(this.before, 0, 0);
        this.start = null;
        this.before = null;
      },
    },
    select: {
      cursor: 'crosshair',
      start: null,
      onDown(p) {
        const mode = $('#selection-mode').value;
        if (mode === 'rect') {
          this.start = p;
          selection = null;
          clearSelectionOverlay();
          syncSelectionDependentUI();
          return;
        }
        let mask = null;
        if      (mode === 'row')        mask = buildRowMask(p.y);
        else if (mode === 'column')     mask = buildColumnMask(p.x);
        else if (mode === 'contiguous') mask = buildContiguousMask(p.x, p.y);
        else if (mode === 'same-color') mask = buildSameColorMask(p.x, p.y);
        if (mask) {
          selection = { mask };
          drawSelectionFromMask();
          syncSelectionDependentUI();
        }
      },
      onMove(p) {
        if (!this.start) return;
        const minX = Math.min(this.start.x, p.x), maxX = Math.max(this.start.x, p.x);
        const minY = Math.min(this.start.y, p.y), maxY = Math.max(this.start.y, p.y);
        // Live drag preview: synthesize the rect mask each frame so the
        // outline renderer can do the merged-edge stroke.
        selection = { mask: buildRectMask(minX, minY, maxX, maxY) };
        drawSelectionFromMask();
      },
      onUp(p) {
        if (!this.start) return;
        const minX = Math.min(this.start.x, p.x), maxX = Math.max(this.start.x, p.x);
        const minY = Math.min(this.start.y, p.y), maxY = Math.max(this.start.y, p.y);
        selection = { mask: buildRectMask(minX, minY, maxX, maxY) };
        drawSelectionFromMask();
        syncSelectionDependentUI();
        this.start = null;
      },
      onCancel() {
        if (this.start) {
          this.start = null;
          drawSelectionFromMask();
        }
      },
    },
  };

  function setTool(name) {
    if (currentTool !== name) tools[currentTool]?.onDeactivate?.();
    currentTool = name;
    tools[name]?.onActivate?.();
    $$('.tool-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === name));
    artCanvas.style.cursor = tools[name]?.cursor ?? 'cell';
    clearHoverOverlay();
  }

  // ---------- Undo / redo ----------
  function snapshot() { return artCtx.getImageData(0, 0, imgW, imgH); }
  function restore(snap) {
    setCanvasSize(snap.width, snap.height);
    artCtx.putImageData(snap, 0, 0);
    refreshPreviews();
  }
  function pushUndoSnap(snap) {
    undoStack.push(snap);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
  }
  function pushUndo() { pushUndoSnap(snapshot()); }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    fitZoom();
    updateStatus();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    fitZoom();
    updateStatus();
  }

  // ---------- Resize & crop ----------
  // Nearest-neighbour downsample. Each output pixel (i,j) covers a cell of
  // `cellW`×`cellH` source pixels and samples the source pixel at the cell's
  // origin (`+shift`). In "output size" mode cellW = oldW/newW (a fraction);
  // in "pixel size" mode cellW is the integer the user typed, so the grid
  // cells are exactly that many source pixels wide/tall.
  function resampleByCell(newW, newH, cellW, cellH, shiftX, shiftY) {
    const oldW = imgW, oldH = imgH;
    const src  = artCtx.getImageData(0, 0, oldW, oldH);
    const out  = new ImageData(newW, newH);
    for (let j = 0; j < newH; j++) {
      for (let i = 0; i < newW; i++) {
        let sx = Math.floor(i * cellW + shiftX);
        let sy = Math.floor(j * cellH + shiftY);
        sx = Math.max(0, Math.min(oldW - 1, sx));
        sy = Math.max(0, Math.min(oldH - 1, sy));
        const si = (sy * oldW + sx) * 4;
        const di = (j * newW + i)  * 4;
        out.data[di]     = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
    setCanvasSize(newW, newH);
    artCtx.putImageData(out, 0, 0);
  }
  // Auto-Crop trims a uniform border. The background colour is taken to be
  // pixel (0,0) — covering both fully-transparent borders AND solid-colour
  // backgrounds (e.g. the white border around the default mascot image).
  // The crop box is the bounding box of every pixel that differs from it.
  function cropToContent() {
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    const br = d[0], bg = d[1], bb = d[2], ba = d[3];
    let minX = imgW, minY = imgH, maxX = -1, maxY = -1;
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const i = (y * imgW + x) * 4;
        if (d[i] !== br || d[i+1] !== bg || d[i+2] !== bb || d[i+3] !== ba) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return false;   // whole image is the background colour
    const newW = maxX - minX + 1;
    const newH = maxY - minY + 1;
    if (newW === imgW && newH === imgH) return false;
    const cropped = artCtx.getImageData(minX, minY, newW, newH);
    setCanvasSize(newW, newH);
    artCtx.putImageData(cropped, 0, 0);
    return true;
  }
  function cropToSelection() {
    if (!selection) return false;
    const m = selection.mask;
    let minX = imgW, minY = imgH, maxX = -1, maxY = -1;
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        if (!m[y * imgW + x]) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return false;
    const newW = maxX - minX + 1;
    const newH = maxY - minY + 1;
    if (newW === imgW && newH === imgH) return false;
    const cropped = artCtx.getImageData(minX, minY, newW, newH);
    setCanvasSize(newW, newH);
    artCtx.putImageData(cropped, 0, 0);
    return true;
  }

  // ---------- Save ----------
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function saveImage(format) {
    if (format === 'bmp') {
      const id = artCtx.getImageData(0, 0, imgW, imgH);
      downloadBlob(encodeBMP24(id), 'ez-pixel-art.bmp');
      return;
    }
    if (format === 'svg') {
      const id = artCtx.getImageData(0, 0, imgW, imgH);
      downloadBlob(encodeSVG(id), 'ez-pixel-art.svg');
      return;
    }
    if (format === 'scad') {
      const id = artCtx.getImageData(0, 0, imgW, imgH);
      const depth = parseFloat($('#scad-depth').value);
      const d = Number.isFinite(depth) && depth > 0 ? depth : 5;
      downloadBlob(encodeSCAD(id, d), 'ez-pixel-art.scad');
      return;
    }
    if (format === 'jpg') {
      const tmp = document.createElement('canvas');
      tmp.width = imgW; tmp.height = imgH;
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = '#fff';
      tctx.fillRect(0, 0, imgW, imgH);
      tctx.drawImage(artCanvas, 0, 0);
      tmp.toBlob(b => downloadBlob(b, 'ez-pixel-art.jpg'), 'image/jpeg', 0.95);
      return;
    }
    artCanvas.toBlob(b => downloadBlob(b, 'ez-pixel-art.png'), 'image/png');
  }

  function encodeBMP24(imageData) {
    const w = imageData.width, h = imageData.height;
    const rowSize   = ((24 * w + 31) >> 5) << 2;
    const pixelSize = rowSize * h;
    const fileSize  = 54 + pixelSize;
    const buf   = new ArrayBuffer(fileSize);
    const view  = new DataView(buf);
    const bytes = new Uint8Array(buf);
    bytes[0] = 0x42; bytes[1] = 0x4D;
    view.setUint32(2,  fileSize, true);
    view.setUint32(10, 54,       true);
    view.setUint32(14, 40,       true);
    view.setInt32 (18, w,        true);
    view.setInt32 (22, h,        true);
    view.setUint16(26, 1,        true);
    view.setUint16(28, 24,       true);
    view.setUint32(34, pixelSize,true);
    view.setInt32 (38, 2835,     true);
    view.setInt32 (42, 2835,     true);
    const src = imageData.data;
    for (let y = 0; y < h; y++) {
      const srcRow = (h - 1 - y) * w * 4;
      let dst = 54 + y * rowSize;
      for (let x = 0; x < w; x++) {
        const i = srcRow + x * 4;
        const a = src[i + 3] / 255;
        bytes[dst++] = Math.round(src[i + 2] * a + 255 * (1 - a)); // B
        bytes[dst++] = Math.round(src[i + 1] * a + 255 * (1 - a)); // G
        bytes[dst++] = Math.round(src[i]     * a + 255 * (1 - a)); // R
      }
    }
    return new Blob([buf], { type: 'image/bmp' });
  }

  // SVG encoder. For each non-transparent pixel we'd otherwise emit a 1×1
  // <rect>; instead we coalesce consecutive same-RGBA pixels into wider /
  // taller rects via run-length encoding. We run the pass in BOTH directions
  // (rows L→R, then columns T→B) and ship whichever yielded fewer rects, so
  // images dominated by vertical features (1-px columns, tall thin shapes)
  // shrink as much as row-dominated ones. shape-rendering=crispEdges keeps
  // the rects from getting anti-aliased when the file is rendered.
  function svgRunsHorizontal(d, w, h) {
    const out = [];
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const i = (y * w + x) * 4;
        const a = d[i + 3];
        if (a === 0) { x++; continue; }
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let end = x + 1;
        while (end < w) {
          const j = (y * w + end) * 4;
          if (d[j] !== r || d[j + 1] !== g || d[j + 2] !== b || d[j + 3] !== a) break;
          end++;
        }
        out.push([x, y, end - x, 1, r, g, b, a]);
        x = end;
      }
    }
    return out;
  }
  function svgRunsVertical(d, w, h) {
    const out = [];
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h) {
        const i = (y * w + x) * 4;
        const a = d[i + 3];
        if (a === 0) { y++; continue; }
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let end = y + 1;
        while (end < h) {
          const j = (end * w + x) * 4;
          if (d[j] !== r || d[j + 1] !== g || d[j + 2] !== b || d[j + 3] !== a) break;
          end++;
        }
        out.push([x, y, 1, end - y, r, g, b, a]);
        y = end;
      }
    }
    return out;
  }
  function encodeSVG(imageData) {
    const w = imageData.width, h = imageData.height;
    const d = imageData.data;
    const hRects = svgRunsHorizontal(d, w, h);
    const vRects = svgRunsVertical(d, w, h);
    const rects = vRects.length < hRects.length ? vRects : hRects;
    const hex2 = (n) => n.toString(16).padStart(2, '0');
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`,
    ];
    for (const [x, y, rw, rh, r, g, b, a] of rects) {
      const fill = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
      const opacityAttr = a === 255 ? '' : ` fill-opacity="${(a / 255).toFixed(3)}"`;
      parts.push(`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${fill}"${opacityAttr}/>`);
    }
    parts.push('</svg>');
    return new Blob([parts.join('')], { type: 'image/svg+xml' });
  }

  // OpenSCAD encoder. Each non-transparent pixel becomes a unit-square cube
  // whose Z height is (alpha / 255) * max_height, so the image's alpha channel
  // is a depth map. Y is flipped (image row 0 → SCAD y = imgH-1) so the model
  // is upright when viewed in OpenSCAD's standard +Y-up orientation. We
  // run-length encode runs of consecutive same-alpha pixels into wider /
  // taller cuboids; pixels with different alphas are NEVER merged because
  // their cube heights would differ. As with SVG we run RLE in both
  // directions and emit whichever produced fewer cubes.
  function scadRunsHorizontal(d, w, h) {
    const out = [];
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const a = d[(y * w + x) * 4 + 3];
        if (a === 0) { x++; continue; }
        let end = x + 1;
        while (end < w && d[(y * w + end) * 4 + 3] === a) end++;
        out.push([x, y, end - x, 1, a]);
        x = end;
      }
    }
    return out;
  }
  function scadRunsVertical(d, w, h) {
    const out = [];
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h) {
        const a = d[(y * w + x) * 4 + 3];
        if (a === 0) { y++; continue; }
        let end = y + 1;
        while (end < h && d[(end * w + x) * 4 + 3] === a) end++;
        out.push([x, y, 1, end - y, a]);
        y = end;
      }
    }
    return out;
  }
  function encodeSCAD(imageData, maxHeight) {
    const w = imageData.width, h = imageData.height;
    const d = imageData.data;
    const hRuns = scadRunsHorizontal(d, w, h);
    const vRuns = scadRunsVertical(d, w, h);
    const runs = vRuns.length < hRuns.length ? vRuns : hRuns;
    const parts = [
      `// Generated by ez-pixel-art`,
      `// Source image: ${w} x ${h} px`,
      `// 1 image-pixel = 1 unit in X and Y; height = (alpha / 255) * max_height`,
      `// alpha == 0 pixels are omitted`,
      ``,
      `pixel_size = 1;`,
      `max_height = ${maxHeight};`,
      ``,
      `module px(x, y, w, h, a) {`,
      `    translate([x * pixel_size, y * pixel_size, 0])`,
      `        cube([w * pixel_size, h * pixel_size, (a / 255) * max_height]);`,
      `}`,
      ``,
    ];
    for (const [x, y, rw, rh, a] of runs) {
      // Flip Y so image-row 0 sits at the top in OpenSCAD's +Y-up world.
      // A run that spans image rows y..y+rh-1 occupies SCAD rows
      // (h-1-y-rh+1)..(h-1-y), i.e. its bottom-left corner is at h - y - rh.
      const sy = h - y - rh;
      parts.push(`px(${x}, ${sy}, ${rw}, ${rh}, ${a});`);
    }
    return new Blob([parts.join('\n')], { type: 'text/plain' });
  }

  // ---------- Open / import ----------
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }
  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed: ' + url));
      img.src = url;
    });
  }
  // ---- Pixel-set analysis ----
  function rgbaKey(r, g, b, a) { return r + ',' + g + ',' + b + ',' + a; }
  function parseKey(k)         { return k.split(',').map(Number); }
  function analyzePixelSets() {
    const d = artCtx.getImageData(0, 0, imgW, imgH).data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const k = rgbaKey(d[i], d[i+1], d[i+2], d[i+3]);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, rgba: parseKey(key), count }));
  }

  // ---- LAB color space ----
  function srgbToLin(c) {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }
  function linToSrgb(l) {
    const c = l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(Math.max(l, 0), 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  }
  function rgbToLab(r, g, b) {
    const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
    const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
    const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
    const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;
    const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
    const f = t => t > 216 / 24389 ? Math.cbrt(t) : (t * 24389 / 27 + 16) / 116;
    const fx = f(X / Xn), fy = f(Y / Yn), fz = f(Z / Zn);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function labToRgb(L, a, b) {
    const fy = (L + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - b / 200;
    const fInv = t => {
      const t3 = t * t * t;
      return t3 > 216 / 24389 ? t3 : (116 * t - 16) * 27 / 24389;
    };
    const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
    const X = fInv(fx) * Xn, Y = fInv(fy) * Yn, Z = fInv(fz) * Zn;
    const R =  3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    const G = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
    const B =  0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    return [linToSrgb(R), linToSrgb(G), linToSrgb(B)];
  }
  function sqDist3(a, b) {
    const d0 = a[0] - b[0], d1 = a[1] - b[1], d2 = a[2] - b[2];
    return d0*d0 + d1*d1 + d2*d2;
  }

  // ---- Weighted k-means in LAB ----
  function mulberry32(seed) {
    return function() {
      let t = (seed = (seed + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function weightedPick(items, weights, rng) {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0) return items[Math.floor(rng() * items.length)];
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  function kmeansLab(points, weights, k, maxIters = 60) {
    const n = points.length;
    if (k >= n) {
      return { centroids: points.map(p => [...p]), labels: points.map((_, i) => i), inertia: 0 };
    }
    let seed = 0xC0DEFACE;
    for (const p of points) {
      seed = ((seed * 31) >>> 0) ^ ((Math.round(p[0]) + Math.round(p[1] + 128) * 257 + Math.round(p[2] + 128) * 65537) >>> 0);
    }
    const rng = mulberry32(seed ^ k);
    const centroids = [[...weightedPick(points, weights, rng)]];
    for (let c = 1; c < k; c++) {
      const dists = points.map((p, i) => {
        let m = Infinity;
        for (const cent of centroids) {
          const d = sqDist3(p, cent);
          if (d < m) m = d;
        }
        return m * weights[i];
      });
      centroids.push([...weightedPick(points, dists, rng)]);
    }
    const labels = new Array(n).fill(-1);
    for (let iter = 0; iter < maxIters; iter++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        let best = 0, bestD = Infinity;
        for (let j = 0; j < k; j++) {
          const d = sqDist3(points[i], centroids[j]);
          if (d < bestD) { bestD = d; best = j; }
        }
        if (labels[i] !== best) { labels[i] = best; changed = true; }
      }
      if (!changed && iter > 0) break;
      const sums = Array.from({ length: k }, () => [0, 0, 0]);
      const cw   = new Array(k).fill(0);
      for (let i = 0; i < n; i++) {
        const j = labels[i], w = weights[i];
        sums[j][0] += w * points[i][0];
        sums[j][1] += w * points[i][1];
        sums[j][2] += w * points[i][2];
        cw[j]      += w;
      }
      for (let j = 0; j < k; j++) {
        if (cw[j] === 0) continue;
        centroids[j] = [sums[j][0] / cw[j], sums[j][1] / cw[j], sums[j][2] / cw[j]];
      }
    }
    let inertia = 0;
    for (let i = 0; i < n; i++) inertia += weights[i] * sqDist3(points[i], centroids[labels[i]]);
    return { centroids, labels, inertia };
  }

  function quantizedColorsFor(sets, kRes, snap) {
    const colors = [];
    const assignments = new Map();
    for (let j = 0; j < kRes.centroids.length; j++) {
      const c = kRes.centroids[j];
      let color;
      if (snap) {
        let bestIdx = -1, bestD = Infinity;
        for (let i = 0; i < sets.length; i++) {
          if (kRes.labels[i] !== j) continue;
          const d = sqDist3(rgbToLab(sets[i].rgba[0], sets[i].rgba[1], sets[i].rgba[2]), c);
          if (d < bestD) { bestD = d; bestIdx = i; }
        }
        color = bestIdx >= 0 ? sets[bestIdx].rgba.slice() : null;
      } else {
        const rgb = labToRgb(c[0], c[1], c[2]);
        color = [rgb[0], rgb[1], rgb[2], 255];
      }
      colors.push(color);
    }
    for (let i = 0; i < sets.length; i++) {
      assignments.set(sets[i].key, colors[kRes.labels[i]]);
    }
    return { colors, assignments };
  }

  const userOverrides = new Map();
  let selectedK = null;
  let kmeansCache = null;

  function pixelSetsSignature(sets) {
    let h = 0xDEADBEEF;
    for (const s of sets) {
      for (let i = 0; i < s.key.length; i++) h = (h * 31 + s.key.charCodeAt(i)) >>> 0;
      h = (h * 31 + s.count) >>> 0;
    }
    return h;
  }
  function snapChecked() { return $('#kmeans-snap').checked; }
  function computeKmeansForAll(sets, snap) {
    const points = sets.map(s => rgbToLab(s.rgba[0], s.rgba[1], s.rgba[2]));
    const weights = sets.map(s => s.count);
    const totalPixels = weights.reduce((a, b) => a + b, 0) || 1;
    const maxK = Math.min(sets.length, 16);
    const perK = [];
    for (let k = 1; k <= maxK; k++) {
      const kRes = kmeansLab(points, weights, k);
      const { colors, assignments } = quantizedColorsFor(sets, kRes, snap);
      perK.push({
        k,
        kRes,
        snap,
        qColors: colors,
        assignments,
        meanErr: Math.sqrt(kRes.inertia / totalPixels),
      });
    }
    return perK;
  }
  function ensureKmeansCache() {
    const sets = analyzePixelSets();
    const sig = pixelSetsSignature(sets) ^ (snapChecked() ? 1 : 0);
    if (!kmeansCache || kmeansCache.sig !== sig) {
      kmeansCache = { sig, sets, perK: computeKmeansForAll(sets, snapChecked()) };
    }
    return kmeansCache;
  }
  function invalidateKmeansCache() { kmeansCache = null; }

  function buildMappingsFromState(sets, qColors, assignments) {
    const map = new Map();
    for (const { key, rgba } of sets) {
      let dst;
      const overrideIdx = userOverrides.get(key);
      if (overrideIdx !== undefined && overrideIdx < qColors.length && qColors[overrideIdx]) {
        dst = qColors[overrideIdx];
      } else {
        dst = assignments.get(key);
      }
      if (!dst) continue;
      if (dst[0] === rgba[0] && dst[1] === rgba[1] && dst[2] === rgba[2] && dst[3] === rgba[3]) continue;
      map.set(key, dst);
    }
    return map;
  }
  function applyMappings(mappings) {
    if (mappings.size === 0) return false;
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    pushUndo();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const k = rgbaKey(d[i], d[i+1], d[i+2], d[i+3]);
      const dst = mappings.get(k);
      if (!dst) continue;
      d[i] = dst[0]; d[i+1] = dst[1]; d[i+2] = dst[2]; d[i+3] = dst[3];
    }
    artCtx.putImageData(id, 0, 0);
    refreshPreviews();
    return true;
  }

  function currentKBucket() {
    const cache = ensureKmeansCache();
    if (cache.sets.length === 0) return null;
    const k = Math.min(selectedK ?? Math.min(cache.sets.length, 8), cache.perK.length);
    return cache.perK[k - 1];
  }

  function quantize() {
    const cache = ensureKmeansCache();
    if (cache.sets.length === 0) return;
    const bucket = currentKBucket();
    if (!bucket) return;
    const mappings = buildMappingsFromState(cache.sets, bucket.qColors, bucket.assignments);
    if (mappings.size > 0) applyMappings(mappings);
    userOverrides.clear();
    invalidateKmeansCache();
    if (isQuantPanelExpanded()) renderQuantPanel();
  }

  // ---- Color Quantization panel ----
  function isQuantPanelExpanded() {
    return !$('#quant-body').classList.contains('hidden');
  }
  function setQuantPanelExpanded(open) {
    $('#quant-body').classList.toggle('hidden', !open);
    $('#btn-quant-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { invalidateKmeansCache(); renderQuantPanel(); }
  }
  function renderQuantPanel() {
    invalidateKmeansCache();
    const cache = ensureKmeansCache();
    const sets  = cache.sets;

    const tbodyKm = $('#kmeans-table tbody');
    const tbodyPs = $('#pixel-sets-table tbody');
    tbodyKm.innerHTML = '';
    tbodyPs.innerHTML = '';
    if (sets.length === 0) {
      $('#quant-summary').textContent = '— no colors yet —';
      $('#pixel-sets-summary').textContent = '';
      $('#btn-quantize').disabled = true;
      const empty = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4; td.className = 'quant-empty';
      td.textContent = 'Paint something to see clusters.';
      empty.appendChild(td);
      tbodyKm.appendChild(empty);
      return;
    }
    $('#btn-quantize').disabled = false;

    if (selectedK === null || selectedK > cache.perK.length) {
      selectedK = Math.min(cache.perK.length, 8);
    }

    const srcSet = new Set(sets.map(s => s.key));
    const curBucket = cache.perK[selectedK - 1];
    for (const [src, idx] of userOverrides) {
      if (!srcSet.has(src) || idx >= curBucket.qColors.length) userOverrides.delete(src);
    }

    for (const bucket of cache.perK) {
      const tr = document.createElement('tr');
      tr.dataset.k = bucket.k;
      if (bucket.k === selectedK) tr.classList.add('is-selected');

      const tdPick = document.createElement('td');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'kmeans-k';
      radio.checked = bucket.k === selectedK;
      radio.addEventListener('change', () => selectK(bucket.k));
      tdPick.appendChild(radio);

      const tdK = document.createElement('td');
      tdK.textContent = String(bucket.k);

      const tdErr = document.createElement('td');
      tdErr.textContent = bucket.meanErr.toFixed(2);

      const tdColors = document.createElement('td');
      const strip = document.createElement('span');
      strip.className = 'km-colors';
      for (const c of bucket.qColors) {
        if (!c) continue;
        const dot = document.createElement('span');
        dot.className = 'qcolor';
        dot.style.background = `rgba(${c.join(',')})`;
        dot.title = `rgba(${c.join(', ')})`;
        strip.appendChild(dot);
      }
      tdColors.appendChild(strip);

      tr.appendChild(tdPick);
      tr.appendChild(tdK);
      tr.appendChild(tdErr);
      tr.appendChild(tdColors);
      tr.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') selectK(bucket.k); });
      tbodyKm.appendChild(tr);
    }

    const k = selectedK;
    $('#quant-summary').textContent =
      `${sets.length} distinct color${sets.length === 1 ? '' : 's'} · k = ${k} · mode: ${snapChecked() ? 'snap' : 'centroid'}`;
    $('#pixel-sets-summary').textContent =
      `${sets.length} distinct · k = ${k} cluster${k === 1 ? '' : 's'}`;

    const qColors = curBucket.qColors;
    const clusterIdxByKey = new Map();
    for (let i = 0; i < sets.length; i++) clusterIdxByKey.set(sets[i].key, curBucket.kRes.labels[i]);

    const qLabels = qColors.map((c, n) => {
      if (!c) return `C${n + 1}`;
      if (!snapChecked()) return `C${n + 1}`;
      const k = rgbaKey(c[0], c[1], c[2], c[3]);
      const rowIdx = sets.findIndex(s => s.key === k);
      return rowIdx >= 0 ? `#${rowIdx + 1}` : `C${n + 1}`;
    });

    sets.forEach((set, rowIdx) => {
      const { key, rgba, count } = set;
      const clusterIdx = clusterIdxByKey.get(key);
      const defaultIdx = userOverrides.get(key) ?? clusterIdx;
      const defaultColor = qColors[defaultIdx];

      const tr = document.createElement('tr');
      tr.dataset.srcKey = key;
      tr.dataset.rowIdx = rowIdx + 1;
      const isQ = qColors.some(c => c && c[0] === rgba[0] && c[1] === rgba[1] && c[2] === rgba[2] && c[3] === rgba[3]);
      if (isQ) tr.classList.add('is-quantized');

      const tdIdx = document.createElement('td');
      tdIdx.className = 'ps-index';
      tdIdx.textContent = `#${rowIdx + 1}`;

      const tdColor = document.createElement('td');
      tdColor.className = 'ps-color-cell';
      const sw = document.createElement('span');
      sw.className = 'ps-swatch';
      sw.style.setProperty('--swatch-color', `rgba(${rgba.join(',')})`);
      tdColor.appendChild(sw);

      const tdRgba = document.createElement('td');
      tdRgba.className = 'ps-rgba';
      tdRgba.textContent = `rgba(${rgba.join(', ')})`;

      const tdCount = document.createElement('td');
      tdCount.textContent = String(count);

      const tdSelect = document.createElement('td');
      const selectBtn = document.createElement('button');
      selectBtn.textContent = 'Select';
      selectBtn.title = 'Select every pixel in the image with this exact RGBA (same as the Same-color selection tool).';
      selectBtn.addEventListener('click', () => {
        selection = { mask: buildSameRgbaMask(rgba[0], rgba[1], rgba[2], rgba[3]) };
        drawSelectionFromMask();
        syncSelectionDependentUI();
      });
      tdSelect.appendChild(selectBtn);

      const tdTarget = document.createElement('td');
      const wrap = document.createElement('span');
      wrap.className = 'ps-target';
      const sel = document.createElement('select');
      qColors.forEach((c, n) => {
        if (!c) return;
        const opt = document.createElement('option');
        opt.value = String(n);
        opt.textContent = `${qLabels[n]} · rgba(${c.join(', ')})`;
        if (n === defaultIdx) opt.selected = true;
        opt.style.background = `rgba(${c.join(',')})`;
        sel.appendChild(opt);
      });
      const previewDot = document.createElement('span');
      previewDot.className = 'qcolor';
      if (defaultColor) previewDot.style.background = `rgba(${defaultColor.join(',')})`;
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.value, 10);
        if (idx === clusterIdx) userOverrides.delete(key);
        else                    userOverrides.set(key, idx);
        const c = qColors[idx];
        if (c) previewDot.style.background = `rgba(${c.join(',')})`;
      });
      wrap.appendChild(sel);
      wrap.appendChild(previewDot);
      tdTarget.appendChild(wrap);

      const tdReplace = document.createElement('td');
      const replaceBtn = document.createElement('button');
      replaceBtn.textContent = 'Replace';
      replaceBtn.title = 'Replace this pixel-set with the chosen color, immediately (undoable).';
      replaceBtn.addEventListener('click', () => {
        const idx = parseInt(sel.value, 10);
        const dst = qColors[idx];
        if (!dst) return;
        if (dst[0] === rgba[0] && dst[1] === rgba[1] && dst[2] === rgba[2] && dst[3] === rgba[3]) return;
        applyMappings(new Map([[key, dst]]));
        userOverrides.delete(key);
        renderQuantPanel();
      });
      tdReplace.appendChild(replaceBtn);

      tr.appendChild(tdIdx);
      tr.appendChild(tdColor);
      tr.appendChild(tdRgba);
      tr.appendChild(tdCount);
      tr.appendChild(tdSelect);
      tr.appendChild(tdTarget);
      tr.appendChild(tdReplace);
      tbodyPs.appendChild(tr);
    });
  }
  function selectK(k) {
    selectedK = k;
    userOverrides.clear();
    renderQuantPanel();
  }

  // ---------- Current-color UI ----------
  function setColorFromHex(hex) {
    const [r, g, b, a] = hexToRgba(hex);
    const hasAlpha = hex.replace('#', '').length >= 8;
    currentColor = [r, g, b, hasAlpha ? a : currentColor[3]];
    syncColorUI();
  }
  function syncColorUI() {
    const [r, g, b, a] = currentColor;
    $('#current-color').value = rgbToHex6(currentColor);
    $('#alpha-slider').value  = a;
    $('#alpha-number').value  = a;
    $('#current-color-preview').style.setProperty(
      '--swatch-color', `rgba(${r},${g},${b},${a/255})`);
    $('#current-color-info').textContent = `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  function setAlpha(a) {
    if (!Number.isFinite(a)) return;
    currentColor[3] = Math.max(0, Math.min(255, a | 0));
    syncColorUI();
  }

  // ---------- Hover overlay ----------
  function clearHoverOverlay() {
    hoverCtx.clearRect(0, 0, imgW, imgH);
  }

  // ---------- Selection ----------
  let selection = null;
  const SELECTION_OUTLINE_COLOR = 'rgba(60, 120, 255, 0.95)';

  function clearSelectionOverlay() {
    selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
  }
  function clearSelection() {
    selection = null;
    clearSelectionOverlay();
    syncSelectionDependentUI();
  }
  function buildRectMask(minX, minY, maxX, maxY) {
    const m = new Uint8Array(imgW * imgH);
    const x0 = Math.max(0, Math.min(imgW - 1, minX));
    const x1 = Math.max(0, Math.min(imgW - 1, maxX));
    const y0 = Math.max(0, Math.min(imgH - 1, minY));
    const y1 = Math.max(0, Math.min(imgH - 1, maxY));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        m[y * imgW + x] = 1;
    return m;
  }
  function buildRowMask(y) {
    const m = new Uint8Array(imgW * imgH);
    if (y < 0 || y >= imgH) return m;
    for (let x = 0; x < imgW; x++) m[y * imgW + x] = 1;
    return m;
  }
  function buildColumnMask(x) {
    const m = new Uint8Array(imgW * imgH);
    if (x < 0 || x >= imgW) return m;
    for (let y = 0; y < imgH; y++) m[y * imgW + x] = 1;
    return m;
  }
  function buildContiguousMask(sx, sy) {
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    const si = (sy * imgW + sx) * 4;
    const tr = d[si], tg = d[si+1], tb = d[si+2], ta = d[si+3];
    const m = new Uint8Array(imgW * imgH);
    const stack = [sx, sy];
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < 0 || y < 0 || x >= imgW || y >= imgH) continue;
      const idx = y * imgW + x;
      if (m[idx]) continue;
      const i = idx * 4;
      if (d[i] !== tr || d[i+1] !== tg || d[i+2] !== tb || d[i+3] !== ta) continue;
      m[idx] = 1;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    return m;
  }
  function buildSameColorMask(sx, sy) {
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    const si = (sy * imgW + sx) * 4;
    return buildSameRgbaMaskFromData(d, d[si], d[si+1], d[si+2], d[si+3]);
  }
  function buildSameRgbaMask(tr, tg, tb, ta) {
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    return buildSameRgbaMaskFromData(id.data, tr, tg, tb, ta);
  }
  function buildSameRgbaMaskFromData(d, tr, tg, tb, ta) {
    const m = new Uint8Array(imgW * imgH);
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const idx = y * imgW + x;
        const i = idx * 4;
        if (d[i] === tr && d[i+1] === tg && d[i+2] === tb && d[i+3] === ta) {
          m[idx] = 1;
        }
      }
    }
    return m;
  }
  // Draws a merged outline along the boundary of the selection in display
  // pixels: for each selected pixel, stroke the side(s) whose neighbour is
  // NOT selected. Line thickness scales with zoom so the outline stays
  // visible at any zoom level without obscuring the pixel colours inside.
  function drawSelectionFromMask() {
    clearSelectionOverlay();
    if (!selection) return;
    const m = selection.mask;
    if (!m || m.length !== imgW * imgH) return;
    const z = zoom;
    const thickness = Math.max(2, Math.min(6, Math.round(z / 4)));
    selectionCtx.lineWidth = thickness;
    selectionCtx.strokeStyle = SELECTION_OUTLINE_COLOR;
    selectionCtx.lineCap = 'square';
    selectionCtx.beginPath();
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        if (!m[y * imgW + x]) continue;
        const top = y > 0           ? m[(y - 1) * imgW + x] : 0;
        const bot = y < imgH - 1    ? m[(y + 1) * imgW + x] : 0;
        const lef = x > 0           ? m[y * imgW + (x - 1)] : 0;
        const rig = x < imgW - 1    ? m[y * imgW + (x + 1)] : 0;
        const px = x * z, py = y * z;
        if (!top) { selectionCtx.moveTo(px,         py); selectionCtx.lineTo(px + z, py); }
        if (!bot) { selectionCtx.moveTo(px,         py + z); selectionCtx.lineTo(px + z, py + z); }
        if (!lef) { selectionCtx.moveTo(px,         py); selectionCtx.lineTo(px,     py + z); }
        if (!rig) { selectionCtx.moveTo(px + z,     py); selectionCtx.lineTo(px + z, py + z); }
      }
    }
    selectionCtx.stroke();
  }
  function applyToSelection(fn) {
    if (!selection) return;
    pushUndo();
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    const m  = selection.mask;
    for (let idx = 0; idx < m.length; idx++) {
      if (!m[idx]) continue;
      fn(d, idx * 4);
    }
    artCtx.putImageData(id, 0, 0);
    refreshPreviews();
  }
  function deleteSelection() {
    applyToSelection((d, i) => { d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 0; });
  }
  function recolorSelection() {
    const [r, g, b, a] = currentColor;
    applyToSelection((d, i) => { d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = a; });
  }
  function syncSelectionDependentUI() {
    const has = !!selection;
    const fs = $('#btn-fill-selection');
    const cs = $('#btn-crop-selection');
    if (fs) fs.disabled = !has;
    if (cs) cs.disabled = !has;
  }

  // ---------- Alpha-as-grayscale preview ----------
  function refreshAlphaPreview() {
    const src = artCtx.getImageData(0, 0, imgW, imgH);
    const out = previewCtx.createImageData(imgW, imgH);
    for (let i = 0; i < src.data.length; i += 4) {
      const a = src.data[i + 3];
      out.data[i] = a;
      out.data[i + 1] = a;
      out.data[i + 2] = a;
      out.data[i + 3] = 255;
    }
    previewCtx.putImageData(out, 0, 0);
  }
  function setAlphaPreview(on) {
    if (on) {
      if (!distinctCanvas.classList.contains('hidden')) {
        $('#distinct-preview').checked = false;
        setDistinctPreview(false);
      }
      refreshAlphaPreview();
      previewCanvas.classList.remove('hidden');
      artCanvas.classList.add('hidden');
    } else {
      previewCanvas.classList.add('hidden');
      artCanvas.classList.remove('hidden');
    }
  }

  // ---------- Distinct-colors preview ----------
  const DISTINCT_PALETTE = [
    [255,   0,   0], [  0, 200,   0], [  0,   0, 255], [255, 220,   0],
    [255,   0, 255], [  0, 220, 220], [255, 140,   0], [140,   0, 255],
    [  0, 140, 255], [140, 255,   0], [255,   0, 140], [  0, 255, 140],
    [140,   0,   0], [  0, 100,   0], [  0,   0, 140], [140, 140,   0],
    [140,   0, 140], [  0, 140, 140], [255, 255, 255], [120, 120, 120],
    [255, 180, 200], [165,  80,  40], [200, 220, 100], [ 60,   0, 120],
  ];
  function refreshDistinctPreview() {
    const src = artCtx.getImageData(0, 0, imgW, imgH);
    const out = distinctCtx.createImageData(imgW, imgH);
    const indexByKey = new Map();
    for (let i = 0; i < src.data.length; i += 4) {
      const a = src.data[i + 3];
      if (a === 0) continue;
      const key = (src.data[i] << 24) | (src.data[i+1] << 16) | (src.data[i+2] << 8) | a;
      let idx = indexByKey.get(key);
      if (idx === undefined) {
        idx = indexByKey.size;
        indexByKey.set(key, idx);
      }
      const [pr, pg, pb] = DISTINCT_PALETTE[idx % DISTINCT_PALETTE.length];
      out.data[i] = pr;
      out.data[i + 1] = pg;
      out.data[i + 2] = pb;
      out.data[i + 3] = 255;
    }
    distinctCtx.putImageData(out, 0, 0);
  }
  function setDistinctPreview(on) {
    if (on) {
      if (!previewCanvas.classList.contains('hidden')) {
        $('#alpha-preview').checked = false;
        setAlphaPreview(false);
      }
      refreshDistinctPreview();
      distinctCanvas.classList.remove('hidden');
      artCanvas.classList.add('hidden');
    } else {
      distinctCanvas.classList.add('hidden');
      artCanvas.classList.remove('hidden');
    }
  }

  function refreshPreviews() {
    if (!previewCanvas.classList.contains('hidden')) refreshAlphaPreview();
    if (!distinctCanvas.classList.contains('hidden')) refreshDistinctPreview();
    if (isQuantPanelExpanded()) { invalidateKmeansCache(); renderQuantPanel(); }
  }

  // ---------- Status ----------
  let lastPointerPx = null;
  function updateStatus(p = lastPointerPx) {
    lastPointerPx = p;
    let s = `${imgW}×${imgH}  ·  zoom ${zoom}×`;
    if (p && inBounds(p.x, p.y)) {
      s += `  ·  (${p.x}, ${p.y})`;
      const [r, g, b, a] = artCtx.getImageData(p.x, p.y, 1, 1).data;
      s += `  ·  rgba(${r}, ${g}, ${b}, ${a})`;
    }
    $('#status').textContent = s;
  }

  // ---------- Drawing events ----------
  let activeStroke = false;
  artCanvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    artCanvas.setPointerCapture(e.pointerId);
    const p = pointerToPixel(e);
    if (!inBounds(p.x, p.y)) return;
    activeStroke = true;
    clearHoverOverlay();
    tools[currentTool].onDown?.(p, e);
  });
  artCanvas.addEventListener('pointermove', (e) => {
    const p = pointerToPixel(e);
    updateStatus(p);
    if (activeStroke) {
      tools[currentTool].onMove?.(p, e);
    } else if (inBounds(p.x, p.y)) {
      tools[currentTool].onHover?.(p, e);
    } else {
      clearHoverOverlay();
    }
  });
  artCanvas.addEventListener('pointerup', (e) => {
    if (!activeStroke) return;
    activeStroke = false;
    tools[currentTool].onUp?.(pointerToPixel(e), e);
    if (isQuantPanelExpanded()) { invalidateKmeansCache(); renderQuantPanel(); }
  });
  artCanvas.addEventListener('pointercancel', () => {
    if (!activeStroke) return;
    activeStroke = false;
    tools[currentTool].onCancel?.();
  });
  artCanvas.addEventListener('pointerleave', clearHoverOverlay);
  artCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const p = pointerToPixel(e);
    if (inBounds(p.x, p.y)) pickColor(p.x, p.y, false);
  });

  // ---------- Pulse helper ----------
  // Brief visual feedback when a keyboard shortcut activates a UI element.
  // Re-triggers cleanly on repeat keys by toggling the class off and forcing
  // a reflow before re-adding it.
  function pulse(el) {
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 500);
  }

  // ---------- Top bar wiring ----------
  $$('.tool-btn').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('#current-color').addEventListener('input', (e) => setColorFromHex(e.target.value));
  $('#alpha-slider').addEventListener('input', (e) => setAlpha(parseInt(e.target.value, 10)));
  $('#alpha-number').addEventListener('input', (e) => setAlpha(parseInt(e.target.value, 10)));
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#zoom-input').addEventListener('input', (e) => {
    const n = parseInt(e.target.value, 10);
    if (!Number.isFinite(n)) return;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, n));
    applyZoom();
  });
  $('#grid-toggle').addEventListener('change', (e) => gridOverlay.classList.toggle('hidden', !e.target.checked));
  $('#alpha-preview').addEventListener('change', (e) => setAlphaPreview(e.target.checked));
  $('#distinct-preview').addEventListener('change', (e) => setDistinctPreview(e.target.checked));
  $('#btn-save').addEventListener('click', () => saveImage($('#save-format').value));
  function syncScadOptionsVisibility() {
    const isScad = $('#save-format').value === 'scad';
    $('#scad-options').classList.toggle('hidden', !isScad);
  }
  $('#save-format').addEventListener('change', syncScadOptionsVisibility);
  syncScadOptionsVisibility();
  $('#btn-quantize').addEventListener('click', quantize);
  $('#btn-quant-toggle').addEventListener('click', () => setQuantPanelExpanded(!isQuantPanelExpanded()));
  $('#kmeans-snap').addEventListener('change', () => { invalidateKmeansCache(); if (isQuantPanelExpanded()) renderQuantPanel(); });
  $('#btn-fill-selection').addEventListener('click', () => { if (selection) recolorSelection(); });
  $('#btn-crop-selection').addEventListener('click', () => {
    if (!selection) return;
    pushUndo();
    if (!cropToSelection()) { undoStack.pop(); return; }
    clearSelection();
    fitZoom();
  });

  // ---------- Draw panel ----------
  function isDrawPanelExpanded() {
    return !$('#draw-body').classList.contains('hidden');
  }
  function setDrawPanelExpanded(open) {
    $('#draw-body').classList.toggle('hidden', !open);
    $('#btn-draw-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    renderDrawSummary();
  }
  function renderDrawSummary() {
    const sum = $('#draw-summary');
    if (!sum) return;
    if (isDrawPanelExpanded()) { sum.textContent = ''; return; }
    const [r, g, b, a] = currentColor;
    sum.textContent = `tool: ${currentTool} · rgba(${r}, ${g}, ${b}, ${a})`;
  }
  $('#btn-draw-toggle').addEventListener('click', () => setDrawPanelExpanded(!isDrawPanelExpanded()));

  // ---------- New ----------
  $('#btn-new').addEventListener('click', () => {
    $('#new-w').value = imgW;
    $('#new-h').value = imgH;
    $('#new-dialog').showModal();
  });
  $('#new-dialog').addEventListener('close', () => {
    if ($('#new-dialog').returnValue !== 'ok') return;
    const w = clampDim($('#new-w').value, 32);
    const h = clampDim($('#new-h').value, 32);
    pushUndo();
    setCanvasSize(w, h);
    fitZoom();
    refreshPreviews();
  });
  function clampDim(v, fallback) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(2048, n));
  }

  // ---------- Open / import dialog ----------
  $('#btn-open').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    let img;
    try { img = await loadImage(file); }
    catch { alert('Could not load that image.'); return; }
    openImportDialog(img);
  });

  let importImg = null;
  function openImportDialog(img) {
    importImg = img;
    $('#import-orig').textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    $('#import-w').value = img.naturalWidth;
    $('#import-h').value = img.naturalHeight;
    renderImportPreview();
    $('#import-dialog').showModal();
  }
  function renderImportPreview() {
    if (!importImg) return;
    const PREVIEW = 320;
    const img = importImg;
    const w = clampDim($('#import-w').value, img.naturalWidth);
    const h = clampDim($('#import-h').value, img.naturalHeight);
    const scale = Math.min(PREVIEW / img.naturalWidth, PREVIEW / img.naturalHeight);
    const dispW = Math.max(1, Math.round(img.naturalWidth  * scale));
    const dispH = Math.max(1, Math.round(img.naturalHeight * scale));

    const ic = $('#import-preview-img');
    ic.width  = img.naturalWidth;
    ic.height = img.naturalHeight;
    ic.style.width  = dispW + 'px';
    ic.style.height = dispH + 'px';
    const ictx = ic.getContext('2d');
    ictx.imageSmoothingEnabled = false;
    ictx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
    ictx.drawImage(img, 0, 0);

    const gc = $('#import-preview-grid');
    gc.width  = dispW;
    gc.height = dispH;
    gc.style.width  = dispW + 'px';
    gc.style.height = dispH + 'px';
    const gctx = gc.getContext('2d');
    gctx.clearRect(0, 0, dispW, dispH);
    gctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    gctx.lineWidth = 1;
    const cellW = dispW / w;
    const cellH = dispH / h;
    if (cellW >= 2 && cellH >= 2 && w * h <= 40000) {
      gctx.beginPath();
      for (let i = 1; i < w; i++) {
        const x = Math.round(i * cellW) + 0.5;
        gctx.moveTo(x, 0); gctx.lineTo(x, dispH);
      }
      for (let j = 1; j < h; j++) {
        const y = Math.round(j * cellH) + 0.5;
        gctx.moveTo(0, y); gctx.lineTo(dispW, y);
      }
      gctx.stroke();
    }
  }
  function importInputChanged(which) {
    if (!importImg) return;
    if ($('#import-keep-aspect').checked) {
      const ratio = importImg.naturalWidth / importImg.naturalHeight;
      if (which === 'w') {
        const w = clampDim($('#import-w').value, importImg.naturalWidth);
        $('#import-h').value = Math.max(1, Math.round(w / ratio));
      } else {
        const h = clampDim($('#import-h').value, importImg.naturalHeight);
        $('#import-w').value = Math.max(1, Math.round(h * ratio));
      }
    }
    renderImportPreview();
  }
  $('#import-w').addEventListener('input', () => importInputChanged('w'));
  $('#import-h').addEventListener('input', () => importInputChanged('h'));
  $('#import-keep-aspect').addEventListener('change', () => importInputChanged('w'));
  $('#import-dialog').addEventListener('close', () => {
    const dlg = $('#import-dialog');
    if (dlg.returnValue !== 'ok' || !importImg) { importImg = null; return; }
    const img = importImg;
    const w = clampDim($('#import-w').value, img.naturalWidth);
    const h = clampDim($('#import-h').value, img.naturalHeight);
    pushUndo();
    setCanvasSize(w, h);
    artCtx.imageSmoothingEnabled = false;
    artCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, w, h);
    fitZoom();
    refreshPreviews();
    if (isQuantPanelExpanded()) { invalidateKmeansCache(); renderQuantPanel(); }
    importImg = null;
  });

  // ---------- Image Resize panel ----------
  const RESIZE_GRID_COLOR = 'rgba(40, 180, 70, 0.95)';
  let resizeMode = false;

  function isResizePanelExpanded() {
    return !$('#resize-body').classList.contains('hidden');
  }
  function getResizeMode() {
    return $('#resize-mode').value === 'pixel' ? 'pixel' : 'output';
  }
  // Resolves the panel inputs into a concrete resize plan regardless of mode:
  //   w, h   — output dimensions, in pixels
  //   cw, ch — size of ONE output pixel, measured in current pixels (this is
  //            the grid cell size, and the source step the resample takes).
  // Output-size mode: user types w/h, so cw = imgW/w (usually fractional).
  // Pixel-size  mode: user types cw/ch directly (exact integer cells), so
  //                   w = ceil(imgW/cw) — the final cell may be partial.
  function getResizeParams() {
    const sx = parseInt($('#resize-shift-x').value, 10) || 0;
    const sy = parseInt($('#resize-shift-y').value, 10) || 0;
    if (getResizeMode() === 'pixel') {
      const cw = Math.max(1, clampDim($('#resize-px-w').value, 1));
      const ch = Math.max(1, clampDim($('#resize-px-h').value, 1));
      const w  = Math.max(1, Math.ceil(imgW / cw));
      const h  = Math.max(1, Math.ceil(imgH / ch));
      return { mode: 'pixel', w, h, cw, ch, sx, sy };
    }
    const w = clampDim($('#resize-w').value, imgW);
    const h = clampDim($('#resize-h').value, imgH);
    return { mode: 'output', w, h, cw: imgW / w, ch: imgH / h, sx, sy };
  }
  // The "proposed grid" is drawn on the display-resolution overlay as
  // medium-thick lines on the cell boundaries, so each block of current
  // pixels is visually grouped into the new pixel it would sample from.
  function drawResizeGrid() {
    resizeGridCtx.clearRect(0, 0, resizeGridCanvas.width, resizeGridCanvas.height);
    if (!resizeMode) return;
    const { w: newW, h: newH, cw: cellW, ch: cellH, sx: shiftX, sy: shiftY } = getResizeParams();
    const z = zoom;
    resizeGridCtx.strokeStyle = RESIZE_GRID_COLOR;
    resizeGridCtx.lineWidth = Math.max(2, Math.min(6, Math.round(z / 4)));
    resizeGridCtx.lineCap = 'square';
    resizeGridCtx.beginPath();
    const W = imgW * z, H = imgH * z;
    for (let j = 0; j <= newW; j++) {
      const xCanvas = Math.round((j * cellW + shiftX) * z);
      if (xCanvas < 0 || xCanvas > W) continue;
      resizeGridCtx.moveTo(xCanvas, 0);
      resizeGridCtx.lineTo(xCanvas, H);
    }
    for (let j = 0; j <= newH; j++) {
      const yCanvas = Math.round((j * cellH + shiftY) * z);
      if (yCanvas < 0 || yCanvas > H) continue;
      resizeGridCtx.moveTo(0,  yCanvas);
      resizeGridCtx.lineTo(W,  yCanvas);
    }
    resizeGridCtx.stroke();
  }
  function renderResizeSummary() {
    const sum = $('#resize-summary');
    const expanded = isResizePanelExpanded();
    if (!expanded) {
      sum.textContent = `${imgW}×${imgH}`;
      return;
    }
    const { mode, w, h, sx, sy } = getResizeParams();
    const noChange = w === imgW && h === imgH && sx === 0 && sy === 0;
    if (noChange) {
      sum.textContent = `${imgW}×${imgH} (no pending change)`;
      return;
    }
    const parts = [`${imgW}×${imgH} → ${w}×${h}`];
    if (mode === 'pixel') {
      parts.push(`pixel ${$('#resize-px-w').value}×${$('#resize-px-h').value}`);
    } else if ($('#resize-keep-aspect').checked) {
      parts.push('aspect locked');
    }
    if (sx !== 0 || sy !== 0) parts.push(`shift ${sx},${sy}`);
    sum.textContent = parts.join(' · ');
  }
  function syncResizeModeFields() {
    const pixel = getResizeMode() === 'pixel';
    $('#resize-output-fields').classList.toggle('hidden', pixel);
    $('#resize-pixel-fields').classList.toggle('hidden', !pixel);
  }
  function setResizePanelExpanded(open) {
    $('#resize-body').classList.toggle('hidden', !open);
    $('#btn-resize-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      // Start in output-size mode each expand, defaulting output W/H to
      // one-fifth of the current dimensions so the overlay doesn't have to
      // draw thousands of gridlines. Pixel-size fields get a sane default
      // (5) for the same reason.
      $('#resize-mode').value = 'output';
      const defaultW = Math.max(1, Math.round(imgW / 5));
      const ratio = imgW / imgH;
      const defaultH = $('#resize-keep-aspect').checked
        ? Math.max(1, Math.round(defaultW / ratio))
        : Math.max(1, Math.round(imgH / 5));
      $('#resize-w').value = defaultW;
      $('#resize-h').value = defaultH;
      $('#resize-px-w').value = 5;
      $('#resize-px-h').value = 5;
      $('#resize-shift-x').value = 0;
      $('#resize-shift-y').value = 0;
      syncResizeModeFields();
      resizeMode = true;
      drawResizeGrid();
    } else {
      resizeMode = false;
      resizeGridCtx.clearRect(0, 0, resizeGridCanvas.width, resizeGridCanvas.height);
    }
    renderResizeSummary();
  }
  function applyResize() {
    if (!resizeMode) return;
    const { w, h, cw, ch, sx, sy } = getResizeParams();
    if (w === imgW && h === imgH && sx === 0 && sy === 0) {
      setResizePanelExpanded(false);
      return;
    }
    pushUndo();
    resampleByCell(w, h, cw, ch, sx, sy);
    fitZoom();
    setResizePanelExpanded(false);
    refreshPreviews();
  }
  function exitResizeMode() { setResizePanelExpanded(false); }

  $('#btn-resize-toggle').addEventListener('click', () => setResizePanelExpanded(!isResizePanelExpanded()));
  $('#btn-resize-apply').addEventListener('click', applyResize);

  $('#resize-mode').addEventListener('change', () => {
    syncResizeModeFields();
    drawResizeGrid();
    renderResizeSummary();
  });
  $('#resize-w').addEventListener('input', () => {
    if ($('#resize-keep-aspect').checked) {
      const ratio = imgW / imgH;
      const w = clampDim($('#resize-w').value, imgW);
      $('#resize-h').value = Math.max(1, Math.round(w / ratio));
    }
    drawResizeGrid();
    renderResizeSummary();
  });
  $('#resize-h').addEventListener('input', () => {
    if ($('#resize-keep-aspect').checked) {
      const ratio = imgW / imgH;
      const h = clampDim($('#resize-h').value, imgH);
      $('#resize-w').value = Math.max(1, Math.round(h * ratio));
    }
    drawResizeGrid();
    renderResizeSummary();
  });
  const onResizeInput = () => { drawResizeGrid(); renderResizeSummary(); };
  // In pixel-size mode the "Lock aspect" checkbox keeps the resized pixel
  // square — editing one dimension mirrors it to the other.
  $('#resize-px-w').addEventListener('input', () => {
    if ($('#resize-px-keep-aspect').checked) {
      $('#resize-px-h').value = clampDim($('#resize-px-w').value, 1);
    }
    onResizeInput();
  });
  $('#resize-px-h').addEventListener('input', () => {
    if ($('#resize-px-keep-aspect').checked) {
      $('#resize-px-w').value = clampDim($('#resize-px-h').value, 1);
    }
    onResizeInput();
  });
  $('#resize-px-keep-aspect').addEventListener('change', () => {
    // Turning the lock on squares the pixel immediately (H follows W).
    if ($('#resize-px-keep-aspect').checked) {
      $('#resize-px-h').value = clampDim($('#resize-px-w').value, 1);
    }
    onResizeInput();
  });
  $('#resize-shift-x').addEventListener('input', onResizeInput);
  $('#resize-shift-y').addEventListener('input', onResizeInput);
  $('#resize-keep-aspect').addEventListener('change', renderResizeSummary);

  renderResizeSummary();

  // ---------- Crop ----------
  $('#btn-crop').addEventListener('click', () => {
    pushUndo();
    if (!cropToContent()) { undoStack.pop(); return; }
    fitZoom();
  });

  // ---------- Keyboard ----------
  function toggleCheckboxWithChange(id) {
    const cb = $(id);
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change'));
    return cb;
  }
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const k = e.key.toLowerCase();

    if ((e.metaKey || e.ctrlKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) { redo(); pulse($('#btn-redo')); }
      else            { undo(); pulse($('#btn-undo')); }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); redo(); pulse($('#btn-redo')); return; }
    if ((e.metaKey || e.ctrlKey) && k === 's') {
      e.preventDefault();
      saveImage($('#save-format').value);
      pulse($('#btn-save'));
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (k) {
      case 'p': setTool('pencil'); pulse($('[data-tool="pencil"]')); break;
      case 'e': setTool('eraser'); pulse($('[data-tool="eraser"]')); break;
      case 'f': setTool('fill');   pulse($('[data-tool="fill"]'));   break;
      case 'k': setTool('picker'); pulse($('[data-tool="picker"]')); break;
      case 'r': setTool('rect');   pulse($('[data-tool="rect"]'));   break;
      case 'l': setTool('line');   pulse($('[data-tool="line"]'));   break;
      case 's': setTool('select'); pulse($('[data-tool="select"]')); break;
      case 'z': undo(); pulse($('#btn-undo')); break;
      case 'x': redo(); pulse($('#btn-redo')); break;
      case 'y':
        $('#btn-crop').click();
        pulse($('#btn-crop'));
        break;
      case 'v':
        saveImage($('#save-format').value);
        pulse($('#btn-save'));
        break;
      case 'n':
        $('#btn-new').click();
        pulse($('#btn-new'));
        break;
      case 'o':
        $('#btn-open').click();
        pulse($('#btn-open'));
        break;
      case 'a':
        toggleCheckboxWithChange('#alpha-preview');
        pulse($('#alpha-preview').closest('label'));
        break;
      case 't':
        toggleCheckboxWithChange('#distinct-preview');
        pulse($('#distinct-preview').closest('label'));
        break;
      case 'g':
        toggleCheckboxWithChange('#grid-toggle');
        pulse($('#grid-toggle').closest('label'));
        break;
      case 'c':
        // Crop to Selection — no-op (button stays disabled) without a selection.
        if (selection) { $('#btn-crop-selection').click(); pulse($('#btn-crop-selection')); }
        break;
      case 'd':
        setDrawPanelExpanded(!isDrawPanelExpanded());
        pulse($('#btn-draw-toggle'));
        break;
      case 'q':
        setQuantPanelExpanded(!isQuantPanelExpanded());
        pulse($('#btn-quant-toggle'));
        break;
      case 'i':
        setResizePanelExpanded(!isResizePanelExpanded());
        pulse($('#btn-resize-toggle'));
        break;
      case ',':
        setThickness(getThickness() - 1);
        pulse($('#shape-thickness'));
        break;
      case '.':
        setThickness(getThickness() + 1);
        pulse($('#shape-thickness'));
        break;
      case 'delete': case 'backspace':
        if (selection) { deleteSelection(); e.preventDefault(); }
        break;
      case 'enter':
        if (selection) { recolorSelection(); pulse($('#btn-fill-selection')); e.preventDefault(); }
        break;
      case 'escape':
        activeStroke = false;
        tools[currentTool]?.onCancel?.();
        clearSelection();
        if (resizeMode) exitResizeMode();
        break;
      case '=': case '+':
        zoom = Math.min(MAX_ZOOM, zoom + 1); applyZoom();
        pulse($('#zoom-input'));
        break;
      case '-': case '_':
        zoom = Math.max(MIN_ZOOM, zoom - 1); applyZoom();
        pulse($('#zoom-input'));
        break;
    }
  });

  // ---------- Init ----------
  syncColorUI();
  setCanvasSize(32, 32);
  setTool('pencil');
  fitZoom();
  updateStatus();
  syncSelectionDependentUI();

  // Default startup image — load asynchronously so the app is interactive
  // immediately. Skipped when the app is hosted inside an iframe (the test
  // harness loads it that way and expects a blank canvas to start).
  function inIframe() {
    try { return window.self !== window.top; }
    catch (_) { return true; }
  }
  if (!inIframe()) {
    loadImageFromUrl('assets/clawde-screenshot-2.png')
      .then((img) => {
        const w = img.naturalWidth, h = img.naturalHeight;
        setCanvasSize(w, h);
        artCtx.imageSmoothingEnabled = false;
        artCtx.drawImage(img, 0, 0);
        fitZoom();
        refreshPreviews();
      })
      .catch(() => {
        // Silent fallback: an empty 32×32 canvas is fine if the asset is
        // missing or blocked.
      });
  }
})();
