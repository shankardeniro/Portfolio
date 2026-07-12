import * as THREE from "three";

/* =========================================================================
   Spherical gallery — you sit at the centre of a sphere whose inner surface
   is tiled with project cards. Left-click drag to look around (with inertial,
   Lenis-style easing). Click a card to animate a detail page in.
   ========================================================================= */

const gsap = window.gsap;
const canvas = document.getElementById("gl");
const counterEl = document.getElementById("counter");
const hintEl = document.getElementById("hint");
const loaderEl = document.getElementById("loader");
const loaderBar = document.getElementById("loaderbar");

/* ----------------------------- content --------------------------------- */
const base = [
  {
    title: "Winning Over Sweden",
    titleItalic: "Sweden",
    tag: "Market launch",
    desc: "Launching a compliant, user-centred casino tailored for Swedish player preferences.",
    color: "#d98bb0",
    panel: "#f0d9e6",
    seed: "casino-stockholm",
    stats: [["2.4×", "retention"], ["8", "markets"]],
  },
  {
    title: "Reimagining Onboarding",
    titleItalic: "Onboarding",
    tag: "Onboarding funnel",
    desc: "Solving onboarding challenges for better conversion — phased tests, 53pt better variant.",
    color: "#73c7bd",
    panel: "#d4ece8",
    seed: "onboarding-flow",
    stats: [["+53%", "conversion"], ["4", "test rounds"]],
  },
  {
    title: "User Research Framework",
    titleItalic: "Research",
    tag: "Systems & ops",
    desc: "An org-wide framework that standardised how teams learn from their users.",
    color: "#8f86c9",
    panel: "#ddd9f0",
    seed: "research-team",
    stats: [["12+", "teams"], ["1", "system"]],
  },
  {
    title: "ReviewBuddy",
    titleItalic: "Buddy",
    tag: "0 → 1 product",
    desc: "A mobile-first app to scout street food near you — a playful side project.",
    color: "#e08f86",
    panel: "#f4dcd8",
    seed: "street-food",
    stats: [["5", "usability tests"], ["0→1", "built"]],
  },
];

/* fan the 4 base projects out into a fuller sphere */
const COUNT = 32;
const projects = Array.from({ length: COUNT }, (_, i) => {
  const b = base[i % base.length];
  return { ...b, index: i, seed: `${b.seed}-${i}` };
});

