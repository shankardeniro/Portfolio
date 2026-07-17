import * as THREE from "three";

/* ============================================================
   HERO — a live usability study of the visitor.
   Instead of a decorative orb, the hero canvas runs the kind of
   instrumentation a UX researcher would recognise:
   · cursor dwells become numbered fixations joined by saccade
     lines, an eye-tracking scanpath of your own visit
   · movement leaves a slowly decaying heat trace (Hotjar-style)
   · clicks are logged as click-map ripples
   · when nobody interacts (or on touch), a ghost cursor replays
     a "recorded session" over the real hero UI
   Plain 2D canvas: cheap, theme-aware, honours reduced motion.
   ============================================================ */

const canvas = document.querySelector("[data-webgl]");
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(hover:none),(pointer:coarse)").matches;

const PAL = {
  dark:  { line: [198, 242, 78], heat: [198, 242, 78], heatA: 0.028, bg: [10, 10, 12] },
  light: { line: [74, 98, 16],   heat: [140, 176, 40], heatA: 0.034, bg: [244, 242, 234] },
};
let pal = PAL.dark;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const TAU = Math.PI * 2;

let ctx, heat, hctx, W, H, raf;
let intro = prefersReduced ? 1 : 0;
let scrollFade = 1;

const trail = [];        // raw pointer path, fades within a second
const fixations = [];    // {x,y,r,born,kill,n,ghost}
const ripples = [];      // click-map marks {x,y,born}
let fixCount = 0;

const ptr = { x: -1, y: -1, last: -1e9 };
let dwell = null;        // {x,y,since,fix}

function addFixation(x, y, ghost) {
  const f = { x, y, r: 9, born: performance.now(), kill: 0, n: ++fixCount, ghost };
  fixations.push(f);
  // keep the scanpath readable: retire the oldest once it gets crowded
  const alive = fixations.filter((k) => !k.kill);
  if (alive.length > (window.innerWidth < 700 ? 6 : 9)) alive[0].kill = f.born;
  return f;
}

const lastStamp = { x: -1e9, y: -1e9 };
function stampHeat(x, y) {
  // throttle by distance: a resting cursor shouldn't saturate its spot
  if (Math.hypot(x - lastStamp.x, y - lastStamp.y) < 7) return;
  lastStamp.x = x; lastStamp.y = y;
  const g = hctx.createRadialGradient(x / 2, y / 2, 0, x / 2, y / 2, 17);
  g.addColorStop(0, rgba(pal.heat, pal.heatA));
  g.addColorStop(1, rgba(pal.heat, 0));
  hctx.globalCompositeOperation = "lighter";
  hctx.fillStyle = g;
  hctx.fillRect(x / 2 - 17, y / 2 - 17, 34, 34);
}

/* ---------- the visitor's own session ---------- */
function onMove(e) {
  const now = performance.now();
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.last = now;
  if (scrollFade <= 0) return;
  trail.push({ x: ptr.x, y: ptr.y, t: now });
  stampHeat(ptr.x, ptr.y);
  // a new dwell zone starts whenever the cursor breaks away
  if (!dwell || Math.hypot(ptr.x - dwell.x, ptr.y - dwell.y) > 36) {
    dwell = { x: ptr.x, y: ptr.y, since: now, fix: null };
  }
}

function onDown(e) {
  if (scrollFade <= 0) return;
  ripples.push({ x: e.clientX, y: e.clientY, born: performance.now() });
}

function updateDwell(now) {
  if (!dwell || now - ptr.last > 2600) return;
  if (now - dwell.since > 300) {
    if (!dwell.fix) dwell.fix = addFixation(dwell.x, dwell.y, false);
    // fixation duration = circle size, as in real gaze plots
    dwell.fix.r = Math.min(9 + (now - dwell.since - 300) * 0.011, 26);
  }
}

/* ---------- the ghost session replay ---------- */
const ghost = {
  x: 0, y: 0, alpha: 0, phase: "idle", from: null, to: null,
  t0: 0, dur: 0, holdUntil: 0, fix: null, queue: [],
};

