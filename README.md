# AirControl

Touchless, gesture-driven web app with two modes:

- 🌌 **3D Universe** – procedural Milky Way, a Gargantua-style black hole with live gravitational lensing, a full Solar System (Sun flares, Earth atmosphere & clouds, Saturn's shadow-casting rings, asteroid belt, 7 major moons) and a **Google Earth surface** view.
- 📽️ **Presenter** – upload PDF / PPT / PPTX and annotate slides with hand gestures.

Everything also works with mouse + keyboard.

## Project structure

```
AirControl/
├── README.md
├── backend/
│   ├── server.js          Express: uploads (Multer), static hosting, /api/config
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── public/index.html
    └── src/
        ├── css/styles.css
        └── js/
            ├── handTracking.js   MediaPipe Hands, lerp/deadzone filtering, gestures, swipe
            ├── universeMode.js   Three.js universe + Google Earth surface view
            ├── presenterMode.js  PDF renderer, annotation layers, gesture tools
            └── main.js           State, mode switcher, input routing
```

## Setup

Requirements: **Node.js 18+**, a webcam, and a modern Chromium-based browser (Chrome / Edge recommended).

```bash
cd backend
npm install
cp .env.example .env      # then edit .env
npm start
```

Open **http://localhost:3000** and click **Enable hand tracking** (the camera needs a secure context – `localhost` qualifies; for other hosts use HTTPS).

## Google Earth configuration

1. In Google Cloud Console create (or pick) a project and enable **Maps JavaScript API** and **Map Tiles API** (Photorealistic 3D).
2. Create an API key, restrict it by HTTP referrer (e.g. `http://localhost:3000/*`) and to those APIs.
3. Put it in `backend/.env`: `GOOGLE_EARTH_API_KEY=your_key`.

Without a key (or if 3D fails to load) the app falls back to a keyless satellite embed – mouse navigation only.

## PPT / PPTX support

PDF files render directly in the browser with PDF.js. PowerPoint files are converted to PDF **on the server** with LibreOffice:

- Install LibreOffice and make sure `soffice` is on your PATH (or set `SOFFICE_PATH` in `.env`).
- If LibreOffice is missing, the app asks you to export the deck as PDF instead.

## Gestures

| Mode | Gesture | Action |
|---|---|---|
| Universe | Open palm (move) | Rotate scene |
| Universe | Hold pinch, **left** hand | Zoom in |
| Universe | Hold pinch, **right** hand | Zoom out |
| Universe | Point & hold (~1 s) | Select a body → detail card |
| Universe | Fist | Reset camera |
| Earth view | Point / Open palm / Pinch | Pan / rotate & tilt / zoom |
| Presenter | 1 finger | Pen (colour + thickness from toolbar) |
| Presenter | 2 fingers | Glowing laser pointer (no drawing) |
| Presenter | 3 fingers | Translucent highlighter |
| Presenter | Open palm (slow) | Eraser |
| Presenter | Fast horizontal swipe | Next / previous slide |

## Keyboard & mouse fallbacks

- `1` / `2` switch mode · Universe: drag to orbit, wheel to zoom, click to select, `R` reset, `+`/`-`, arrows, `Esc` deselect
- Presenter: `←` `→` change slide, `P` pen, `L` laser, `H` highlighter, `E` eraser, `C` clear slide; click slide edges to navigate
- Earth view: `Esc` or **Return to Space**

## Performance notes

- Switching to Presenter **pauses the WebGL render loop** entirely, so drawing runs at full frame rate; it resumes when you switch back.
- The Milky Way is shader-driven particles (no per-star meshes); the asteroid belt is a single instanced mesh.
- Planet textures are generated procedurally on startup (≈1 s) so no image assets are needed.
- Pixel ratio is capped at 1.75 (universe) / 2 (slides).

## Troubleshooting

- **Gestures jittery / mis-detected** – use even front lighting, keep your hand 40–80 cm from the camera, palm facing it.
- **Left/right pinch swapped** – flip the label mapping in `handTracking.js` (`side` assignment in `_results`).
- **Camera blocked** – allow camera access in the browser's site settings; everything still works with mouse/keyboard.
- **Uploads failing** – check `MAX_UPLOAD_MB` and that `backend/uploads` is writable.
