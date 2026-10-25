/* AirControl – Standard Image Presenter Mode */
(function () {
  const AC = (window.AC = window.AC || {});

  class PresenterMode {
    constructor(canvas, hooks = {}) {
      this.canvas = canvas || document.getElementById('presenter-canvas');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.hooks = hooks;
      this.active = false;

      this.slides = [];
      this.currentIndex = 0;
      this.zoomLevel = 1.0;
      this.panOffset = { x: 0, y: 0 };

      this.lastSwipeTime = 0;
      this.swipeCooldown = 500;

      this._bindEvents();
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : window.innerWidth;
      this.canvas.height = this.canvas.parentElement ? this.canvas.parentElement.clientHeight : window.innerHeight;
      this.renderCurrentSlide();
    }

    _bindEvents() {
      const fileInput = document.getElementById('slide-file-input');
      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files.length > 0) {
            this.loadImages(Array.from(e.target.files));
          }
        });
      }

      const prevBtn = document.getElementById('ppt-prev');
      const nextBtn = document.getElementById('ppt-next');
      if (prevBtn) prevBtn.onclick = () => this.prevSlide();
      if (nextBtn) nextBtn.onclick = () => this.nextSlide();
    }

    async loadImages(files) {
      this.slides = [];
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await this._loadImage(file);
        }
      }

      if (this.slides.length > 0) {
        this.currentIndex = 0;
        this.resetZoom();
        this.renderCurrentSlide();
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
      if (!this.canvas || !this.ctx) return;

      const w = this.canvas.width;
      const h = this.canvas.height;
      this.ctx.clearRect(0, 0, w, h);

      if (this.slides.length === 0) {
        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '20px Sora, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Select image slides to present', w / 2, h / 2);
        return;
      }

      const slide = this.slides[this.currentIndex];
      const scale = Math.min(w / slide.width, h / slide.height) * this.zoomLevel;
      const x = (w - slide.width * scale) / 2 + this.panOffset.x;
      const y = (h - slide.height * scale) / 2 + this.panOffset.y;

      this.ctx.drawImage(slide, x, y, slide.width * scale, slide.height * scale);

      // Slide counter
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      this.ctx.fillRect(20, h - 55, 140, 35);
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = '600 15px Sora, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`Slide ${this.currentIndex + 1} / ${this.slides.length}`, 35, h - 32);
    }

    handleFrame(frame, dt) {
      if (this.slides.length === 0) return;
      const now = performance.now();

      for (const h of frame.hands) {
        if (h.side === 'left' && h.gesture === 'fist') {
          if (this.hooks.onExit) this.hooks.onExit();
          return;
        }

        if (now - this.lastSwipeTime > this.swipeCooldown) {
          if (h.delta && h.delta.x < -0.12) {
            this.nextSlide();
            this.lastSwipeTime = now;
          } else if (h.delta && h.delta.x > 0.12) {
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
          this.panOffset.x += h.delta.x * 500;
          this.panOffset.y -= h.delta.y * 500;
          this.renderCurrentSlide();
        }
      }
    }
  }

  AC.PresenterMode = PresenterMode;
})();
