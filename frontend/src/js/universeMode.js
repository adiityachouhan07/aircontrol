/* AirControl – 3D Universe mode (Three.js r128) + Google Earth surface view */
(function () {
  const AC = (window.AC = window.AC || {});
  const { PI } = Math;
  const TAU = PI * 2;

  /* ---------- procedural noise + texture helpers ---------- */
  function h3(x, y, z) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const sm = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
    const c = (a, b, d) => h3(xi + a, yi + b, zi + d);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), fx), lerp(c(0, 1, 0), c(1, 1, 0), fx), fy),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), fx), lerp(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
  }
  function fbm(x, y, z, o) {
    let a = 0.5, s = 0, f = 1, n = 0;
    for (let i = 0; i < o; i++) { s += a * noise3(x * f, y * f, z * f); n += a; f *= 2.03; a *= 0.5; }
    return s / n;
  }
  const hex = (h) => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
  const smooth01 = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  function mix(a, b, t, o) { o[0] = lerp(a[0], b[0], t); o[1] = lerp(a[1], b[1], t); o[2] = lerp(a[2], b[2], t); }

  function paint(w, h, px) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h); const o = [0, 0, 0, 255];
    for (let y = 0; y < h; y++) {
      const v = (y + 0.5) / h, ph = v * PI, sy = Math.cos(ph), sr = Math.sin(ph);
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w, th = u * TAU; o[3] = 255;
        px(sr * Math.cos(th), sy, sr * Math.sin(th), th, o);
        const i = (y * w + x) * 4; img.data[i] = o[0]; img.data[i + 1] = o[1]; img.data[i + 2] = o[2]; img.data[i + 3] = o[3];
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }

  const earthH = (x, y, z) => fbm(x * 2 + 3, y * 2, z * 2, 6);
  const TEX = {
    rock(p, w, h) {
      const c0 = hex(p[0]), c1 = hex(p[1]);
      return paint(w, h, (x, y, z, th, o) => {
        const n = fbm(x * 3, y * 3, z * 3, 5), cr = fbm(x * 9 + 5, y * 9, z * 9, 3);
        mix(c0, c1, n, o); let s = 0.75 + Math.abs(cr - 0.5) * 1.1; if (cr < 0.34) s *= 0.7;
        o[0] *= s; o[1] *= s; o[2] *= s;
      });
    },
    bands(def, w, h, spot) {
      const p = def, c0 = hex(def.pal[0]), c1 = hex(def.pal[1]), c2 = hex(def.pal[2]);
      return paint(w, h, (x, y, z, th, o) => {
        const t = fbm(x * 2, y * 5, z * 2, 4), k = 0.5 + 0.5 * Math.sin(y * p.freq + t * p.turb);
        mix(c0, c1, k, o); const d = smooth01(0.55, 0.9, fbm(x * 8, y * 30, z * 8, 3)) * 0.45;
        const m = [o[0], o[1], o[2]]; mix(m, c2, d, o);
        if (spot) { let dx = Math.atan2(Math.sin(th - 4.2), Math.cos(th - 4.2)) / 0.28, dy = (y + 0.32) / 0.11, dd = dx * dx + dy * dy;
          if (dd < 1) { const m2 = [o[0], o[1], o[2]]; mix(m2, hex('#b4492c'), (1 - dd) * 0.9, o); } }
      });
    },
    gas(p, w, h) {
      const c0 = hex(p[0]), c1 = hex(p[1]);
      return paint(w, h, (x, y, z, th, o) => mix(c0, c1, 0.5 * fbm(x * 1.5, y * 3, z * 1.5, 3) + 0.25 * Math.sin(y * 9) + 0.25, o));
    },
    venus(p, w, h) {
      const c0 = hex(p[0]), c1 = hex(p[1]);
      return paint(w, h, (x, y, z, th, o) => mix(c0, c1, fbm(x * 2 + fbm(x, y, z, 3) * 2, y * 4, z * 2, 5), o));
    },
    ice(p, w, h) {
      const c0 = hex(p[0]), c1 = hex(p[1]);
      return paint(w, h, (x, y, z, th, o) => {
        const r = Math.abs(fbm(x * 5, y * 5, z * 5, 3) - 0.5); mix(c0, c1, r < 0.02 ? 0.9 : fbm(x * 3, y * 3, z * 3, 3) * 0.35, o);
      });
    },
    volcanic(p, w, h) {
      const c0 = hex(p[0]), c1 = hex(p[1]), c2 = hex(p[2]);
      return paint(w, h, (x, y, z, th, o) => {
        mix(c0, c1, fbm(x * 4, y * 4, z * 4, 4), o);
        const d = smooth01(0.66, 0.74, fbm(x * 8 + 9, y * 8, z * 8, 3)); const m = [o[0], o[1], o[2]]; mix(m, c2, d, o);
      });
    },
    earth(w, h) {
      const deep = hex('#08275a'), shal = hex('#1b6aa8'), coast = hex('#3aa8b0'), g = hex('#2f6b3a'), ol = hex('#6d6e3a'),
        br = hex('#7b6a58'), sand = hex('#b79c64'), wh = [240, 246, 252];
      return paint(w, h, (x, y, z, th, o) => {
        const e = earthH(x, y, z), lat = Math.abs(y);
        if (lat > 0.88 + (fbm(x * 6, 0, z * 6, 2) - 0.5) * 0.1) { o[0] = wh[0]; o[1] = wh[1]; o[2] = wh[2]; return; }
        if (e < 0.52) { mix(deep, shal, Math.pow(e / 0.52, 3), o); if (e > 0.495) mix(o.slice(), coast, (e - 0.495) / 0.025, o); return; }
        const n = fbm(x * 7, y * 7, z * 7, 4); mix(g, ol, n, o);
        if (lat < 0.4 && n > 0.5) { const m = [o[0], o[1], o[2]]; mix(m, sand, smooth01(0.5, 0.65, n), o); }
        if (e > 0.62) { const m = [o[0], o[1], o[2]]; mix(m, br, smooth01(0.62, 0.7, e), o); }
        if (lat > 0.72) { const m = [o[0], o[1], o[2]]; mix(m, wh, smooth01(0.72, 0.86, lat), o); }
      });
    },
    earthSpec(w, h) {
      return paint(w, h, (x, y, z, th, o) => { const s = earthH(x, y, z) < 0.52 && Math.abs(y) < 0.88 ? 235 : 12; o[0] = o[1] = o[2] = s; });
    },
    clouds(w, h) {
      return paint(w, h, (x, y, z, th, o) => {
        const n = fbm(x * 3 + 11 + fbm(x, y, z, 2) * 1.2, y * 4, z * 3, 5); const a = smooth01(0.5, 0.72, n);
        o[0] = o[1] = o[2] = 255; o[3] = a * 230;
      });
    },
  };

  /* ---------- shared sprite textures ---------- */
  function radialTex(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([t, col]) => g.addColorStop(t, col));
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  function ringTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.strokeStyle = 'rgba(94,231,255,.95)'; x.lineWidth = 3; x.shadowColor = '#5ee7ff'; x.shadowBlur = 8;
    x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); return new THREE.CanvasTexture(c);
  }
  function labelSprite(text, color = '#dce8ff', size = 26) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 72; const x = c.getContext('2d');
    x.font = '300 34px Sora, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(61,123,255,.9)'; x.shadowBlur = 10; x.fillStyle = color; x.fillText(text, 160, 36);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false, opacity: 0.9 }));
    s.scale.set(size, size * 72 / 320, 1); s.renderOrder = 10; return s;
  }

  /* ---------- content data ---------- */
  const PLANETS = [
    { id: 'mercury', name: 'Mercury', r: 1.1, d: 14, sp: 0.55, kind: 'rock', pal: ['#58534e', '#a49a8e'], desc: 'The smallest planet and the closest to the Sun, with a cratered surface and extreme temperature swings.', facts: [['Diameter', '4,879 km'], ['From Sun', '57.9 M km'], ['Year', '88 days'], ['Moons', '0']] },
    { id: 'venus', name: 'Venus', r: 1.9, d: 20, sp: 0.4, kind: 'venus', pal: ['#c9a566', '#f1deb0'], atmo: [1, 0.8, 0.4], desc: 'Wrapped in thick sulphuric-acid clouds, Venus has the hottest surface of any planet.', facts: [['Diameter', '12,104 km'], ['From Sun', '108 M km'], ['Year', '225 days'], ['Moons', '0']] },
    { id: 'earth', name: 'Earth', r: 2, d: 27, sp: 0.3, kind: 'earth', res: [512, 256], atmo: [0.3, 0.6, 1], desc: 'Our home world: liquid oceans, a protective atmosphere and the only known life in the universe.', facts: [['Diameter', '12,742 km'], ['From Sun', '149.6 M km'], ['Year', '365.25 days'], ['Moons', '1']] },
    { id: 'mars', name: 'Mars', r: 1.5, d: 34, sp: 0.24, kind: 'rock', pal: ['#8c3d22', '#d78a54'], desc: 'The red planet: iron-rich dust, the tallest volcano in the solar system and ancient dry river beds.', facts: [['Diameter', '6,779 km'], ['From Sun', '227.9 M km'], ['Year', '687 days'], ['Moons', '2']] },
    { id: 'jupiter', name: 'Jupiter', r: 5, d: 62, sp: 0.13, kind: 'bands', res: [512, 256], pal: ['#c9a27a', '#efe0cb', '#9c5f3c'], freq: 26, turb: 5, spot: true, desc: 'A gas giant more massive than all other planets combined, with a storm — the Great Red Spot — wider than Earth.', facts: [['Diameter', '139,820 km'], ['From Sun', '778 M km'], ['Year', '11.9 yrs'], ['Moons', '95+']] },
    { id: 'saturn', name: 'Saturn', r: 4.2, d: 84, sp: 0.1, kind: 'bands', res: [512, 256], pal: ['#d8c08a', '#f1e3b8', '#b99a62'], freq: 18, turb: 2.5, rings: true, desc: 'Famous for its bright ring system of ice and rock, which also casts a shadow across the planet.', facts: [['Diameter', '116,460 km'], ['From Sun', '1.43 B km'], ['Year', '29.5 yrs'], ['Moons', '140+']] },
    { id: 'uranus', name: 'Uranus', r: 2.8, d: 102, sp: 0.07, kind: 'gas', pal: ['#7fd0d8', '#b5eaee'], tilt: 1.7, desc: 'An ice giant that rotates on its side, giving it extreme seasons.', facts: [['Diameter', '50,724 km'], ['From Sun', '2.87 B km'], ['Year', '84 yrs'], ['Moons', '28']] },
    { id: 'neptune', name: 'Neptune', r: 2.7, d: 118, sp: 0.055, kind: 'gas', pal: ['#2b4fb8', '#5d86e8'], desc: 'The windiest planet, a deep-blue ice giant at the edge of the planets.', facts: [['Diameter', '49,244 km'], ['From Sun', '4.5 B km'], ['Year', '165 yrs'], ['Moons', '16']] },
  ];
  const MOONS = [
    { id: 'moon', name: 'Moon', parent: 'earth', r: 0.55, o: 4.4, sp: 0.9, kind: 'rock', pal: ['#6c6c6c', '#bdbdbd'], desc: 'Earth’s only natural satellite, tidally locked and heavily cratered.', facts: [['Diameter', '3,474 km'], ['Orbit', '27.3 days']] },
    { id: 'io', name: 'Io', parent: 'jupiter', r: 0.55, o: 8.5, sp: 1.6, kind: 'volcanic', pal: ['#e8d27a', '#d9822b', '#3a2a22'], desc: 'The most volcanically active body in the solar system.', facts: [['Diameter', '3,643 km'], ['Orbit', '1.77 days']] },
    { id: 'europa', name: 'Europa', parent: 'jupiter', r: 0.5, o: 11, sp: 1.2, kind: 'ice', pal: ['#e9ecef', '#a5684a'], desc: 'An icy shell hides a global salty ocean — a top target in the search for life.', facts: [['Diameter', '3,122 km'], ['Orbit', '3.55 days']] },
    { id: 'ganymede', name: 'Ganymede', parent: 'jupiter', r: 0.82, o: 14.2, sp: 0.9, kind: 'rock', pal: ['#5d5650', '#a79c8e'], desc: 'The largest moon in the solar system — bigger than Mercury.', facts: [['Diameter', '5,268 km'], ['Orbit', '7.15 days']] },
    { id: 'callisto', name: 'Callisto', parent: 'jupiter', r: 0.76, o: 18, sp: 0.7, kind: 'rock', pal: ['#3a3532', '#756b62'], desc: 'One of the most heavily cratered surfaces known.', facts: [['Diameter', '4,821 km'], ['Orbit', '16.7 days']] },
    { id: 'enceladus', name: 'Enceladus', parent: 'saturn', r: 0.32, o: 12.8, sp: 1.3, kind: 'ice', pal: ['#fbfdff', '#b8d4e8'], desc: 'Geysers at its south pole vent water from a subsurface ocean.', facts: [['Diameter', '504 km'], ['Orbit', '1.37 days']] },
    { id: 'titan', name: 'Titan', parent: 'saturn', r: 0.85, o: 16.5, sp: 0.6, kind: 'gas', pal: ['#c98a3a', '#e8b868'], desc: 'The only moon with a thick atmosphere and lakes of liquid methane.', facts: [['Diameter', '5,150 km'], ['Orbit', '15.9 days']] },
  ];
  const STARS = [
    ['Sirius', [60, 6, -46], 'Brightest star in Earth’s night sky.', [['Distance', '8.6 ly'], ['Type', 'A1V binary']]],
    ['Betelgeuse', [-70, -4, -60], 'Red supergiant in Orion, nearing the end of its life.', [['Distance', '~550 ly'], ['Type', 'M1 supergiant']]],
    ['Polaris', [25, 14, 82], 'The North Star, a pulsating Cepheid variable.', [['Distance', '~430 ly'], ['Type', 'F7 supergiant']]],
    ['Alpha Centauri', [-30, -8, 52], 'Closest star system to the Sun.', [['Distance', '4.37 ly'], ['Type', 'G2V + K1V + M5V']]],
    ['Vega', [92, 10, 30], 'A fast-spinning blue-white star in Lyra.', [['Distance', '25 ly'], ['Type', 'A0V']]],
    ['Rigel', [-96, 6, 20], 'Blue supergiant, the bright foot of Orion.', [['Distance', '~860 ly'], ['Type', 'B8 supergiant']]],
    ['Antares', [-8, 12, -92], 'Red supergiant, the heart of Scorpius.', [['Distance', '~550 ly'], ['Type', 'M1.5 supergiant']]],
    ['Arcturus', [48, -10, -88], 'Brightest star in the northern sky, an orange giant.', [['Distance', '37 ly'], ['Type', 'K1.5 giant']]],
  ];
  const SOLAR_POS = new THREE.Vector3(430, 0, 150);
  const DWELL = 1.1;

  /* ---------- shaders ---------- */
  const NOISE_GLSL = `
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}`;
  const PARTICLE_V = `
    attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uTime, uPx, uMin;
    varying vec3 vC; varying float vA;
    void main(){ vC=aColor; vA=aAlpha*(0.65+0.35*sin(uTime*(0.6+aSize*0.4)+position.x*0.13+position.z*0.07));
      vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(aSize*uPx*(420./-mv.z),uMin,48.); }`;
  const PARTICLE_F = `
    varying vec3 vC; varying float vA;
    void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); a*=a; gl_FragColor=vec4(vC,a*vA); }`;
  const DISK_V = `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
  const DISK_F = `
    uniform float uTime,uIn,uOut,uGain; varying vec2 vP; ${NOISE_GLSL}
    void main(){ float r=length(vP); float t=(r-uIn)/(uOut-uIn); if(t<0.||t>1.) discard;
      float a=atan(vP.y,vP.x);
      float n=noise(vec2((a+uTime*0.9/(t+0.18))*5.,t*22.))*.6+noise(vec2((a*2.+uTime*0.6/(t+.25))*9.,t*55.))*.4;
      vec3 hot=vec3(1.,.96,.86),mid=vec3(1.,.55,.16),cool=vec3(.45,.09,.02);
      vec3 col=mix(hot,mid,smoothstep(0.,.3,t)); col=mix(col,cool,smoothstep(.3,1.,t));
      float inten=(1.15-t)*(0.45+1.0*n); float dop=0.5+0.5*cos(a-0.7);
      float edge=smoothstep(0.,.04,t)*(1.-smoothstep(.7,1.,t));
      gl_FragColor=vec4(col*inten*(0.35+dop)*uGain, edge*min(1.,inten)); }`;
  const SUN_V = `varying vec3 vO; void main(){ vO=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
  const SUN_F = `
    uniform float uTime; varying vec3 vO;
    float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,0,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
    void main(){ vec3 p=normalize(vO)*3.; float t=uTime*0.15;
      float n=n3(p*1.5+t)*.55+n3(p*3.5-t*1.3)*.3+n3(p*8.+t*2.)*.15;
      vec3 c=mix(vec3(.9,.25,.02),vec3(1.,.85,.35),n); c=mix(c,vec3(1.,.97,.8),smoothstep(.62,.9,n));
      c*=0.8+smoothstep(.55,.2,n)*-.25; gl_FragColor=vec4(c*1.25,1.); }`;
  const FLARE_V = `
    attribute vec3 aDir; attribute float aSeed; uniform float uTime,uR,uPx; varying float vA;
    void main(){ float life=fract(uTime*(0.07+aSeed*0.08)+aSeed*7.); float s=sin(life*3.1416);
      vec3 p=aDir*(uR+s*(1.5+aSeed*5.5)); vA=s*(.4+aSeed*.6);
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp((1.2+aSeed*2.5)*uPx*(220./-mv.z),1.,16.); }`;
  const FLARE_F = `varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(1.,.55+.3*a,.15,a*vA); }`;
  const ATMO_V = `
    uniform vec3 uSun; varying vec3 vN,vV,vS;
    void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz);
      vS=normalize((viewMatrix*vec4(uSun,0.)).xyz); gl_Position=projectionMatrix*mv; }`;
  const ATMO_F = `
    uniform vec3 uCol; varying vec3 vN,vV,vS;
    void main(){ float f=pow(1.-max(dot(vN,vV),0.),3.2); float l=dot(vN,vS);
      float day=smoothstep(-.25,.35,l); vec3 c=mix(vec3(1.,.42,.18),uCol,smoothstep(-.05,.5,l));
      gl_FragColor=vec4(c*1.4,f*day*1.15); }`;
  const POST_F = `
    uniform sampler2D tDiffuse; uniform vec2 uCenter; uniform float uAspect,uRs,uK,uOn; varying vec2 vUv;
    void main(){ vec2 uv=vUv;
      if(uOn>.5){ vec2 d=uv-uCenter; d.x*=uAspect; float r=length(d); vec2 dir=d/max(r,1e-5);
        float defl=uK*uRs*uRs/max(r,uRs*.6); float rp=max(r-defl,0.); vec2 sd=dir*rp; sd.x/=uAspect;
        uv=clamp(uCenter+sd,.001,.999); }
      gl_FragColor=texture2D(tDiffuse,uv); }`;

  /* ================== UniverseMode ================== */
  class UniverseMode {
    constructor(canvas, hooks = {}) {
      this.canvas = canvas; this.hooks = hooks; this.scope = 'galaxy'; this.running = false;
      this.hover = null; this.selected = null; this.dwell = 0; this.dwellBody = null;
      this.prevGesture = {}; this.lastReset = 0; this.pickables = { galaxy: [], system: [] };
      this.mouse = { down: false, x: 0, y: 0, moved: 0 };
      this.ray = new THREE.Raycaster(); this.tmp = new THREE.Vector3(); this.clock = new THREE.Clock(false);
      this.view = this._defaultView('galaxy'); this.goal = this._defaultView('galaxy');
      this.focus = null; this.orbiters = []; this.t = 0;
      this.pmats = [];
      this.atmos = [];
    }

    _defaultView(scope) {
      return scope === 'galaxy'
        ? { theta: 0.6, phi: 1.2, radius: 640, target: new THREE.Vector3() }
        : { theta: 0.5, phi: 1.1, radius: 210, target: new THREE.Vector3() };
    }

    init() {
      const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' }));
      this.px = Math.min(window.devicePixelRatio || 1, 1.75);
      r.setPixelRatio(this.px); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x01030a);
      this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 20000);
      this.galaxyG = new THREE.Group(); this.systemG = new THREE.Group(); this.systemG.visible = false;
      this.scene.add(this.galaxyG, this.systemG);
      this.glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
      this.hoverRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.hoverRing.visible = false; this.hoverRing.renderOrder = 20; this.scene.add(this.hoverRing);

      this._buildFarStars(); this._buildGalaxy(); this._buildBlackHole(); this._buildMarkers(); this._buildSystem(); this._buildPost();
      this._bindDOM(); this.resize(); this._applyView(1); this._renderCard(null);
    }

    /* ----- builders ----- */
    _particles(pos, col, size, alpha, min = 1) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
      const m = new THREE.ShaderMaterial({ vertexShader: PARTICLE_V, fragmentShader: PARTICLE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPx: { value: this.px }, uMin: { value: min * this.px } } });
      const p = new THREE.Points(g, m); p.frustumCulled = false; 
      
      if (!this.pmats) this.pmats = [];
      this.pmats.push(m); 
      return p;
    }
    _buildFarStars() {
      const N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N), al = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const u = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - u * u), R = 6000;
        pos.set([R * s * Math.cos(a), R * u, R * s * Math.sin(a)], i * 3);
        const w = Math.random(); col.set([0.7 + 0.3 * w, 0.8 + 0.1 * w, 1], i * 3); sz[i] = 6 + Math.random() * 14; al[i] = 0.35 + Math.random() * 0.6;
      }
      this.scene.add(this._particles(pos, col, sz, al, 1.2));
    }
    _buildGalaxy() {
      const N = 70000, R = 900, arms = 4, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N), al = new Float32Array(N);
      const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      for (let i = 0; i < N; i++) {
        let r, a, y; const c = [1, 1, 1];
        if (Math.random() < 0.2) { r = Math.pow(Math.random(), 1.7) * 170; a = Math.random() * TAU; y = g() * 28 * (1 - r / 220); c[0] = 1; c[1] = 0.82; c[2] = 0.6; }
        else {
          r = (0.05 + Math.pow(Math.random(), 0.8)) * R; const arm = Math.floor(Math.random() * arms);
          a = arm * (TAU / arms) + (r / R) * 5.4 + g() * 0.42 * (1.1 - 0.6 * r / R); y = g() * 14 * (1 - 0.8 * r / R);
          const t = r / R; c[0] = lerp(1, 0.4, Math.min(1, t * 1.3)); c[1] = lerp(0.85, 0.62, t); c[2] = lerp(0.65, 1, Math.min(1, t * 1.6));
          if (Math.random() < 0.04) { c[0] = 1; c[1] = 0.5; c[2] = 0.75; }
        }
        pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); col.set(c, i * 3); sz[i] = 1.2 + Math.random() * 2.6; al[i] = 0.35 + Math.random() * 0.65;
      }
      this.galaxyG.add(this._particles(pos, col, sz, al));
      // translucent dust lanes
      const D = 5000, dp = new Float32Array(D * 3), dc = new Float32Array(D * 3), ds = new Float32Array(D), da = new Float32Array(D);
      for (let i = 0; i < D; i++) {
        const r = (0.1 + Math.pow(Math.random(), 0.9)) * R, arm = Math.floor(Math.random() * arms), a = arm * (TAU / arms) + (r / R) * 5.4 + g() * 0.25;
        dp.set([Math.cos(a) * r, g() * 10, Math.sin(a) * r], i * 3); dc.set([0.25, 0.35, 0.9], i * 3); ds[i] = 26 + Math.random() * 30; da[i] = 0.05;
      }
      this.galaxyG.add(this._particles(dp, dc, ds, da));
    }
    _buildBlackHole() {
      const bh = (this.bh = new THREE.Group()); this.galaxyG.add(bh);
      bh.add(new THREE.Mesh(new THREE.SphereGeometry(14, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 })));
      const mk = (a, b, seg, frag, gain) => new THREE.ShaderMaterial({ vertexShader: DISK_V, fragmentShader: frag, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uIn: { value: a }, uOut: { value: b }, uGain: { value: gain } } });
      this.diskMat = mk(19, 84, 160, DISK_F, 1.5);
      const disk = new THREE.Mesh(new THREE.RingGeometry(19, 84, 160, 1), this.diskMat); disk.rotation.x = -PI / 2; bh.add(disk);
      this.haloMat = mk(14.6, 34, 96, DISK_F, 1.0);
      this.halo = new THREE.Mesh(new THREE.RingGeometry(14.6, 34, 96, 1), this.haloMat); bh.add(this.halo);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff9a40, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(210, 210, 1); bh.add(glow);
      const pick = new THREE.Mesh(new THREE.SphereGeometry(40, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      const body = { id: 'gargantua', name: 'Gargantua', type: 'Supermassive black hole', obj: pick, pickR: 46, focusR: 150, kind: 'bh',
        desc: 'A spinning supermassive black hole inspired by Interstellar. Its accretion disk glows as matter spirals in, and gravity bends the light of stars behind it.',
        facts: [['Mass', '100 M suns (stylised)'], ['Disk', 'Superheated plasma'], ['Lensing', 'Live refraction']] };
      pick.userData.body = body; bh.add(pick); this.pickables.galaxy.push(pick);
    }
    _buildMarkers() {
      STARS.forEach(([name, off, desc, facts]) => {
        const p = SOLAR_POS.clone().add(new THREE.Vector3(...off));
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xaed0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        s.position.copy(p); s.scale.set(9, 9, 1); this.galaxyG.add(s);
        const l = labelSprite(name, '#cfe0ff', 30); l.position.copy(p).add(new THREE.Vector3(0, 9, 0)); this.galaxyG.add(l);
        const pick = new THREE.Mesh(new THREE.SphereGeometry(7, 6, 6), new THREE.MeshBasicMaterial({ visible: false })); pick.position.copy(p);
        pick.userData.body = { id: name, name, type: 'Star', obj: pick, pickR: 10, focusR: 60, kind: 'star', desc, facts };
        this.galaxyG.add(pick); this.pickables.galaxy.push(pick);
      });
      // Solar System navigation marker (glowing sun, cone pointing at it, label)
      const m = (this.solarMarker = new THREE.Group()); m.position.copy(SOLAR_POS); this.galaxyG.add(m);
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sun.scale.set(20, 20, 1); m.add(sun);
      this.cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 11, 4), new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.9 }));
      this.cone.rotation.x = PI; this.cone.position.y = 22; m.add(this.cone);
      const lab = labelSprite('Solar System', '#ffe6b0', 54); lab.position.y = 36; m.add(lab);
      const pick = new THREE.Mesh(new THREE.SphereGeometry(18, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      pick.userData.body = { id: 'solar', name: 'Solar System', type: 'Planetary system · Orion Arm', obj: pick, pickR: 22, focusR: 90, kind: 'solar',
        desc: 'Our home: one star, eight planets, hundreds of moons and a belt of asteroids, about 26,000 light-years from the galactic centre.',
        facts: [['Star', 'Sun (G2V)'], ['Planets', '8'], ['Age', '4.6 billion yrs']], action: 'Enter Solar System' };
      m.add(pick); this.pickables.galaxy.push(pick);
    }

    _body(def, group, isMoon) {
      const [w, h] = def.res || (isMoon ? [128, 64] : [256, 128]);
      let map, extra = {};
      if (def.kind === 'earth') { map = TEX.earth(w, h); extra.specularMap = TEX.earthSpec(w / 2, h / 2); }
      else if (def.kind === 'bands') map = TEX.bands(def, w, h, def.spot);
      else map = TEX[def.kind](def.pal, w, h);
      const mat = def.kind === 'earth'
        ? new THREE.MeshPhongMaterial({ map, specular: new THREE.Color(0x6688bb), shininess: 28, ...extra })
        : new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, bumpMap: ['rock', 'ice', 'volcanic'].includes(def.kind) ? map : null, bumpScale: 0.8 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.r, isMoon ? 24 : 64, isMoon ? 16 : 48), mat);
      mesh.rotation.order = 'ZYX'; mesh.rotation.z = def.tilt || 0.1; if (def.id === 'saturn' || def.id === 'earth') { mesh.castShadow = true; mesh.receiveShadow = true; }
      group.add(mesh);
      const pickR = Math.max(def.r * 1.5, isMoon ? 1.1 : 2);
      const pick = new THREE.Mesh(new THREE.SphereGeometry(pickR, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      group.add(pick);
      pick.userData.body = { id: def.id, name: def.name, type: isMoon ? `Moon of ${def.parent[0].toUpperCase() + def.parent.slice(1)}` : 'Planet', obj: pick,
        pickR: pickR * 1.15, focusR: def.r * (def.rings ? 5.5 : 4.2), kind: isMoon ? 'moon' : 'planet', desc: def.desc, facts: def.facts, minR: def.r * (def.rings ? 3 : 2.3),
        action: def.id === 'earth' ? 'Land on Surface (Explore Earth)' : null };
      this.pickables.system.push(pick);
      return mesh;
    }

    _buildSystem() {
      const S = this.systemG;
      // Sun
      this.sunMat = new THREE.ShaderMaterial({ vertexShader: SUN_V, fragmentShader: SUN_F, uniforms: { uTime: { value: 0 } } });
      const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 64, 48), this.sunMat); S.add(sun);
      [[0xffb347, 42, 0.55], [0xff7a1a, 85, 0.22]].forEach(([c, s, o]) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }));
        sp.scale.set(s, s, 1); S.add(sp);
      });
      // FIXED: randomDirection() removed for Three.js r128 compatibility
      const FN = 2400, fd = new Float32Array(FN * 3), fs = new Float32Array(FN), centers = Array.from({ length: 14 }, () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize());
      for (let i = 0; i < FN; i++) { const d = centers[i % 14].clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.12)).normalize(); fd.set([d.x, d.y, d.z], i * 3); fs[i] = Math.random(); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FN * 3), 3));
      fg.setAttribute('aDir', new THREE.BufferAttribute(fd, 3)); fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
      this.flareMat = new THREE.ShaderMaterial({ vertexShader: FLARE_V, fragmentShader: FLARE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uR: { value: 9 }, uPx: { value: this.px } } });
      const flares = new THREE.Points(fg, this.flareMat); flares.frustumCulled = false; S.add(flares);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(13, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      sp.userData.body = { id: 'sun', name: 'Sun', type: 'Star · G-type main sequence', obj: sp, pickR: 14, focusR: 30, minR: 20, kind: 'sun',
        desc: 'The star at the heart of our solar system. Its surface churns with plasma and erupts in solar flares.', facts: [['Diameter', '1.39 M km'], ['Surface', '5,500 °C'], ['Age', '4.6 B yrs']] };
      S.add(sp); this.pickables.system.push(sp);

      // Lights (the Sun casts shadows – used for Saturn's rings)
      this.sunLight = new THREE.PointLight(0xfff0dd, 2.2, 0, 0); this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048); this.sunLight.shadow.camera.near = 12; this.sunLight.shadow.camera.far = 220;
      this.sunLight.shadow.bias = -0.0008; S.add(this.sunLight, new THREE.AmbientLight(0x2a3a6a, 0.55));

      // Planets + orbit lines
      const holders = {};
      PLANETS.forEach((p, i) => {
        const pivot = new THREE.Object3D(); pivot.rotation.y = i * 1.3; S.add(pivot);
        const holder = new THREE.Object3D(); holder.position.x = p.d; pivot.add(holder); holders[p.id] = holder;
        const mesh = this._body(p, holder, false);
        this.orbiters.push({ pivot, sp: p.sp * 0.5 }, { spin: mesh, sp: 0.4 });
        const pts = []; for (let k = 0; k <= 128; k++) pts.push(new THREE.Vector3(Math.cos((k / 128) * TAU) * p.d, 0, Math.sin((k / 128) * TAU) * p.d));
        S.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3d7bff, transparent: true, opacity: 0.18 })));
        if (p.atmo) {
          const am = new THREE.ShaderMaterial({ vertexShader: ATMO_V, fragmentShader: ATMO_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uSun: { value: new THREE.Vector3(-1, 0, 0) }, uCol: { value: new THREE.Vector3(...p.atmo) } } });
          const a = new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.12, 48, 32), am); holder.add(a); 
          if (!this.atmos) this.atmos = [];
          this.atmos.push({ holder, am });
        }
        if (p.id === 'earth') {
          const ct = TEX.clouds(512, 256);
          this.clouds = new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.025, 48, 32), new THREE.MeshLambertMaterial({ map: ct, transparent: true, depthWrite: false }));
          holder.add(this.clouds);
        }
        if (p.rings) this._saturnRings(mesh, p);
      });

      // Moons
      MOONS.forEach((m, i) => {
        const pivot = new THREE.Object3D(); pivot.rotation.y = i * 2.1; pivot.rotation.x = (i % 3) * 0.04; holders[m.parent].add(pivot);
        const h = new THREE.Object3D(); h.position.x = m.o; pivot.add(h);
        const mesh = this._body(m, h, true); this.orbiters.push({ pivot, sp: m.sp }, { spin: mesh, sp: 0.3 });
      });

      // Asteroid belt: individually tumbling rocks (instanced)
      const geo = new THREE.IcosahedronGeometry(1, 1), pa = geo.attributes.position;
      for (let i = 0; i < pa.count; i++) { const k = 0.7 + h3(Math.round(pa.getX(i) * 100), Math.round(pa.getY(i) * 100), Math.round(pa.getZ(i) * 100)) * 0.6; pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k * 0.8, pa.getZ(i) * k); }
      geo.computeVertexNormals();
      const CNT = 1400; this.belt = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), CNT);
      this.belt.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.beltData = []; const cc = new THREE.Color();
      for (let i = 0; i < CNT; i++) {
        this.beltData.push({ r: 41 + Math.random() * 10, a: Math.random() * TAU, y: (Math.random() - 0.5) * 3, s: 0.08 + Math.pow(Math.random(), 3) * 0.28,
          w: 0.2 / Math.sqrt(41 + Math.random() * 10) * (0.9 + Math.random() * 0.2), rx: Math.random() * TAU, ry: Math.random() * TAU, tx: (Math.random() - 0.5) * 2, ty: (Math.random() - 0.5) * 2 });
        const b = 0.35 + Math.random() * 0.4; this.belt.setColorAt(i, cc.setRGB(b * 1.05, b, b * 0.9));
      }
      this.belt.frustumCulled = false; S.add(this.belt); this._tmpO = new THREE.Object3D();
    }

    _saturnRings(planetMesh, p) {
      const inner = p.r * 1.45, outer = p.r * 2.55, geo = new THREE.RingGeometry(inner, outer, 128, 1), pos = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5); }
      const c = document.createElement('canvas'); c.width = 1024; c.height = 4; const x = c.getContext('2d');
      for (let i = 0; i < 1024; i++) {
        const t = i / 1024; let a = 0.85 * (0.55 + 0.45 * Math.sin(t * 90) * Math.sin(t * 23 + 1)); if (t < 0.08) a *= t / 0.08;
        if (t > 0.58 && t < 0.66) a = 0.03; if (t > 0.97) a *= (1 - t) / 0.03;
        x.fillStyle = `rgba(${Math.round(215 - t * 40)},${Math.round(190 - t * 40)},${Math.round(150 - t * 30)},${Math.max(0, a)})`; x.fillRect(i, 0, 1, 4);
      }
      const ring = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 }));
      ring.rotation.x = -PI / 2; ring.castShadow = true; ring.receiveShadow = true; planetMesh.add(ring);
      planetMesh.rotation.z = 0.47;
    }

    _buildPost() {
      const pr = this.renderer.getPixelRatio(), W = 2, H = 2;
      const RT = this.renderer.capabilities.isWebGL2 ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
      this.rt = new RT(W * pr, H * pr, { format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); if (this.rt.samples !== undefined) this.rt.samples = 4;
      this.postMat = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: POST_F,
        uniforms: { tDiffuse: { value: this.rt.texture }, uCenter: { value: new THREE.Vector2(.5, .5) }, uAspect: { value: 1 }, uRs: { value: 0.05 }, uK: { value: 1.25 }, uOn: { value: 0 } }, depthTest: false });
      this.postScene = new THREE.Scene(); this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));
    }

    /* ----- DOM + mouse/keyboard ----- */
    _bindDOM() {
      const c = this.canvas, $ = (id) => document.getElementById(id);
      this.el = { card: $('body-card'), title: $('card-title'), type: $('card-type'), desc: $('card-desc'), facts: $('card-facts'), action: $('card-action'), scope: $('uni-scope'), back: $('btn-back-galaxy') };
      $('card-close').onclick = () => this.deselect();
      this.el.back.onclick = () => this.exitToGalaxy();
      this.el.action.onclick = () => { const b = this.selected; if (!b) return; if (b.kind === 'solar') this.enterSystem(); else if (b.id === 'earth') this.hooks.onLand && this.hooks.onLand(); };
      c.addEventListener('pointerdown', (e) => { this.mouse = { down: true, x: e.clientX, y: e.clientY, moved: 0 }; c.setPointerCapture(e.pointerId); });
      c.addEventListener('pointermove', (e) => {
        const m = this.mouse;
        if (m.down) { const dx = e.clientX - m.x, dy = e.clientY - m.y; m.moved += Math.abs(dx) + Math.abs(dy); m.x = e.clientX; m.y = e.clientY; this.goal.theta -= dx * 0.005; this.goal.phi = this._clampPhi(this.goal.phi - dy * 0.005); }
        else { const b = this.pick(e.clientX, e.clientY); c.style.cursor = b ? 'pointer' : 'grab'; this.hover = b; }
      });
      c.addEventListener('pointerup', (e) => { if (this.mouse.down && this.mouse.moved < 5) { const b = this.pick(e.clientX, e.clientY); b ? this.select(b) : this.deselect(); } this.mouse.down = false; });
      c.addEventListener('wheel', (e) => { e.preventDefault(); this._zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
      window.addEventListener('resize', () => this.resize());
    }
    handleKey(e) {
      if (e.key === 'r' || e.key === 'R') this.reset(); else if (e.key === 'Escape') this.deselect();
      else if (e.key === '+' || e.key === '=') this._zoom(0.85); else if (e.key === '-') this._zoom(1.18);
      else if (e.key === 'ArrowLeft') this.goal.theta -= 0.12; else if (e.key === 'ArrowRight') this.goal.theta += 0.12;
      else if (e.key === 'ArrowUp') this.goal.phi = this._clampPhi(this.goal.phi - 0.1); else if (e.key === 'ArrowDown') this.goal.phi = this._clampPhi(this.goal.phi + 0.1);
    }

    /* ----- view / camera ----- */
    _clampPhi(p) { return Math.min(PI - 0.12, Math.max(0.12, p)); }
    _limits() {
      const f = this.selected && this.focus; const min = f ? (this.selected.minR || this.selected.pickR * 1.4) : (this.scope === 'galaxy' ? 70 : 24);
      return [min, this.scope === 'galaxy' ? 2200 : 520];
    }
    _zoom(f) { const [a, b] = this._limits(); this.goal.radius = Math.min(b, Math.max(a, this.goal.radius * f)); }
    _applyView(k) {
      const v = this.view, g = this.goal;
      v.theta += (g.theta - v.theta) * k; v.phi += (g.phi - v.phi) * k; v.radius += (g.radius - v.radius) * k; v.target.lerp(g.target, k);
      const s = Math.sin(v.phi); this.camera.position.set(v.target.x + v.radius * s * Math.cos(v.theta), v.target.y + v.radius * Math.cos(v.phi), v.target.z + v.radius * s * Math.sin(v.theta));
      this.camera.lookAt(v.target);
    }
    reset() {
      this.focus = null; this.goal = this._defaultView(this.scope); this.goal.theta = this.view.theta; this.deselect(true);
      this.goal.theta = this._defaultView(this.scope).theta;
    }

    /* ----- selection ----- */
    pick(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
      const hit = this.ray.intersectObjects(this.pickables[this.scope], false)[0];
      return hit ? hit.object.userData.body : null;
    }
    select(b) {
      this.selected = b; this.focus = b.obj; this._renderCard(b);
      this.goal.radius = Math.max(b.focusR, b.minR || 0); this.hooks.onSelect && this.hooks.onSelect(b);
    }
    deselect(silent) {
      if (!this.selected && !silent) return; this.selected = null; this.focus = null; this._renderCard(null);
      if (!silent) { this._zoom(1); } this.hooks.onSelect && this.hooks.onSelect(null);
    }
    _renderCard(b) {
      const e = this.el; if (!e) return; if (!b) { e.card.classList.add('hidden'); return; }
      e.title.textContent = b.name; e.type.textContent = b.type; e.desc.textContent = b.desc;
      e.facts.innerHTML = (b.facts || []).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      e.action.classList.toggle('hidden', !b.action); e.action.textContent = b.action || ''; e.card.classList.remove('hidden');
      e.card.style.animation = 'none'; void e.card.offsetWidth; e.card.style.animation = '';
    }
    enterSystem() {
      this.scope = 'system'; this.galaxyG.visible = false; this.systemG.visible = true; this.selected = null; this.focus = null; this._renderCard(null);
      this.view = this._defaultView('system'); this.view.radius = 420; this.goal = this._defaultView('system');
      this.el.scope.textContent = 'Solar System'; this.el.back.classList.remove('hidden'); this.hooks.onScope && this.hooks.onScope('system');
    }
    exitToGalaxy() {
      this.scope = 'galaxy'; this.galaxyG.visible = true; this.systemG.visible = false; this.selected = null; this.focus = null; this._renderCard(null);
      this.view = this._defaultView('galaxy'); this.view.target.copy(SOLAR_POS); this.view.radius = 140; this.goal = this._defaultView('galaxy');
      this.el.scope.textContent = 'Milky Way'; this.el.back.classList.add('hidden'); this.hooks.onScope && this.hooks.onScope('galaxy');
    }

    /* ----- hand input ----- */
    handleFrame(frame, dt) {
      let pointer = null; const now = performance.now();
      for (const h of frame.hands) {
        if (h.gesture === 'palm') { this.goal.theta -= h.delta.x * 5.5; this.goal.phi = this._clampPhi(this.goal.phi - h.delta.y * 3.5); }
        else if (h.gesture === 'pinch') this._zoom(Math.exp((h.side === 'left' ? -1 : 1) * dt * 1.1));
        else if (h.gesture === 'point') pointer = h;
        if (h.gesture === 'fist' && this.prevGesture[h.side] !== 'fist' && now - this.lastReset > 800) { this.lastReset = now; this.reset(); }
        this.prevGesture[h.side] = h.gesture;
      }
      for (const s of ['left', 'right']) if (!frame.hands.find((h) => h.side === s)) this.prevGesture[s] = null;
      if (pointer) {
        const b = this.pick(pointer.x, pointer.y); this.hover = b;
        if (b && b === this.dwellBody) { this.dwell += dt; if (this.dwell >= DWELL) { this.dwell = 0; this.select(b); } } else { this.dwellBody = b; this.dwell = 0; }
        return { side: pointer.side, progress: b ? Math.min(1, this.dwell / DWELL) : 0, hovering: !!b };
      }
      this.dwell = 0; this.dwellBody = null; this.hover = null; return { side: null, progress: 0, hovering: false };
    }

    /* ----- loop ----- */
    start() { if (this.running || !this.renderer) return; this.running = true; this.clock.start(); this._loop(); }
    pause() { this.running = false; this.clock.stop(); cancelAnimationFrame(this.raf); }
    _loop = () => {
      if (!this.running) return; this.raf = requestAnimationFrame(this._loop);
      const dt = Math.min(0.05, this.clock.getDelta()); this.t += dt; this._update(dt); this._render();
    };
    _update(dt) {
      const t = this.t; 
      if (this.pmats) this.pmats.forEach((m) => { if (m && m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = t; });
      if (this.focus) this.focus.getWorldPosition(this.goal.target);
      else this.goal.target.lerp(new THREE.Vector3(), 0.05);
      this._applyView(1 - Math.exp(-dt * 5));
      if (this.scope === 'galaxy') {
        if (this.diskMat && this.diskMat.uniforms) this.diskMat.uniforms.uTime.value = t; 
        if (this.haloMat && this.haloMat.uniforms) this.haloMat.uniforms.uTime.value = t; 
        if (this.halo) this.halo.lookAt(this.camera.position);
        if (this.cone) { this.cone.position.y = 22 + Math.sin(t * 2) * 2.5; this.cone.rotation.y = t; }
      } else {
        if (this.sunMat && this.sunMat.uniforms) this.sunMat.uniforms.uTime.value = t; 
        if (this.flareMat && this.flareMat.uniforms) this.flareMat.uniforms.uTime.value = t;
        this.orbiters.forEach((o) => { if (o.pivot) o.pivot.rotation.y += o.sp * dt; else o.spin.rotation.y += o.sp * dt; });
        if (this.clouds) this.clouds.rotation.y += dt * 0.05;
        if (this.atmos) this.atmos.forEach(({ holder, am }) => { holder.getWorldPosition(this.tmp); am.uniforms.uSun.value.copy(this.tmp).multiplyScalar(-1).normalize(); });
        const o = this._tmpO; this.beltData.forEach((d, i) => {
          d.a += d.w * dt; d.rx += d.tx * dt; d.ry += d.ty * dt; o.position.set(Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r); o.rotation.set(d.rx, d.ry, 0); o.scale.setScalar(d.s); o.updateMatrix(); this.belt.setMatrixAt(i, o.matrix);
        }); this.belt.instanceMatrix.needsUpdate = true;
      }
      // hover ring
      const hb = this.hover || (this.dwellBody); if (hb && hb.obj) {
        hb.obj.getWorldPosition(this.hoverRing.position); const d = this.camera.position.distanceTo(this.hoverRing.position);
        this.hoverRing.scale.setScalar(Math.max(hb.pickR * 2.4, d * 0.035)); this.hoverRing.visible = true; this.hoverRing.material.rotation = t * 0.6;
      } else this.hoverRing.visible = false;
    }
    _render() {
      const r = this.renderer;
      if (this.scope === 'galaxy') {
        const p = this.bh.getWorldPosition(this.tmp).clone(), toBH = p.clone().sub(this.camera.position), dist = toBH.length();
        const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); const inFront = toBH.dot(fwd) > 0;
        const ndc = p.project(this.camera), u = this.postMat.uniforms, half = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
        u.uCenter.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5); u.uRs.value = 14 / (half * 2); u.uOn.value = inFront && dist > 30 ? 1 : 0; u.uAspect.value = this.camera.aspect;
        r.setRenderTarget(this.rt); r.render(this.scene, this.camera); r.setRenderTarget(null); r.render(this.postScene, this.postCam);
      } else r.render(this.scene, this.camera);
    }
    resize() {
      const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const pr = this.renderer.getPixelRatio(); this.rt.setSize(w * pr, h * pr);
    }
  }

  AC.UniverseMode = UniverseMode;
})();

