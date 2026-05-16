'use strict';

(() => {
  const RELOAD_TIMEOUT_MS = 5000;
  const READY_POLL_MS     = 20;

  // ---------- App helper ----------
  // Wraps the app under test (running in an iframe) so scenarios can drive it
  // declaratively. Methods mirror the helpers used in the verification report.
  class App {
    constructor(iframe) {
      this.iframe = iframe;
      this.win    = iframe.contentWindow;
      this.doc    = iframe.contentDocument;
      this.canvas = this.doc.getElementById('art');
      this.ctx    = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    q(sel)  { return this.doc.querySelector(sel); }
    qa(sel) { return Array.from(this.doc.querySelectorAll(sel)); }

    pix(x, y) {
      return Array.from(this.ctx.getImageData(x, y, 1, 1).data);
    }
    previewPix(x, y) {
      const c = this.q('#art-alpha-preview');
      return Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data);
    }
    overlayPix(x, y) {
      const c = this.q('#hover-overlay');
      return Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data);
    }

    _coords(x, y) {
      const r = this.canvas.getBoundingClientRect();
      const z = r.width / this.canvas.width;
      return { clientX: r.left + (x + 0.5) * z, clientY: r.top + (y + 0.5) * z };
    }
    _pointer(type, x, y) {
      const { clientX, clientY } = this._coords(x, y);
      return new this.win.PointerEvent(type, {
        bubbles: true, button: 0, buttons: 1,
        pointerType: 'mouse', pointerId: 1,
        clientX, clientY,
      });
    }

    pointerDown(x, y) { this.canvas.dispatchEvent(this._pointer('pointerdown', x, y)); }
    pointerMove(x, y) { this.canvas.dispatchEvent(this._pointer('pointermove', x, y)); }
    pointerUp(x, y)   { this.canvas.dispatchEvent(this._pointer('pointerup',   x, y)); }

    click(x, y) {
      this.pointerDown(x, y);
      this.pointerUp(x, y);
    }
    drag(x0, y0, x1, y1) {
      this.pointerDown(x0, y0);
      this.pointerMove(x1, y1);
      this.pointerUp(x1, y1);
    }
    rightClick(x, y) {
      const { clientX, clientY } = this._coords(x, y);
      this.canvas.dispatchEvent(new this.win.MouseEvent('contextmenu', {
        bubbles: true, button: 2, buttons: 2, clientX, clientY,
      }));
    }

    setAlpha(v) {
      const s = this.q('#alpha-slider');
      s.value = String(v);
      s.dispatchEvent(new this.win.Event('input', { bubbles: true }));
    }
    setThickness(n) {
      const t = this.q('#shape-thickness');
      t.value = String(n);
      t.dispatchEvent(new this.win.Event('input', { bubbles: true }));
    }
    setFilled(b) {
      const f = this.q('#rect-filled');
      f.checked = !!b;
      f.dispatchEvent(new this.win.Event('change', { bubbles: true }));
    }
    pickSwatch(idx) {
      this.qa('#palette .swatch:not(.add-swatch)')[idx].click();
    }
    pressErase()         { this.q('#btn-eraser').click(); }
    pressUndo()          { this.q('#btn-undo').click(); }
    pressRedo()          { this.q('#btn-redo').click(); }
    toggleAlphaPreview() { this.q('#alpha-preview').click(); }
    keyboard(key) {
      this.doc.body.dispatchEvent(new this.win.KeyboardEvent('keydown', {
        key, bubbles: true,
      }));
    }

    canvasDataURL() {
      const previewOn = !this.q('#art-alpha-preview').classList.contains('hidden');
      const c = previewOn ? this.q('#art-alpha-preview') : this.canvas;
      return c.toDataURL('image/png');
    }
  }

  // ---------- Helpers ----------
  function deepEq(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => deepEq(v, b[i]));
    }
    return Object.is(a, b);
  }
  function fmt(v) {
    if (Array.isArray(v)) return '[' + v.map(fmt).join(', ') + ']';
    if (typeof v === 'string') return JSON.stringify(v);
    return String(v);
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- Iframe lifecycle ----------
  // The browser caches child resources (app.js, style.css) loaded via <script>/<link>
  // tags inside the iframe, so simply cache-busting the iframe URL isn't enough.
  // Fetch the HTML, append a timestamp to every same-origin .js / .css URL,
  // inject a <base> tag so relative paths still resolve, then load via srcdoc.
  async function reloadIframe(iframe) {
    const ts = Date.now();
    const html = await (await fetch('../index.html?_t=' + ts, { cache: 'no-store' })).text();
    const base = new URL('../', location.href).href;
    const busted = html
      .replace('<head>', '<head><base href="' + base + '">')
      .replace(/(\bsrc=")([^"#?]+\.js)(")/g,  '$1$2?_t=' + ts + '$3')
      .replace(/(\bhref=")([^"#?]+\.css)(")/g, '$1$2?_t=' + ts + '$3');
    return new Promise((resolve, reject) => {
      const onLoad = async () => {
        iframe.removeEventListener('load', onLoad);
        const start = Date.now();
        while (Date.now() - start < RELOAD_TIMEOUT_MS) {
          const doc    = iframe.contentDocument;
          const art    = doc && doc.getElementById('art');
          const slider = doc && doc.getElementById('alpha-slider');
          if (art && art.width === 32 && slider) return resolve();
          await new Promise(r => setTimeout(r, READY_POLL_MS));
        }
        reject(new Error('app failed to initialise within ' + RELOAD_TIMEOUT_MS + 'ms'));
      };
      iframe.addEventListener('load', onLoad);
      iframe.srcdoc = busted;
    });
  }

  // ---------- Rendering ----------
  function renderRow(tbody, idx, sc, results, passed, runError, dataUrl) {
    const tr = document.createElement('tr');
    tr.className = passed ? 'pass' : 'fail';

    const tdNum = document.createElement('td');
    tdNum.textContent = String(idx + 1).padStart(2, '0');
    tr.appendChild(tdNum);

    const tdLabel = document.createElement('td');
    const labelEl = document.createElement('div');
    labelEl.className = 'label';
    labelEl.textContent = sc.label;
    tdLabel.appendChild(labelEl);
    const descEl = document.createElement('div');
    descEl.className = 'desc';
    descEl.textContent = sc.description || '';
    tdLabel.appendChild(descEl);
    tr.appendChild(tdLabel);

    const tdBadge = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge ' + (passed ? 'badge-pass' : 'badge-fail');
    badge.textContent = passed ? 'PASS' : 'FAIL';
    tdBadge.appendChild(badge);
    tr.appendChild(tdBadge);

    const tdDetails = document.createElement('td');
    if (runError) {
      const err = document.createElement('div');
      err.className = 'error';
      err.textContent = 'run() threw: ' + runError;
      tdDetails.appendChild(err);
    } else if (results.length === 0) {
      tdDetails.textContent = 'no assertions';
    } else {
      const summary = document.createElement('div');
      summary.className = 'assert-summary';
      const passedCount = results.filter(r => r.pass).length;
      summary.textContent = passedCount + ' / ' + results.length + ' assertions pass';
      tdDetails.appendChild(summary);
      for (const f of results.filter(r => !r.pass)) {
        const div = document.createElement('div');
        div.className = 'failure';
        div.innerHTML = '<code>' + esc(f.name) + '</code>: expected ' +
                        '<code>' + esc(fmt(f.expected)) + '</code>, got ' +
                        '<code>' + esc(fmt(f.actual)) + '</code>';
        tdDetails.appendChild(div);
      }
    }
    tr.appendChild(tdDetails);

    const tdCanvas = document.createElement('td');
    if (dataUrl) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.className = 'canvas-thumb';
      img.alt = sc.label;
      tdCanvas.appendChild(img);
    }
    tr.appendChild(tdCanvas);

    tbody.appendChild(tr);
  }

  // ---------- Orchestrator ----------
  async function runAll() {
    const iframe    = document.getElementById('app');
    const tbody     = document.querySelector('#results tbody');
    const summaryEl = document.getElementById('summary');
    const runBtn    = document.getElementById('run');
    tbody.innerHTML = '';
    summaryEl.textContent = 'Running…';
    summaryEl.className   = 'running';
    runBtn.disabled = true;

    let app = null;
    let passes = 0, fails = 0;

    for (let i = 0; i < window.scenarios.length; i++) {
      const sc = window.scenarios[i];
      if (!sc.chain || !app) {
        try {
          await reloadIframe(iframe);
          app = new App(iframe);
        } catch (e) {
          renderRow(tbody, i, sc, [], false, 'iframe reload failed: ' + (e && e.message), null);
          fails++;
          continue;
        }
      }

      let runError = null;
      let ctx = null;
      try { ctx = await sc.run(app); }
      catch (e) { runError = (e && (e.stack || e.message)) || String(e); }

      let results = [];
      if (!runError) {
        try {
          const raw = sc.assertions(app, ctx) || [];
          results = raw.map(([name, actual, expected]) => ({
            name, actual, expected, pass: deepEq(actual, expected),
          }));
        } catch (e) {
          runError = 'assertions() threw: ' + ((e && (e.stack || e.message)) || String(e));
        }
      }

      const passed = !runError && results.every(r => r.pass);
      if (passed) passes++; else fails++;

      let dataUrl = null;
      try { dataUrl = app && app.canvasDataURL(); } catch (_) {}
      renderRow(tbody, i, sc, results, passed, runError, dataUrl);
    }

    const total = passes + fails;
    summaryEl.textContent = passes + ' / ' + total + ' PASS · ' + fails + ' fail';
    summaryEl.className   = (fails === 0) ? 'pass' : 'fail';
    runBtn.disabled = false;
  }

  // ---------- Boot ----------
  window.addEventListener('load', () => {
    document.getElementById('run').addEventListener('click', runAll);
    runAll();
  });
})();