// waypoints come from the actual hero UI, so the replay reads like
// a real participant scanning the page
function ghostTargets() {
  // on touch the replay stays inside the hero content — circles over the
  // nav read as clutter on a small screen
  const els = document.querySelectorAll(
    isTouch
      ? ".tag, .hero__title, .hero__meta, .scroll-cue"
      : ".tag, .hero__title, .hero__meta, .scroll-cue, .nav__cta, .nav__brand"
  );
  const pts = [];
  els.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
    pts.push({
      x: r.left + r.width * (0.2 + Math.random() * 0.6),
      y: r.top + r.height * (0.25 + Math.random() * 0.5),
    });
  });
  // a plausible reading order with a little shuffle
  for (let i = pts.length - 1; i > 0; i--) {
    if (Math.random() < 0.35) { const j = Math.max(0, i - 1); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  }
  return pts;
}

function updateGhost(now, dt) {
  const wantOn = scrollFade > 0.1 && (isTouch || now - ptr.last > 4500);
  ghost.alpha += ((wantOn ? 1 : 0) - ghost.alpha) * (wantOn ? 0.04 : 0.18);
  if (ghost.alpha < 0.02) { ghost.phase = "idle"; return; }

  if (ghost.phase === "idle") {
    if (!ghost.queue.length) ghost.queue = ghostTargets();
    if (!ghost.queue.length) return;
    ghost.to = ghost.queue.shift();
    if (!ghost.from) { ghost.x = window.innerWidth * 0.72; ghost.y = window.innerHeight * 0.4; }
    ghost.from = { x: ghost.x, y: ghost.y };
    const d = Math.hypot(ghost.to.x - ghost.from.x, ghost.to.y - ghost.from.y);
    ghost.dur = Math.min(Math.max(d * 1.6, 480), 1500);
    ghost.t0 = now;
    ghost.phase = "move";
  } else if (ghost.phase === "move") {
    const p = Math.min((now - ghost.t0) / ghost.dur, 1);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const dx = ghost.to.x - ghost.from.x, dy = ghost.to.y - ghost.from.y;
    const len = Math.hypot(dx, dy) || 1;
    // slight arc perpendicular to the path so it moves like a hand, not a robot
    const arc = Math.sin(p * Math.PI) * Math.min(len * 0.08, 26);
    ghost.x = ghost.from.x + dx * e - (dy / len) * arc;
    ghost.y = ghost.from.y + dy * e + (dx / len) * arc;
    trail.push({ x: ghost.x, y: ghost.y, t: now });
    stampHeat(ghost.x, ghost.y);
    if (p >= 1) {
      ghost.phase = "hold";
      ghost.holdUntil = now + 420 + Math.random() * 750;
      ghost.fix = addFixation(ghost.to.x, ghost.to.y, true);
    }
  } else if (ghost.phase === "hold") {
    if (ghost.fix) ghost.fix.r = Math.min(ghost.fix.r + dt * 0.008, 22);
    if (now >= ghost.holdUntil) { ghost.fix = null; ghost.phase = "idle"; }
  }
}

/* ---------- drawing ---------- */
function fixAlpha(f, now) {
  const LIFE = 16000;
  const inA = Math.min((now - f.born) / 260, 1);
  const end = f.kill ? Math.min(f.kill + 900, f.born + LIFE) : f.born + LIFE;
  return inA * Math.max(Math.min((end - now) / 900, 1), 0);
}

function drawTrail(now) {
  while (trail.length && now - trail[0].t > 900) trail.shift();
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  for (let i = 1; i < trail.length; i++) {
    const p0 = trail[i - 1], p1 = trail[i];
    if (p1.t - p0.t > 120) continue;               // gap: real/ghost handoff
    ctx.strokeStyle = rgba(pal.line, (1 - (now - p1.t) / 900) * 0.28);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
}

function drawSaccades(now) {
  ctx.lineWidth = 1;
  for (let i = 1; i < fixations.length; i++) {
    const a = fixations[i - 1], b = fixations[i];
    const al = Math.min(fixAlpha(a, now), fixAlpha(b, now)) * 0.45;
    if (al <= 0) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < a.r + b.r + 6) continue;               // circles overlap, skip the connector
    const ux = dx / d, uy = dy / d;
    ctx.strokeStyle = rgba(pal.line, al);
    ctx.setLineDash(a.ghost || b.ghost ? [4, 5] : []);
    ctx.beginPath();
    ctx.moveTo(a.x + ux * (a.r + 3), a.y + uy * (a.r + 3));
    ctx.lineTo(b.x - ux * (b.r + 3), b.y - uy * (b.r + 3));
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawFixations(now) {
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = fixations.length - 1; i >= 0; i--) {
    const f = fixations[i];
    const a = fixAlpha(f, now);
    if (a <= 0 && now > f.born + 1000) { fixations.splice(i, 1); continue; }
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU);
    ctx.fillStyle = rgba(pal.line, 0.13 * a);
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = rgba(pal.line, 0.85 * a);
    if (f.ghost) ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(pal.line, a);
    ctx.fillText(String(f.n), f.x, f.y + 0.5);
  }
}

