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
  ];
})();
