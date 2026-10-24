/* AirControl – Presenter mode: PDF/PPT slides + live gesture annotations */
(function () {
  const AC = (window.AC = window.AC || {});
  const COLORS = ['#3d7bff', '#5ee7ff', '#ffffff', '#ff4d6d', '#ffd23f', '#3ddc84', '#b06bff', '#ff9f43'];
  const TOOL_BY_GESTURE = { point: 'pen', peace: 'laser', three: 'highlight', palm: 'erase' };
  const TOOL_LABEL = { pen: 'Pen', laser: 'Laser', highlight: 'Highlighter', erase: 'Eraser', none: 'Ready' };

  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  /* ---- slide sources ---- */
  function demoDeck() {
    const slides = [
      ['AirControl Presenter', 'Draw, point and navigate with your hands', ['☝  One finger — pen', '✌  Two fingers — laser pointer', '3 fingers — highlighter', '✋  Open palm — eraser', '↔  Swipe — next / previous slide']],
      ['Upload your deck', 'PDF, PPT or PPTX', ['Use the upload button at the top-left', 'PowerPoint files are converted on the server', 'Annotations are kept per slide']],
      ['Keyboard & mouse work too', 'Every gesture has a fallback', ['P pen · L laser · H highlighter · E eraser', '← → change slide · C clears the slide', 'Click and drag to draw']],
    ];
    return {
      count: slides.length,
      async getPage(n) {
        const [t, sub, lines] = slides[n - 1];
        return { size: { w: 1600, h: 900 }, async render(ctx, s) {
          ctx.save(); ctx.scale(s, s);
          const g = ctx.createLinearGradient(0, 0, 1600, 900); g.addColorStop(0, '#0b1a3d'); g.addColorStop(1, '#122a66'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 900);
          ctx.fillStyle = 'rgba(94,231,255,.07)'; ctx.beginPath(); ctx.arc(1350, 160, 380, 0, 7); ctx.fill();
          ctx.fillStyle = '#eaf2ff'; ctx.font = '600 92px Sora, system-ui, sans-serif'; ctx.fillText(t, 110, 260);
          ctx.fillStyle = '#7fb0ff'; ctx.font = '300 44px Sora, system-ui, sans-serif'; ctx.fillText(sub, 110, 335);
          ctx.fillStyle = '#cfe0ff'; ctx.font = '300 42px Sora, system-ui, sans-serif'; lines.forEach((l, i) => ctx.fillText(l, 110, 490 + i * 78));
          ctx.restore();
        } };
      },
    };
  }
  function pdfDeck(pdf) {
    return {
      count: pdf.numPages,
      async getPage(n) {
        const p = await pdf.getPage(n), v = p.getViewport({ scale: 1 });
        return { size: { w: v.width, h: v.height }, async render(ctx, s) {
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          await p.render({ canvasContext: ctx, viewport: p.getViewport({ scale: s }) }).promise;
        } };
      },
    };
  }

  class PresenterMode {
    constructor() {
      const $ = (id) => document.getElementById(id);
      this.stage = $('stage'); this.slide = $('slide-canvas'); this.ann = $('ann-canvas'); this.live = $('live-canvas'); this.fx = $('fx-canvas');
      this.pageInd = $('page-ind'); this.toolInd = $('tool-ind'); this.toastEl = $('toast'); this.thick = $('thickness');
      this.doc = demoDeck(); this.page = 1; this.store = {}; this.tok = 0; this.dpr = 1;
      this.color = COLORS[0]; this.tool = 'none'; this.mouseTool = 'pen'; this.last = null; this.trail = []; this.activeSide = null; this.mouseDown = false;
      this._buildToolbar(); this._bindInput();
    }

    _buildToolbar() {
      const sw = document.getElementById('swatches');
      COLORS.forEach((c, i) => {
        const b = document.createElement('button'); b.className = 'swatch' + (i === 0 ? ' active' : ''); b.style.background = c; b.style.color = c; b.title = c; b.setAttribute('aria-label', 'Color ' + c);
        b.onclick = () => { this.color = c; sw.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === b)); }; sw.appendChild(b);
      });
      document.getElementById('file-input').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) this.upload(f); e.target.value = ''; });
    }

    _bindInput() {
      document.getElementById('edge-prev').onclick = () => this.go(-1);
      document.getElementById('edge-next').onclick = () => this.go(1);
      const s = this.stage;
      s.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('edge')) return; this.mouseDown = true; s.setPointerCapture(e.pointerId); this._mouse(e); });
      s.addEventListener('pointermove', (e) => { if (this.mouseDown || this.mouseTool === 'laser') this._mouse(e); });
      s.addEventListener('pointerup', () => { this.mouseDown = false; this._release(); this._clearFx(); });
      window.addEventListener('resize', () => this.active && this._debounceShow());
    }
    _debounceShow() { clearTimeout(this._rt); this._rt = setTimeout(() => this.show(this.page), 150); }
    _mouse(e) {
      const t = this.mouseTool;
      this._apply(t === 'laser' || this.mouseDown ? t : 'none', e.clientX, e.clientY, 'mouse');
    }

    activate() { this.active = true; this.show(this.page); }
    deactivate() { this.active = false; this._release(); this._clearFx(); }

    /* ---- rendering ---- */
    async show(n) {
      this._release(); this._saveAnn();
      const tok = ++this.tok; this.page = Math.min(this.doc.count, Math.max(1, n));
      const pg = await this.doc.getPage(this.page); if (tok !== this.tok) return;
      const maxW = this.stage.clientWidth * 0.94 - 70, maxH = this.stage.clientHeight * 0.94, fit = Math.min(maxW / pg.size.w, maxH / pg.size.h);
      const cw = Math.round(pg.size.w * fit), ch = Math.round(pg.size.h * fit); this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      [this.slide, this.ann, this.live, this.fx].forEach((c) => { c.width = Math.round(cw * this.dpr); c.height = Math.round(ch * this.dpr); c.style.width = cw + 'px'; c.style.height = ch + 'px'; });
      await pg.render(this.slide.getContext('2d'), fit * this.dpr); if (tok !== this.tok) return;
      const saved = this.store[this.page]; if (saved) this.ann.getContext('2d').drawImage(saved, 0, 0, this.ann.width, this.ann.height);
      this.pageInd.textContent = `${this.page} / ${this.doc.count}`;
    }
    _saveAnn() {
      if (!this.ann.width) return; const c = document.createElement('canvas'); c.width = this.ann.width; c.height = this.ann.height; c.getContext('2d').drawImage(this.ann, 0, 0); this.store[this.page] = c;
    }
    go(d) { if (this.page + d < 1 || this.page + d > this.doc.count) return; this.show(this.page + d); }
    clearPage() { this.ann.getContext('2d').clearRect(0, 0, this.ann.width, this.ann.height); delete this.store[this.page]; }

    async upload(file) {
      this.toast(`Uploading ${file.name}…`, 20000);
      try {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd }); const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        const pdf = await pdfjsLib.getDocument(data.url).promise;
        this.doc = pdfDeck(pdf); this.store = {}; await this.show(1); this.toast(`${data.name} · ${pdf.numPages} slides`);
      } catch (e) { this.toast(e.message || 'Upload failed', 5000); }
    }
    toast(msg, ms = 2600) { this.toastEl.textContent = msg; this.toastEl.classList.remove('hidden'); clearTimeout(this._tt); this._tt = setTimeout(() => this.toastEl.classList.add('hidden'), ms); }

    /* ---- gesture input ---- */
    handleFrame(frame) {
      if (frame.swipe) { this._release(); this.go(frame.swipe === 'left' ? 1 : -1); this.toast(frame.swipe === 'left' ? 'Next slide' : 'Previous slide', 900); return; }
      // choose the drawing hand: keep the current one if it still has a tool gesture, else first available (right preferred)
      const cands = frame.hands.filter((h) => TOOL_BY_GESTURE[h.gesture]);
      let h = cands.find((c) => c.side === this.activeSide) || cands.find((c) => c.side === 'right') || cands[0];
      if (!h || frame.swipeRecent) { this.activeSide = null; this._release(); this._setTool('none'); this._clearFx(); return; }
      this.activeSide = h.side; this._apply(TOOL_BY_GESTURE[h.gesture], h.x, h.y, 'hand');
    }
    noHands() { this._release(); this._setTool('none'); this._clearFx(); this.activeSide = null; }

    _setTool(t) { if (t !== this.tool) { this._release(); this.tool = t; this.toolInd.textContent = TOOL_LABEL[t]; } }
    _toCanvas(x, y) {
      const r = this.slide.getBoundingClientRect(); const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
      return { x: px * this.ann.width, y: py * this.ann.height, inside: px >= 0 && px <= 1 && py >= 0 && py <= 1 };
    }
    _apply(tool, cx, cy, src) {
      this._setTool(tool); const p = this._toCanvas(cx, cy), d = this.dpr, w = +this.thick.value * d;
      const fx = this.fx.getContext('2d'); fx.clearRect(0, 0, this.fx.width, this.fx.height);
      if (!p.inside || tool === 'none') { this._release(); return; }
      const a = this.ann.getContext('2d'), l = this.live.getContext('2d');
      if (tool === 'pen') {
        a.globalCompositeOperation = 'source-over'; a.strokeStyle = a.fillStyle = this.color; a.lineWidth = w; a.lineCap = a.lineJoin = 'round';
        a.beginPath(); a.moveTo((this.last || p).x, (this.last || p).y); a.lineTo(p.x, p.y); a.stroke(); this.last = p;
        fx.fillStyle = this.color; fx.beginPath(); fx.arc(p.x, p.y, w / 2 + 3 * d, 0, 7); fx.globalAlpha = 0.5; fx.fill(); fx.globalAlpha = 1;
      } else if (tool === 'highlight') {
        this.live.style.opacity = 0.38; l.strokeStyle = this.color; l.lineWidth = w * 4.5; l.lineCap = l.lineJoin = 'round';
        l.beginPath(); l.moveTo((this.last || p).x, (this.last || p).y); l.lineTo(p.x, p.y); l.stroke(); this.last = p; this.hl = true;
      } else if (tool === 'erase') {
        const r = Math.max(46, w * 3) * 1; a.globalCompositeOperation = 'destination-out'; a.beginPath(); a.arc(p.x, p.y, r, 0, 7); a.fill(); a.globalCompositeOperation = 'source-over';
        fx.strokeStyle = 'rgba(94,231,255,.8)'; fx.lineWidth = 2 * d; fx.beginPath(); fx.arc(p.x, p.y, r, 0, 7); fx.stroke(); this.last = null;
      } else if (tool === 'laser') {
        this.trail.push({ x: p.x, y: p.y }); if (this.trail.length > 16) this.trail.shift();
        this.trail.forEach((t, i) => { const k = (i + 1) / this.trail.length; fx.fillStyle = `rgba(94,231,255,${0.25 * k})`; fx.beginPath(); fx.arc(t.x, t.y, 5 * d * k, 0, 7); fx.fill(); });
        const g = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26 * d); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(120,200,255,.95)'); g.addColorStop(0.5, 'rgba(61,123,255,.35)'); g.addColorStop(1, 'rgba(61,123,255,0)');
        fx.fillStyle = g; fx.beginPath(); fx.arc(p.x, p.y, 26 * d, 0, 7); fx.fill();
      }
      if (tool !== 'laser') this.trail = [];
    }
    _release() {
      this.last = null;
      if (this.hl) { // commit translucent highlight in one pass so overlapping segments don't darken
        const a = this.ann.getContext('2d'); a.globalAlpha = 0.38; a.drawImage(this.live, 0, 0); a.globalAlpha = 1;
        this.live.getContext('2d').clearRect(0, 0, this.live.width, this.live.height); this.hl = false;
      }
    }
    _clearFx() { this.trail = []; this.fx.getContext('2d').clearRect(0, 0, this.fx.width, this.fx.height); }

    handleKey(e) {
      const k = e.key.toLowerCase();
      if (['arrowright', 'pagedown', ' '].includes(k)) { this.go(1); e.preventDefault(); }
      else if (['arrowleft', 'pageup'].includes(k)) this.go(-1);
      else if (k === 'home') this.show(1); else if (k === 'end') this.show(this.doc.count);
      else if (k === 'p') this._kt('pen'); else if (k === 'l') this._kt('laser'); else if (k === 'h') this._kt('highlight'); else if (k === 'e') this._kt('erase');
      else if (k === 'c') this.clearPage();
    }
    _kt(t) { this.mouseTool = t; this.toolInd.textContent = TOOL_LABEL[t]; }
  }

  AC.PresenterMode = PresenterMode;
})();