function drawRipples(now) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    const p = (now - r.born) / 750;
    if (p >= 1) { ripples.splice(i, 1); continue; }
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(pal.line, (1 - p) * 0.9);
    ctx.beginPath(); ctx.arc(r.x, r.y, 8 + p * 38, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(pal.line, 1 - p);
    ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, TAU); ctx.fill();
  }
}

function drawGhost(now) {
  if (ghost.alpha < 0.02) return;
  const a = ghost.alpha;
  ctx.save();
  ctx.translate(ghost.x, ghost.y);
  ctx.beginPath(); ctx.arc(3, 6, 15, 0, TAU);
  ctx.fillStyle = rgba(pal.line, 0.08 * a);
  ctx.fill();
  // classic cursor arrow, outlined in the page colour so it reads over text
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 15); ctx.lineTo(3.6, 11.8);
  ctx.lineTo(6.4, 17.6); ctx.lineTo(8.8, 16.4); ctx.lineTo(6, 10.8);
  ctx.lineTo(10.8, 10.4); ctx.closePath();
  ctx.fillStyle = rgba(pal.line, 0.95 * a);
  ctx.strokeStyle = rgba(pal.bg, 0.9 * a);
  ctx.lineWidth = 1.5;
  ctx.stroke(); ctx.fill();
  // "replay" tag with a blinking record dot
  const blink = 0.55 + 0.45 * Math.sin(now * 0.006);
  ctx.fillStyle = rgba(pal.line, 0.9 * a * blink);
  ctx.beginPath(); ctx.arc(16, 23.5, 2, 0, TAU); ctx.fill();
  ctx.font = "600 8px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(pal.line, 0.75 * a);
  ctx.fillText("R E P L A Y", 22, 24);
  ctx.restore();
}

/* ---------- lifecycle ---------- */
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  heat.width = Math.ceil(W / 2); heat.height = Math.ceil(H / 2);
  if (prefersReduced) renderStatic();
}

// reduced motion: a single still scanpath over the hero, nothing moves
function renderStatic() {
  fixations.length = 0; fixCount = 0;
  ghostTargets().slice(0, 6).forEach((p) => {
    const f = addFixation(p.x, p.y, false);
    f.r = 12 + Math.random() * 10;
  });
  const settled = performance.now() + 1000;
  ctx.clearRect(0, 0, W, H);
  drawSaccades(settled);
  drawFixations(settled);
}

let prev = 0, cleared = false;
function loop() {
  raf = requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(now - (prev || now), 50);
  prev = now;

  scrollFade = Math.max(0, 1 - (window.scrollY / window.innerHeight) * 1.25);
  if (intro < 1) intro = Math.min(intro + dt / 1200, 1);
  canvas.style.opacity = String(scrollFade * intro);
  if (scrollFade <= 0) {
    if (!cleared) { ctx.clearRect(0, 0, W, H); cleared = true; }
    return;                                       // nothing visible, skip the work
  }
  cleared = false;

  // the window can report 0×0 before first layout; recover once it's real
  if (!canvas.width || !heat.width) { resize(); if (!canvas.width || !heat.width) return; }

  updateDwell(now);
  updateGhost(now, dt);

  hctx.globalCompositeOperation = "destination-out";
  hctx.fillStyle = "rgba(0,0,0,0.028)";
  hctx.fillRect(0, 0, heat.width, heat.height);

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(heat, 0, 0, W, H);
  drawTrail(now);
  drawSaccades(now);
  drawFixations(now);
  drawRipples(now);
  drawGhost(now);
}

