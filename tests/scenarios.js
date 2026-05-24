'use strict';

(() => {
  const ORANGE       = [203, 110, 74, 255];
  const ORANGE_128   = [203, 110, 74, 128];
  const TRANSPARENT  = [0, 0, 0, 0];

  // Helper used by the Color-Quantization scenarios: dropdown option *values*
  // are cluster indices, not color keys, so we look up the right option by
  // its visible RGBA label to keep the tests color-centric.
  const pickDropdownByRgba = (row, win, rgba) => {
    const sel = row.querySelector('select');
    const target = `rgba(${rgba.join(', ')})`;
    for (const opt of sel.options) {
      if (opt.textContent.endsWith(target)) {
        sel.value = opt.value;
        sel.dispatchEvent(new win.Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  };

  window.scenarios = [
    {
      label: '01-initial',
      description: 'Fresh reload — defaults check (α=255, pencil, empty 32×32 canvas, no palette grid).',
      run: async () => {},
      assertions: (app) => [
        ['α slider',                  app.q('#alpha-slider').value,                                '255'],
        ['α number',                  app.q('#alpha-number').value,                                '255'],
        ['color picker',              app.q('#current-color').value,                               '#cb6e4a'],
        ['active tool',               app.q('#tools .tool-btn.active').dataset.tool,               'pencil'],
        ['palette grid removed',      !!app.q('#palette'),                                         false],
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
      description: 'Click Eraser button → selects Eraser tool (no longer mutates α). Click (4,4) — punches a transparent hole regardless of current α.',
      chain: true,
      run: async (app) => { app.pressErase(); app.click(4, 4); },
      assertions: (app) => [
        ['α slider unchanged',       app.q('#alpha-slider').value,                  '128'],
        ['active tool',              app.q('.tool-btn.active').dataset.tool,        'eraser'],
        ['pixel (4,4) erased',       app.pix(4, 4),                                 TRANSPARENT],
        ['pixel (5,5) still opaque', app.pix(5, 5),                                 ORANGE],
      ],
    },

    {
      label: '06-keyboard-e',
      description: 'From Pencil with α=255, keyboard "e" switches to the Eraser tool (without mutating α). Clicking (12,12) erases the pixel. Tool is restored to Pencil at the end so downstream chained tests stay on Pencil.',
      chain: true,
      run: async (app) => {
        app.setAlpha(255);
        app.q('[data-tool="pencil"]').click();   // back to Pencil so 'e' has somewhere to switch FROM
        app.click(12, 12);                        // paint ORANGE
        app.keyboard('e');                        // 'e' → Eraser tool
        const toolAfterE = app.q('.tool-btn.active').dataset.tool;
        app.click(12, 12);                        // erase
        app.q('[data-tool="pencil"]').click();   // restore for the rest of the chain
        return { toolAfterE };
      },
      assertions: (app, ctx) => [
        ['α slider unchanged by e',          app.q('#alpha-slider').value,                  '255'],
        ['e switched tool to eraser',        ctx.toolAfterE,                                'eraser'],
        ['tool restored to pencil for chain', app.q('.tool-btn.active').dataset.tool,       'pencil'],
        ['pixel (12,12) erased',             app.pix(12, 12),                               TRANSPARENT],
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
      label: '13a-distinct-preview-on',
      description: 'Paint three different colors plus a repeat, toggle distinct-colors preview ON — each unique RGBA maps to a high-contrast hue, repeats reuse the same hue, α=0 pixels stay transparent.',
      run: async (app) => {
        // Three visually-similar colors via the color picker + one repeat.
        const setHex = (h) => {
          const p = app.q('#current-color');
          p.value = h;
          p.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        };
        setHex('#ff0000'); app.click(2, 2);            // unique #1
        setHex('#ff0001'); app.click(4, 4);            // unique #2 (near-identical)
        setHex('#ff0002'); app.click(6, 6);            // unique #3
        setHex('#ff0000'); app.click(8, 8);            // repeat of #1
        app.toggleDistinctPreview();
      },
      assertions: (app) => [
        ['art hidden',                          app.canvas.classList.contains('hidden'),                          true],
        ['distinct preview visible',            !app.q('#art-distinct-preview').classList.contains('hidden'),     true],
        ['distinct (2,2) palette[0] red',       app.distinctPix(2, 2),                                            [255, 0, 0, 255]],
        ['distinct (4,4) palette[1] green',     app.distinctPix(4, 4),                                            [0, 200, 0, 255]],
        ['distinct (6,6) palette[2] blue',      app.distinctPix(6, 6),                                            [0, 0, 255, 255]],
        ['distinct (8,8) reuses palette[0]',    app.distinctPix(8, 8),                                            [255, 0, 0, 255]],
        ['distinct (0,0) blank stays clear',    app.distinctPix(0, 0),                                            [0, 0, 0, 0]],
      ],
    },

    {
      label: '13b-distinct-preview-off',
      description: 'Toggle distinct-colors preview OFF — normal view returns.',
      chain: true,
      run: async (app) => { app.toggleDistinctPreview(); },
      assertions: (app) => [
        ['art visible',                  !app.canvas.classList.contains('hidden'),                          true],
        ['distinct preview hidden',      app.q('#art-distinct-preview').classList.contains('hidden'),       true],
      ],
    },

    {
      label: '13c-previews-mutually-exclusive',
      description: 'α preview and distinct preview cannot both be on — flipping one on flips the other off and unchecks its box.',
      run: async (app) => {
        app.click(4, 4);                                  // one opaque pixel
        app.toggleAlphaPreview();                         // alpha ON
        const after1 = {
          alphaOn:    !app.q('#art-alpha-preview').classList.contains('hidden'),
          distinctOn: !app.q('#art-distinct-preview').classList.contains('hidden'),
          alphaChecked:    app.q('#alpha-preview').checked,
          distinctChecked: app.q('#distinct-preview').checked,
        };
        app.toggleDistinctPreview();                      // distinct ON → alpha forced OFF
        const after2 = {
          alphaOn:    !app.q('#art-alpha-preview').classList.contains('hidden'),
          distinctOn: !app.q('#art-distinct-preview').classList.contains('hidden'),
          alphaChecked:    app.q('#alpha-preview').checked,
          distinctChecked: app.q('#distinct-preview').checked,
        };
        app.toggleAlphaPreview();                         // alpha ON → distinct forced OFF
        const after3 = {
          alphaOn:    !app.q('#art-alpha-preview').classList.contains('hidden'),
          distinctOn: !app.q('#art-distinct-preview').classList.contains('hidden'),
          alphaChecked:    app.q('#alpha-preview').checked,
          distinctChecked: app.q('#distinct-preview').checked,
        };
        app.toggleAlphaPreview();                         // tidy up
        return { after1, after2, after3 };
      },
      assertions: (_app, ctx) => [
        ['1: alpha on',                  ctx.after1.alphaOn,         true],
        ['1: distinct off',              ctx.after1.distinctOn,      false],
        ['1: alpha box checked',         ctx.after1.alphaChecked,    true],
        ['2: distinct on',               ctx.after2.distinctOn,      true],
        ['2: alpha off',                 ctx.after2.alphaOn,         false],
        ['2: alpha box unchecked',       ctx.after2.alphaChecked,    false],
        ['2: distinct box checked',      ctx.after2.distinctChecked, true],
        ['3: alpha on',                  ctx.after3.alphaOn,         true],
        ['3: distinct off',              ctx.after3.distinctOn,      false],
        ['3: distinct box unchecked',    ctx.after3.distinctChecked, false],
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
      description: 'Eraser tool at thickness=3 clears a 3×3 region from a filled canvas (per prompt-4 item 17/23, the Eraser is now its own tool that paints α=0 regardless of currentColor).',
      run: async (app) => {
        app.q('[data-tool="fill"]').click();
        app.click(10, 10);                  // fill the whole canvas
        app.pressErase();                   // selects Eraser tool
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
        ['Pick',    app.q('[data-tool="picker"]').innerHTML, 'Pic<b>k</b>'],
        ['Rect',    app.q('[data-tool="rect"]').innerHTML,   '<b>R</b>ect'],
        ['Line',    app.q('[data-tool="line"]').innerHTML,   '<b>L</b>ine'],
        ['Eraser',  app.q('#btn-eraser').innerHTML,           '<b>E</b>raser'],
        ['Undo',    app.q('#btn-undo').innerHTML,             '<b>z</b> Undo'],
        ['Redo',    app.q('#btn-redo').innerHTML,             '<b>x</b> Redo'],
        ['Save (v shortcut)', app.q('#btn-save').innerHTML,   'Sa<b>v</b>e'],
        ['Grid label has bold G with no space',
         app.q('#grid-toggle').closest('label').innerHTML.includes('<b>G</b>rid'), true],
        ['Grid label has NO stray "G rid"',
         /<b>G<\/b>\s+rid/.test(app.q('#grid-toggle').closest('label').innerHTML),  false],
        ['alpha-preview label has bold a',
         app.q('#alpha-preview').closest('label').innerHTML.includes('<b>a</b>lpha preview'), true],
        ['distinct-preview label has bold t (t shortcut)',
         app.q('#distinct-preview').closest('label').innerHTML.includes('distinc<b>t</b> colors'), true],
        ['Color Quantization title has bold Q',
         app.q('#btn-quant-toggle').innerHTML.includes('<b>Q</b>uantization'), true],
        ['Crop to Selection has bold C',
         app.q('#btn-crop-selection').innerHTML.includes('<b>C</b>rop to Selection'), true],
      ],
    },

    {
      label: '39-keyboard-z-x-undo-redo',
      description: 'Plain Z triggers undo, X triggers redo (per prompt-4 item 8). Cmd/Ctrl+Z still works (verified elsewhere). The previous "u" binding has been removed.',
      run: async (app) => {
        app.click(10, 10);
        const painted = app.pix(10, 10);
        app.keyboard('z');
        const afterUndo = app.pix(10, 10);
        app.keyboard('x');
        const afterRedo = app.pix(10, 10);
        // Confirm "u" no longer maps to undo: paint, press u, pixel stays.
        app.click(20, 20);
        const beforeU = app.pix(20, 20);
        app.keyboard('u');
        const afterU = app.pix(20, 20);
        return { painted, afterUndo, afterRedo, beforeU, afterU };
      },
      assertions: (_app, ctx) => [
        ['after paint',           ctx.painted,    ORANGE],
        ['after z (undo)',        ctx.afterUndo,  TRANSPARENT],
        ['after x (redo)',        ctx.afterRedo,  ORANGE],
        ['"u" key no longer undoes', ctx.afterU,  ctx.beforeU],
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
      description: 'Drag with Select draws a merged blue outline AROUND the selected pixels (per prompt-4 item 4): edge lines sit on pixel boundaries, interior pixels (their centres in display coords) stay clear, and #art is untouched.',
      run: async (app) => {
        app.q('[data-tool="select"]').click();
        app.drag(4, 4, 8, 8);
      },
      assertions: (app) => [
        // The runner.selectionPix(x, y) reads the top-left CORNER of image
        // pixel (x, y) in display coords, which is exactly where merged-
        // outline edges intersect.
        ['outline NW corner (4,4)',  app.selectionPix(4, 4)[3] > 0,   true],
        ['outline top-edge (6,4)',   app.selectionPix(6, 4)[3] > 0,   true],
        ['outline top-edge (8,4)',   app.selectionPix(8, 4)[3] > 0,   true],
        ['outline left-edge (4,8)',  app.selectionPix(4, 8)[3] > 0,   true],
        ['outline SE corner (9,9)',  app.selectionPix(9, 9)[3] > 0,   true],
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
        ['outline NW (4,4) gone',  app.selectionPix(4, 4)[3], 0],
        ['outline SE (9,9) gone',  app.selectionPix(9, 9)[3], 0],
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
        ['outline NW still on (4,4)', app.selectionPix(4, 4)[3] > 0,           true],
        ['outline SE still on (9,9)', app.selectionPix(9, 9)[3] > 0,           true],
        ['active tool',               app.q('.tool-btn.active').dataset.tool,  'pencil'],
      ],
    },

    // ===== prompt-2 item 25: Color Quantization panel (k-means + pixel-sets) =====

    {
      label: '52-quant-panel-collapsed-by-default',
      description: 'Color Quantization section appears in the page, collapsed; Quantize button is inside the body (revealed on expand).',
      run: async () => {},
      assertions: (app) => [
        ['panel exists',             !!app.q('#quant-panel'),                                       true],
        ['body hidden initially',    app.q('#quant-body').classList.contains('hidden'),             true],
        ['toggle aria-expanded',     app.q('#btn-quant-toggle').getAttribute('aria-expanded'),      'false'],
        ['snap default checked',     app.q('#kmeans-snap').checked,                                  true],
      ],
    },

    {
      label: '53-quantize-to-one-color',
      description: '9 ORANGE + 2 BLACK; expand panel, pick k=1 (snap mode) → every non-transparent pixel becomes ORANGE (the weighted-largest cluster snaps to ORANGE).',
      run: async (app) => {
        for (let i = 0; i < 9; i++) app.click(i, 0);
        app.setColorHex('#000000');                       // BLACK
        app.click(10, 0);
        app.click(11, 0);
        app.expandQuant();
        app.pickKmeansK(1);
        app.pressQuantize();
      },
      assertions: (app) => [
        ['(0,0) ORANGE',  app.pix(0, 0),  ORANGE],
        ['(10,0) ORANGE', app.pix(10, 0), ORANGE],
        ['(11,0) ORANGE', app.pix(11, 0), ORANGE],
      ],
    },

    {
      label: '54-quantize-to-k-clusters-remaps-rare',
      description: '5 ORANGE + 3 BLACK + 1 dark-gray; expand, k=2 (snap) keeps ORANGE & BLACK; dark-gray clusters with BLACK in LAB space and snaps there.',
      run: async (app) => {
        for (let i = 0; i < 5; i++) app.click(i, 0);
        app.setColorHex('#000000');                       // BLACK
        app.click(5, 0); app.click(6, 0); app.click(7, 0);
        const inp = app.q('#current-color');
        inp.value = '#202020';
        inp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        app.click(8, 0);
        app.expandQuant();
        app.pickKmeansK(2);
        app.pressQuantize();
      },
      assertions: (app) => [
        ['ORANGE stays ORANGE',        app.pix(0, 0), ORANGE],
        ['BLACK stays BLACK',          app.pix(5, 0), [0, 0, 0, 255]],
        ['dark-gray remaps to BLACK',  app.pix(8, 0), [0, 0, 0, 255]],
      ],
    },

    {
      label: '55-quantize-preserves-transparency',
      description: 'Transparent pixels stay transparent — they\'re excluded from clustering and untouched by Quantize.',
      run: async (app) => {
        app.click(0, 0);
        app.expandQuant();
        app.pickKmeansK(1);
        app.pressQuantize();
      },
      assertions: (app) => [
        ['(0,0) painted',           app.pix(0, 0),  ORANGE],
        ['(5,5) still transparent', app.pix(5, 5),  TRANSPARENT],
      ],
    },

    {
      label: '57-quantize-undoable',
      description: 'Undo after Quantize restores the original (non-quantized) pixels.',
      run: async (app) => {
        for (let i = 0; i < 5; i++) app.click(i, 0);
        app.setColorHex('#000000');
        app.click(5, 0);
        app.expandQuant();
        app.pickKmeansK(1);
        app.pressQuantize();
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
        app.setColorHex('#000000');                       // BLACK
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
        app.setColorHex('#000000');
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
        app.setColorHex('#000000');
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

    // ===== prompt-2 item 23: In-canvas resize (collapsible Image Resize panel) =====

    {
      label: '63-resize-panel-collapsed-by-default',
      description: 'Image Resize section is present, collapsed by default, with a header summary showing current canvas dims.',
      run: async () => {},
      assertions: (app) => [
        ['panel exists',                  !!app.q('#resize-panel'),                                       true],
        ['body hidden initially',         app.q('#resize-body').classList.contains('hidden'),             true],
        ['toggle aria-expanded false',    app.q('#btn-resize-toggle').getAttribute('aria-expanded'),      'false'],
        ['collapsed summary shows dims',  app.q('#resize-summary').textContent,                           '32×32'],
        ['no toolbar Resize… button',     !!app.q('#btn-resize'),                                          false],
        ['no Cancel button',              !!app.q('#btn-resize-cancel'),                                   false],
      ],
    },

    {
      label: '63a-resize-panel-expands-and-inits-inputs',
      description: 'Expanding the panel reveals W / H / aspect / shift inputs pre-filled with current dims, and enters resize mode (grid overlay drawn).',
      run: async (app) => {
        app.expandResize();
      },
      assertions: (app) => [
        ['body visible',                   !app.q('#resize-body').classList.contains('hidden'),            true],
        ['toggle aria-expanded true',      app.q('#btn-resize-toggle').getAttribute('aria-expanded'),      'true'],
        ['Apply button present',           !!app.q('#btn-resize-apply'),                                    true],
        ['shift X input present',          !!app.q('#resize-shift-x'),                                      true],
        ['shift Y input present',          !!app.q('#resize-shift-y'),                                      true],
        // Per prompt-4 item 2: default to floor(imgW/5) so the proposed-
        // grid overlay doesn't have to draw thousands of lines on first
        // expand. For a 32×32 canvas that's 6.
        ['proposed W default ≈ W/5',       app.q('#resize-w').value,                                        '6'],
        ['proposed H default ≈ H/5',       app.q('#resize-h').value,                                        '6'],
      ],
    },

    {
      label: '63b-resize-summary-live-updates',
      description: 'Header summary live-updates as the user edits W / shift; aspect-locked and shift modifiers appear in the summary.',
      run: async (app) => {
        app.expandResize();
        const w = app.q('#resize-w');
        w.value = '16';
        w.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const summaryAfterW = app.q('#resize-summary').textContent;
        const sx = app.q('#resize-shift-x');
        sx.value = '2';
        sx.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const summaryAfterShift = app.q('#resize-summary').textContent;
        return { summaryAfterW, summaryAfterShift };
      },
      assertions: (_app, ctx) => [
        ['summary after W edit',      ctx.summaryAfterW,      '32×32 → 16×16 · aspect locked'],
        ['summary after shift edit',  ctx.summaryAfterShift,  '32×32 → 16×16 · aspect locked · shift 2,0'],
      ],
    },

    {
      label: '64-resize-apply-no-shift',
      description: 'Resize 32×32 → 16×16 with shift 0/0 — OLD pixel (2,0) ends up at NEW (1,0); OLD (0,0) ends up at NEW (0,0). Apply collapses the panel.',
      run: async (app) => {
        app.click(2, 0);                         // paint OLD (2,0) ORANGE
        app.expandResize();
        app.q('#resize-w').value = '16';
        app.q('#resize-h').value = '16';
        app.q('#resize-shift-x').value = '0';
        app.q('#resize-shift-y').value = '0';
        app.q('#btn-resize-apply').click();
      },
      assertions: (app) => [
        ['canvas width',                  app.canvas.width,                                            16],
        ['canvas height',                 app.canvas.height,                                           16],
        ['NEW (1,0) sampled OLD (2,0)',   app.pix(1, 0),                                               ORANGE],
        ['NEW (0,0) sampled OLD (0,0)',   app.pix(0, 0),                                               TRANSPARENT],
        ['body collapsed after Apply',    app.q('#resize-body').classList.contains('hidden'),          true],
        ['summary shows new dims',        app.q('#resize-summary').textContent,                        '16×16'],
      ],
    },

    {
      label: '65-resize-apply-with-shift-x',
      description: 'Resize 32×32 → 16×16 with shift X=1 — OLD pixel (1,0) ends up at NEW (0,0) (was OLD (0,0) without shift).',
      run: async (app) => {
        app.click(1, 0);                         // paint OLD (1,0)
        app.expandResize();
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
      description: 'Esc while the panel is expanded collapses it without applying — canvas dimensions preserved.',
      run: async (app) => {
        app.q('[data-tool="pencil"]').click();
        app.expandResize();
        app.q('#resize-w').value = '16';
        app.q('#resize-h').value = '16';
        app.keyboard('Escape');
      },
      assertions: (app) => [
        ['canvas width preserved',  app.canvas.width,                                       32],
        ['canvas height preserved', app.canvas.height,                                      32],
        ['body collapsed',          app.q('#resize-body').classList.contains('hidden'),    true],
      ],
    },

    {
      label: '67-resize-collapse-via-toggle-is-cancel',
      description: 'Clicking the panel header again while expanded collapses without applying — replaces the old Cancel button.',
      run: async (app) => {
        app.expandResize();
        app.q('#resize-w').value = '16';
        app.q('#btn-resize-toggle').click();      // collapse via header → implicit cancel
      },
      assertions: (app) => [
        ['canvas width preserved', app.canvas.width,                                       32],
        ['body collapsed',         app.q('#resize-body').classList.contains('hidden'),    true],
      ],
    },

    {
      label: '68-resize-undoable',
      description: 'Undo after resize restores both dimensions and pixel content; the collapsed summary follows.',
      run: async (app) => {
        app.click(5, 5);                          // paint a pixel
        app.expandResize();
        app.q('#resize-w').value = '16';
        app.q('#resize-h').value = '16';
        app.q('#btn-resize-apply').click();
        const afterDims  = [app.canvas.width, app.canvas.height];
        const afterSummary = app.q('#resize-summary').textContent;
        app.pressUndo();
        const undoneDims = [app.canvas.width, app.canvas.height];
        const undoneSummary = app.q('#resize-summary').textContent;
        const restoredPx = app.pix(5, 5);
        return { afterDims, afterSummary, undoneDims, undoneSummary, restoredPx };
      },
      assertions: (_app, ctx) => [
        ['after resize 16x16',         ctx.afterDims,      [16, 16]],
        ['after-resize summary',       ctx.afterSummary,   '16×16'],
        ['after undo 32x32',           ctx.undoneDims,     [32, 32]],
        ['post-undo summary follows',  ctx.undoneSummary,  '32×32'],
        ['restored pixel',             ctx.restoredPx,     ORANGE],
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

    // ===== prompt-2 item 25 (continued): Pixel-sets table + k-means analysis =====

    {
      label: '75-quant-panel-toggles',
      description: 'Color Quantization toggle expands/collapses the body, sets aria-expanded, and rotates the caret affordance.',
      run: async (app) => {
        app.expandQuant();
        const open = {
          bodyVisible: !app.q('#quant-body').classList.contains('hidden'),
          ariaExpanded: app.q('#btn-quant-toggle').getAttribute('aria-expanded'),
        };
        app.collapseQuant();
        const closed = {
          bodyVisible: !app.q('#quant-body').classList.contains('hidden'),
          ariaExpanded: app.q('#btn-quant-toggle').getAttribute('aria-expanded'),
        };
        return { open, closed };
      },
      assertions: (_app, ctx) => [
        ['expanded: body visible',    ctx.open.bodyVisible,    true],
        ['expanded: aria-expanded',   ctx.open.ariaExpanded,   'true'],
        ['collapsed: body hidden',    ctx.closed.bodyVisible,  false],
        ['collapsed: aria-expanded',  ctx.closed.ariaExpanded, 'false'],
      ],
    },

    {
      label: '76-pixel-sets-row-indices',
      description: 'Each pixel-set row has a 1-based # index column, and per-row dropdown options reference target colors by their pixel-set # in snap mode.',
      run: async (app) => {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) app.click(x, y);    // 9 ORANGE → row #1
        const cp = app.q('#current-color');
        cp.value = '#000000'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        for (let y = 10; y < 12; y++) for (let x = 10; x < 12; x++) app.click(x, y); // 4 BLACK → row #2
        app.expandQuant();
        app.pickKmeansK(2);
        const rows = Array.from(app.q('#pixel-sets-table tbody').querySelectorAll('tr'));
        const firstSel = rows[0].querySelector('select');
        return {
          row1Idx: rows[0].querySelector('.ps-index').textContent,
          row2Idx: rows[1].querySelector('.ps-index').textContent,
          row1Default: rows[0].querySelector('select option:checked').textContent,
          dropdownOpts: Array.from(firstSel.options).map(o => o.textContent),
        };
      },
      assertions: (_app, ctx) => [
        ['row 1 index',                ctx.row1Idx,                                              '#1'],
        ['row 2 index',                ctx.row2Idx,                                              '#2'],
        ['row 1 default label (snap)', ctx.row1Default,                                          '#1 · rgba(203, 110, 74, 255)'],
        ['dropdown labels reference pixel-set #s', ctx.dropdownOpts.every(s => /^#\d+ · rgba/.test(s)), true],
      ],
    },

    {
      label: '77-pixel-sets-table-counts',
      description: 'Pixel-sets table has one row per distinct RGBA, sorted by count desc, with correct counts.',
      run: async (app) => {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) app.click(x, y);
        const cp = app.q('#current-color');
        cp.value = '#000000'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        for (let y = 10; y < 12; y++) for (let x = 10; x < 12; x++) app.click(x, y);
        app.expandQuant();
        const rows = Array.from(app.q('#pixel-sets-table tbody').querySelectorAll('tr'));
        return {
          rowCount: rows.length,
          firstSrc: rows[0]?.dataset.srcKey,
          firstCount: rows[0]?.querySelectorAll('td')[3].textContent,
          secondSrc: rows[1]?.dataset.srcKey,
          secondCount: rows[1]?.querySelectorAll('td')[3].textContent,
        };
      },
      assertions: (_app, ctx) => [
        ['two rows',                       ctx.rowCount,    2],
        ['top row is ORANGE (most common)', ctx.firstSrc,   '203,110,74,255'],
        ['top row count',                  ctx.firstCount,  '9'],
        ['next row is BLACK',              ctx.secondSrc,   '0,0,0,255'],
        ['next row count',                 ctx.secondCount, '4'],
      ],
    },

    {
      label: '78-pixel-sets-row-select-builds-mask',
      description: 'Per-row Select sets the global selection to every pixel of that RGBA (same as Same-color selection); Delete clears them.',
      run: async (app) => {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) app.click(x, y);
        const cp = app.q('#current-color');
        cp.value = '#000000'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        for (let y = 10; y < 12; y++) for (let x = 10; x < 12; x++) app.click(x, y);
        app.expandQuant();
        const blackRow = app.q('#pixel-sets-table tbody tr[data-src-key="0,0,0,255"]');
        blackRow.querySelector('td:nth-child(5) button').click();   // Select column
        app.keyboard('Delete');
      },
      assertions: (app) => [
        ['BLACK (10,10) cleared',    app.pix(10, 10), [0, 0, 0, 0]],
        ['BLACK (11,11) cleared',    app.pix(11, 11), [0, 0, 0, 0]],
        ['ORANGE (0,0) untouched',   app.pix(0, 0),   [203, 110, 74, 255]],
        ['ORANGE (2,2) untouched',   app.pix(2, 2),   [203, 110, 74, 255]],
      ],
    },

    {
      label: '79-pixel-sets-row-replace-immediate',
      description: 'Per-row Replace immediately remaps that pixel-set; undo restores. Other colors untouched.',
      run: async (app) => {
        for (let x = 0; x < 5; x++) app.click(x, 0);                   // 5 ORANGE
        const cp = app.q('#current-color');
        cp.value = '#000000'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        for (let x = 0; x < 3; x++) app.click(x, 1);                   // 3 BLACK
        cp.value = '#222222'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        app.click(0, 2);                                                // 1 dark-gray
        app.expandQuant();
        app.pickKmeansK(2);
        const grayRow = app.q('#pixel-sets-table tbody tr[data-src-key="34,34,34,255"]');
        const defaultLabel = grayRow.querySelector('select option:checked').textContent;
        grayRow.querySelector('td:nth-child(7) button').click();        // Replace column
        const afterReplace = app.pix(0, 2);
        app.pressUndo();
        return { defaultLabel, afterReplace };
      },
      assertions: (app, ctx) => [
        ['default dst = BLACK (nearest)', ctx.defaultLabel.endsWith('rgba(0, 0, 0, 255)'),         true],
        ['(0,2) became BLACK',            ctx.afterReplace,                                        [0, 0, 0, 255]],
        ['undo restored dark-gray',       app.pix(0, 2),                                           [34, 34, 34, 255]],
        ['ORANGE pixels untouched',       app.pix(0, 0),                                           [203, 110, 74, 255]],
        ['BLACK pixels untouched',        app.pix(0, 1),                                           [0, 0, 0, 255]],
      ],
    },

    {
      label: '80-pixel-sets-quantize-with-override',
      description: 'User overrides a row\'s dropdown to a non-default cluster, then bulk Quantize honours the override.',
      run: async (app) => {
        for (let x = 0; x < 5; x++) app.click(x, 0);
        const cp = app.q('#current-color');
        cp.value = '#000000'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        for (let x = 0; x < 3; x++) app.click(x, 1);
        cp.value = '#222222'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        app.click(0, 2);
        app.expandQuant();
        app.pickKmeansK(2);
        const grayRow = app.q('#pixel-sets-table tbody tr[data-src-key="34,34,34,255"]');
        const picked = pickDropdownByRgba(grayRow, app.win, [203, 110, 74, 255]);  // override to ORANGE
        app.pressQuantize();
        return { picked };
      },
      assertions: (app, ctx) => [
        ['override option present',          ctx.picked,        true],
        ['dark-gray → ORANGE (overridden)',  app.pix(0, 2),     [203, 110, 74, 255]],
        ['ORANGE survives',                   app.pix(0, 0),     [203, 110, 74, 255]],
        ['BLACK survives',                    app.pix(0, 1),     [0, 0, 0, 255]],
      ],
    },

    {
      label: '81-pixel-sets-quantize-swap-cycle',
      description: 'Override ORANGE→BLACK and BLACK→ORANGE; bulk Quantize swaps them atomically (single-pass snapshot read, no iteration).',
      run: async (app) => {
        for (let x = 0; x < 5; x++) app.click(x, 0);
        const cp = app.q('#current-color');
        cp.value = '#000000'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        for (let x = 0; x < 3; x++) app.click(x, 1);
        app.expandQuant();
        app.pickKmeansK(2);
        const orangeRow = app.q('#pixel-sets-table tbody tr[data-src-key="203,110,74,255"]');
        const blackRow  = app.q('#pixel-sets-table tbody tr[data-src-key="0,0,0,255"]');
        const a = pickDropdownByRgba(orangeRow, app.win, [0, 0, 0, 255]);          // ORANGE → BLACK
        const b = pickDropdownByRgba(blackRow,  app.win, [203, 110, 74, 255]);     // BLACK → ORANGE
        app.pressQuantize();
        return { a, b };
      },
      assertions: (app, ctx) => [
        ['ORANGE override present',     ctx.a,             true],
        ['BLACK override present',      ctx.b,             true],
        ['was-ORANGE now BLACK (0,0)',  app.pix(0, 0),     [0, 0, 0, 255]],
        ['was-ORANGE now BLACK (4,0)',  app.pix(4, 0),     [0, 0, 0, 255]],
        ['was-BLACK now ORANGE (0,1)',  app.pix(0, 1),     [203, 110, 74, 255]],
        ['was-BLACK now ORANGE (2,1)',  app.pix(2, 1),     [203, 110, 74, 255]],
      ],
    },

    {
      label: '82-kmeans-error-monotone',
      description: 'K-means mean ΔE/px is non-increasing as k grows, and reaches 0 at k = distinct count.',
      run: async (app) => {
        // 3 distinct colors with clear separation: ORANGE, BLACK, dark-gray.
        for (let x = 0; x < 5; x++) app.click(x, 0);
        const cp = app.q('#current-color');
        cp.value = '#000000'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        for (let x = 0; x < 3; x++) app.click(x, 1);
        cp.value = '#888888'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        app.click(0, 2);
        app.expandQuant();
        const rows = Array.from(app.q('#kmeans-table tbody').querySelectorAll('tr'));
        const errs = rows.map(r => parseFloat(r.querySelectorAll('td')[2].textContent));
        return { errs };
      },
      assertions: (_app, ctx) => [
        ['three k rows (1..3)',                                ctx.errs.length,                           3],
        ['k=1 error > 0',                                       ctx.errs[0] > 0,                          true],
        ['k=2 error ≤ k=1 error',                               ctx.errs[1] <= ctx.errs[0] + 1e-9,        true],
        ['k=3 error ≤ k=2 error',                               ctx.errs[2] <= ctx.errs[1] + 1e-9,        true],
        ['k=distinct → 0 error (each color is its own cluster)',ctx.errs[2] < 1e-6,                       true],
      ],
    },

    {
      label: '83-kmeans-snap-vs-centroid-proposals-differ',
      description: 'For a 2-cluster scenario at k=1, snap mode produces a real image color while centroid mode produces a synthetic midpoint — the proposed colors differ.',
      run: async (app) => {
        // 7 ORANGE + 3 BLACK → cluster center is weighted toward ORANGE in both modes.
        for (let x = 0; x < 7; x++) app.click(x, 0);
        const cp = app.q('#current-color');
        cp.value = '#000000'; cp.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        for (let x = 0; x < 3; x++) app.click(x, 1);
        app.expandQuant();
        app.pickKmeansK(1);
        app.setKmeansSnap(true);
        const snapTitle = app.q('#kmeans-table tbody tr[data-k="1"] .qcolor').title;
        app.setKmeansSnap(false);
        const centroidTitle = app.q('#kmeans-table tbody tr[data-k="1"] .qcolor').title;
        return { snapTitle, centroidTitle };
      },
      assertions: (_app, ctx) => [
        ['snap proposal differs from centroid proposal', ctx.snapTitle !== ctx.centroidTitle, true],
        ['snap proposal IS ORANGE (a real image color)', ctx.snapTitle,                       'rgba(203, 110, 74, 255)'],
      ],
    },

    // ===== prompt-4 features =====

    {
      label: '84-eraser-tool-exists',
      description: 'Eraser is a real tool (prompt-4 items 15/17/23), not a button-that-mutates-α. It lives in the #tools group next to Pencil with data-tool="eraser".',
      run: async () => {},
      assertions: (app) => {
        const toolBtns = app.qa('#tools .tool-btn').map(b => b.dataset.tool);
        return [
          ['eraser button in #tools',         toolBtns.includes('eraser'),       true],
          ['button label is "Eraser"',        app.q('#btn-eraser').textContent,  'Eraser'],
          ['Eraser sits right after Pencil',
           toolBtns.indexOf('eraser'),         toolBtns.indexOf('pencil') + 1],
        ];
      },
    },

    {
      label: '85-tool-order-in-tools-group',
      description: 'Drawing tools in the #tools group are ordered Pencil, Eraser, Line, Rect, Fill — increasing by "pixel power" (prompt-4 item 17).',
      run: async () => {},
      assertions: (app) => {
        const order = app.qa('#tools .tool-btn').map(b => b.dataset.tool);
        return [
          ['order',  order,  ['pencil', 'eraser', 'line', 'rect', 'fill']],
        ];
      },
    },

    {
      label: '86-eraser-paints-transparent-independent-of-alpha',
      description: 'The Eraser tool always writes RGBA(0,0,0,0). The user\'s currentColor / α slider is preserved so switching back to Pencil resumes with their original color.',
      run: async (app) => {
        app.q('[data-tool="fill"]').click(); app.click(0, 0);    // fill ORANGE α=255
        app.setAlpha(200);
        const cpVal = app.q('#current-color').value;
        app.q('[data-tool="eraser"]').click();
        app.click(10, 10);                                         // erase one pixel
        return { cpVal, slider: app.q('#alpha-slider').value, pix: app.pix(10, 10) };
      },
      assertions: (_app, ctx) => [
        ['erased pixel is RGBA(0,0,0,0)',  ctx.pix,        TRANSPARENT],
        ['α slider preserved',              ctx.slider,    '200'],
        ['color picker preserved',          ctx.cpVal,     '#cb6e4a'],
      ],
    },

    {
      label: '87-fill-selection-disabled-without-selection',
      description: 'Per prompt-4 item 6, the Fill Selection button is disabled until a selection exists, and enables once one does.',
      run: async (app) => {
        const beforeDisabled = app.q('#btn-fill-selection').disabled;
        app.q('[data-tool="select"]').click();
        app.drag(4, 4, 8, 8);
        const afterDisabled = app.q('#btn-fill-selection').disabled;
        app.keyboard('Escape');                                    // clear selection
        const afterClearDisabled = app.q('#btn-fill-selection').disabled;
        return { beforeDisabled, afterDisabled, afterClearDisabled };
      },
      assertions: (_app, ctx) => [
        ['disabled before any selection',  ctx.beforeDisabled,      true],
        ['enabled with a selection',       ctx.afterDisabled,       false],
        ['disabled again after Escape',    ctx.afterClearDisabled,  true],
      ],
    },

    {
      label: '88-fill-selection-button-label',
      description: '"Fill Sel" was renamed to "Fill Selection" (prompt-4 item 6).',
      run: async () => {},
      assertions: (app) => [
        ['label text', app.q('#btn-fill-selection').textContent, 'Fill Selection'],
      ],
    },

    {
      label: '89-crop-to-selection-button-exists-and-disabled',
      description: 'Per prompt-4 item 12, a "Crop to Selection" button exists and is disabled until a selection is active.',
      run: async () => {},
      assertions: (app) => [
        ['button exists',                  !!app.q('#btn-crop-selection'),         true],
        ['disabled by default',            app.q('#btn-crop-selection').disabled,  true],
        ['label',                          app.q('#btn-crop-selection').textContent, 'Crop to Selection'],
      ],
    },

    {
      label: '90-crop-to-selection-crops-and-clears-selection',
      description: 'With a rect selection 5..7 active, Crop to Selection trims the canvas to that 3×3 box and dismisses the selection.',
      run: async (app) => {
        app.q('[data-tool="fill"]').click(); app.click(0, 0);     // fill ORANGE
        app.q('[data-tool="select"]').click();
        app.drag(5, 5, 7, 7);
        const enabled = !app.q('#btn-crop-selection').disabled;
        app.q('#btn-crop-selection').click();
        return {
          enabled,
          w: app.canvas.width,
          h: app.canvas.height,
          corner: app.pix(0, 0),
          selectionGone: app.q('#btn-crop-selection').disabled,
        };
      },
      assertions: (_app, ctx) => [
        ['enabled with selection',           ctx.enabled,         true],
        ['canvas w after crop',              ctx.w,               3],
        ['canvas h after crop',              ctx.h,               3],
        ['cropped corner kept its colour',   ctx.corner,          ORANGE],
        ['selection dismissed after crop',   ctx.selectionGone,   true],
      ],
    },

    {
      label: '91-auto-crop-label-and-y-shortcut',
      description: 'Old "Crop" button is now "Auto-Crop" (prompt-4 item 11). Y is its keyboard shortcut.',
      run: async (app) => {
        // Paint a small region away from the origin so Auto-Crop has work to do.
        for (let y = 4; y < 7; y++) for (let x = 4; x < 7; x++) app.click(x, y);
        const before = [app.canvas.width, app.canvas.height];
        app.keyboard('y');
        const after = [app.canvas.width, app.canvas.height];
        return { before, after };
      },
      assertions: (app, ctx) => [
        ['button label includes Auto-Crop',
         app.q('#btn-crop').textContent.includes('Auto-Crop'), true],
        ['canvas was 32×32',                ctx.before,            [32, 32]],
        ['after y, canvas trimmed to 3×3',  ctx.after,             [3, 3]],
      ],
    },

    {
      label: '92-zoom-number-input-only',
      description: 'Per prompt-4 item 13, the zoom UI is a single number input — the old +/- buttons are gone. The number input controls and reflects the live zoom.',
      run: async (app) => {
        const initial = app.q('#zoom-input').value;
        const zi = app.q('#zoom-input');
        zi.value = '8';
        zi.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const afterSet = app.canvas.style.width;
        return { initial, afterSet };
      },
      assertions: (app, ctx) => [
        ['zoom-input present',           !!app.q('#zoom-input'),                            true],
        ['old +/- buttons gone',
         !app.q('#btn-zoom-in') && !app.q('#btn-zoom-out'),                                  true],
        ['initial value reflects fitZoom',
         /^\d+$/.test(ctx.initial),                                                          true],
        ['canvas CSS width = zoom × imgW',
         ctx.afterSet,                                                                       '256px'],
      ],
    },

    {
      label: '93-zoom-equals-and-minus-still-work',
      description: 'Per prompt-4 item 13, "-" and "=" still adjust zoom (but the visible UI is just a number input).',
      run: async (app) => {
        const before = parseInt(app.q('#zoom-input').value, 10);
        app.keyboard('=');
        const afterEq = parseInt(app.q('#zoom-input').value, 10);
        app.keyboard('-');
        const afterMinus = parseInt(app.q('#zoom-input').value, 10);
        return { before, afterEq, afterMinus };
      },
      assertions: (_app, ctx) => [
        ['= increased zoom',     ctx.afterEq,     ctx.before + 1],
        ['- restored zoom',      ctx.afterMinus,  ctx.before],
      ],
    },

    {
      label: '94-thickness-comma-period-shortcuts',
      description: 'Per prompt-4 item 16, "," and "." decrease / increase the brush thickness.',
      run: async (app) => {
        app.setThickness(5);
        app.keyboard(',');
        app.keyboard(',');
        const lower = app.q('#shape-thickness').value;
        app.keyboard('.');
        app.keyboard('.');
        app.keyboard('.');
        const higher = app.q('#shape-thickness').value;
        return { lower, higher };
      },
      assertions: (_app, ctx) => [
        ['two "," presses → thickness 3',  ctx.lower,   '3'],
        ['three "." presses → thickness 6', ctx.higher, '6'],
      ],
    },

    {
      label: '95-k-shortcut-picks-picker',
      description: 'Per prompt-4 item 20, "k" selects the Pick (eyedropper) tool. The old "i" binding now toggles the Image Resize panel.',
      run: async (app) => {
        app.keyboard('k');
        const afterK = app.q('.tool-btn.active').dataset.tool;
        return { afterK };
      },
      assertions: (_app, ctx) => [
        ['k → picker tool',  ctx.afterK,  'picker'],
      ],
    },

    {
      label: '96-draw-panel-d-shortcut',
      description: 'Per prompt-4 item 18, "d" toggles the Draw panel open/closed.',
      run: async (app) => {
        const startsOpen = !app.q('#draw-body').classList.contains('hidden');
        app.keyboard('d');
        const afterFirst = !app.q('#draw-body').classList.contains('hidden');
        app.keyboard('d');
        const afterSecond = !app.q('#draw-body').classList.contains('hidden');
        return { startsOpen, afterFirst, afterSecond };
      },
      assertions: (app, ctx) => [
        ['draw panel exists',                !!app.q('#draw-panel'),                    true],
        ['tool buttons live inside it',
         !!app.q('#draw-panel #tools'),                                                  true],
        ['color section lives inside it',
         !!app.q('#draw-panel #color-section'),                                          true],
        ['d toggled off',                    ctx.afterFirst,                            !ctx.startsOpen],
        ['d toggled back on',                ctx.afterSecond,                           ctx.startsOpen],
      ],
    },

    {
      label: '97-q-shortcut-toggles-quant-panel',
      description: 'Per prompt-5 item 3, the Color Quantization panel shortcut moved from "c" to "q".',
      run: async (app) => {
        const closed = app.q('#quant-body').classList.contains('hidden');
        app.keyboard('q');
        const afterOne = app.q('#quant-body').classList.contains('hidden');
        app.keyboard('q');
        const afterTwo = app.q('#quant-body').classList.contains('hidden');
        // "c" must no longer toggle the quant panel.
        app.keyboard('c');
        const afterC = app.q('#quant-body').classList.contains('hidden');
        return { closed, afterOne, afterTwo, afterC };
      },
      assertions: (_app, ctx) => [
        ['starts collapsed',          ctx.closed,   true],
        ['q opens',                   ctx.afterOne, false],
        ['q collapses again',         ctx.afterTwo, true],
        ['c no longer opens quant',   ctx.afterC,   true],
      ],
    },

    {
      label: '98-i-shortcut-toggles-resize-panel',
      description: 'Per prompt-4 item 20, "i" toggles the Image Resize panel (and no longer selects the picker — that\'s "k" now).',
      run: async (app) => {
        const closed = app.q('#resize-body').classList.contains('hidden');
        app.keyboard('i');
        const afterOne = app.q('#resize-body').classList.contains('hidden');
        const stillPencil = app.q('.tool-btn.active').dataset.tool;
        app.keyboard('i');
        const afterTwo = app.q('#resize-body').classList.contains('hidden');
        return { closed, afterOne, afterTwo, stillPencil };
      },
      assertions: (_app, ctx) => [
        ['starts collapsed',                ctx.closed,         true],
        ['i opens',                          ctx.afterOne,      false],
        ['i did NOT select picker',         ctx.stillPencil,    'pencil'],
        ['i collapses again',                ctx.afterTwo,      true],
      ],
    },

    {
      label: '99-undo-redo-refits-zoom',
      description: 'Per prompt-4 item 10, undo / redo reset the view / zoom level. Cranking zoom far off the fit value and then undoing must snap the zoom back to a fitted value (i.e. undo re-fits the view).',
      run: async (app) => {
        // Force the zoom to the maximum, well away from any fit value.
        const zi = app.q('#zoom-input');
        zi.value = '64';
        zi.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const beforeUndo = parseInt(zi.value, 10);
        // An undoable edit, then undo — undo() calls fitZoom().
        app.click(5, 5);
        app.pressUndo();
        const afterUndo = parseInt(app.q('#zoom-input').value, 10);
        // Redo also re-fits.
        app.pressRedo();
        const afterRedo = parseInt(app.q('#zoom-input').value, 10);
        return { beforeUndo, afterUndo, afterRedo };
      },
      assertions: (_app, ctx) => [
        ['zoom was cranked to 64',         ctx.beforeUndo,                 64],
        ['undo re-fit the zoom (≠ 64)',    ctx.afterUndo !== 64,           true],
        ['redo also re-fit the zoom (≠ 64)', ctx.afterRedo !== 64,         true],
      ],
    },

    {
      label: '100-pulse-on-shortcut',
      description: 'Per prompt-4 item 21, typing a keyboard shortcut adds a brief .pulse class to the activated UI element (even on repeat key).',
      run: async (app) => {
        // After 'r', the Rect tool button should pulse momentarily.
        app.keyboard('r');
        const hasPulseImmediately = app.q('[data-tool="rect"]').classList.contains('pulse');
        // Even repeat keypresses pulse — verify by re-pressing.
        app.q('[data-tool="rect"]').classList.remove('pulse');
        app.keyboard('r');
        const hasPulseOnRepeat = app.q('[data-tool="rect"]').classList.contains('pulse');
        return { hasPulseImmediately, hasPulseOnRepeat };
      },
      assertions: (_app, ctx) => [
        ['pulse class applied on first r',   ctx.hasPulseImmediately,   true],
        ['pulse class re-applied on repeat', ctx.hasPulseOnRepeat,      true],
      ],
    },

    // ===== prompt-5 features =====

    {
      label: '101-format-selector-right-of-save',
      description: 'Per prompt-5 item 2, the save-format <select> sits to the RIGHT of the Save button in the DOM.',
      run: async () => {},
      assertions: (app) => {
        const group = app.q('#btn-save').parentElement;
        const kids = Array.from(group.children);
        return [
          ['save-format after Save button',
           kids.indexOf(app.q('#save-format')) > kids.indexOf(app.q('#btn-save')), true],
        ];
      },
    },

    {
      label: '102-thickness-and-filled-in-draw-panel',
      description: 'Per prompt-5 item 5, the Thickness input and Filled checkbox live inside the Draw panel.',
      run: async () => {},
      assertions: (app) => [
        ['#shape-thickness inside #draw-panel', !!app.q('#draw-panel #shape-thickness'), true],
        ['#rect-filled inside #draw-panel',     !!app.q('#draw-panel #rect-filled'),     true],
        ['#shape-options no longer in toolbar', !!app.q('#toolbar #shape-options'),      false],
      ],
    },

    {
      label: '103-crop-and-fill-selection-right-of-mode',
      description: 'Per prompt-5 item 8, "Crop to Selection" and "Fill Selection" sit to the right of the selection Mode dropdown, inside #select-tool-group.',
      run: async () => {},
      assertions: (app) => {
        const group = app.q('#select-tool-group');
        const kids = Array.from(group.children);
        const modeLabel = app.q('#selection-mode').closest('label');
        return [
          ['Crop to Selection in #select-tool-group', !!app.q('#select-tool-group #btn-crop-selection'), true],
          ['Fill Selection in #select-tool-group',    !!app.q('#select-tool-group #btn-fill-selection'), true],
          ['Crop to Selection after Mode dropdown',
           kids.indexOf(app.q('#btn-crop-selection')) > kids.indexOf(modeLabel), true],
          ['Fill Selection after Mode dropdown',
           kids.indexOf(app.q('#btn-fill-selection')) > kids.indexOf(modeLabel), true],
        ];
      },
    },

    {
      label: '104-palette-removed',
      description: 'Per prompt-5 item 9, the palette swatch grid and "add current color" button are gone.',
      run: async () => {},
      assertions: (app) => [
        ['#palette element gone',  !!app.q('#palette'),               false],
        ['no .add-swatch button',  !!app.q('.add-swatch'),            false],
        ['Pick button still present', !!app.q('[data-tool="picker"]'), true],
      ],
    },

    {
      label: '105-c-shortcut-crops-to-selection',
      description: 'Per prompt-5 item 4, "c" triggers Crop to Selection (a no-op while no selection exists).',
      run: async (app) => {
        app.q('[data-tool="fill"]').click(); app.click(0, 0);     // fill ORANGE
        // No selection yet — c should be a safe no-op.
        app.keyboard('c');
        const sizeNoSel = [app.canvas.width, app.canvas.height];
        // Now make a selection and crop with c.
        app.q('[data-tool="select"]').click();
        app.drag(6, 6, 9, 9);
        app.keyboard('c');
        const sizeAfter = [app.canvas.width, app.canvas.height];
        return { sizeNoSel, sizeAfter };
      },
      assertions: (_app, ctx) => [
        ['c is a no-op without a selection', ctx.sizeNoSel,  [32, 32]],
        ['c crops to the 4×4 selection box', ctx.sizeAfter,  [4, 4]],
      ],
    },

    {
      label: '106-v-shortcut-and-save-button',
      description: 'Per prompt-5 item 1, "v" is the Save hotkey. The Save button keeps its id and label "Save".',
      run: async (app) => {
        // Stub out the download path so the test doesn't spawn a real file
        // save; just confirm the keypress reaches saveImage without throwing.
        let saved = 0;
        const origCreate = app.win.HTMLAnchorElement.prototype.click;
        app.win.HTMLAnchorElement.prototype.click = function () { saved++; };
        let threw = false;
        try {
          app.q('[data-tool="pencil"]').click();
          app.click(1, 1);                       // something to save
          app.keyboard('v');
        } catch (_) { threw = true; }
        app.win.HTMLAnchorElement.prototype.click = origCreate;
        return { threw, label: app.q('#btn-save').textContent };
      },
      assertions: (_app, ctx) => [
        ['v keypress did not throw', ctx.threw,  false],
        ['Save button label',       ctx.label,  'Save'],
      ],
    },

    {
      label: '107-t-shortcut-toggles-distinct-preview',
      description: 'Per prompt-5 item 7, "t" toggles the distinct-colors preview.',
      run: async (app) => {
        app.click(3, 3);                          // one pixel so the preview has content
        const before = app.q('#distinct-preview').checked;
        app.keyboard('t');
        const afterOne = app.q('#distinct-preview').checked;
        app.keyboard('t');
        const afterTwo = app.q('#distinct-preview').checked;
        return { before, afterOne, afterTwo };
      },
      assertions: (_app, ctx) => [
        ['starts off',           ctx.before,    false],
        ['t turns it on',        ctx.afterOne,  true],
        ['t turns it off again', ctx.afterTwo,  false],
      ],
    },

    {
      label: '108-auto-crop-trims-uniform-background',
      description: 'Per prompt-5 item 6, Auto-Crop trims a uniform OPAQUE background border (not just transparent). Fill the canvas white, paint a black 3×3 block, Auto-Crop → canvas shrinks to the block.',
      run: async (app) => {
        // Fill the whole canvas opaque white.
        app.setColorHex('#ffffff');
        app.q('[data-tool="fill"]').click();
        app.click(0, 0);
        // Paint a black 3×3 block at (10..12, 10..12).
        app.setColorHex('#000000');
        app.q('[data-tool="pencil"]').click();
        app.setThickness(1);
        for (let y = 10; y < 13; y++) for (let x = 10; x < 13; x++) app.click(x, y);
        const before = [app.canvas.width, app.canvas.height];
        app.keyboard('y');                        // Auto-Crop
        const after = [app.canvas.width, app.canvas.height];
        return { before, after, corner: app.pix(0, 0) };
      },
      assertions: (_app, ctx) => [
        ['canvas started 32×32',           ctx.before,  [32, 32]],
        ['Auto-Crop trimmed white border', ctx.after,   [3, 3]],
        ['cropped content is the black block', ctx.corner, [0, 0, 0, 255]],
      ],
    },

    // ===== Image Resize: pixel-size mode =====

    {
      label: '109-resize-mode-selector-toggles-fields',
      description: 'The Image Resize panel has a "Resize by" selector. Output-size mode shows the W/H inputs; Pixel-size mode hides them and reveals the Pixel W/H inputs. The header summary names the pixel size.',
      run: async (app) => {
        app.expandResize();
        const outShownDefault = !app.q('#resize-output-fields').classList.contains('hidden');
        const pxHiddenDefault =  app.q('#resize-pixel-fields').classList.contains('hidden');
        const mode = app.q('#resize-mode');
        mode.value = 'pixel';
        mode.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        const outHiddenAfter =  app.q('#resize-output-fields').classList.contains('hidden');
        const pxShownAfter   = !app.q('#resize-pixel-fields').classList.contains('hidden');
        const summary = app.q('#resize-summary').textContent;
        return { outShownDefault, pxHiddenDefault, outHiddenAfter, pxShownAfter, summary };
      },
      assertions: (_app, ctx) => [
        ['output fields shown by default',  ctx.outShownDefault,  true],
        ['pixel fields hidden by default',  ctx.pxHiddenDefault,  true],
        ['output fields hidden in pixel mode', ctx.outHiddenAfter, true],
        ['pixel fields shown in pixel mode',   ctx.pxShownAfter,   true],
        // Default pixel size is 5 → 32×32 becomes ceil(32/5)=7 per axis.
        ['summary names the pixel size',    ctx.summary,          '32×32 → 7×7 · pixel 5×5'],
      ],
    },

    {
      label: '110-resize-by-pixel-size-applies',
      description: 'In Pixel-size mode the user sets the size of ONE resized pixel (in current pixels). Pixel size 4×4 on a 32×32 canvas → 8×8 output, where output(i,j) samples source(i*4, j*4) — the green grid cells are exactly 4×4.',
      run: async (app) => {
        app.click(4, 0);                          // ORANGE at source (4,0)
        app.click(8, 8);                          // ORANGE at source (8,8)
        app.expandResize();
        const mode = app.q('#resize-mode');
        mode.value = 'pixel';
        mode.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        const pw = app.q('#resize-px-w');
        pw.value = '4'; pw.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const ph = app.q('#resize-px-h');
        ph.value = '4'; ph.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        app.q('#btn-resize-apply').click();
        return { w: app.canvas.width, h: app.canvas.height };
      },
      assertions: (app, ctx) => [
        ['output is 8×8 = ceil(32/4) per axis',  [ctx.w, ctx.h],   [8, 8]],
        ['source (4,0) lands at output (1,0)',   app.pix(1, 0),    ORANGE],
        ['source (8,8) lands at output (2,2)',   app.pix(2, 2),    ORANGE],
        ['output (0,0) is empty',                app.pix(0, 0),    TRANSPARENT],
      ],
    },

    {
      label: '111-resize-by-pixel-size-non-divisible',
      description: 'Pixel-size mode handles a cell size that does not divide the canvas evenly: pixel size 5 on a 32-wide canvas → ceil(32/5)=7 columns, and output column i samples source column i*5.',
      run: async (app) => {
        app.click(30, 0);                         // ORANGE at source col 30 (= 6*5)
        app.expandResize();
        const mode = app.q('#resize-mode');
        mode.value = 'pixel';
        mode.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        const pw = app.q('#resize-px-w');
        pw.value = '5'; pw.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const ph = app.q('#resize-px-h');
        ph.value = '5'; ph.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        app.q('#btn-resize-apply').click();
        return { w: app.canvas.width, h: app.canvas.height };
      },
      assertions: (app, ctx) => [
        ['output width is ceil(32/5) = 7', ctx.w,            7],
        ['source col 30 lands at output col 6', app.pix(6, 0), ORANGE],
        ['output col 5 (source 25) is empty',   app.pix(5, 0), TRANSPARENT],
      ],
    },

    {
      label: '112-pixel-size-aspect-lock',
      description: 'Pixel-size mode has its own "Lock aspect" checkbox, checked by default — it keeps the resized pixel square (editing one dimension mirrors the other). Unchecking it allows a non-square pixel like 3×5.',
      run: async (app) => {
        app.expandResize();
        const mode = app.q('#resize-mode');
        mode.value = 'pixel';
        mode.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        const lockDefault = app.q('#resize-px-keep-aspect').checked;
        // With the lock on, editing Pixel W mirrors Pixel H.
        const pw = app.q('#resize-px-w');
        pw.value = '8'; pw.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const hMirrored = app.q('#resize-px-h').value;
        // Unlock, then set a non-square 3×5.
        const lock = app.q('#resize-px-keep-aspect');
        lock.checked = false;
        lock.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        pw.value = '3'; pw.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const ph = app.q('#resize-px-h');
        ph.value = '5'; ph.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        return { lockDefault, hMirrored, pw: pw.value, ph: ph.value };
      },
      assertions: (_app, ctx) => [
        ['lock checked by default',         ctx.lockDefault, true],
        ['locked: Pixel H mirrors Pixel W', ctx.hMirrored,   '8'],
        ['unlocked: Pixel W stays 3',       ctx.pw,          '3'],
        ['unlocked: Pixel H stays 5',       ctx.ph,          '5'],
      ],
    },


    // ===== SVG export =====

    {
      label: '113-svg-format-option-exists',
      description: 'SVG appears as an option in the #save-format selector alongside PNG/JPG/BMP.',
      run: async () => {},
      assertions: (app) => {
        const opts = app.qa('#save-format option').map(o => o.value);
        return [
          ['svg option present',  opts.includes('svg'),                                  true],
          ['svg option label',    app.q('#save-format option[value="svg"]').textContent, 'SVG'],
        ];
      },
    },

    {
      label: '114-svg-export-basic',
      description: 'Saving as SVG produces an image/svg+xml blob whose root <svg> matches the canvas dimensions and has the xmlns + crispEdges attributes that make the file render correctly when opened standalone.',
      run: async (app) => {
        app.click(5, 7);                                  // one ORANGE pixel
        const blob = await app.captureSave('svg');
        const text = await blob.text();
        return { type: blob.type, text };
      },
      assertions: (_app, ctx) => [
        ['blob type is image/svg+xml',         ctx.type.startsWith('image/svg+xml'),                  true],
        ['root <svg> with xmlns',              /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(ctx.text), true],
        ['root <svg> with width=32',           /<svg[^>]*\bwidth="32"/.test(ctx.text),                true],
        ['root <svg> with height=32',          /<svg[^>]*\bheight="32"/.test(ctx.text),               true],
        ['shape-rendering=crispEdges',         /shape-rendering="crispEdges"/.test(ctx.text),         true],
      ],
    },

    {
      label: '115-svg-rect-per-pixel',
      description: 'Each non-transparent pixel emits exactly one 1×1 <rect>; painted pixel at (5,7) shows up as <rect x="5" y="7" width="1" height="1" .../>.',
      run: async (app) => {
        app.click(5, 7);                                  // one ORANGE pixel
        const blob = await app.captureSave('svg');
        const text = await blob.text();
        const rectCount = (text.match(/<rect\b/g) || []).length;
        return { text, rectCount };
      },
      assertions: (_app, ctx) => [
        ['exactly one rect',                         ctx.rectCount,                                                              1],
        ['rect at x=5 y=7 width=1 height=1',         /<rect[^>]*\bx="5"[^>]*\by="7"[^>]*\bwidth="1"[^>]*\bheight="1"/.test(ctx.text), true],
        ['rect uses #cb6e4a fill',                   /fill="#cb6e4a"/i.test(ctx.text),                                            true],
      ],
    },

    {
      label: '116-svg-skips-transparent-pixels',
      description: 'α=0 pixels emit no <rect> at all — a freshly cleared 32×32 canvas produces zero rects; one painted pixel produces exactly one.',
      run: async (app) => {
        const blankBlob = await app.captureSave('svg');
        const blankText = await blankBlob.text();
        const blankRects = (blankText.match(/<rect\b/g) || []).length;
        app.click(10, 10);
        const oneBlob = await app.captureSave('svg');
        const oneText = await oneBlob.text();
        const oneRects = (oneText.match(/<rect\b/g) || []).length;
        return { blankRects, oneRects };
      },
      assertions: (_app, ctx) => [
        ['blank canvas → 0 rects',  ctx.blankRects,  0],
        ['1 painted pixel → 1 rect', ctx.oneRects,   1],
      ],
    },

    {
      label: '117-svg-translucent-uses-fill-opacity',
      description: 'A translucent pixel (α=128) emits a <rect> with fill-opacity ≈ 0.5; fully-opaque pixels emit no fill-opacity attribute (compactness).',
      run: async (app) => {
        app.click(0, 0);                                  // opaque ORANGE
        app.setAlpha(128);
        app.click(5, 5);                                  // translucent ORANGE
        const blob = await app.captureSave('svg');
        const text = await blob.text();
        // Walk each rect to inspect its attributes individually.
        const rects = text.match(/<rect\b[^>]*\/>/g) || [];
        const opaqueRect      = rects.find(r => r.includes(' x="0" ') && r.includes(' y="0" '));
        const translucentRect = rects.find(r => r.includes(' x="5" ') && r.includes(' y="5" '));
        return { opaqueRect, translucentRect };
      },
      assertions: (_app, ctx) => [
        ['opaque rect has no fill-opacity',          /fill-opacity/.test(ctx.opaqueRect || ''),    false],
        ['translucent rect has fill-opacity ≈ 0.5',  /fill-opacity="0\.50/.test(ctx.translucentRect || ''), true],
      ],
    },

    {
      label: '119-svg-horizontal-run-merged',
      description: 'Five consecutive same-colour pixels in a row (3..7, 1) become ONE <rect width="5" height="1"> via horizontal run-length merging.',
      run: async (app) => {
        for (let x = 3; x <= 7; x++) app.click(x, 1);
        const blob = await app.captureSave('svg');
        const text = await blob.text();
        const rectCount = (text.match(/<rect\b/g) || []).length;
        return { text, rectCount };
      },
      assertions: (_app, ctx) => [
        ['exactly one rect for the run', ctx.rectCount, 1],
        ['rect at x=3 y=1 width=5 height=1',
         /<rect[^>]*\bx="3"[^>]*\by="1"[^>]*\bwidth="5"[^>]*\bheight="1"/.test(ctx.text), true],
      ],
    },

    {
      label: '120-svg-vertical-run-merged-when-it-wins',
      description: 'A 1×5 vertical column at (3, 1..5): horizontal RLE would emit 5 separate width=1 rects (one per row) while vertical RLE emits ONE width=1 height=5 rect. encodeSVG keeps whichever produces fewer rects, so the vertical encoding wins.',
      run: async (app) => {
        for (let y = 1; y <= 5; y++) app.click(3, y);
        const blob = await app.captureSave('svg');
        const text = await blob.text();
        const rectCount = (text.match(/<rect\b/g) || []).length;
        return { text, rectCount };
      },
      assertions: (_app, ctx) => [
        ['exactly one rect for the column', ctx.rectCount, 1],
        ['rect at x=3 y=1 width=1 height=5',
         /<rect[^>]*\bx="3"[^>]*\by="1"[^>]*\bwidth="1"[^>]*\bheight="5"/.test(ctx.text), true],
      ],
    },

    {
      label: '121-svg-transparent-gap-breaks-runs',
      description: 'A transparent pixel inside an otherwise-uniform horizontal run breaks the run into two rects in both directions, so the chosen encoding still has 2 rects.',
      run: async (app) => {
        for (let x = 0; x <= 4; x++) app.click(x, 0);     // ORANGE 0..4
        // Punch a transparent hole at x=2.
        app.pressErase();
        app.click(2, 0);
        const blob = await app.captureSave('svg');
        const text = await blob.text();
        const rectCount = (text.match(/<rect\b/g) || []).length;
        return { rectCount, text };
      },
      assertions: (_app, ctx) => [
        ['gap split → exactly 2 rects', ctx.rectCount, 2],
      ],
    },

    {
      label: '118-svg-keyboard-v-saves-svg',
      description: 'When the save-format selector is set to SVG, the V keyboard shortcut also produces an SVG blob (regression: keyboard path uses #save-format like the button).',
      run: async (app) => {
        app.click(1, 1);
        const sel = app.q('#save-format');
        sel.value = 'svg';
        // Intercept like captureSave but trigger via V keypress.
        let captured = null;
        const origCreate = app.win.URL.createObjectURL;
        const origRevoke = app.win.URL.revokeObjectURL;
        const origClick  = app.win.HTMLAnchorElement.prototype.click;
        app.win.URL.createObjectURL = (b) => { captured = b; return 'blob:stub'; };
        app.win.URL.revokeObjectURL = () => {};
        app.win.HTMLAnchorElement.prototype.click = function () {};
        try { app.keyboard('v'); }
        finally {
          app.win.URL.createObjectURL = origCreate;
          app.win.URL.revokeObjectURL = origRevoke;
          app.win.HTMLAnchorElement.prototype.click = origClick;
        }
        return { type: captured && captured.type };
      },
      assertions: (_app, ctx) => [
        ['v produced an svg blob',  ctx.type && ctx.type.startsWith('image/svg+xml'), true],
      ],
    },


    // ===== SCAD (OpenSCAD) export =====

    {
      label: '122-scad-format-option-exists',
      description: 'SCAD appears as an option in the #save-format selector alongside PNG/JPG/BMP/SVG.',
      run: async () => {},
      assertions: (app) => {
        const opts = app.qa('#save-format option').map(o => o.value);
        return [
          ['scad option present',  opts.includes('scad'),                                  true],
          ['scad option label',    app.q('#save-format option[value="scad"]').textContent, 'SCAD'],
        ];
      },
    },

    {
      label: '123-scad-depth-input-visibility',
      description: 'A #scad-depth input + explanatory text are hidden by default and become visible only when the save format is set to SCAD.',
      run: async (app) => {
        const sel = app.q('#save-format');
        sel.value = 'png';
        sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        const hiddenForPng = app.q('#scad-options').classList.contains('hidden');
        sel.value = 'scad';
        sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        const visibleForScad = !app.q('#scad-options').classList.contains('hidden');
        const hasDepthInput  = !!app.q('#scad-depth');
        const hasInfoText    = !!app.q('#scad-info');
        // Restore default
        sel.value = 'png';
        sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        return { hiddenForPng, visibleForScad, hasDepthInput, hasInfoText };
      },
      assertions: (_app, ctx) => [
        ['scad-options hidden when format=png',   ctx.hiddenForPng,    true],
        ['scad-options visible when format=scad', ctx.visibleForScad,  true],
        ['#scad-depth input exists',              ctx.hasDepthInput,   true],
        ['#scad-info explanatory text exists',    ctx.hasInfoText,     true],
      ],
    },

    {
      label: '124-scad-export-basic',
      description: 'Saving as SCAD produces a text/plain blob whose body declares pixel_size, max_height, the px module definition, and a header comment listing the source image dimensions.',
      run: async (app) => {
        app.click(5, 7);                                  // one ORANGE pixel
        const blob = await app.captureSave('scad');
        const text = await blob.text();
        return { type: blob.type, text };
      },
      assertions: (_app, ctx) => [
        ['blob type is text/plain',     ctx.type.startsWith('text/plain'),         true],
        ['header lists 32x32 source',   /32\s*x\s*32/.test(ctx.text),              true],
        ['declares pixel_size',         /pixel_size\s*=\s*1\b/.test(ctx.text),     true],
        ['declares max_height',         /max_height\s*=\s*5\b/.test(ctx.text),     true],
        ['defines module px',           /module\s+px\s*\(/.test(ctx.text),         true],
        ['module uses cube()',          /cube\s*\(/.test(ctx.text),                true],
      ],
    },

    {
      label: '125-scad-call-per-pixel',
      description: 'A single painted opaque pixel emits exactly one px(...) call; transparent pixels emit none. Y is flipped so image (5, 7) on a 32-tall canvas becomes SCAD y = 24.',
      run: async (app) => {
        app.click(5, 7);                                  // one ORANGE pixel, α=255
        const blob = await app.captureSave('scad');
        const text = await blob.text();
        const callCount = (text.match(/^\s*px\s*\(/gm) || []).length;
        const onlyCall  = (text.match(/^\s*px\s*\([^)]*\)\s*;/gm) || [])[0] || '';
        return { callCount, onlyCall };
      },
      assertions: (_app, ctx) => [
        ['exactly one px() call',                   ctx.callCount,                                          1],
        ['x=5, y=24 (Y flipped), w=1, h=1, a=255',  /px\(\s*5\s*,\s*24\s*,\s*1\s*,\s*1\s*,\s*255\s*\)/.test(ctx.onlyCall), true],
      ],
    },

    {
      label: '126-scad-skips-transparent-pixels',
      description: 'α=0 pixels emit no px() calls — a blank canvas produces zero calls; one painted pixel produces exactly one.',
      run: async (app) => {
        const blankBlob = await app.captureSave('scad');
        const blankText = await blankBlob.text();
        const blankCalls = (blankText.match(/^\s*px\s*\(/gm) || []).length;
        app.click(10, 10);
        const oneBlob = await app.captureSave('scad');
        const oneText = await oneBlob.text();
        const oneCalls = (oneText.match(/^\s*px\s*\(/gm) || []).length;
        return { blankCalls, oneCalls };
      },
      assertions: (_app, ctx) => [
        ['blank canvas → 0 px() calls',  ctx.blankCalls,  0],
        ['1 painted pixel → 1 px() call', ctx.oneCalls,   1],
      ],
    },

    {
      label: '127-scad-horizontal-run-merged',
      description: 'Five consecutive same-alpha pixels in a row become ONE px() call with width=5 via horizontal run-length merging on the alpha channel.',
      run: async (app) => {
        for (let x = 3; x <= 7; x++) app.click(x, 1);     // ORANGE α=255 run on image row 1
        const blob = await app.captureSave('scad');
        const text = await blob.text();
        const callCount = (text.match(/^\s*px\s*\(/gm) || []).length;
        return { text, callCount };
      },
      assertions: (_app, ctx) => [
        ['exactly one px() for the run',           ctx.callCount, 1],
        ['call is px(3, 30, 5, 1, 255)',           /px\(\s*3\s*,\s*30\s*,\s*5\s*,\s*1\s*,\s*255\s*\)/.test(ctx.text), true],
      ],
    },

    {
      label: '128-scad-vertical-run-merged-when-it-wins',
      description: 'A 1×5 vertical column: horizontal RLE would emit 5 separate calls (one per row) while vertical RLE emits ONE call with height=5. encodeSCAD keeps whichever produces fewer calls, so the vertical encoding wins.',
      run: async (app) => {
        for (let y = 1; y <= 5; y++) app.click(3, y);     // vertical line x=3
        const blob = await app.captureSave('scad');
        const text = await blob.text();
        const callCount = (text.match(/^\s*px\s*\(/gm) || []).length;
        return { text, callCount };
      },
      assertions: (_app, ctx) => [
        ['exactly one px() for the column',  ctx.callCount, 1],
        // Image y=1..5 on a 32-tall canvas → SCAD y = 32-1-5 = 26 with h=5.
        ['call is px(3, 26, 1, 5, 255)',     /px\(\s*3\s*,\s*26\s*,\s*1\s*,\s*5\s*,\s*255\s*\)/.test(ctx.text), true],
      ],
    },

    {
      label: '129-scad-different-alphas-do-not-merge',
      description: 'Adjacent pixels with different alphas are NOT merged into one cube — each gets its own px() call (the heights differ, so the geometry differs).',
      run: async (app) => {
        app.click(0, 0);                                  // α=255
        app.setAlpha(128);
        app.click(1, 0);                                  // α=128
        const blob = await app.captureSave('scad');
        const text = await blob.text();
        const callCount = (text.match(/^\s*px\s*\(/gm) || []).length;
        return { text, callCount };
      },
      assertions: (_app, ctx) => [
        ['two px() calls (one per alpha)',  ctx.callCount,                                                  2],
        ['α=255 call present',              /px\(\s*0\s*,\s*31\s*,\s*1\s*,\s*1\s*,\s*255\s*\)/.test(ctx.text), true],
        ['α=128 call present',              /px\(\s*1\s*,\s*31\s*,\s*1\s*,\s*1\s*,\s*128\s*\)/.test(ctx.text), true],
      ],
    },

    {
      label: '130-scad-depth-value-flows-into-output',
      description: 'Editing #scad-depth changes the max_height constant in the generated SCAD body (the actual unit depth a user model uses).',
      run: async (app) => {
        app.click(0, 0);
        const sel = app.q('#save-format');
        sel.value = 'scad';
        sel.dispatchEvent(new app.win.Event('change', { bubbles: true }));
        const depth = app.q('#scad-depth');
        depth.value = '12';
        depth.dispatchEvent(new app.win.Event('input', { bubbles: true }));
        const blob = await app.captureSave('scad');
        const text = await blob.text();
        return { text };
      },
      assertions: (_app, ctx) => [
        ['max_height reflects user depth=12',  /max_height\s*=\s*12\b/.test(ctx.text), true],
      ],
    },

  ];
})();
