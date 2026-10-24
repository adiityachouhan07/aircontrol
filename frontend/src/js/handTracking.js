/* AirControl – MediaPipe Hands tracking, smoothing, gesture recognition */
(function () {
  const AC = (window.AC = window.AC || {});

  const CFG = {
    margin: 0.12,          // crop of camera edges so the whole screen is reachable
    deadzone: 0.004,       // normalized movement ignored below this (jitter filter)
    alphaMin: 0.12,        // lerp factor when moving slowly (heavy smoothing)
    alphaMax: 0.65,        // lerp factor when moving fast (low latency)
    pinchOn: 0.28,         // thumb–index distance / palm size to start a pinch
    pinchOff: 0.42,        // ...to release it (hysteresis)
    stableFrames: 3,       // frames a gesture must persist before it is committed
    swipeWindowMs: 380,
    swipeMinDx: 0.30,
    swipeCooldownMs: 900,
    lostMs: 250,
  };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /** Exponential lerp with deadzone and speed-adaptive alpha. */
  function smooth(prev, raw) {
    const d = Math.hypot(raw.x - prev.x, raw.y - prev.y);
    if (d < CFG.deadzone) return prev;
    const t = Math.min(1, d / 0.08);
    const a = CFG.alphaMin + (CFG.alphaMax - CFG.alphaMin) * t;
    return { x: prev.x + (raw.x - prev.x) * a, y: prev.y + (raw.y - prev.y) * a };
  }

  function fingerStates(lm) {
    const w = lm[0];
    const ext = (tip, pip) => dist(lm[tip], w) / dist(lm[pip], w) > 1.15;
    const palm = dist(lm[0], lm[9]);
    return {
      palm,
      index: ext(8, 6), middle: ext(12, 10), ring: ext(16, 14), pinky: ext(20, 18),
      thumb: dist(lm[4], lm[5]) > palm * 0.62,
      indexRatio: dist(lm[8], w) / dist(lm[6], w),
      pinchRatio: dist(lm[4], lm[8]) / palm,
    };
  }

  function classify(f, wasPinch) {
    const pinching = f.pinchRatio < (wasPinch ? CFG.pinchOff : CFG.pinchOn) && f.indexRatio > 0.95;
    if (pinching) return 'pinch';
    const n = [f.index, f.middle, f.ring, f.pinky].filter(Boolean).length;
    if (n === 4) return 'palm';
    if (f.index && f.middle && f.ring) return 'three';
    if (f.index && f.middle && !f.ring && !f.pinky) return 'peace';
    if (f.index && !f.middle && !f.ring && !f.pinky) return 'point';
    if (n === 0) return 'fist';
    return 'unknown';
  }

  class HandTracker {
    constructor({ video, overlay }) {
      this.video = video;
      this.overlay = overlay;
      this.ctx = overlay.getContext('2d');
      this.listeners = [];
      this.statusListeners = [];
      this.hands = {};      // per user-side state
      this.lastSwipe = 0;
      this.running = false;
    }
    onFrame(fn) { this.listeners.push(fn); }
    onStatus(fn) { this.statusListeners.push(fn); }
    _status(s) { this.statusListeners.forEach((f) => f(s)); }

    async start() {
      if (this.running) return;
      if (!window.Hands || !window.Camera) throw new Error('MediaPipe libraries failed to load.');
      this._status('loading');
      const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.6 });
      hands.onResults((r) => this._results(r));
      this.camera = new Camera(this.video, {
        onFrame: async () => { await hands.send({ image: this.video }); },
        width: 640, height: 480,
      });
      await this.camera.start();
      this.overlay.width = 320; this.overlay.height = 240;
      this.running = true;
      this._status('on');
    }

    stop() {
      if (this.camera) this.camera.stop();
      const s = this.video.srcObject;
      if (s) s.getTracks().forEach((t) => t.stop());
      this.running = false;
      this._status('off');
    }

    _results(res) {
      const now = performance.now();
      const W = window.innerWidth, H = window.innerHeight;
      const seen = new Set();
      const out = [];
      let swipe = null;

      this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

      (res.multiHandLandmarks || []).forEach((lm, i) => {
        // MediaPipe assumes a mirrored (selfie) image; we feed the raw video, so labels are inverted.
        const label = res.multiHandedness?.[i]?.label || 'Right';
        const side = label === 'Left' ? 'right' : 'left';
        seen.add(side);
        this._drawPreview(lm);

        const st = (this.hands[side] ||= {
          side, pos: null, gesture: 'unknown', cand: 'unknown', candN: 0, pinch: false, hist: [], lastSeen: now,
        });
        st.lastSeen = now;

        const f = fingerStates(lm);
        const raw = classify(f, st.pinch);
        st.pinch = raw === 'pinch';
        if (raw === st.cand) st.candN++; else { st.cand = raw; st.candN = 1; }
        const need = raw === 'pinch' ? 2 : CFG.stableFrames;
        if (st.candN >= need) st.gesture = raw;

        // Anchor point depends on gesture (fingertip for pointing, palm centre otherwise)
        let a;
        if (st.gesture === 'pinch') a = { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
        else if (['point', 'peace', 'three'].includes(st.gesture)) a = lm[8];
        else a = lm[9];
        let n = { x: clamp01(((1 - a.x) - CFG.margin) / (1 - 2 * CFG.margin)), y: clamp01((a.y - CFG.margin) / (1 - 2 * CFG.margin)) };
        const prev = st.pos || n;
        st.pos = smooth(prev, n);
        const delta = { x: st.pos.x - prev.x, y: st.pos.y - prev.y };

        // Swipe detection on raw palm x (open palm / unknown, fast horizontal travel)
        st.hist.push({ t: now, x: 1 - lm[9].x, y: lm[9].y });
        while (st.hist.length && now - st.hist[0].t > CFG.swipeWindowMs) st.hist.shift();
        if (['palm', 'unknown'].includes(st.gesture) && st.hist.length > 4 && now - this.lastSwipe > CFG.swipeCooldownMs) {
          const a0 = st.hist[0], a1 = st.hist[st.hist.length - 1];
          const dx = a1.x - a0.x, dy = a1.y - a0.y;
          if (Math.abs(dx) > CFG.swipeMinDx && Math.abs(dy) < Math.abs(dx) * 0.55) {
            swipe = dx > 0 ? 'right' : 'left';
            this.lastSwipe = now;
            st.hist = [];
          }
        }

        out.push({
          side, gesture: st.gesture, norm: { ...st.pos }, delta,
          x: st.pos.x * W, y: st.pos.y * H,
          pinchRatio: f.pinchRatio, palmSize: f.palm,
        });
      });

      // drop hands that disappeared
      Object.keys(this.hands).forEach((k) => {
        if (!seen.has(k) && now - this.hands[k].lastSeen > CFG.lostMs) delete this.hands[k];
      });

      const frame = { hands: out, swipe, swipeRecent: now - this.lastSwipe < 600, time: now };
      this.listeners.forEach((fn) => fn(frame));
    }

    _drawPreview(lm) {
      const c = this.ctx, w = this.overlay.width, h = this.overlay.height;
      c.fillStyle = 'rgba(94,231,255,.9)';
      lm.forEach((p) => { c.beginPath(); c.arc(p.x * w, p.y * h, 2.2, 0, 6.283); c.fill(); });
    }
  }

  AC.HandTracker = HandTracker;
  AC.GESTURE_LABEL = { palm: 'Open palm', pinch: 'Pinch', point: 'Point', peace: 'Two fingers', three: 'Three fingers', fist: 'Fist', unknown: '…' };
})();