/* ----------------------------- three setup ----------------------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 0);
camera.rotation.order = "YXZ";

const RADIUS = 6.2;
const CARD_W = 1.62;
const CARD_H = CARD_W * 1.34; // matches 540 / 720 canvas aspect

/* ----------------------------- card texture ---------------------------- */
const TEX_W = 540;
const TEX_H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, y);
      line = words[n] + " ";
      y += lineH;
      if (++lines >= maxLines - 1) {
        // last allowed line — print remainder (truncate w/ ellipsis if needed)
        let rest = words.slice(n).join(" ");
        while (ctx.measureText(rest + "…").width > maxW && rest.length) rest = rest.slice(0, -1);
        ctx.fillText(rest.trim() + (n < words.length ? "…" : ""), x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

function drawCard(ctx, p, img) {
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  const pad = 26;
  const r = 30;

  // panel
  ctx.save();
  roundRect(ctx, 0, 0, TEX_W, TEX_H, r);
  ctx.fillStyle = "#ece9e4";
  ctx.fill();
  ctx.clip();

  // media area
  const mx = pad, my = pad, mw = TEX_W - pad * 2, mh = 392;
  roundRect(ctx, mx, my, mw, mh, 20);
  ctx.save();
  ctx.clip();
  if (img) {
    // cover-fit
    const ar = img.width / img.height;
    const tar = mw / mh;
    let dw, dh, dx, dy;
    if (ar > tar) { dh = mh; dw = mh * ar; dx = mx - (dw - mw) / 2; dy = my; }
    else { dw = mw; dh = mw / ar; dx = mx; dy = my - (dh - mh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
    // subtle tint to harmonise with accent
    ctx.fillStyle = hexToRgba(p.color, 0.16);
    ctx.fillRect(mx, my, mw, mh);
  } else {
    const g = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
    g.addColorStop(0, p.color);
    g.addColorStop(1, p.panel);
    ctx.fillStyle = g;
    ctx.fillRect(mx, my, mw, mh);
  }
  ctx.restore();

  // tag pill
  if (p.tag) {
    ctx.font = "500 21px 'Instrument Sans', system-ui, sans-serif";
    const tw = ctx.measureText(p.tag).width;
    const px = mx + 16, py = my + mh - 50, ph = 38, pw = tw + 34;
    roundRect(ctx, px, py, pw, ph, ph / 2);
    ctx.fillStyle = "rgba(20,19,17,0.86)";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(p.tag, px + 17, py + ph / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }

  // title (serif)
  ctx.fillStyle = "#1b1a17";
  ctx.font = "400 40px 'Instrument Serif', Georgia, serif";
  wrapText(ctx, p.title, pad, my + mh + 64, mw, 44, 2);

  // description
  ctx.fillStyle = "#6b675f";
  ctx.font = "400 22px 'Instrument Sans', system-ui, sans-serif";
  wrapText(ctx, p.desc, pad, my + mh + 150, mw, 30, 3);

  // index + view affordance row
  ctx.fillStyle = "#9a958c";
  ctx.font = "500 19px 'Instrument Sans', system-ui, sans-serif";
  ctx.fillText(String(p.index + 1).padStart(2, "0"), pad, TEX_H - 30);
  ctx.textAlign = "right";
  ctx.fillStyle = "#1b1a17";
  ctx.fillText("View  ↗", TEX_W - pad, TEX_H - 30);
  ctx.textAlign = "left";

  ctx.restore();
}

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ----------------------------- build cards ----------------------------- */
const cards = [];
const cardGroup = new THREE.Group();
scene.add(cardGroup);

let loaded = 0;
function bumpLoader() {
  loaded++;
  const pct = Math.round((loaded / projects.length) * 100);
  loaderBar.style.width = pct + "%";
  if (loaded >= projects.length) finishLoad();
}

projects.forEach((p, i) => {
  // even distribution on a sphere (fibonacci)
  const y = 1 - (i / (projects.length - 1)) * 2; // 1 → -1
  const radius = Math.sqrt(1 - y * y);
  const theta = i * 2.399963229728653; // golden angle
  const dir = new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);

  const canvas2 = document.createElement("canvas");
  canvas2.width = TEX_W;
  canvas2.height = TEX_H;
  const ctx = canvas2.getContext("2d");
  drawCard(ctx, p, null);

  const texture = new THREE.CanvasTexture(canvas2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(geo, mat);

  mesh.position.copy(dir).multiplyScalar(RADIUS);
  // face the centre (camera sits at the origin): front (+Z) points inward
  mesh.lookAt(0, 0, 0);

  mesh.userData = { project: p, baseScale: 1, ctx, texture, canvas2, dir };
  cardGroup.add(mesh);
  cards.push(mesh);

  // load real photo through a CORS-enabled proxy, then repaint
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => { drawCard(ctx, p, img); texture.needsUpdate = true; bumpLoader(); };
  img.onerror = () => bumpLoader();
  img.src = `https://images.weserv.nl/?url=picsum.photos/seed/${encodeURIComponent(p.seed)}/620/470`;
});

/* ----------------------------- loader done ----------------------------- */
let loadFinished = false;
function finishLoad() {
  if (loadFinished) return;
  loadFinished = true;
  loaderEl.classList.add("done");
  // a small intro: ease the sphere scale + a gentle look-around
  gsap.from(cardGroup.scale, { x: 0.82, y: 0.82, z: 0.82, duration: 1.6, ease: "power3.out" });
  gsap.from(state, { yaw: state.yaw - 0.5, duration: 2.2, ease: "power2.out" });
}
// safety: never hang on the loader
setTimeout(finishLoad, 4000);

/* ----------------------------- interaction ----------------------------- */
const state = {
  yaw: 0, pitch: 0,        // smoothed (rendered) orientation
  targetYaw: 0, targetPitch: 0, // where we're easing toward
  velYaw: 0, velPitch: 0,  // momentum
};
const PITCH_LIMIT = 1.15;

let dragging = false;
let moved = 0;
let last = { x: 0, y: 0 };
let downPos = { x: 0, y: 0 };
let downTime = 0;

function onDown(e) {
  if (detailOpen) return;
  dragging = true;
  moved = 0;
  last.x = e.clientX; last.y = e.clientY;
  downPos.x = e.clientX; downPos.y = e.clientY;
  downTime = performance.now();
  state.velYaw = 0; state.velPitch = 0;
  canvas.classList.add("dragging");
  hintEl.classList.add("hide");
}
function onMove(e) {
  // hover detection when not dragging
  if (!dragging) { updateHover(e); return; }
  const dx = e.clientX - last.x;
  const dy = e.clientY - last.y;
  last.x = e.clientX; last.y = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  const k = 0.0028;
  state.targetYaw -= dx * k;
  state.targetPitch -= dy * k;
  state.targetPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.targetPitch));
  state.velYaw = -dx * k;
  state.velPitch = -dy * k;
}
function onUp(e) {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove("dragging");
  // fling: carry momentum into the target
  state.targetYaw += state.velYaw * 14;
  state.targetPitch += state.velPitch * 14;
  state.targetPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.targetPitch));

  // treat as a click if it barely moved and was quick
  const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  if (dist < 8 && performance.now() - downTime < 400) handleClick(e);
}

canvas.addEventListener("pointerdown", onDown);
window.addEventListener("pointermove", onMove);
window.addEventListener("pointerup", onUp);

/* hover highlight */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
function setNdc(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
}
function updateHover(e) {
  if (detailOpen) return;
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(cards, false)[0];
  const obj = hit ? hit.object : null;
  if (obj !== hovered) {
    if (hovered) gsap.to(hovered.userData, { baseScale: 1, duration: 0.4, ease: "power2.out" });
    hovered = obj;
    if (hovered) gsap.to(hovered.userData, { baseScale: 1.08, duration: 0.4, ease: "power2.out" });
    canvas.classList.toggle("hovering", !!hovered);
  }
}

/* ----------------------------- detail page ----------------------------- */
const detail = document.getElementById("detail");
const detailBg = document.getElementById("detailBg");
let detailOpen = false;

function handleClick(e) {
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(cards, false)[0];
  if (!hit) return;
  openDetail(hit.object, e.clientX, e.clientY);
}

function openDetail(mesh, ox, oy) {
  if (detailOpen) return;
  detailOpen = true;
  const p = mesh.userData.project;

  document.getElementById("detailTag").textContent = p.tag || "Case study";
  document.getElementById("detailIndex").textContent = String(p.index + 1).padStart(2, "0");
  document.getElementById("detailDesc").textContent = p.desc;
  document.getElementById("detailImg").src =
    `https://images.weserv.nl/?url=picsum.photos/seed/${encodeURIComponent(p.seed)}/900/1100`;

  // title with italic accent word
  const tEl = document.getElementById("detailTitle");
  if (p.titleItalic && p.title.includes(p.titleItalic)) {
    tEl.innerHTML = p.title.replace(p.titleItalic, `<em>${p.titleItalic}</em>`);
  } else tEl.textContent = p.title;

  // stats
  const statsEl = document.getElementById("detailStats");
  statsEl.innerHTML = (p.stats || []).map(([b, s]) =>
    `<div class="detail__stat"><b>${b}</b><span>${s}</span></div>`).join("");

  // page background tuned to the card's accent
  detailBg.style.background =
    `radial-gradient(120% 120% at 75% 20%, ${hexToRgba(p.color, 0.5)} 0%, ${p.panel} 55%, #efece6 100%)`;

  detail.classList.add("open");
  detail.setAttribute("aria-hidden", "false");

  // expanding circular reveal originating from the click point
  const R = Math.hypot(Math.max(ox, window.innerWidth - ox), Math.max(oy, window.innerHeight - oy));
  gsap.fromTo(detail,
    { clipPath: `circle(0px at ${ox}px ${oy}px)` },
    { clipPath: `circle(${R}px at ${ox}px ${oy}px)`, duration: 0.85, ease: "power3.inOut" });

  gsap.from(".detail__meta > *", { y: 28, opacity: 0, duration: 0.7, stagger: 0.07, delay: 0.35, ease: "power3.out" });
  gsap.from(".detail__media", { y: 40, opacity: 0, scale: 0.96, duration: 0.9, delay: 0.3, ease: "power3.out" });
}

function closeDetail() {
  if (!detailOpen) return;
  const ox = window.innerWidth - 80, oy = 40;
  const R = Math.hypot(Math.max(ox, window.innerWidth - ox), Math.max(oy, window.innerHeight - oy));
  gsap.to(detail, {
    clipPath: `circle(0px at ${ox}px ${oy}px)`, duration: 0.7, ease: "power3.inOut",
    onComplete: () => {
      detail.classList.remove("open");
      detail.setAttribute("aria-hidden", "true");
      detailOpen = false;
    },
  });
}
document.getElementById("back").addEventListener("click", closeDetail);
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

/* ----------------------------- counter --------------------------------- */
// show which card is closest to centre of view
function updateCounter() {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let best = -1, bestDot = -2;
  for (let i = 0; i < cards.length; i++) {
    const d = cards[i].getWorldPosition(new THREE.Vector3()).normalize().dot(fwd);
    if (d > bestDot) { bestDot = d; best = i; }
  }
  if (best >= 0) counterEl.textContent =
    `${String(best + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
}

/* ----------------------------- render loop ----------------------------- */
let autoIdle = 0;
const tmpV = new THREE.Vector3();
function tick() {
  // idle drift when the user isn't touching it
  if (!dragging && !detailOpen) {
    autoIdle += 0.0006;
    state.targetYaw += Math.sin(autoIdle) * 0.00018 + 0.0004;
  }

  // Lenis-style easing: ease toward target, soft and frame-rate friendly
  const ease = 0.085;
  state.yaw += (state.targetYaw - state.yaw) * ease;
  state.pitch += (state.targetPitch - state.pitch) * ease;

  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;

  // apply per-card hover scale + keep cards facing the centre
  for (let i = 0; i < cards.length; i++) {
    const u = cards[i].userData;
    const s = u.baseScale;
    cards[i].scale.set(s, s, s);
  }

  updateCounter();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.__dbg = { scene, camera, cards, state, renderer, cardGroup, THREE };

/* ----------------------------- resize ---------------------------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