/* ================== Google Earth surface integration ================== */
(function () {
  const AC = (window.AC = window.AC || {});
  class EarthSurface {
    constructor() {
      this.root = document.getElementById('earth-view'); this.mapEl = document.getElementById('earth-map'); this.note = document.getElementById('earth-note');
      this.map = null; this.active = false; this.apiKey = null; this.loading = null;
      document.getElementById('earth-return').onclick = () => this.close();
    }
    async _key() {
      if (this.apiKey !== null) return this.apiKey;
      try { this.apiKey = (await (await fetch('/api/config')).json()).googleEarthApiKey || ''; } catch { this.apiKey = ''; }
      return this.apiKey;
    }
    _loadMaps(key) {
      if (window.google?.maps?.importLibrary) return Promise.resolve();
      return (this.loading ||= new Promise((res, rej) => {
        const s = document.createElement('script'); s.async = true;
        s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=beta&loading=async`;
        s.onload = res; s.onerror = () => rej(new Error('Maps script failed to load')); document.head.appendChild(s);
      }));
    }
    async open() {
      this.active = true; this.root.classList.remove('hidden'); document.body.classList.add('earth-open'); this.mapEl.innerHTML = ''; this.note.classList.add('hidden');
      const key = await this._key();
      if (key) {
        try {
          await this._loadMaps(key);
          const { Map3DElement } = await google.maps.importLibrary('maps3d');
          this.map = new Map3DElement({ center: { lat: 20, lng: 10, altitude: 0 }, range: 14000000, tilt: 0, heading: 0, mode: 'HYBRID' });
          this.mapEl.appendChild(this.map); this.mode = '3d'; return;
        } catch (e) { console.warn('Photorealistic 3D failed:', e); this._note('Photorealistic 3D could not load (check API key & enabled APIs). Showing satellite fallback.'); }
      } else this._note('No GOOGLE_EARTH_API_KEY set — showing keyless satellite fallback. Add a key for photorealistic 3D.');
      this.mode = 'iframe'; this.map = null;
      this.mapEl.innerHTML = '<iframe title="Earth" allowfullscreen src="https://maps.google.com/maps?ll=20,10&z=3&t=k&output=embed"></iframe>';
    }
    _note(t) { this.note.textContent = t; this.note.classList.remove('hidden'); }
    close() { this.active = false; this.root.classList.add('hidden'); document.body.classList.remove('earth-open'); this.mapEl.innerHTML = ''; this.map = null; }

    /** Touchless navigation of the 3D map */
    handleFrame(frame, dt) {
      const m = this.map; if (!m || this.mode !== '3d') return;
      for (const h of frame.hands) {
        if (h.gesture === 'point') {
          const c = m.center, k = (m.range || 1e6) / 111000 * 1.4, hd = ((m.heading || 0) * Math.PI) / 180;
          const dx = h.delta.x * k, up = -h.delta.y * k, cs = Math.cos(hd), sn = Math.sin(hd);
          const dE = -(dx * cs + up * sn), dN = -(-dx * sn + up * cs);
          m.center = { lat: Math.max(-85, Math.min(85, c.lat + dN)), lng: c.lng + dE / Math.max(0.2, Math.cos((c.lat * Math.PI) / 180)), altitude: c.altitude || 0 };
        } else if (h.gesture === 'palm') {
          m.heading = ((m.heading || 0) - h.delta.x * 220 + 360) % 360; m.tilt = Math.max(0, Math.min(80, (m.tilt || 0) + h.delta.y * 120));
        } else if (h.gesture === 'pinch') {
          m.range = Math.max(200, Math.min(2.2e7, (m.range || 1e6) * Math.exp((h.side === 'left' ? -1 : 1) * dt * 1.3)));
        } else if (h.gesture === 'fist') { m.heading = 0; m.tilt = 0; }
      }
    }
  }
  AC.EarthSurface = EarthSurface;
})();