function init() {
  ctx = canvas.getContext("2d");
  heat = document.createElement("canvas");
  hctx = heat.getContext("2d");

  // main.js flips this when the theme toggles
  window.setHeroTheme = function (isLight) {
    pal = isLight ? PAL.light : PAL.dark;
    if (hctx) hctx.clearRect(0, 0, heat.width, heat.height);
    if (prefersReduced && ctx) renderStatic();
  };
  pal = document.documentElement.getAttribute("data-theme") === "light" ? PAL.light : PAL.dark;

  resize();
  window.addEventListener("resize", resize, { passive: true });

  if (prefersReduced) {
    // keep the still frame in sync with scroll + late layout shifts
    window.addEventListener("scroll", () => {
      canvas.style.opacity = String(Math.max(0, 1 - (window.scrollY / window.innerHeight) * 1.25));
    }, { passive: true });
    // the hero intro still shifts elements around after load — re-render once
    // things settle so the fixations sit on real UI, not mid-flight positions
    window.addEventListener("load", renderStatic);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderStatic());
    setTimeout(renderStatic, 3200);
    return;
  }
  // touch drags are scrolling, not cursor behaviour — don't log them as a
  // session; touch devices get the ghost replay only
  if (!isTouch) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
  }
  raf = requestAnimationFrame(loop);   // first frame async, outside init's try/catch
}

try {
  if (canvas) init();
} catch (err) {
  console.warn("Hero canvas init failed", err);
  if (canvas) canvas.style.display = "none";
}

window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));

/* ============================================================
   CASE STUDY, scroll-driven glowing path (vectrfl-style)
   A neon tube draws itself as you scroll; a glowing head travels
   the leading edge, particles light up around it, and the scene
   drifts in response. Exposed as window.createCaseScene(canvas).
   ============================================================ */
