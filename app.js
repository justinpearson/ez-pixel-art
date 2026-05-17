'use strict';

(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- DOM ----------
  const artCanvas     = $('#art');
  const artCtx        = artCanvas.getContext('2d', { willReadFrequently: true });
  const previewCanvas = $('#art-alpha-preview');
  const previewCtx    = previewCanvas.getContext('2d');
  const hoverCanvas   = $('#hover-overlay');
  const hoverCtx      = hoverCanvas.getContext('2d');
  const selectionCanvas = $('#selection-overlay');
  const selectionCtx    = selectionCanvas.getContext('2d');
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

  const DEFAULT_PALETTE = [
    '#000000', '#1d2b53', '#7e2553', '#008751',
    '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300', '#ffec27', '#00e436',
    '#29adff', '#83769c', '#ff77a8', '#ffccaa',
  ];
  let palette = DEFAULT_PALETTE.map(h => h + 'ff');

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
  function rgbaToHex([r, g, b, a]) {
    const h = n => n.toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b) + h(a);
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
    hoverCanvas.width    = w;
    hoverCanvas.height   = h;
    selectionCanvas.width  = w;
    selectionCanvas.height = h;
    artCtx.imageSmoothingEnabled = false;
    applyZoom();
  }
  function applyZoom() {
    const cssW = imgW * zoom;
    const cssH = imgH * zoom;
    artCanvas.style.width  = cssW + 'px';
    artCanvas.style.height = cssH + 'px';
    previewCanvas.style.width  = cssW + 'px';
    previewCanvas.style.height = cssH + 'px';
    hoverCanvas.style.width    = cssW + 'px';
    hoverCanvas.style.height   = cssH + 'px';
    selectionCanvas.style.width  = cssW + 'px';
    selectionCanvas.style.height = cssH + 'px';
    stage.style.width      = cssW + 'px';
    stage.style.height     = cssH + 'px';
    gridOverlay.style.setProperty('--cell', zoom + 'px');
    $('#zoom-label').textContent = zoom + '×';
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
  // putImageData writes the exact RGBA we want; fillStyle+fillRect would
  // round-trip through pre-multiplied alpha and lose precision at mid alphas.
  // ctx/rgba default to the main canvas and the user's current color, so the
  // overwhelming majority of callsites stay one-liners. The hover preview
  // overrides both to draw into the overlay with its own marker color.
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
  // Stamps a `size`×`size` square centred on (cx, cy). paintPixel handles
  // out-of-bounds clipping so brushes near canvas edges just lose pixels.
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
  // Each tool owns its drag state and exposes pointer lifecycle hooks.
  // The canvas event handlers in "Drawing events" delegate to tools[currentTool].
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
      // Hover preview: draws the about-to-paint pixels on #hover-overlay.
      // For Erase (α=0) we'd otherwise stamp nothing — substitute a contrasting
      // marker so the user can see where the cursor will erase.
      onHover(p) {
        clearHoverOverlay();
        const rgba = currentColor[3] === 0
          ? [128, 128, 128, 180]   // erase marker
          : currentColor;
        stamp(p.x, p.y, getThickness(), hoverCtx, rgba);
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
        // Starting a new drag abandons any prior committed selection.
        this.start = p;
        selection = null;
        clearSelectionOverlay();
      },
      onMove(p) {
        if (!this.start) return;
        const minX = Math.min(this.start.x, p.x), maxX = Math.max(this.start.x, p.x);
        const minY = Math.min(this.start.y, p.y), maxY = Math.max(this.start.y, p.y);
        clearSelectionOverlay();
        drawSelectionOutline(minX, minY, maxX, maxY);
      },
      onUp(p) {
        if (!this.start) return;
        const minX = Math.min(this.start.x, p.x), maxX = Math.max(this.start.x, p.x);
        const minY = Math.min(this.start.y, p.y), maxY = Math.max(this.start.y, p.y);
        selection = { minX, minY, maxX, maxY };
        clearSelectionOverlay();
        drawSelectionOutline(minX, minY, maxX, maxY);
        this.start = null;
      },
      onCancel() {
        // Abandons an in-progress drag. The committed selection (if any) is
        // dismissed by the global Esc handler, not here, so cancelling a drag
        // doesn't accidentally wipe a prior selection the user is keeping.
        if (this.start) {
          this.start = null;
          clearSelectionOverlay();
          if (selection) drawSelectionOutline(
            selection.minX, selection.minY, selection.maxX, selection.maxY);
        }
      },
    },
  };

  function setTool(name) {
    if (currentTool !== name) tools[currentTool]?.onDeactivate?.();
    currentTool = name;
    tools[name]?.onActivate?.();
    // .tool-btn lives in both #tools and #color-section (Pick was moved next
    // to the palette per prompt-2 item 17), so the active toggle is global.
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
    if (!previewCanvas.classList.contains('hidden')) refreshAlphaPreview();
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
    updateStatus();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    updateStatus();
  }

  // ---------- Resize & crop ----------
  function resizeImage(newW, newH) {
    const tmp = document.createElement('canvas');
    tmp.width = imgW; tmp.height = imgH;
    tmp.getContext('2d').drawImage(artCanvas, 0, 0);
    setCanvasSize(newW, newH);
    artCtx.imageSmoothingEnabled = false;
    artCtx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, newW, newH);
  }
  function cropToContent() {
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    let minX = imgW, minY = imgH, maxX = -1, maxY = -1;
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        if (d[(y * imgW + x) * 4 + 3] !== 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
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
  function extractPalette(imageData, maxColors = 32) {
    const d = imageData.data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const key = ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) >>> 0;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([key]) => rgbaToHex([(key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff, 255]));
  }

  // Squash the image to the top `maxColors` most-common RGBA tuples; every
  // other non-transparent pixel is remapped to the nearest survivor in
  // Euclidean RGBA distance. Transparent pixels are left alone. The palette
  // is replaced with the kept colors.
  function quantize(maxColors) {
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const key = `${d[i]},${d[i+1]},${d[i+2]},${d[i+3]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (counts.size === 0) return;
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([key]) => key.split(',').map(Number));
    pushUndo();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      let best = top[0], bestDist = Infinity;
      for (const c of top) {
        const dr = c[0] - d[i], dg = c[1] - d[i+1], db = c[2] - d[i+2], da = c[3] - d[i+3];
        const dist = dr*dr + dg*dg + db*db + da*da;
        if (dist < bestDist) { bestDist = dist; best = c; }
      }
      d[i] = best[0]; d[i+1] = best[1]; d[i+2] = best[2]; d[i+3] = best[3];
    }
    artCtx.putImageData(id, 0, 0);
    palette = top.map(rgbaToHex);
    renderPalette();
    if (!previewCanvas.classList.contains('hidden')) refreshAlphaPreview();
  }
  function getQuantizeN() {
    const n = parseInt($('#quantize-n').value, 10);
    return Math.max(1, Math.min(64, Number.isFinite(n) ? n : 16));
  }

  // ---------- Palette UI ----------
  function renderPalette() {
    const el = $('#palette');
    el.innerHTML = '';
    palette.forEach((hex, i) => {
      const [r, g, b, a] = hexToRgba(hex);
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'swatch';
      sw.style.setProperty('--swatch-color', `rgba(${r},${g},${b},${a/255})`);
      sw.title = hex + '  (right-click to remove)';
      sw.addEventListener('click', () => setColorFromHex(hex));
      sw.addEventListener('contextmenu', e => {
        e.preventDefault();
        palette.splice(i, 1);
        renderPalette();
      });
      el.appendChild(sw);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'swatch add-swatch';
    add.textContent = '+';
    add.title = 'Add current color to palette';
    add.addEventListener('click', () => {
      const hex = rgbaToHex(currentColor);
      if (!palette.includes(hex)) { palette.push(hex); renderPalette(); }
    });
    el.appendChild(add);
  }
  function setColorFromHex(hex) {
    const [r, g, b, a] = hexToRgba(hex);
    // hex-6/3 carries no alpha — preserve the user's current alpha.
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
  function eraseMode() {
    currentColor[3] = 0;
    syncColorUI();
    setTool('pencil');
  }

  // ---------- Hover overlay ----------
  function clearHoverOverlay() {
    hoverCtx.clearRect(0, 0, imgW, imgH);
  }

  // ---------- Selection ----------
  // selection is global (persists across tool switches) so the user can make
  // a selection then switch to Pencil etc. without losing it. Esc dismisses.
  let selection = null;  // null or { minX, minY, maxX, maxY }
  const SELECTION_COLOR = [80, 140, 240, 220];

  function clearSelectionOverlay() {
    selectionCtx.clearRect(0, 0, imgW, imgH);
  }
  function clearSelection() {
    selection = null;
    clearSelectionOverlay();
  }
  function drawSelectionOutline(minX, minY, maxX, maxY) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x === minX || x === maxX || y === minY || y === maxY) {
          paintPixel(x, y, selectionCtx, SELECTION_COLOR);
        }
      }
    }
  }
  function deleteSelection() {
    if (!selection) return;
    pushUndo();
    const id = artCtx.getImageData(0, 0, imgW, imgH);
    const d  = id.data;
    for (let y = selection.minY; y <= selection.maxY; y++) {
      for (let x = selection.minX; x <= selection.maxX; x++) {
        const i = (y * imgW + x) * 4;
        d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
      }
    }
    artCtx.putImageData(id, 0, 0);
    if (!previewCanvas.classList.contains('hidden')) refreshAlphaPreview();
  }

  // ---------- Alpha-as-grayscale preview ----------
  // Photoshop convention: white = opaque, black = transparent.
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
      refreshAlphaPreview();
      previewCanvas.classList.remove('hidden');
      artCanvas.classList.add('hidden');
    } else {
      previewCanvas.classList.add('hidden');
      artCanvas.classList.remove('hidden');
    }
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
  // Thin dispatcher: pointer lifecycle is forwarded to the current tool.
  // Right-click pick stays a global behaviour, not tool-routed.
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

  // ---------- Top bar wiring ----------
  $$('.tool-btn').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('#current-color').addEventListener('input', (e) => setColorFromHex(e.target.value));
  $('#alpha-slider').addEventListener('input', (e) => setAlpha(parseInt(e.target.value, 10)));
  $('#alpha-number').addEventListener('input', (e) => setAlpha(parseInt(e.target.value, 10)));
  $('#btn-eraser').addEventListener('click', eraseMode);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#btn-zoom-in') .addEventListener('click', () => { zoom = Math.min(MAX_ZOOM, zoom + 1); applyZoom(); });
  $('#btn-zoom-out').addEventListener('click', () => { zoom = Math.max(MIN_ZOOM, zoom - 1); applyZoom(); });
  $('#grid-toggle').addEventListener('change', (e) => gridOverlay.classList.toggle('hidden', !e.target.checked));
  $('#alpha-preview').addEventListener('change', (e) => setAlphaPreview(e.target.checked));
  $('#btn-save').addEventListener('click', () => saveImage($('#save-format').value));
  $('#btn-quantize').addEventListener('click', () => quantize(getQuantizeN()));

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
    if ($('#import-extract-palette').checked) {
      const extracted = extractPalette(artCtx.getImageData(0, 0, w, h), 32);
      if (extracted.length) { palette = extracted; renderPalette(); }
    }
    fitZoom();
    importImg = null;
  });

  // ---------- Resize dialog ----------
  $('#btn-resize').addEventListener('click', () => {
    $('#resize-w').value = imgW;
    $('#resize-h').value = imgH;
    $('#resize-dialog').showModal();
  });
  $('#resize-w').addEventListener('input', () => {
    if (!$('#resize-keep-aspect').checked) return;
    const ratio = imgW / imgH;
    const w = clampDim($('#resize-w').value, imgW);
    $('#resize-h').value = Math.max(1, Math.round(w / ratio));
  });
  $('#resize-h').addEventListener('input', () => {
    if (!$('#resize-keep-aspect').checked) return;
    const ratio = imgW / imgH;
    const h = clampDim($('#resize-h').value, imgH);
    $('#resize-w').value = Math.max(1, Math.round(h * ratio));
  });
  $('#resize-dialog').addEventListener('close', () => {
    if ($('#resize-dialog').returnValue !== 'ok') return;
    const w = clampDim($('#resize-w').value, imgW);
    const h = clampDim($('#resize-h').value, imgH);
    if (w === imgW && h === imgH) return;
    pushUndo();
    resizeImage(w, h);
    fitZoom();
  });

  // ---------- Crop ----------
  $('#btn-crop').addEventListener('click', () => {
    pushUndo();
    if (!cropToContent()) { undoStack.pop(); return; }
    fitZoom();
  });

  // ---------- Keyboard ----------
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (k) {
      case 'p': setTool('pencil'); break;
      case 'e': eraseMode();       break;
      case 'f': setTool('fill');   break;
      case 'i': setTool('picker'); break;
      case 'r': setTool('rect');   break;
      case 'l': setTool('line');   break;
      case 's': setTool('select'); break;
      case 'u': undo();            break;
      case 'delete': case 'backspace':
        if (selection) { deleteSelection(); e.preventDefault(); }
        break;
      case 'escape':
        activeStroke = false;
        tools[currentTool]?.onCancel?.();
        clearSelection();
        break;
      case '=': case '+':
        zoom = Math.min(MAX_ZOOM, zoom + 1); applyZoom(); break;
      case '-': case '_':
        zoom = Math.max(MIN_ZOOM, zoom - 1); applyZoom(); break;
      case 'g': {
        const cb = $('#grid-toggle');
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
        break;
      }
    }
  });

  // ---------- Init ----------
  syncColorUI();
  renderPalette();
  setCanvasSize(32, 32);
  setTool('pencil');
  fitZoom();
  updateStatus();
})();
