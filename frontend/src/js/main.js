/* AirControl – application controller: state, mode switching, input routing */
(function () {
  const AC = window.AC;
  const $ = (id) => document.getElementById(id);

  const state = { mode: 'universe', tracking: false, lastFrameT: 0 };
  const els = {
    cam: $('cam-status'), gest: $('gesture-status'), camBtn: $('cam-btn'), preview: $('cam-preview'),
    uni: $('universe-root'), pres: $('presenter-root'), cursors: [$('cursor-0'), $('cursor-1')],
  };

  /* ---------- modules ---------- */
  const presenter = new AC.PresenterMode();
  const earth = new AC.EarthSurface();
  const universe = new AC.UniverseMode($('universe-canvas'), { onLand: () => { universe.pause(); earth.open(); } });
  try { universe.init(); }
  catch (e) { console.error(e); presenter.toast('WebGL is unavailable – Universe mode cannot start.', 6000); }

  const closeEarth = earth.close.bind(earth);
  earth.close = () => { closeEarth(); if (state.mode === 'universe') universe.start(); };

  /* ---------- mode switcher ---------- */
  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    document.body.className = `mode-${mode}${earth.active ? ' earth-open' : ''}`;
    document.querySelectorAll('#mode-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    els.uni.classList.toggle('hidden', mode !== 'universe');
    els.pres.classList.toggle('hidden', mode !== 'presenter');
    if (mode === 'presenter') { universe.pause(); presenter.activate(); }          // free the GPU for 60 FPS drawing
    else { presenter.deactivate(); if (!earth.active) universe.start(); universe.resize(); }
  }
  document.querySelectorAll('#mode-tabs .tab').forEach((t) => (t.onclick = () => setMode(t.dataset.mode)));

  /* ---------- hand tracking ---------- */
  const tracker = new AC.HandTracker({ video: $('cam-video'), overlay: $('cam-overlay') });
  tracker.onStatus((s) => {
    els.cam.className = 'pill ' + (s === 'on' ? 'on' : 'off');
    els.cam.textContent = { on: 'Camera on', off: 'Camera off', loading: 'Starting camera…' }[s];
    state.tracking = s === 'on'; els.preview.classList.toggle('hidden', s !== 'on'); els.camBtn.textContent = s === 'on' ? 'Disable hand tracking' : 'Enable hand tracking';
  });
  els.camBtn.onclick = async () => {
    if (state.tracking) { tracker.stop(); hideCursors(); els.gest.textContent = 'No hand'; return; }
    try { await tracker.start(); }
    catch (e) { console.error(e); els.cam.textContent = 'Camera blocked'; presenter.toast('Camera unavailable – mouse & keyboard controls still work.', 4500); }
  };

  const hideCursors = () => els.cursors.forEach((c) => c.classList.add('hidden'));

  tracker.onFrame((frame) => {
    const dt = Math.min(0.1, Math.max(0.001, (frame.time - state.lastFrameT) / 1000 || 0.033)); state.lastFrameT = frame.time;
    els.gest.textContent = frame.hands.length ? frame.hands.map((h) => `${h.side[0].toUpperCase()}: ${AC.GESTURE_LABEL[h.gesture]}`).join('  ') : 'No hand';
    els.gest.classList.toggle('on', frame.hands.length > 0);

    let dwell = { side: null, progress: 0, hovering: false };
    if (earth.active) earth.handleFrame(frame, dt);
    else if (state.mode === 'universe') dwell = universe.handleFrame(frame, dt);
    else frame.hands.length ? presenter.handleFrame(frame) : presenter.noHands();

    // cursors
    els.cursors.forEach((c, i) => {
      const h = frame.hands[i];
      const drawing = state.mode === 'presenter' && !earth.active && ['point', 'peace', 'three', 'palm'].includes(h?.gesture);
      if (!h || drawing) return c.classList.add('hidden');
      c.classList.remove('hidden'); c.style.transform = `translate(${h.x}px, ${h.y}px)`;
      c.classList.toggle('pinch', h.gesture === 'pinch'); c.classList.toggle('palm', h.gesture === 'palm');
      const hov = dwell.side === h.side && dwell.hovering; c.classList.toggle('hover', hov);
      c.querySelector('.ring').style.strokeDashoffset = 125.7 * (1 - (dwell.side === h.side ? dwell.progress : 0));
    });
  });

  /* ---------- keyboard ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input[type=text]')) return;
    if (e.key === '1') return setMode('universe');
    if (e.key === '2') return setMode('presenter');
    if (earth.active) { if (e.key === 'Escape') earth.close(); return; }
    if (state.mode === 'universe') universe.handleKey(e); else presenter.handleKey(e);
  });

  /* ---------- lifecycle ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) universe.pause();
    else if (state.mode === 'universe' && !earth.active) universe.start();
  });
  universe.start();
  window.AC.app = { state, universe, presenter, earth, tracker, setMode };
})();