window.createCaseScene = function createCaseScene(cv, accentHex) {
  const accent = new THREE.Color(accentHex || "#c6f24e");
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  // --- the path: a tall zigzag descending in Y, weaving in X and Z ---
  const PTS = [];
  const TURNS = 13, SPAN = 19;
  for (let i = 0; i <= TURNS; i++) {
    const t = i / TURNS;
    const y = SPAN - t * SPAN * 2;
    const x = Math.sin(t * Math.PI * 5.0) * 3.1 * (0.5 + 0.5 * Math.cos(t * Math.PI));
    const z = Math.cos(t * Math.PI * 3.5) * 1.8;
    PTS.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(PTS, false, "catmullrom", 0.4);

  const SEG = 700, RAD_SEG = 8;
  function makeTube(radius, intensity, isHalo) {
    const geo = new THREE.TubeGeometry(curve, SEG, radius, RAD_SEG, false);
    const count = geo.attributes.position.count;
    const aLen = new Float32Array(count);
    for (let i = 0; i <= SEG; i++) {
      const f = i / SEG;
      for (let j = 0; j <= RAD_SEG; j++) aLen[i * (RAD_SEG + 1) + j] = f;
    }
    geo.setAttribute("aLen", new THREE.BufferAttribute(aLen, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { uProgress: { value: 0 }, uColor: { value: accent.clone() }, uIntensity: { value: intensity }, uHalo: { value: isHalo ? 1 : 0 } },
      vertexShader: `
        attribute float aLen; varying float vLen;
        void main(){ vLen=aLen; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uProgress; uniform vec3 uColor; uniform float uIntensity; uniform float uHalo;
        varying float vLen;
        void main(){
          if (vLen > uProgress + 0.002) discard;
          float d = uProgress - vLen;                 // distance behind the head
          float head = smoothstep(0.05, 0.0, d);      // bright hot tip
          float trail = 0.25 + 0.75 * smoothstep(0.45, 0.0, d);
          vec3 col = uColor * trail + vec3(1.0) * head * 1.6;
          float a = uIntensity * (uHalo > 0.5 ? (0.16 + head * 0.5) : (0.7 + head * 0.6));
          gl_FragColor = vec4(col, a);
        }`,
    });
    return new THREE.Mesh(geo, mat);
  }

  const world = new THREE.Group();
  const core = makeTube(0.05, 1.0, false);
  const halo = makeTube(0.22, 1.0, true);
  world.add(halo, core);

  // --- glowing head orb + soft halo ---
  function glowSphere(r, a) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { uColor: { value: accent.clone() }, uA: { value: a } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uA; varying vec3 vN; varying vec3 vV;
        void main(){ float f=pow(1.0-max(dot(vN,vV),0.0),1.6); vec3 c=mix(uColor,vec3(1.0),0.5); gl_FragColor=vec4(c, (0.4+f)*uA); }`,
    }));
    return m;
  }
  const headCore = glowSphere(0.16, 1.0);
  const headGlow = glowSphere(0.6, 0.5);
  world.add(headGlow, headCore);

  // --- particles that brighten near the head ---
  const NP = 320;
  const pPos = new Float32Array(NP * 3), pRnd = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    const p = curve.getPointAt(Math.random());
    const ang = Math.random() * Math.PI * 2, rr = 0.6 + Math.random() * 3.2;
    pPos[i * 3] = p.x + Math.cos(ang) * rr;
    pPos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 2.4;
    pPos[i * 3 + 2] = p.z + Math.sin(ang) * rr;
    pRnd[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("aRnd", new THREE.BufferAttribute(pRnd, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: { uHead: { value: new THREE.Vector3() }, uColor: { value: accent.clone() }, uTime: { value: 0 } },
    vertexShader: `
      attribute float aRnd; varying float vB; uniform vec3 uHead; uniform float uTime;
      void main(){
        vec3 p = position; p.y += sin(uTime*0.5 + aRnd*6.28)*0.15;
        float dist = distance(p, uHead);
        vB = smoothstep(3.2, 0.0, dist);
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = (4.0 + vB*9.0) * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vB; uniform vec3 uColor;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d) * (0.05 + vB);
        gl_FragColor = vec4(mix(uColor, vec3(1.0), vB*0.6), a);
      }`,
  });
  const particles = new THREE.Points(pGeo, pMat);
  world.add(particles);

  // --- chapter nodes: glowing waypoints placed at the story beats ---
  const nodesGroup = new THREE.Group();
  world.add(nodesGroup);
  let nodes = [];
  // accepts either [number] or [{frac, major}], majors are the chapter beats,
  // minors are every other section, so the path reads as stations on a journey
  function setNodes(arr) {
    nodes.forEach((n) => nodesGroup.remove(n.mesh));
    nodes = (arr || []).map((item) => {
      const major = typeof item === "object" && !!item.major;
      const f = typeof item === "number" ? item : item.frac;
      const ff = Math.min(Math.max(f, 0), 1);
      const mesh = glowSphere(major ? 0.3 : 0.14, major ? 0.4 : 0.3);
      curve.getPointAt(ff, mesh.position);
      nodesGroup.add(mesh);
      return { mesh, frac: ff, mat: mesh.material, major };
    });
  }

  scene.add(world);

  // --- state / animation ---
  let progress = 0, target = 0, time = 0, raf2 = null, running = false;
  const px = { x: 0, y: 0, tx: 0, ty: 0 };
  const headLocal = new THREE.Vector3();

  function onPointer(e) {
    px.tx = (e.clientX / window.innerWidth) * 2 - 1;
    px.ty = -(e.clientY / window.innerHeight) * 2 + 1;
  }
  function resize() {
    const w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function frame() {
    raf2 = requestAnimationFrame(frame);
    time += 0.016;
    progress += (target - progress) * 0.08;
    px.x += (px.tx - px.x) * 0.05; px.y += (px.ty - px.y) * 0.05;

    const p = Math.min(Math.max(progress, 0.0001), 0.9999);
    core.material.uniforms.uProgress.value = p;
    halo.material.uniforms.uProgress.value = p;

    curve.getPointAt(p, headLocal);
    // keep the head vertically centred; the path scrolls through it
    world.position.y = -headLocal.y;
    world.rotation.y = px.x * 0.18 + Math.sin(time * 0.1) * 0.05;

    headCore.position.copy(headLocal);
    headGlow.position.copy(headLocal);
    pMat.uniforms.uHead.value.copy(headLocal);
    pMat.uniforms.uTime.value = time;

    // pulse each station as the head arrives; majors flare bigger/brighter
    for (const n of nodes) {
      const d = Math.abs(p - n.frac);
      const pulse = Math.max(0, 1 - d / (n.major ? 0.06 : 0.04));
      const reached = p >= n.frac - 0.002 ? 1 : 0;
      n.mesh.scale.setScalar(1 + pulse * pulse * (n.major ? 2.2 : 1.5));
      n.mat.uniforms.uA.value = (n.major ? 0.16 : 0.08) + reached * (n.major ? 0.22 : 0.12) + pulse * (n.major ? 1.3 : 0.85);
    }

    camera.position.x += (px.x * 0.8 - camera.position.x) * 0.05;
    camera.position.y += (px.y * 0.5 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  return {
    start() { if (running) return; running = true; resize(); window.addEventListener("pointermove", onPointer, { passive: true }); window.addEventListener("resize", resize); frame(); },
    stop() { running = false; cancelAnimationFrame(raf2); window.removeEventListener("pointermove", onPointer); window.removeEventListener("resize", resize); },
    setProgress(v) { target = v; },
    setNodes,
    resize,
  };
};
