/* AirControl – Safe Presentation Mode */
(function () {
  const AC = (window.AC = window.AC || {});

  class PresenterMode {
    constructor(canvas, hooks = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.hooks = hooks;
      this.active = false;

      this.slides = [];
      this.currentIndex = 0;
      this.zoomLevel = 1.0;
      this.panOffset = { x: 0, y: 0 };

      this.lastSwipeTime = 0;
      this.swipeCooldown = 600;

      this._bindEvents();
    }

    _bindEvents() {
      const fileInput = document.getElementById('ppt-file-input');
      if (fileInput) {
        fileInput.addEventListener('change', (e) => this.loadPresentationFile(e.target.files[0]));
      }

      const prevBtn = document.getElementById('ppt-prev');
      const nextBtn = document.getElementById('ppt-next');
      if (prevBtn) prevBtn.onclick = () => this.prevSlide();
      if (nextBtn) nextBtn.onclick = () => this.nextSlide();
    }

    async loadPresentationFile(file) {
      if (!file) return;

      const fileType = file.name.split('.').pop().toLowerCase();
      this.slides = [];

      if (fileType === 'pptx') {
        await this._parsePPTX(file);
      } else if (fileType === 'pdf') {
        await this._parsePDF(file);
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(fileType)) {
        await this._loadImage(file);
      } else {
        alert('Please upload a .pptx, .pdf, or image file!');
        return;
      }

      if (this.slides.length > 0) {
        this.currentIndex = 0;
        this.renderCurrentSlide();
      }
    }

    async _parsePPTX(file) {
      if (!window.JSZip) {
        console.error('JSZip library required for PPTX parsing.');
        return;
      }
      try {
        const zip = await JSZip.loadAsync(file);
        const slideFiles = Object.keys(zip.files).filter((fileName) =>
          fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')
        );

        slideFiles.sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)[0], 10);
          const numB = parseInt(b.match(/\d+/)[0], 10);
          return numA - numB;
        });

        for (let i = 0; i < slideFiles.length; i++) {
          const slideXml = await zip.files[slideFiles[i]].async('text');
          const slideCanvas = this._renderPPTXSlideToCanvas(slideXml, i + 1);
          this.slides.push(slideCanvas);
        }
      } catch (err) {
        console.error('Failed to parse PPTX:', err);
      }
    }

    _renderPPTXSlideToCanvas(xmlText, slideNum) {
      const c = document.createElement('canvas');
      c.width = 1920;
      c.height = 1080;
      const ctx = c.getContext('2d');

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, c.width, c.height);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const textNodes = xmlDoc.getElementsByTagName('a:t');

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 42px Sora, sans-serif';
      ctx.textAlign = 'center';

      let yOffset = 250;
      ctx.fillText(`Slide ${slideNum}`, c.width / 2, 140);

      ctx.font = '28px Sora, sans-serif';
      for (let i = 0; i < textNodes.length && i < 12; i++) {
        const text = textNodes[i].textContent.trim();
        if (text) {
          ctx.fillText(text, c.width / 2, yOffset);
          yOffset += 55;
        }
      }

      return c;
    }

    async _parsePDF(file) {
      if (!window.pdfjsLib) return;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const c = document.createElement('canvas');
        c.width = viewport.width;
        c.height = viewport.height;
        const ctx = c.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;
        this.slides.push(c);
      }
    }

    _loadImage(file) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0);
          this.slides.push(c);
          resolve();
        };
        img.src = URL.createObjectURL(file);
      });
    }

    nextSlide() {
      if (this.currentIndex < this.slides.length - 1) {
        this.currentIndex++;
        this.resetZoom();
        this.renderCurrentSlide();
      }
    }

    prevSlide() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.resetZoom();
        this.renderCurrentSlide();
      }
    }

    resetZoom() {
      this.zoomLevel = 1.0;
      this.panOffset = { x: 0, y: 0 };
    }

    renderCurrentSlide() {
      if (!this.canvas || this.slides.length === 0) return;

      const w = this.canvas.width;
      const h = this.canvas.height;
      if (!this.ctx) return;

      this.ctx.clearRect(0, 0, w, h);

      const slide = this.slides[this.currentIndex];
      const scale = Math.min(w / slide.width, h / slide.height) * this.zoomLevel;
      const x = (w - slide.width * scale) / 2 + this.panOffset.x;
      const y = (h - slide.height * scale) / 2 + this.panOffset.y;

      this.ctx.drawImage(slide, x, y, slide.width * scale, slide.height * scale);
      this._renderUIOverlay();
    }

    _renderUIOverlay() {
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(30, this.canvas.height - 70, 180, 45);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 18px Sora, sans-serif';
      ctx.fillText(
        `Slide ${this.currentIndex + 1} / ${this.slides.length}`,
        50,
        this.canvas.height - 40
      );
    }

    handleFrame(frame, dt) {
      if (!this.active || this.slides.length === 0) return;

      const now = performance.now();

      for (const h of frame.hands) {
        if (h.side === 'left' && h.gesture === 'fist') {
          this.hooks.onExit && this.hooks.onExit();
          return;
        }

        if (now - this.lastSwipeTime > this.swipeCooldown) {
          if (h.delta.x < -0.12 || h.gesture === 'swipe_left') {
            this.nextSlide();
            this.lastSwipeTime = now;
          } else if (h.delta.x > 0.12 || h.gesture === 'swipe_right') {
            this.prevSlide();
            this.lastSwipeTime = now;
          }
        }

        if (h.gesture === 'pinch') {
          const factor = h.side === 'right' ? 1.02 : 0.98;
          this.zoomLevel = Math.max(0.8, Math.min(3.0, this.zoomLevel * factor));
          this.renderCurrentSlide();
        }

        if ((h.gesture === 'palm' || h.gesture === 'open') && this.zoomLevel > 1.05) {
          this.panOffset.x += h.delta.x * 600;
          this.panOffset.y -= h.delta.y * 600;
          this.renderCurrentSlide();
        }
      }
    }
  }

  AC.PresenterMode = PresenterMode;
})();
