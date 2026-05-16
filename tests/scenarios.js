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
  ];
})();
