/* ==========================================
   AirControl – Global Styles & Layouts
   ========================================== */
* { box-sizing: border-box; margin: 0; padding: 0; }
body, html { width: 100%; height: 100%; overflow: hidden; background: #01030a; font-family: 'Sora', sans-serif; color: #fff; }

/* Glassmorphism Effect */
.glass {
  background: rgba(13, 25, 48, 0.75);
  border: 1px solid rgba(94, 231, 255, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Topbar Header */
#topbar {
  position: absolute; top: 16px; left: 20px; right: 20px; z-index: 100;
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 24px; border-radius: 16px;
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 18px; color: #5ee7ff; }
.brand-dot { width: 10px; height: 10px; background: #5ee7ff; border-radius: 50%; box-shadow: 0 0 10px #5ee7ff; }

#mode-tabs { display: flex; gap: 8px; }
.tab {
  background: transparent; border: 1px solid rgba(94, 231, 255, 0.2); color: #a4b8d9;
  padding: 8px 18px; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: 500; transition: 0.2s;
}
.tab.active, .tab:hover { background: rgba(61, 123, 255, 0.3); border-color: rgba(94, 231, 255, 0.6); color: #fff; }

.status { display: flex; align-items: center; gap: 12px; }
.pill { padding: 6px 14px; border-radius: 20px; font-size: 13px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
.pill.off { color: #ff6b6b; border-color: rgba(255, 107, 107, 0.3); }

.btn-glow {
  background: #3d7bff; border: 1px solid rgba(94, 231, 255, 0.6); color: #fff;
  padding: 8px 18px; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: 600;
  box-shadow: 0 0 15px rgba(61, 123, 255, 0.4); transition: 0.2s;
}
.btn-glow:hover { background: #528bff; box-shadow: 0 0 20px rgba(94, 231, 255, 0.6); }

/* Mode Roots */
.mode-root { position: absolute; inset: 0; }
.mode-root.hidden { display: none !important; }

/* Universe Mode Elements */
#universe-canvas { width: 100%; height: 100%; display: block; }
#uni-breadcrumb { position: absolute; top: 90px; left: 20px; z-index: 50; padding: 10px 20px; border-radius: 12px; font-size: 14px; display: flex; gap: 12px; align-items: center; }
#btn-back-galaxy { background: none; border: none; color: #5ee7ff; cursor: pointer; font-family: inherit; font-weight: 600; }
#btn-back-galaxy.hidden { display: none; }

#gesture-help { position: absolute; bottom: 20px; left: 20px; z-index: 50; padding: 16px 20px; border-radius: 14px; font-size: 13px; line-height: 1.6; color: #a4b8d9; }
#gesture-help b { color: #fff; }
#gesture-help .muted { margin-top: 6px; font-size: 11px; color: #6c8cb8; }

/* Celestial Body Info Card */
#body-card { position: absolute; bottom: 30px; right: 30px; width: 340px; padding: 24px; border-radius: 18px; z-index: 60; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
#body-card.hidden { display: none; }
#body-card h2 { font-size: 24px; color: #fff; margin-bottom: 2px; }
#body-card .muted { font-size: 12px; color: #5ee7ff; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
#body-card p { font-size: 13px; color: #a4b8d9; line-height: 1.5; margin-bottom: 16px; }
#body-card dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; font-size: 12px; }
#body-card dt { color: #6c8cb8; }
#body-card dd { color: #fff; font-weight: 600; text-align: right; }
.card-actions { display: flex; gap: 10px; }
.icon-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: #a4b8d9; font-size: 20px; cursor: pointer; }

/* Earth Surface View (OpenLayers Map) */
#earth-view { position: absolute; inset: 0; background: #000; z-index: 80; display: flex; flex-direction: column; }
#earth-view.hidden { display: none !important; }
#earth-map { width: 100%; height: 100%; }
#earth-return { position: absolute; top: 20px; right: 20px; z-index: 90; }
#earth-help { position: absolute; bottom: 20px; right: 20px; z-index: 90; padding: 14px 18px; border-radius: 12px; font-size: 12px; line-height: 1.5; }

/* Presenter Mode Elements */
#stage { position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #050b18; overflow: hidden; }
#stage canvas { position: absolute; display: block; }
.edge { position: absolute; top: 0; bottom: 0; width: 80px; z-index: 30; cursor: pointer; }
#edge-prev { left: 0; }
#edge-next { right: 0; }

#toolbar { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 50; display: flex; align-items: center; gap: 16px; padding: 12px 20px; border-radius: 16px; }
.tool-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; color: #5ee7ff; transition: 0.2s; }
.tool-btn:hover { background: rgba(61,123,255,0.4); }
#swatches { display: flex; gap: 8px; }
.swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: 0.2s; }
.swatch.active { border-color: #fff; transform: scale(1.15); box-shadow: 0 0 10px rgba(255,255,255,0.6); }
#thickness { accent-color: #5ee7ff; cursor: pointer; }

#pres-indicator { position: absolute; bottom: 24px; right: 24px; z-index: 50; padding: 10px 18px; border-radius: 12px; font-size: 13px; display: flex; gap: 12px; }
#toast { position: absolute; top: 90px; left: 50%; transform: translateX(-50%); z-index: 100; padding: 10px 24px; border-radius: 12px; font-size: 14px; color: #5ee7ff; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
#toast.hidden { display: none; }

/* Hand Cursors & Bottom-Right Camera Preview */
.hand-cursor { position: absolute; width: 48px; height: 48px; pointer-events: none; z-index: 1000; transform: translate(-50%, -50%); }
.hand-cursor.hidden { display: none; }
.hand-cursor .ring { fill: none; stroke: #5ee7ff; stroke-width: 2.5; stroke-dasharray: 125; stroke-dashoffset: 0; transition: stroke-dashoffset 0.1s linear; }

#cam-preview { position: absolute; bottom: 20px; right: 20px; width: 180px; height: 120px; border-radius: 14px; overflow: hidden; z-index: 100; border: 1px solid rgba(94,231,255,0.3); }
#cam-preview.hidden { display: none; }
#cam-video, #cam-overlay { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); position: absolute; inset: 0; }

/* ==========================================
   Presenter Fullscreen & Floating FaceCam 
   ========================================== */
body.presenter-fullscreen #presenter-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  background: #000;
}

#presenter-facecam {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 220px;
  height: 140px;
  border-radius: 16px;
  overflow: hidden;
  z-index: 10000;
  border: 2px solid rgba(94, 231, 255, 0.6);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
  transition: all 0.3s ease;
}
#presenter-facecam.hidden { display: none !important; }
#presenter-facecam video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
