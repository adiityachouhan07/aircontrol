/* AirControl – Presenter mode: PDF/PPT slides + live gesture annotations + Cursor-Centric Pinch Zoom + Thumbs Up/Down Fullscreen */
(function () {
  const AC = (window.AC = window.AC || {});
  const COLORS = ['#3d7bff', '#5ee7ff', '#ffffff', '#ff4d6d', '#ffd23f', '#3ddc84', '#b06bff', '#ff9f43'];
  const TOOL_BY_GESTURE = { point: 'pen', peace: 'laser', three: 'highlight', palm: 'erase' };
  const TOOL_LABEL = { pen: 'Pen', laser: 'Laser', highlight: 'Highlighter', erase: 'Eraser', none: 'Ready' };

  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  /* ---- Shape Recognition Logic ---- */
  function findCorners(points) {
    const corners = [];
    const step = Math.max(2, Math.floor(points.length / 12));

    for (let i = step; i < points.length - step; i += step) {
      const pPrev = points[i - step];
      const pCurr = points[i];
      const pNext = points[i + step];

      const a1 = Math.atan2(pCurr.y - pPrev.y, pCurr.x - pPrev.x);
      const a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
      let diff = Math.abs(a1 - a2);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      if (diff > 0.75) {
        if (corners.length === 0 || Math.hypot(pCurr.x - corners[corners.length - 1].x, pCurr.y - corners[corners.length - 1].y) > 25) {
          corners.push(pCurr);
        }
      }
    }
    return corners;
  }

  function recognizeShape(points) {
    if (!points || points.length < 8) return null;

    const N = points.length;
    const start = points[0];
    const end = points[N - 1];

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const startEndDist = Math.hypot(dx, dy);

    let pathLength = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < N; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;

      if (i > 0) {
        pathLength += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
      }
    }

    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 10 && height < 10) return null;

    const isClosed = startEndDist < pathLength * 0.32;

    if (startEndDist / pathLength > 0.86 && !isClosed) {
      return { type: 'line', start, end };
    }

    if (!isClosed) return null;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const aspectRatio = width / height;

    if (aspectRatio > 0.65 && aspectRatio < 1.45) {
      let totalR = 0;
      for (let i = 0; i < N; i++) {
        totalR += Math.hypot(points[i].x - centerX, points[i].y - centerY);
      }
      const avgR = totalR / N;
      let variance = 0;
      for (let i = 0; i < N; i++) {
        variance += Math.pow(Math.hypot(points[i].x - centerX, points[i].y - centerY) - avgR, 2);
      }
      const stdDev = Math.sqrt(variance / N);

      if (stdDev / avgR < 0.25) {
        return { type: 'circle', center: { x: centerX, y: centerY }, radius: avgR };
      }
    }

    const corners = findCorners(points);

    if (corners.length === 3) {
      return { type: 'triangle', corners };
    } else if (corners.length === 4 || (corners.length >= 4 && corners.length <= 6)) {
      return { type: 'rectangle', minX, minY, width, height };
    }

    return null;
  }

  /* ---- slide sources ---- */
  function demoDeck() {
    const slides = [
      ['AirControl Presenter', 'Draw, point and navigate with your hands', ['☝ One finger — pen', '✌ Two fingers — laser pointer', '3 fingers — highlighter', '✋ Open palm — eraser', '👍 Thumbs Up — Fullscreen + FaceCam', '👎 Thumbs Down — Exit Fullscreen', '🤏 Right Pinch — Zoom In at Cursor', '🤏 Left Pinch — Zoom Out at Cursor']],
      ['Upload your deck', 'PDF, PPT or PPTX', ['Use the upload button at the top-left', 'PowerPoint files are converted on the server', 'Annotations are kept per slide']],
      ['Keyboard & mouse work too', 'Every gesture has a fallback', ['P pen · L laser · H highlighter · E eraser', '← → change slide · C clears the slide', 'Click and drag to draw']],
    ];
    return {
      count: slides.length,
      async getPage(n) {
        const [t, sub, lines] = slides[n - 1];
        return {
          size: { w: 1600, h: 900 },
          async render(ctx, s) {
            ctx.save();
            ctx.scale(s, s);
            const g = ctx.createLinearGradient(0, 0, 1600, 900);
            g.addColorStop(0, '#0b1a3d');
            g.addColorStop(1, '#122a66');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 1600, 900);
            ctx.fillStyle = 'rgba(94,231,255,.07)';
            ctx.beginPath();
            ctx.arc(1350, 160, 380, 0, 7);
            ctx.fill();
            ctx.fillStyle = '#eaf2ff';
            ctx.font = '600 92px Sora, system-ui, sans-serif';
            ctx.fillText(t, 110, 260);
            ctx.fillStyle = '#7fb0ff';
            ctx.font = '300 44px Sora, system-ui, sans-serif';
            ctx.fillText(sub, 110, 335);
            ctx.fillStyle = '#cfe0ff';
            ctx.font = '300 42px Sora, system-ui, sans-serif';
            lines.forEach((l, i) => ctx.fillText(l, 110, 490 + i * 78));
            ctx.restore();
          }
        };
      }
    };
  }

  function pdfDeck(pdf) {
    return {
      count: pdf.numPages,
      async getPage(n) {
        const p = await pdf.getPage(n);
        const v = p.getViewport({ scale: 1 });
        return {
          size: { w: v.width, h: v.height },
          async render(ctx, s) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            await p.render({
              canvasContext: ctx,
              viewport: p.getViewport({ scale: s })
            }).promise;
          }
        };
      }
    };
  }

  class PresenterMode {
    constructor() {
      const $ = (id) => document.getElementById(id);
      this.stage = $('stage');
      this.slide = $('slide-canvas');
      this.ann = $('ann-canvas');
      this.live = $('live-canvas');
      this.fx = $('fx-canvas');
      this.pageInd = $('page-ind');
      this.toolInd = $('tool-ind');
      this.toastEl = $('toast');
      this.thick = $('thickness');
      this.faceCam = $('presenter-facecam');
      this.faceVideo = $('presenter-face-video');
      this.doc = demoDeck();
      this.page = 1;
      this.store = {};
      this.tok = 0;
      this.dpr = 1;
      this.color = COLORS[0];
      this.tool = 'none';
      this.mouseTool = 'pen';
      this.last = null;
      this.trail = [];
      this.strokeBuffer = [];
      this.activeSide = null;
      this.mouseDown = false;
      this.isFullscreen = false;
      this.lastFullscreenToggle = 0;
      
      // Zoom & Pan state
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.cw = 0;
      this.ch = 0;

      this._buildToolbar();
      this._bindInput();
    }

    _buildToolbar() {
      const sw = document.getElementById('swatches');
      COLORS.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'swatch' + (i === 0 ? ' active' : '');
        b.style.background = c;
        b.style.color = c;
        b.title = c;
        b.setAttribute('aria-label', 'Color ' + c);
        b.onclick = () => {
          this.color = c;
          sw.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === b));
        };
        sw.appendChild(b);
      });
      document.getElementById('file-input').addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (f) this.upload(f);
        e.target.value = '';
      });
    }

    _bindInput() {
      document.getElementById('edge-prev').onclick = () => this.go(-1);
      document.getElementById('edge-next').onclick = () => this.go(1);
      const s = this.stage;
      s.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('edge')) return;
        this.mouseDown = true;
        s.setPointerCapture(e.pointerId);
        this._mouse(e);
      });
      s.addEventListener('pointermove', (e) => {
        if (this.mouseDown || this.mouseTool === 'laser') this._mouse(e);
      });
      s.addEventListener('pointerup', () => {
        this.mouseDown = false;
        this._release();
        this._clearFx();
      });
      window.addEventListener('resize', () => this.active && this._debounceShow());
    }

    /* ---- Fullscreen & Floating FaceCam Toggle ---- */
    toggleFullscreen(enable) {
      const now = performance.now();
      if (now - this.lastFullscreenToggle < 1200) return;
      this.lastFullscreenToggle = now;

      if (enable && !this.isFullscreen) {
        this.isFullscreen = true;
        document.body.classList.add('presenter-fullscreen');
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        this._enableFaceCam();
        this.toast('Fullscreen Mode · Thumbs Up', 1200);
      } else if (!enable && this.isFullscreen) {
        this.isFullscreen = false;
        document.body.classList.remove('presenter-fullscreen');
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        this._disableFaceCam();
        this.toast('Exited Fullscreen · Thumbs Down', 1200);
      }
      setTimeout(() => this._debounceShow(), 200);
    }

    _enableFaceCam() {
      if (!this.faceCam || !this.faceVideo) return;
      const mainCamVideo = document.getElementById('cam-video');
      if (mainCamVideo && mainCamVideo.srcObject) {
        this.faceVideo.srcObject = mainCamVideo.srcObject;
        this.faceCam.classList.remove('hidden');
      }
    }

    _disableFaceCam() {
      if (this.faceCam) {
        this.faceCam.classList.add('hidden');
      }
    }

    _debounceShow() {
      clearTimeout(this._rt);
      this._rt = setTimeout(() => this.show(this.page), 150);
    }

    _mouse(e) {
      const t = this.mouseTool;
      this._apply(t === 'laser' || this.mouseDown ? t : 'none', e.clientX, e.clientY, 'mouse');
    }

    activate() {
      this.active = true;
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this._updateCanvasTransform();
      this.show(this.page);
    }

    deactivate() {
      this.active = false;
      this.toggleFullscreen(false);
      this._release();
      this._clearFx();
    }

    _updateCanvasTransform() {
      const stageW = this.stage.clientWidth;
      const stageH = this.stage.clientHeight;
      const initialLeft = (stageW - this.cw) / 2;
      const initialTop = (stageH - this.ch) / 2;

      const transformVal = `translate(${initialLeft + this.panX}px, ${initialTop + this.panY}px) scale(${this.zoom})`;
      [this.slide, this.ann, this.live, this.fx].forEach((c) => {
        if (c) c.style.transform = transformVal;
      });
    }

    /* ---- rendering ---- */
    async show(n) {
      this._release();
      this._saveAnn();
      const tok = ++this.tok;
      this.page = Math.min(this.doc.count, Math.max(1, n));
      const pg = await this.doc.getPage(this.page);
      if (tok !== this.tok) return;
      const maxW = this.stage.clientWidth * 0.94 - 70;
      const maxH = this.stage.clientHeight * 0.94;
      const fit = Math.min(maxW / pg.size.w, maxH / pg.size.h);
      this.cw = Math.round(pg.size.w * fit);
      this.ch = Math.round(pg.size.h * fit);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      [this.slide, this.ann, this.live, this.fx].forEach((c) => {
        c.width = Math.round(this.cw * this.dpr);
        c.height = Math.round(this.ch * this.dpr);
        c.style.width = this.cw + 'px';
        c.style.height = this.ch + 'px';
      });

      this._updateCanvasTransform();
      await pg.render(this.slide.getContext('2d'), fit * this.dpr);
      if (tok !== this.tok) return;
      const saved = this.store[this.page];
      if (saved) this.ann.getContext('2d').drawImage(saved, 0, 0, this.ann.width, this.ann.height);
      this.pageInd.textContent = `${this.page} / ${this.doc.count}`;
    }

    _saveAnn() {
      if (!this.ann.width) return;
      const c = document.createElement('canvas');
      c.width = this.ann.width;
      c.height = this.ann.height;
      c.getContext('2d').drawImage(this.ann, 0, 0);
      this.store[this.page] = c;
    }

    go(d) {
      if (this.page + d < 1 || this.page + d > this.doc.count) return;
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.show(this.page + d);
    }

    clearPage() {
      this.ann.getContext('2d').clearRect(0, 0, this.ann.width, this.ann.height);
      delete this.store[this.page];
    }

    async upload(file) {
      this.toast(`Uploading ${file.name}…`, 20000);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        const pdf = await pdfjsLib.getDocument(data.url).promise;
        this.doc = pdfDeck(pdf);
        this.store = {};
        await this.show(1);
        this.toast(`${data.name} · ${pdf.numPages} slides`);
      } catch (e) {
        this.toast(e.message || 'Upload failed', 5000);
      }
    }

    toast(msg, ms = 2600) {
      this.toastEl.textContent = msg;
      this.toastEl.classList.remove('hidden');
      clearTimeout(this._tt);
      this._tt = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
    }

    /* ---- gesture input ---- */
    handleFrame(frame) {
      // 1. THUMBS UP / DOWN FULLSCREEN GESTURES
      for (const h of frame.hands) {
        if (h.gesture === 'thumb_up' || h.gesture === 'thumbs_up') {
          this.toggleFullscreen(true);
          return;
        } else if (h.gesture === 'thumb_down' || h.gesture === 'thumbs_down') {
          this.toggleFullscreen(false);
          return;
        }
      }

      // 2. CURSOR-CENTRIC PINCH ZOOM (Right Hand = Zoom In, Left Hand = Zoom Out)
      for (const h of frame.hands) {
        if (h.gesture === 'pinch') {
          const stageRect = this.stage.getBoundingClientRect();
          const stageW = stageRect.width;
          const stageH = stageRect.height;
          const targetX = h.x - stageRect.left;
          const targetY = h.y - stageRect.top;

          const oldZoom = this.zoom;
          if (h.side === 'right') {
            this.zoom = Math.min(4, this.zoom + 0.04);
          } else if (h.side === 'left') {
            this.zoom = Math.max(1, this.zoom - 0.04);
          }

          if (this.zoom !== oldZoom) {
            const initialLeft = (stageW - this.cw) / 2;
            const initialTop = (stageH - this.ch) / 2;
            const oldLeft = initialLeft + this.panX;
            const oldTop = initialTop + this.panY;
            const zoomRatio = this.zoom / oldZoom;

            const newLeft = targetX - (targetX - oldLeft) * zoomRatio;
            const newTop = targetY - (targetY - oldTop) * zoomRatio;

            this.panX = newLeft - initialLeft;
            this.panY = newTop - initialTop;

            if (this.zoom === 1) {
              this.panX = 0;
              this.panY = 0;
            }

            this._updateCanvasTransform();
            this.toast(`Zoom: ${Math.round(this.zoom * 100)}%`, 400);
            return;
          }
        }
      }

      // 3. SLIDE SWIPE
      if (frame.swipe) {
        this._release();
        this.go(frame.swipe === 'left' ? 1 : -1);
        this.toast(frame.swipe === 'left' ? 'Next slide' : 'Previous slide', 900);
        return;
      }

      // 4. ANNOTATION TOOLS
      const cands = frame.hands.filter((h) => TOOL_BY_GESTURE[h.gesture]);
      let h = cands.find((c) => c.side === this.activeSide)
        || cands.find((c) => c.side === 'right')
        || cands[0];

      if (!h || frame.swipeRecent) {
        this.activeSide = null;
        this._release();
        this._setTool('none');
        this._clearFx();
        return;
      }

      this.activeSide = h.side;
      this._apply(TOOL_BY_GESTURE[h.gesture], h.x, h.y, 'hand');
    }

    noHands() {
      this._release();
      this._setTool('none');
      this._clearFx();
      this.activeSide = null;
    }

    _setTool(t) {
      if (t !== this.tool) {
        this._release();
        this.tool = t;
        this.toolInd.textContent = TOOL_LABEL[t];
      }
    }

    _toCanvas(x, y) {
      const stageRect = this.stage.getBoundingClientRect();
      const stageW = stageRect.width;
      const stageH = stageRect.height;
      const initialLeft = (stageW - this.cw) / 2;
      const initialTop = (stageH - this.ch) / 2;

      // Map screen cursor coordinates to transformed canvas coordinates
      const currentLeft = initialLeft + this.panX;
      const currentTop = initialTop + this.panY;

      const relX = x - stageRect.left - currentLeft;
      const relY = y - stageRect.top - currentTop;

      const canvasX = relX / this.zoom;
      const canvasY = relY / this.zoom;

      return {
        x: canvasX * this.dpr,
        y: canvasY * this.dpr,
        inside: canvasX >= 0 && canvasX <= this.cw && canvasY >= 0 && canvasY <= this.ch
      };
    }

    _apply(tool, cx, cy, src) {
      this._setTool(tool);
      const p = this._toCanvas(cx, cy);
      const d = this.dpr;
      const w = +this.thick.value * d;
      const fx = this.fx.getContext('2d');
      fx.clearRect(0, 0, this.fx.width, this.fx.height);

      if (!p.inside || tool === 'none') {
        this._release();
        return;
      }

      const a = this.ann.getContext('2d');
      const l = this.live.getContext('2d');

      if (tool === 'pen') {
        this.strokeBuffer.push(p);

        l.strokeStyle = this.color;
        l.lineWidth = w;
        l.lineCap = l.lineJoin = 'round';
        l.beginPath();
        l.moveTo((this.last || p).x, (this.last || p).y);
        l.lineTo(p.x, p.y);
        l.stroke();
        this.last = p;

        fx.fillStyle = this.color;
        fx.beginPath();
        fx.arc(p.x, p.y, w / 2 + 3 * d, 0, 7);
        fx.globalAlpha = 0.5;
        fx.fill();
        fx.globalAlpha = 1;
      } else if (tool === 'highlight') {
        this.live.style.opacity = 0.38;
        l.strokeStyle = this.color;
        l.lineWidth = w * 4.5;
        l.lineCap = l.lineJoin = 'round';
        l.beginPath();
        l.moveTo((this.last || p).x, (this.last || p).y);
        l.lineTo(p.x, p.y);
        l.stroke();
        this.last = p;
        this.hl = true;
      } else if (tool === 'erase') {
        const r = Math.max(46, w * 3) * 1;
        a.globalCompositeOperation = 'destination-out';
        a.beginPath();
        a.arc(p.x, p.y, r, 0, 7);
        a.fill();
        a.globalCompositeOperation = 'source-over';
        fx.strokeStyle = 'rgba(94,231,255,.8)';
        fx.lineWidth = 2 * d;
        fx.beginPath();
        fx.arc(p.x, p.y, r, 0, 7);
        fx.stroke();
        this.last = null;
      } else if (tool === 'laser') {
        this.trail.push({ x: p.x, y: p.y });
        if (this.trail.length > 16) this.trail.shift();
        this.trail.forEach((t, i) => {
          const k = (i + 1) / this.trail.length;
          fx.fillStyle = `rgba(94,231,255,${0.25 * k})`;
          fx.beginPath();
          fx.arc(t.x, t.y, 5 * d * k, 0, 7);
          fx.fill();
        });
        const g = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26 * d);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.18, 'rgba(120,200,255,.95)');
        g.addColorStop(0.5, 'rgba(61,123,255,.35)');
        g.addColorStop(1, 'rgba(61,123,255,0)');
        fx.fillStyle = g;
        fx.beginPath();
        fx.arc(p.x, p.y, 26 * d, 0, 7);
        fx.fill();
      }

      if (tool !== 'laser') this.trail = [];
    }

    _release() {
      this.last = null;
      const d = this.dpr;
      const w = +this.thick.value * d;

      if (this.strokeBuffer.length > 0) {
        const a = this.ann.getContext('2d');
        const shape = recognizeShape(this.strokeBuffer);

        a.globalCompositeOperation = 'source-over';
        a.strokeStyle = a.fillStyle = this.color;
        a.lineWidth = w;
        a.lineCap = a.lineJoin = 'round';
        a.beginPath();

        if (shape) {
          switch (shape.type) {
            case 'line':
              a.moveTo(shape.start.x, shape.start.y);
              a.lineTo(shape.end.x, shape.end.y);
              break;
            case 'circle':
              a.arc(shape.center.x, shape.center.y, shape.radius, 0, Math.PI * 2);
              break;
            case 'rectangle':
              a.rect(shape.minX, shape.minY, shape.width, shape.height);
              break;
            case 'triangle':
              a.moveTo(shape.corners[0].x, shape.corners[0].y);
              a.lineTo(shape.corners[1].x, shape.corners[1].y);
              a.lineTo(shape.corners[2].x, shape.corners[2].y);
              a.closePath();
              break;
          }
          a.stroke();
        } else {
          a.drawImage(this.live, 0, 0);
        }

        this.live.getContext('2d').clearRect(0, 0, this.live.width, this.live.height);
        this.strokeBuffer = [];
      }

      if (this.hl) {
        const a = this.ann.getContext('2d');
        a.globalAlpha = 0.38;
        a.drawImage(this.live, 0, 0);
        a.globalAlpha = 1;
        this.live.getContext('2d').clearRect(0, 0, this.live.width, this.live.height);
        this.hl = false;
      }
    }

    _clearFx() {
      this.trail = [];
      this.fx.getContext('2d').clearRect(0, 0, this.fx.width, this.fx.height);
    }

    handleKey(e) {
      const k = e.key.toLowerCase();
      if (['arrowright', 'pagedown', ' '].includes(k)) {
        this.go(1);
        e.preventDefault();
      } else if (['arrowleft', 'pageup'].includes(k)) {
        this.go(-1);
      } else if (k === 'home') {
        this.show(1);
      } else if (k === 'end') {
        this.show(this.doc.count);
      } else if (k === 'p') {
        this._kt('pen');
      } else if (k === 'l') {
        this._kt('laser');
      } else if (k === 'h') {
        this._kt('highlight');
      } else if (k === 'e') {
        this._kt('erase');
      } else if (k === 'c') {
        this.clearPage();
      } else if (k === 'f') {
        this.toggleFullscreen(!this.isFullscreen);
      }
    }

    _kt(t) {
      this.mouseTool = t;
      this.toolInd.textContent = TOOL_LABEL[t];
    }
  }

  AC.PresenterMode = PresenterMode;
})();
