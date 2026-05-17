'use strict';

(() => {
  const ORANGE       = [203, 110, 74, 255];
  const ORANGE_128   = [203, 110, 74, 128];
  const TRANSPARENT  = [0, 0, 0, 0];

  window.scenarios = [
    {
      label: '01-initial',
      description: 'Fresh reload — defaults check (α=255, pencil, 16-swatch palette, empty canvas).',
      run: async () => {},
      assertions: (app) => [
        ['α slider',                  app.q('#alpha-slider').value,                                '255'],
        ['α number',                  app.q('#alpha-number').value,                                '255'],
        ['color picker',              app.q('#current-color').value,                               '#cb6e4a'],
        ['active tool',               app.q('#tools .tool-btn.active').dataset.tool,               'pencil'],
        ['palette size',              app.qa('#palette .swatch:not(.add-swatch)').length,          16],
        ['canvas cursor',             app.canvas.style.cursor,                                     'cell'],
        ['canvas width',              app.canvas.width,                                            32],
        ['canvas height',             app.canvas.height,                                           32],
        ['pixel (0,0) transparent',   app.pix(0, 0),                                               TRANSPARENT],
      ],
    },

    {
      label: '02-pencil-stroke',
      description: 'Drag (4,4) → (7,7) at α=255 paints a Bresenham diagonal.',
      chain: true,
      run: async (app) => { app.drag(4, 4, 7, 7); },
      assertions: (app) => [
        ['pixel (4,4)',                  app.pix(4, 4),   ORANGE],
        ['pixel (5,5)',                  app.pix(5, 5),   ORANGE],
        ['pixel (6,6)',                  app.pix(6, 6),   ORANGE],
        ['pixel (7,7)',                  app.pix(7, 7),   ORANGE],
        ['pixel (10,10) untouched',      app.pix(10, 10), TRANSPARENT],
      ],
    },

    {
      label: '03-translucent-paint',
      description: 'α slider to 128, click (10,5) — exact RGBA stored.',
      chain: true,
      run: async (app) => { app.setAlpha(128); app.click(10, 5); },
      assertions: (app) => [
        ['α slider',                  app.q('#alpha-slider').value,  '128'],
        ['pixel (10,5)',              app.pix(10, 5),                ORANGE_128],
      ],
    },

    {
      label: '04-fill',
      description: 'Switch to fill, click (20,20) — every transparent pixel becomes [203,110,74,128].',
      chain: true,
      run: async (app) => {
        app.q('[data-tool="fill"]').click();
        app.click(20, 20);
        app.q('[data-tool="pencil"]').click();
      },
      assertions: (app) => [
        ['pixel (0,0) filled',           app.pix(0, 0),                                  ORANGE_128],
        ['pixel (20,20) filled',         app.pix(20, 20),                                ORANGE_128],
        ['pixel (5,5) stroke preserved', app.pix(5, 5),                                  ORANGE],
        ['pixel (10,5) translucent kept',app.pix(10, 5),                                 ORANGE_128],
        ['active tool back to pencil',   app.q('#tools .tool-btn.active').dataset.tool,  'pencil'],
      ],
    },

    {
      label: '05-erase-button',
      description: 'Click Erase, click (4,4) — punches a transparent hole; tool stays pencil.',
      chain: true,
      run: async (app) => { app.pressErase(); app.click(4, 4); },
      assertions: (app) => [
        ['α slider',                 app.q('#alpha-slider').value,                  '0'],
        ['active tool',              app.q('#tools .tool-btn.active').dataset.tool, 'pencil'],
        ['pixel (4,4) erased',       app.pix(4, 4),                                 TRANSPARENT],
        ['pixel (5,5) still opaque', app.pix(5, 5),                                 ORANGE],
      ],
    },

    {
      label: '06-keyboard-e',
      description: 'α=255 + paint (12,12), then keyboard E, then click (12,12) — pixel erased.',
      chain: true,
      run: async (app) => {
        app.setAlpha(255);
        app.click(12, 12);
        app.keyboard('e');
        app.click(12, 12);
      },
      assertions: (app) => [
        ['α slider after E',        app.q('#alpha-slider').value,                  '0'],
        ['active tool',             app.q('#tools .tool-btn.active').dataset.tool, 'pencil'],
        ['pixel (12,12) erased',    app.pix(12, 12),                               TRANSPARENT],
      ],
    },

    {
      label: '07-picker-opaque',
      description: 'Right-click (5,5) — picks opaque pixel; α=255, tool unchanged.',
      chain: true,
      run: async (app) => { app.rightClick(5, 5); },
      assertions: (app) => [
        ['α slider',                 app.q('#alpha-slider').value,                  '255'],
        ['color picker',             app.q('#current-color').value,                 '#cb6e4a'],
        ['active tool (unchanged)',  app.q('#tools .tool-btn.active').dataset.tool, 'pencil'],
      ],
    },

    {
      label: '08-picker-translucent',
      description: 'Right-click (20,20) — picks translucent fill; α=128.',
      chain: true,
      run: async (app) => { app.rightClick(20, 20); },
      assertions: (app) => [
        ['α slider',                 app.q('#alpha-slider').value,    '128'],
        ['color picker (RGB only)',  app.q('#current-color').value,   '#cb6e4a'],
      ],
    },

    {
      label: '09-palette-add',
      description: 'Click + — new swatch hex ends in 80 (=128); palette grows to 17.',
      chain: true,
      run: async (app) => { app.q('#palette .add-swatch').click(); },
      assertions: (app) => {
        const swatches = app.qa('#palette .swatch:not(.add-swatch)');
        const last = swatches[swatches.length - 1];
        return [
          ['palette size',         swatches.length,  17],
          ['last swatch title',    last.title,       '#cb6e4a80  (right-click to remove)'],
        ];
      },
    },

    {
      label: '10-undo',
      description: 'Undo most recent canvas edit — (12,12) goes back to opaque orange.',
      chain: true,
      run: async (app) => { app.pressUndo(); },
      assertions: (app) => [
        ['pixel (12,12) restored',   app.pix(12, 12),   ORANGE],
      ],
    },

    {
      label: '11-redo',
      description: 'Redo — (12,12) goes back to transparent.',
      chain: true,
      run: async (app) => { app.pressRedo(); },
      assertions: (app) => [
        ['pixel (12,12) re-erased',  app.pix(12, 12),   TRANSPARENT],
      ],
    },

    {
      label: '12-alpha-preview-on',
      description: 'Paint a mixed-alpha canvas, toggle α preview ON — grayscale mask matches.',
      run: async (app) => {
        app.click(4, 4);          // opaque at default α=255
        app.setAlpha(128);
        app.click(10, 10);        // translucent
        app.toggleAlphaPreview();
      },
      assertions: (app) => [
        ['art hidden',                       app.canvas.classList.contains('hidden'),                       true],
        ['preview visible',                  !app.q('#art-alpha-preview').classList.contains('hidden'),     true],
        ['preview (4,4) white (α=255)',      app.previewPix(4, 4),                                          [255, 255, 255, 255]],
        ['preview (10,10) gray (α=128)',     app.previewPix(10, 10),                                        [128, 128, 128, 255]],
        ['preview (0,0) black (α=0)',        app.previewPix(0, 0),                                          [0, 0, 0, 255]],
      ],
    },

    {
      label: '13-alpha-preview-off',
      description: 'Toggle α preview OFF — normal view returns.',
      chain: true,
      run: async (app) => { app.toggleAlphaPreview(); },
      assertions: (app) => [
        ['art visible',           !app.canvas.classList.contains('hidden'),                       true],
        ['preview hidden',        app.q('#art-alpha-preview').classList.contains('hidden'),       true],
      ],
    },

    {
      label: '14-cursor',
      description: 'setTool uses tool-defined cursor: Picker → crosshair, Pencil → cell.',
      run: async (app) => {
        app.q('[data-tool="picker"]').click();
        const picker = app.canvas.style.cursor;
        app.q('[data-tool="pencil"]').click();
        const pencil = app.canvas.style.cursor;
        return { picker, pencil };
      },
      assertions: (_app, ctx) => [
        ['cursor after Picker',   ctx.picker,  'crosshair'],
        ['cursor after Pencil',   ctx.pencil,  'cell'],
      ],
    },

    {
      label: '15-escape',
      description: 'Dispatch Escape — no-op for current tools, must not throw. New keybinding wired for future rect/line/selection.',
      run: async (app) => { app.keyboard('Escape'); },
      assertions: (app) => [
        ['app still responds',   !!app.q('#alpha-slider'),                       true],
        ['tool still pencil',    app.q('#tools .tool-btn.active').dataset.tool,  'pencil'],
      ],
    },

    // ===== prompt-2 item 21: Rectangle + Line tools (TDD) =====

    {
      label: '16-rect-tool-button',
      description: 'Rect tool button exists; clicking switches tool to rect and sets cursor=crosshair.',
      run: async (app) => { app.q('[data-tool="rect"]').click(); },
      assertions: (app) => [
        ['active tool', app.q('#tools .tool-btn.active').dataset.tool, 'rect'],
        ['cursor',      app.canvas.style.cursor,                       'crosshair'],
      ],
    },

    {
      label: '17-line-tool-button',
      description: 'Line tool button exists; clicking switches tool to line and sets cursor=crosshair.',
      run: async (app) => { app.q('[data-tool="line"]').click(); },
      assertions: (app) => [
        ['active tool', app.q('#tools .tool-btn.active').dataset.tool, 'line'],
        ['cursor',      app.canvas.style.cursor,                       'crosshair'],
      ],
    },

    {
      label: '18-keyboard-r-l',
      description: 'Keyboard R selects rect; L selects line.',
      run: async (app) => {
        app.keyboard('r');
        const afterR = app.q('#tools .tool-btn.active').dataset.tool;
        app.keyboard('l');
        const afterL = app.q('#tools .tool-btn.active').dataset.tool;
        return { afterR, afterL };
      },
      assertions: (_app, ctx) => [
        ['after R', ctx.afterR, 'rect'],
        ['after L', ctx.afterL, 'line'],
      ],
    },

    {
      label: '19-rect-filled',
      description: 'Drag (4,4) → (8,8) with Filled checked → 25-pixel solid block; neighbours untouched.',
      run: async (app) => {
        app.q('[data-tool="rect"]').click();
        app.setFilled(true);
        app.setThickness(1);
        app.drag(4, 4, 8, 8);
      },
      assertions: (app) => [
        ['corner (4,4)',      app.pix(4, 4),  ORANGE],
        ['interior (6,6)',    app.pix(6, 6),  ORANGE],
        ['corner (8,8)',      app.pix(8, 8),  ORANGE],
        ['outside (3,3)',     app.pix(3, 3),  TRANSPARENT],
        ['outside (9,9)',     app.pix(9, 9),  TRANSPARENT],
      ],
    },

    {
      label: '20-rect-outline-thickness-1',
      description: 'Drag (4,4) → (8,8) outline thickness=1 → border painted, interior transparent.',
      run: async (app) => {
        app.q('[data-tool="rect"]').click();
        app.setFilled(false);
        app.setThickness(1);
        app.drag(4, 4, 8, 8);
      },
      assertions: (app) => [
        ['top-left (4,4)',           app.pix(4, 4),   ORANGE],
        ['top-right (8,4)',          app.pix(8, 4),   ORANGE],
        ['bottom-left (4,8)',        app.pix(4, 8),   ORANGE],
        ['bottom-right (8,8)',       app.pix(8, 8),   ORANGE],
        ['mid-top (6,4)',            app.pix(6, 4),   ORANGE],
        ['mid-right (8,6)',          app.pix(8, 6),   ORANGE],
        ['interior (5,5) clear',     app.pix(5, 5),   TRANSPARENT],
        ['interior (6,6) clear',     app.pix(6, 6),   TRANSPARENT],
        ['interior (7,7) clear',     app.pix(7, 7),   TRANSPARENT],
      ],
    },

    {
      label: '21-rect-outline-thickness-2',
      description: 'Outline thickness=2 on a 5×5 rect → 2-pixel border; only (6,6) interior is clear.',
      run: async (app) => {
        app.q('[data-tool="rect"]').click();
        app.setFilled(false);
        app.setThickness(2);
        app.drag(4, 4, 8, 8);
      },
      assertions: (app) => [
        ['outer (4,4)',              app.pix(4, 4),   ORANGE],
        ['inner-border (5,5)',       app.pix(5, 5),   ORANGE],
        ['outer (8,8)',              app.pix(8, 8),   ORANGE],
        ['inner-border (5,7)',       app.pix(5, 7),   ORANGE],
        ['only interior (6,6)',      app.pix(6, 6),   TRANSPARENT],
      ],
    },

    {
      label: '22-rect-preview-during-drag',
      description: 'During drag the preview shows; extending changes the preview; release commits the final shape.',
      run: async (app) => {
        app.q('[data-tool="rect"]').click();
        app.setFilled(true);
        app.setThickness(1);
        app.pointerDown(4, 4);
        app.pointerMove(6, 6);
        const midDrag = { p55: app.pix(5, 5), p77: app.pix(7, 7) };
        app.pointerMove(8, 8);
        const extended = { p55: app.pix(5, 5), p77: app.pix(7, 7) };
        app.pointerUp(8, 8);
        const committed = { p77: app.pix(7, 7), p88: app.pix(8, 8) };
        return { midDrag, extended, committed };
      },
      assertions: (_app, ctx) => [
        ['mid-drag (5,5) painted',         ctx.midDrag.p55,    ORANGE],
        ['mid-drag (7,7) NOT yet painted', ctx.midDrag.p77,    TRANSPARENT],
        ['extended (5,5) still painted',   ctx.extended.p55,   ORANGE],
        ['extended (7,7) now painted',     ctx.extended.p77,   ORANGE],
        ['committed (7,7) preserved',      ctx.committed.p77,  ORANGE],
        ['committed (8,8) painted',        ctx.committed.p88,  ORANGE],
      ],
    },

    {
      label: '23-rect-esc-cancel',
      description: 'Esc mid-drag restores canvas; pointerup commits nothing.',
      run: async (app) => {
        app.q('[data-tool="rect"]').click();
        app.setFilled(true);
        app.pointerDown(4, 4);
        app.pointerMove(8, 8);
        app.keyboard('Escape');
        app.pointerUp(8, 8);
      },
      assertions: (app) => [
        ['(5,5) clear', app.pix(5, 5), TRANSPARENT],
        ['(8,8) clear', app.pix(8, 8), TRANSPARENT],
      ],
    },

    {
      label: '24-line-horizontal',
      description: 'Drag (4,4) → (10,4) thickness=1 → 7 pixels along row 4.',
      run: async (app) => {
        app.q('[data-tool="line"]').click();
        app.setThickness(1);
        app.drag(4, 4, 10, 4);
      },
      assertions: (app) => [
        ['start (4,4)',         app.pix(4, 4),   ORANGE],
        ['mid (7,4)',           app.pix(7, 4),   ORANGE],
        ['end (10,4)',          app.pix(10, 4),  ORANGE],
        ['off-line (4,5)',      app.pix(4, 5),   TRANSPARENT],
        ['off-line (10,5)',     app.pix(10, 5),  TRANSPARENT],
      ],
    },

    {
      label: '25-line-diagonal',
      description: 'Drag (4,4) → (10,10) → Bresenham diagonal.',
      run: async (app) => {
        app.q('[data-tool="line"]').click();
        app.setThickness(1);
        app.drag(4, 4, 10, 10);
      },
      assertions: (app) => [
        ['(4,4)',               app.pix(4, 4),   ORANGE],
        ['(7,7)',               app.pix(7, 7),   ORANGE],
        ['(10,10)',             app.pix(10, 10), ORANGE],
        ['off-diagonal (4,5)',  app.pix(4, 5),   TRANSPARENT],
      ],
    },

    {
      label: '26-line-thick',
      description: 'Horizontal drag at thickness=3 → 3-pixel-wide band centred on row 4.',
      run: async (app) => {
        app.q('[data-tool="line"]').click();
        app.setThickness(3);
        app.drag(4, 4, 10, 4);
      },
      assertions: (app) => [
        ['centre (7,4)',        app.pix(7, 4),   ORANGE],
        ['above (7,3)',         app.pix(7, 3),   ORANGE],
        ['below (7,5)',         app.pix(7, 5),   ORANGE],
        ['two-below (7,6)',     app.pix(7, 6),   TRANSPARENT],
      ],
    },

    {
      label: '27-line-esc-cancel',
      description: 'Esc mid-drag for line tool — canvas unchanged.',
      run: async (app) => {
        app.q('[data-tool="line"]').click();
        app.setThickness(1);
        app.pointerDown(4, 4);
        app.pointerMove(10, 10);
        app.keyboard('Escape');
        app.pointerUp(10, 10);
      },
      assertions: (app) => [
        ['(4,4) clear', app.pix(4, 4),   TRANSPARENT],
        ['(7,7) clear', app.pix(7, 7),   TRANSPARENT],
      ],
    },

    {
      label: '28-rect-undo-redo',
      description: 'Filled rect → undo restores empty canvas → redo brings rect back.',
      run: async (app) => {
        app.q('[data-tool="rect"]').click();
        app.setFilled(true);
        app.setThickness(1);
        app.drag(4, 4, 8, 8);
        const drawn = app.pix(6, 6);
        app.pressUndo();
        const undone = app.pix(6, 6);
        app.pressRedo();
        const redone = app.pix(6, 6);
        return { drawn, undone, redone };
      },
      assertions: (_app, ctx) => [
        ['after draw',  ctx.drawn,   ORANGE],
        ['after undo',  ctx.undone,  TRANSPARENT],
        ['after redo',  ctx.redone,  ORANGE],
      ],
    },

    // ===== prompt-2 item 11: Adjustable pencil size (TDD) =====

    {
      label: '29-pencil-size-1-default',
      description: 'Pencil at thickness=1 — single pixel at click point (regression: prior behaviour preserved).',
      run: async (app) => {
        app.setThickness(1);
        app.click(15, 15);
      },
      assertions: (app) => [
        ['(15,15) painted',  app.pix(15, 15), ORANGE],
        ['(14,15) clear',    app.pix(14, 15), TRANSPARENT],
        ['(16,15) clear',    app.pix(16, 15), TRANSPARENT],
      ],
    },

    {
      label: '30-pencil-size-3-single-click',
      description: 'Pencil at thickness=3, single click at (10,10) → 3×3 block centred on (10,10).',
      run: async (app) => {
        app.setThickness(3);
        app.click(10, 10);
      },
      assertions: (app) => [
        ['centre (10,10)',         app.pix(10, 10), ORANGE],
        ['NW (9,9)',               app.pix(9, 9),   ORANGE],
        ['NE (11,9)',              app.pix(11, 9),  ORANGE],
        ['SW (9,11)',              app.pix(9, 11),  ORANGE],
        ['SE (11,11)',             app.pix(11, 11), ORANGE],
        ['outside W (8,10)',       app.pix(8, 10),  TRANSPARENT],
        ['outside E (12,10)',      app.pix(12, 10), TRANSPARENT],
        ['outside N (10,8)',       app.pix(10, 8),  TRANSPARENT],
      ],
    },

    {
      label: '31-pencil-size-5-stroke',
      description: 'Pencil at thickness=5, drag (8,8) → (16,8) → 5-pixel-wide band centred on row 8.',
      run: async (app) => {
        app.setThickness(5);
        app.drag(8, 8, 16, 8);
      },
      assertions: (app) => [
        ['centre (12,8)',          app.pix(12, 8),  ORANGE],
        ['two above (12,6)',       app.pix(12, 6),  ORANGE],
        ['two below (12,10)',      app.pix(12, 10), ORANGE],
        ['three above (12,5)',     app.pix(12, 5),  TRANSPARENT],
        ['three below (12,11)',    app.pix(12, 11), TRANSPARENT],
      ],
    },

    {
      label: '32-pencil-clipped-at-edge',
      description: 'Pencil at thickness=3 stamped near (0,0) — only in-bounds pixels paint; no error.',
      run: async (app) => {
        app.setThickness(3);
        app.click(0, 0);
      },
      assertions: (app) => [
        ['(0,0) painted',  app.pix(0, 0),  ORANGE],
        ['(1,0) painted',  app.pix(1, 0),  ORANGE],
        ['(0,1) painted',  app.pix(0, 1),  ORANGE],
        ['(1,1) painted',  app.pix(1, 1),  ORANGE],
        ['(2,0) clear',    app.pix(2, 0),  TRANSPARENT],
      ],
    },

    {
      label: '33-eraser-thick',
      description: 'Pencil at α=0 (Erase) with thickness=3 clears a 3×3 region from a filled canvas.',
      run: async (app) => {
        app.q('[data-tool="fill"]').click();
        app.click(10, 10);                  // fill the whole canvas
        app.q('[data-tool="pencil"]').click();
        app.pressErase();                   // α=0, tool=pencil
        app.setThickness(3);
        app.click(15, 15);
      },
      assertions: (app) => [
        ['centre (15,15) cleared',      app.pix(15, 15), TRANSPARENT],
        ['NW (14,14) cleared',          app.pix(14, 14), TRANSPARENT],
        ['SE (16,16) cleared',          app.pix(16, 16), TRANSPARENT],
        ['outside (12,15) still filled', app.pix(12, 15), ORANGE],
      ],
    },

    // ===== prompt-2 polish bundle: items 5, 9, 17, 19 (TDD) =====

    {
      label: '34-rgb-readout-initial',
      description: 'Default color shows rgba(203, 110, 74, 255) readout near the preview swatch.',
      run: async () => {},
      assertions: (app) => [
        ['readout text', app.q('#current-color-info').textContent.trim(), 'rgba(203, 110, 74, 255)'],
      ],
    },

    {
      label: '35-rgb-readout-tracks-alpha',
      description: 'After dropping α to 128, readout shows the new alpha.',
      run: async (app) => { app.setAlpha(128); },
      assertions: (app) => [
        ['readout text', app.q('#current-color-info').textContent.trim(), 'rgba(203, 110, 74, 128)'],
      ],
    },

    {
      label: '36-status-color-under-cursor',
      description: 'Pointer hover over a painted pixel — status text includes that pixel\'s RGBA.',
      run: async (app) => {
        app.click(10, 10);              // paint pixel ORANGE
        app.pointerMove(10, 10);        // hover over it (handler still fires)
      },
      assertions: (app) => [
        ['status mentions pixel rgba',
         app.q('#status').textContent.includes('rgba(203, 110, 74, 255)'), true],
      ],
    },

    {
      label: '37-pick-button-near-palette',
      description: 'Pick (eyedropper) lives in the color section near the palette, not in the #tools group.',
      run: async () => {},
      assertions: (app) => [
        ['picker in #color-section', !!app.q('#color-section [data-tool="picker"]'), true],
        ['picker NOT in #tools',     !!app.q('#tools [data-tool="picker"]'),         false],
        ['picker still clickable',   typeof app.q('[data-tool="picker"]').click,     'function'],
      ],
    },

    {
      label: '38-shortcut-letters-bolded',
      description: 'Tool/action button labels wrap their keyboard shortcut letter in <b>.',
      run: async () => {},
      assertions: (app) => [
        ['Pencil',  app.q('[data-tool="pencil"]').innerHTML, '<b>P</b>encil'],
        ['Fill',    app.q('[data-tool="fill"]').innerHTML,   '<b>F</b>ill'],
        ['Pick',    app.q('[data-tool="picker"]').innerHTML, 'P<b>i</b>ck'],
        ['Rect',    app.q('[data-tool="rect"]').innerHTML,   '<b>R</b>ect'],
        ['Line',    app.q('[data-tool="line"]').innerHTML,   '<b>L</b>ine'],
        ['Erase',   app.q('#btn-eraser').innerHTML,           '<b>E</b>rase'],
        ['Undo',    app.q('#btn-undo').innerHTML,             '<b>U</b>ndo'],
        ['Grid label has bold G',
         app.q('#grid-toggle').closest('label').innerHTML.includes('<b>G</b>rid'), true],
      ],
    },

    {
      label: '39-keyboard-u-undo',
      description: 'Plain U key triggers undo (without Cmd/Ctrl). R stays bound to Rect; Redo keeps Cmd-Shift-Z.',
      run: async (app) => {
        app.click(10, 10);
        const before = app.pix(10, 10);
        app.keyboard('u');
        const after = app.pix(10, 10);
        return { before, after };
      },
      assertions: (_app, ctx) => [
        ['before undo (painted)', ctx.before, ORANGE],
        ['after undo (cleared)',  ctx.after,  TRANSPARENT],
      ],
    },

    // ===== prompt-2 item 13: Cursor click-preview (pencil-only first pass, TDD) =====

    {
      label: '40-pencil-hover-preview',
      description: 'Pencil hover at (10,10) — overlay shows a preview pixel; #art is unchanged.',
      run: async (app) => {
        app.setThickness(1);
        app.pointerMove(10, 10);
      },
      assertions: (app) => [
        ['#art (10,10) untouched',           app.pix(10, 10),         TRANSPARENT],
        ['overlay (10,10) shows preview',    app.overlayPix(10, 10),  ORANGE],
        ['overlay (5,5) clean',              app.overlayPix(5, 5),    TRANSPARENT],
      ],
    },

    {
      label: '41-pencil-hover-thickness-3',
      description: 'Pencil hover at thickness=3 → 3×3 preview stamp on the overlay.',
      run: async (app) => {
        app.setThickness(3);
        app.pointerMove(10, 10);
      },
      assertions: (app) => [
        ['overlay centre (10,10)',     app.overlayPix(10, 10),  ORANGE],
        ['overlay NW (9,9)',           app.overlayPix(9, 9),    ORANGE],
        ['overlay SE (11,11)',         app.overlayPix(11, 11),  ORANGE],
        ['overlay outside (8,10)',     app.overlayPix(8, 10),   TRANSPARENT],
      ],
    },

    {
      label: '42-pencil-hover-moves',
      description: 'Moving the cursor clears the old preview and re-paints at the new spot.',
      run: async (app) => {
        app.setThickness(1);
        app.pointerMove(10, 10);
        app.pointerMove(15, 15);
      },
      assertions: (app) => [
        ['old position cleared', app.overlayPix(10, 10), TRANSPARENT],
        ['new position painted', app.overlayPix(15, 15), ORANGE],
      ],
    },

    {
      label: '43-pencil-hover-eraser-marker',
      description: 'In Erase mode (α=0), the hover preview is a contrasting opaque marker, not transparent (otherwise the user couldn\'t see where they\'d erase).',
      run: async (app) => {
        app.pressErase();
        app.setThickness(1);
        app.pointerMove(10, 10);
      },
      assertions: (app) => [
        ['marker has visible alpha',  app.overlayPix(10, 10)[3] > 0,   true],
      ],
    },

    {
      label: '44-non-pencil-no-hover-preview',
      description: 'Rect tool hover: no preview pixel on overlay (only pencil/erase show hover preview in this pass).',
      run: async (app) => {
        app.q('[data-tool="rect"]').click();
        app.pointerMove(10, 10);
      },
      assertions: (app) => [
        ['overlay (10,10) clean', app.overlayPix(10, 10), TRANSPARENT],
      ],
    },

    {
      label: '45-hover-leaves-art-unchanged',
      description: 'Many hovers don\'t mutate #art; only the actual click commits.',
      run: async (app) => {
        app.setThickness(1);
        app.pointerMove(5, 5);
        app.pointerMove(8, 8);
        app.pointerMove(10, 10);
        const beforeClick = app.pix(10, 10);
        app.click(10, 10);
        const afterClick = app.pix(10, 10);
        return { beforeClick, afterClick };
      },
      assertions: (_app, ctx) => [
        ['before click: #art transparent', ctx.beforeClick, TRANSPARENT],
        ['after click: #art painted',      ctx.afterClick,  ORANGE],
      ],
    },

    // ===== prompt-2 item 27: Selection tools (rectangular first pass, TDD) =====

    {
      label: '46-select-tool-button',
      description: 'Select tool button exists with bold S; clicking switches tool and sets cursor=crosshair.',
      run: async (app) => { app.q('[data-tool="select"]').click(); },
      assertions: (app) => [
        ['active tool',  app.q('.tool-btn.active').dataset.tool,    'select'],
        ['cursor',       app.canvas.style.cursor,                    'crosshair'],
        ['button label', app.q('[data-tool="select"]').innerHTML,    '<b>S</b>elect'],
      ],
    },

    {
      label: '47-keyboard-s-select',
      description: 'Keyboard S selects the Select tool.',
      run: async (app) => { app.keyboard('s'); },
      assertions: (app) => [
        ['active tool', app.q('.tool-btn.active').dataset.tool, 'select'],
      ],
    },

    {
      label: '48-selection-drag-outline',
      description: 'Drag with Select draws a blue outline on #selection-overlay; interior stays clear; #art is untouched.',
      run: async (app) => {
        app.q('[data-tool="select"]').click();
        app.drag(4, 4, 8, 8);
      },
      assertions: (app) => [
        ['outline NW (4,4)',         app.selectionPix(4, 4)[3] > 0,   true],
        ['outline NE (8,4)',         app.selectionPix(8, 4)[3] > 0,   true],
        ['outline SW (4,8)',         app.selectionPix(4, 8)[3] > 0,   true],
        ['outline SE (8,8)',         app.selectionPix(8, 8)[3] > 0,   true],
        ['outline mid-edge (6,4)',   app.selectionPix(6, 4)[3] > 0,   true],
        ['interior (6,6) clear',     app.selectionPix(6, 6)[3],       0],
        ['#art (5,5) unchanged',     app.pix(5, 5),                   TRANSPARENT],
      ],
    },

    {
      label: '49-selection-esc-clears',
      description: 'ESC after a committed selection clears the outline.',
      run: async (app) => {
        app.q('[data-tool="select"]').click();
        app.drag(4, 4, 8, 8);
        app.keyboard('Escape');
      },
      assertions: (app) => [
        ['outline (4,4) gone', app.selectionPix(4, 4)[3], 0],
        ['outline (8,8) gone', app.selectionPix(8, 8)[3], 0],
      ],
    },

    {
      label: '50-selection-delete-clears-pixels',
      description: 'With an active selection, Delete sets the selected pixels to α=0; pixels outside the selection are untouched.',
      run: async (app) => {
        app.q('[data-tool="fill"]').click();
        app.click(10, 10);                       // fill canvas with ORANGE
        app.q('[data-tool="select"]').click();
        app.drag(5, 5, 7, 7);
        app.keyboard('Delete');
      },
      assertions: (app) => [
        ['selected (5,5) cleared', app.pix(5, 5), TRANSPARENT],
        ['selected (6,6) cleared', app.pix(6, 6), TRANSPARENT],
        ['selected (7,7) cleared', app.pix(7, 7), TRANSPARENT],
        ['outside W (4,5) kept',   app.pix(4, 5), ORANGE],
        ['outside E (8,5) kept',   app.pix(8, 5), ORANGE],
        ['outside N (5,4) kept',   app.pix(5, 4), ORANGE],
        ['outside S (5,8) kept',   app.pix(5, 8), ORANGE],
      ],
    },

    {
      label: '51-selection-survives-tool-switch',
      description: 'Committed selection remains visible after switching to Pencil (selection is global, not tool-local).',
      run: async (app) => {
        app.q('[data-tool="select"]').click();
        app.drag(4, 4, 8, 8);
        app.q('[data-tool="pencil"]').click();
      },
      assertions: (app) => [
        ['outline still on (4,4)', app.selectionPix(4, 4)[3] > 0,           true],
        ['outline still on (8,8)', app.selectionPix(8, 8)[3] > 0,           true],
        ['active tool',            app.q('.tool-btn.active').dataset.tool,  'pencil'],
      ],
    },

    // ===== prompt-2 item 25: Palette quantizer (TDD) =====

    {
      label: '52-quantize-button-exists',
      description: 'Quantize button + Max colors input (default 16) present in toolbar.',
      run: async () => {},
      assertions: (app) => [
        ['button exists', !!app.q('#btn-quantize'), true],
        ['N input',       app.q('#quantize-n').value, '16'],
      ],
    },

    {
      label: '53-quantize-to-one-color',
      description: '9 ORANGE + 2 BLACK; quantize N=1 → every non-transparent pixel becomes ORANGE (most common).',
      run: async (app) => {
        for (let i = 0; i < 9; i++) app.click(i, 0);
        app.pickSwatch(0);                       // first default swatch is BLACK
        app.click(10, 0);
        app.click(11, 0);
        app.q('#quantize-n').value = '1';
        app.q('#btn-quantize').click();
      },
      assertions: (app) => [
        ['(0,0) ORANGE',  app.pix(0, 0),  ORANGE],
        ['(10,0) ORANGE', app.pix(10, 0), ORANGE],
        ['(11,0) ORANGE', app.pix(11, 0), ORANGE],
      ],
    },

    {
      label: '54-quantize-to-n-colors-remaps-rare',
      description: '5 ORANGE + 3 BLACK + 1 dark-gray; quantize N=2 keeps top 2; dark-gray remaps to nearest (BLACK).',
      run: async (app) => {
        for (let i = 0; i < 5; i++) app.click(i, 0);
        app.pickSwatch(0);                       // BLACK
        app.click(5, 0); app.click(6, 0); app.click(7, 0);
        const inp = app.q('#current-color');
        inp.value = '#202020';
        inp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        app.click(8, 0);
        app.q('#quantize-n').value = '2';
        app.q('#btn-quantize').click();
      },
      assertions: (app) => [
        ['ORANGE stays ORANGE',        app.pix(0, 0), ORANGE],
        ['BLACK stays BLACK',          app.pix(5, 0), [0, 0, 0, 255]],
        ['dark-gray remaps to BLACK',  app.pix(8, 0), [0, 0, 0, 255]],
      ],
    },

    {
      label: '55-quantize-preserves-transparency',
      description: 'Transparent pixels stay transparent — they don\'t count toward the palette and aren\'t recoloured.',
      run: async (app) => {
        app.click(0, 0);
        app.q('#quantize-n').value = '1';
        app.q('#btn-quantize').click();
      },
      assertions: (app) => [
        ['(0,0) painted',           app.pix(0, 0),  ORANGE],
        ['(5,5) still transparent', app.pix(5, 5),  TRANSPARENT],
      ],
    },

    {
      label: '56-quantize-replaces-palette',
      description: 'After quantize, palette contains only the retained colors.',
      run: async (app) => {
        for (let i = 0; i < 5; i++) app.click(i, 0);
        app.pickSwatch(0);
        app.click(5, 0);
        app.q('#quantize-n').value = '2';
        app.q('#btn-quantize').click();
      },
      assertions: (app) => [
        ['palette has 2 swatches', app.qa('#palette .swatch:not(.add-swatch)').length, 2],
      ],
    },

    {
      label: '57-quantize-undoable',
      description: 'Undo after quantize restores the original (non-quantized) pixels.',
      run: async (app) => {
        for (let i = 0; i < 5; i++) app.click(i, 0);
        app.pickSwatch(0);
        app.click(5, 0);
        app.q('#quantize-n').value = '1';
        app.q('#btn-quantize').click();
        const after = app.pix(5, 0);
        app.pressUndo();
        const restored = app.pix(5, 0);
        return { after, restored };
      },
      assertions: (_app, ctx) => [
        ['quantized (5,0) → ORANGE', ctx.after,    ORANGE],
        ['undone (5,0) → BLACK',     ctx.restored, [0, 0, 0, 255]],
      ],
    },

    // ===== prompt-2 item 27 (extension): Recolor selection =====

    {
      label: '58-fill-selection-button-exists',
      description: 'Fill-selection button present in the toolbar.',
      run: async () => {},
      assertions: (app) => [
        ['button exists', !!app.q('#btn-fill-selection'), true],
      ],
    },

    {
      label: '59-fill-selection-no-op-without-selection',
      description: 'Clicking Fill Sel with no active selection is a safe no-op — canvas unchanged, no error.',
      run: async (app) => {
        app.click(5, 5);                         // paint something so there's a pixel to compare
        const before = app.pix(5, 5);
        app.q('#btn-fill-selection').click();
        const after = app.pix(5, 5);
        return { before, after };
      },
      assertions: (_app, ctx) => [
        ['pixel unchanged', ctx.after, ctx.before],
      ],
    },

    {
      label: '60-fill-selection-recolors',
      description: 'With a selection active, Fill Sel replaces every selected pixel with the current color; outside pixels are untouched.',
      run: async (app) => {
        app.q('[data-tool="select"]').click();
        app.drag(5, 5, 7, 7);
        app.pickSwatch(0);                       // BLACK
        app.q('#btn-fill-selection').click();
      },
      assertions: (app) => [
        ['(5,5) BLACK',  app.pix(5, 5), [0, 0, 0, 255]],
        ['(6,6) BLACK',  app.pix(6, 6), [0, 0, 0, 255]],
        ['(7,7) BLACK',  app.pix(7, 7), [0, 0, 0, 255]],
        ['(4,5) clear',  app.pix(4, 5), TRANSPARENT],
        ['(8,5) clear',  app.pix(8, 5), TRANSPARENT],
      ],
    },

    {
      label: '61-keyboard-enter-fills-selection',
      description: 'Enter key fills the selected region with the current color (same as the button).',
      run: async (app) => {
        app.q('[data-tool="select"]').click();
        app.drag(5, 5, 7, 7);
        app.pickSwatch(0);
        app.keyboard('Enter');
      },
      assertions: (app) => [
        ['(6,6) BLACK', app.pix(6, 6), [0, 0, 0, 255]],
      ],
    },

    {
      label: '62-fill-selection-undoable',
      description: 'Undo after Fill Sel restores the pre-fill pixels (TRANSPARENT in this scenario).',
      run: async (app) => {
        app.q('[data-tool="select"]').click();
        app.drag(5, 5, 7, 7);
        app.pickSwatch(0);
        app.q('#btn-fill-selection').click();
        const after = app.pix(6, 6);
        app.pressUndo();
        const restored = app.pix(6, 6);
        return { after, restored };
      },
      assertions: (_app, ctx) => [
        ['recoloured BLACK',   ctx.after,    [0, 0, 0, 255]],
        ['undone TRANSPARENT', ctx.restored, TRANSPARENT],
      ],
    },

    // ===== prompt-2 item 23: In-canvas resize (TDD) =====

    {
      label: '63-resize-enters-in-canvas-mode',
      description: 'Click Resize → #resize-ops becomes visible (no modal popup); old modal is gone.',
      run: async (app) => { app.q('#btn-resize').click(); },
      assertions: (app) => [
        ['resize-ops visible',      app.q('#resize-ops').classList.contains('active'), true],
        ['Apply button present',    !!app.q('#btn-resize-apply'),  true],
        ['Cancel button present',   !!app.q('#btn-resize-cancel'), true],
        ['shift X input present',   !!app.q('#resize-shift-x'),    true],
        ['shift Y input present',   !!app.q('#resize-shift-y'),    true],
        ['proposed W initial value', app.q('#resize-w').value,     '32'],
        ['no resize-dialog markup',  !!app.q('#resize-dialog'),    false],
      ],
    },

    {
      label: '64-resize-apply-no-shift',
      description: 'Resize 32×32 → 16×16 with shift 0/0 — OLD pixel (2,0) ends up at NEW (1,0); OLD (0,0) ends up at NEW (0,0).',
      run: async (app) => {
        app.click(2, 0);                         // paint OLD (2,0) ORANGE
        app.q('#btn-resize').click();
        app.q('#resize-w').value = '16';
        app.q('#resize-h').value = '16';
        app.q('#resize-shift-x').value = '0';
        app.q('#resize-shift-y').value = '0';
        app.q('#btn-resize-apply').click();
      },
      assertions: (app) => [
        ['canvas width',                app.canvas.width,    16],
        ['canvas height',               app.canvas.height,   16],
        ['NEW (1,0) sampled OLD (2,0)', app.pix(1, 0),       ORANGE],
        ['NEW (0,0) sampled OLD (0,0)', app.pix(0, 0),       TRANSPARENT],
        ['resize-ops hidden again',     app.q('#resize-ops').classList.contains('active'), false],
      ],
    },

    {
      label: '65-resize-apply-with-shift-x',
      description: 'Resize 32×32 → 16×16 with shift X=1 — OLD pixel (1,0) ends up at NEW (0,0) (was OLD (0,0) without shift).',
      run: async (app) => {
        app.click(1, 0);                         // paint OLD (1,0)
        app.q('#btn-resize').click();
        app.q('#resize-w').value = '16';
        app.q('#resize-h').value = '16';
        app.q('#resize-shift-x').value = '1';
        app.q('#resize-shift-y').value = '0';
        app.q('#btn-resize-apply').click();
      },
      assertions: (app) => [
        ['NEW (0,0) sampled OLD (1,0)', app.pix(0, 0), ORANGE],
      ],
    },

    {
      label: '66-resize-esc-cancels',
      description: 'Esc while in resize mode exits without applying — canvas dimensions preserved.',
      run: async (app) => {
        app.q('[data-tool="pencil"]').click();   // make sure tool is pencil so esc doesn't double-cancel something
        app.q('#btn-resize').click();
        app.q('#resize-w').value = '16';
        app.q('#resize-h').value = '16';
        app.keyboard('Escape');
      },
      assertions: (app) => [
        ['canvas width preserved',  app.canvas.width,  32],
        ['canvas height preserved', app.canvas.height, 32],
        ['resize-ops hidden',       app.q('#resize-ops').classList.contains('active'), false],
      ],
    },

    {
      label: '67-resize-cancel-button',
      description: 'Cancel button exits resize mode without applying.',
      run: async (app) => {
        app.q('#btn-resize').click();
        app.q('#resize-w').value = '16';
        app.q('#btn-resize-cancel').click();
      },
      assertions: (app) => [
        ['canvas width preserved', app.canvas.width, 32],
        ['resize-ops hidden',      app.q('#resize-ops').classList.contains('active'), false],
      ],
    },

    {
      label: '68-resize-undoable',
      description: 'Undo after resize restores both dimensions and pixel content.',
      run: async (app) => {
        app.click(5, 5);                          // paint a pixel
        app.q('#btn-resize').click();
        app.q('#resize-w').value = '16';
        app.q('#resize-h').value = '16';
        app.q('#btn-resize-apply').click();
        const afterDims  = [app.canvas.width, app.canvas.height];
        app.pressUndo();
        const undoneDims = [app.canvas.width, app.canvas.height];
        const restoredPx = app.pix(5, 5);
        return { afterDims, undoneDims, restoredPx };
      },
      assertions: (_app, ctx) => [
        ['after resize 16x16',  ctx.afterDims,  [16, 16]],
        ['after undo 32x32',    ctx.undoneDims, [32, 32]],
        ['restored pixel',      ctx.restoredPx, ORANGE],
      ],
    },

    // ===== prompt-2 item 27 (long tail): additional selection types =====

    {
      label: '69-selection-mode-dropdown',
      description: 'Selection mode dropdown present with 5 options; default is rect.',
      run: async () => {},
      assertions: (app) => [
        ['dropdown present', !!app.q('#selection-mode'), true],
        ['option count',     app.qa('#selection-mode option').length, 5],
        ['default value',    app.q('#selection-mode').value, 'rect'],
      ],
    },

    {
      label: '70-single-pixel-selection',
      description: 'In rect mode, click without drag → 1×1 selection at the click point; Delete clears only that pixel.',
      run: async (app) => {
        app.q('[data-tool="fill"]').click(); app.click(10, 10);   // fill ORANGE
        app.q('[data-tool="select"]').click();
        app.click(15, 15);                                         // click-without-drag
        app.keyboard('Delete');
      },
      assertions: (app) => [
        ['(15,15) cleared', app.pix(15, 15), TRANSPARENT],
        ['(14,15) intact', app.pix(14, 15), ORANGE],
        ['(16,15) intact', app.pix(16, 15), ORANGE],
        ['(15,14) intact', app.pix(15, 14), ORANGE],
        ['(15,16) intact', app.pix(15, 16), ORANGE],
      ],
    },

    {
      label: '71-row-selection',
      description: 'Mode = row, click on (5,10) → whole row 10 selected; Delete clears the row.',
      run: async (app) => {
        app.q('[data-tool="fill"]').click(); app.click(10, 10);
        app.q('[data-tool="select"]').click();
        const sel = app.q('#selection-mode');
        sel.value = 'row';
        sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        app.click(5, 10);
        app.keyboard('Delete');
      },
      assertions: (app) => [
        ['(0,10) cleared',  app.pix(0, 10),  TRANSPARENT],
        ['(15,10) cleared', app.pix(15, 10), TRANSPARENT],
        ['(31,10) cleared', app.pix(31, 10), TRANSPARENT],
        ['(5,9) intact',    app.pix(5, 9),   ORANGE],
        ['(5,11) intact',   app.pix(5, 11),  ORANGE],
      ],
    },

    {
      label: '72-column-selection',
      description: 'Mode = column, click on (10,5) → whole column 10 selected.',
      run: async (app) => {
        app.q('[data-tool="fill"]').click(); app.click(10, 10);
        app.q('[data-tool="select"]').click();
        const sel = app.q('#selection-mode');
        sel.value = 'column';
        sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        app.click(10, 5);
        app.keyboard('Delete');
      },
      assertions: (app) => [
        ['(10,0) cleared',  app.pix(10, 0),  TRANSPARENT],
        ['(10,15) cleared', app.pix(10, 15), TRANSPARENT],
        ['(10,31) cleared', app.pix(10, 31), TRANSPARENT],
        ['(9,10) intact',   app.pix(9, 10),  ORANGE],
        ['(11,10) intact',  app.pix(11, 10), ORANGE],
      ],
    },

    {
      label: '73-contiguous-color-selection',
      description: 'Mode = contiguous, click inside the LEFT orange region → flood-fill selection of the left region only; right region untouched after Delete.',
      run: async (app) => {
        // Set up two disconnected ORANGE regions split by an erased column at x=15.
        app.q('[data-tool="fill"]').click(); app.click(10, 10);
        app.pressErase(); app.setThickness(1);
        for (let y = 0; y < 32; y++) app.click(15, y);
        app.q('[data-tool="select"]').click();
        const sel = app.q('#selection-mode');
        sel.value = 'contiguous';
        sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        app.click(5, 5);                              // any pixel in LEFT region
        app.keyboard('Delete');
      },
      assertions: (app) => [
        ['(5,5) cleared (left region)',    app.pix(5, 5),    TRANSPARENT],
        ['(0,0) cleared (left region)',    app.pix(0, 0),    TRANSPARENT],
        ['(14,14) cleared (left region)',  app.pix(14, 14),  TRANSPARENT],
        ['(16,16) intact (right region)',  app.pix(16, 16),  ORANGE],
        ['(31,31) intact (right region)',  app.pix(31, 31),  ORANGE],
      ],
    },

    {
      label: '74-same-color-selection',
      description: 'Mode = same-color, click on any ORANGE pixel → selects ALL ORANGE pixels regardless of connectivity; Delete clears both regions.',
      run: async (app) => {
        app.q('[data-tool="fill"]').click(); app.click(10, 10);
        app.pressErase(); app.setThickness(1);
        for (let y = 0; y < 32; y++) app.click(15, y);
        app.q('[data-tool="select"]').click();
        const sel = app.q('#selection-mode');
        sel.value = 'same-color';
        sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        app.click(5, 5);
        app.keyboard('Delete');
      },
      assertions: (app) => [
        ['(5,5) cleared (left)',     app.pix(5, 5),    TRANSPARENT],
        ['(16,16) cleared (right)',  app.pix(16, 16),  TRANSPARENT],
        ['(31,31) cleared (right)',  app.pix(31, 31),  TRANSPARENT],
        ['(15,5) still empty',       app.pix(15, 5),   TRANSPARENT],
      ],
    },
  ];
})();
