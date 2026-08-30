import * as THREE from "three";

/* =========================================================================
   Ring gallery — you sit at the centre of a horizontal ring of project
   cards, all on one line at eye level. Drag to spin it (with inertial,
   Lenis-style easing). Click a card and its section expands into a detail
   page from the click point.
   ========================================================================= */

const gsap = window.gsap;
const canvas = document.getElementById("gl");
const counterEl = document.getElementById("counter");
const hintEl = document.getElementById("hint");
const loaderEl = document.getElementById("loader");
const loaderBar = document.getElementById("loaderbar");

/* ----------------------------- content ---------------------------------
   The three case studies, each fanned out across the sphere by its own
   artefacts. Every shot carries the section it appears in (`sec`) and a
   short excerpt of that section's story (`text`), both lifted from the
   case-study copy in main.js. */
const base = [
  {
    title: "Winning Over Sweden",
    titleItalic: "Sweden",
    tag: "Market launch",
    slug: "winning-over-sweden",
    color: "#d98bb0",
    panel: "#f0d9e6",
    stats: [["0", "violations in 6 months"], ["58%", "more claimed bonuses"]],
    shots: [
      { f: "hero.webp", cap: "A compliant, user-centred casino built for the Swedish market.",
        sec: "Overview · Launching where the rules are strict",
        text: "Sweden has one of the strictest, most mature gambling markets in Europe. Spelinspektionen can revoke a licence over a single violation. Before we could convince any player of anything, we had to convince the regulator we were safe." },
      { f: "requirements-map.webp", cap: "The UX Requirements Map: regulation, to UI pattern, to design action.",
        sec: "Goal 01 · Turning regulation into UX",
        text: "I went through every Spelinspektionen requirement and mapped each one to a UI pattern and the copy it needed. By the first wireframe, compliance was already part of the design." },
      { f: "rtp-lobby.webp", cap: "RTP surfaced on every game tile, with a tap-through explainer.",
        sec: "Goal 03 · Making fairness legible",
        text: "Players read “97% RTP” as “this game pays big right now”, the opposite of what it means. A fairness bet only works if people can read the fairness, so every tile shows its RTP with a one-tap plain-language guide." },
      { f: "epic-pulse.webp", cap: "Epic Pulse: a game's live RTP trend against the house average.",
        sec: "Goal 03 · Making fairness legible",
        text: "Epic Pulse plots each game's live payout numbers against the ~96% house average, where a sceptical player can check the fairness claim themselves. RTP went from a number people misread to a reason to pick a game." },
      { f: "competitive-audit.webp", cap: "Five Swedish operators scored on criteria adapted from Nielsen's heuristics.",
        sec: "Goal 02 · Reading the field",
        text: "If players misread RTP, leading on it could be a costly mistake. Scoring five competitors showed a growing, valuable group who actively hunt Max-RTP games, and no one had claimed that ground." },
      { f: "interview-guide.webp", cap: "The kiosk-interview guide, used in the field across Stockholm.",
        sec: "Goal 02 · The bet",
        text: "The whole plan hinged on one thing nobody had checked: do players even understand or care about RTP? With no budget, I ran short kiosk interviews with real players before we bet the brand on it." },
      { f: "usability-session.webp", cap: "A moderated think-aloud session in progress.",
        sec: "Goal 03 · Watching for hesitation",
        text: "A journey map shows the route, not where real people stumble. Moderated think-aloud sessions with ten Swedish players surfaced 19 distinct patterns, from critical blockers to positive signals." },
      { f: "user-journey.webp", cap: "The complete end-to-end journey map.",
        sec: "Goal 03 · From BankID to gameplay",
        text: "The end-to-end journey, BankID registration → first deposit → gameplay → responsible-gambling tools, is where a first-time player can quietly get lost. I mapped the whole thing to add reassurance before people needed to ask." },
      { f: "lobby-desktop.webp", cap: "The launched lobby: Wunderino, Sweden, 2025.",
        sec: "The launch",
        text: "Getting a new casino licensed and launched in Sweden, one of the strictest gambling markets: get the licence, bet on being the fairest option, then turn that into actual players." },
      { f: "ds-colors.webp", cap: "Primitives, the full brand, neutral and semantic colour ramps.",
        sec: "Goal 01 · Built on tokens",
        text: "Nothing points at a raw colour or size: primitives feed semantic tokens named for what they're for, and tokens feed the components. Change one token and it updates everywhere, twenty-odd flows in sync." },
      { f: "ds-typography.webp", cap: "The type system: Bovine MVB for display, Noto Sans for the rest.",
        sec: "Goal 01 · Built on tokens",
        text: "Going straight to high-fidelity on a licensing deadline only works if you're not redrawing everything each time, so it all sat on a shared system, tokens and components defined once and reused everywhere." },
      { f: "ds-game-card.webp", cap: "Game cards, the core lobby unit, with Epic Pulse built in.",
        sec: "Goal 01 · The component library",
        text: "On top of the tokens sat the components, every variant, state and rule pinned down so engineering didn't have to guess." },
      { f: "mvp-reality-check.webp", cap: "The reality-check interruption, a licence requirement made calm.",
        sec: "Goal 01 · The screens that get us licensed",
        text: "Engineering couldn't start until the licensing-critical screens existed, so the responsible-gaming and account screens went straight to high-fidelity, the MVP the whole licence application was built on." },
      { f: "trust-after.webp", cap: "Trust signals, after the redesign.",
        sec: "Goal 03 · Finding 03: Trust signals",
        text: "Every participant scanned first for BankID, Swish and known provider logos as proof they could trust us, and read their absence as a red flag. So the redesign leads with the names people already believe." },
    ],
  },
  {
    title: "Reimagining Onboarding",
    titleItalic: "Onboarding",
    tag: "Onboarding funnel",
    slug: "reimagining-onboarding",
    color: "#73c7bd",
    panel: "#d4ece8",
    stats: [["+11 pts", "end-to-end conversion"], ["75.2%", "cleared KYC, up from 67.1%"]],
    shots: [
      { f: "hero.webp", cap: "Rebuilding a regulated sign-up around where players stalled.",
        sec: "The challenge",
        text: "As a regulated financial institution we legally can't do one-tap sign-up: every player must pass a KYC check before they can play. A third of pre-checked users were walking away right before verification, and nobody knew why." },
      { f: "affinity-cut.webp", cap: "The affinity map, survey and interview data in four themes.",
        sec: "Act 01 · From scattered insight to clear themes",
        text: "Everything from the surveys and interviews clustered into four themes: requests for assistance, technical and document issues, privacy and security, and motivation." },
      { f: "usability-session.webp", cap: "A moderated session watched live by UX, KYC, BI and operations.",
        sec: "Act 02 · Watching real users move through it",
        text: "Ten participants tried to deposit and play across the KYC states they might land in, with the cross-functional team observing live. Low task-completion and high error rates made the verdict blunt: the flow had to change." },
      { f: "iteration-6.webp", cap: "An early iteration of the registration → activation flow.",
        sec: "Act 03 · From happy path to hi-fi",
        text: "A tight timeline meant no designing the same screens twice: happy path first, fast Figma prototypes, then the design system to jump straight to high-fidelity. The time saved went into testing, not polishing throwaway screens." },
      { f: "iteration-7.webp", cap: "Happy path, iteration 7, with regulatory requirements integrated.",
        sec: "Act 03 · From happy path to hi-fi",
        text: "Skipping mid-fi was a calculated bet: hi-fi was cheap on top of the design system, so iteration count could stay high right up to the regulatory-complete flow." },
      { f: "reg-step1.webp", cap: "Step 1, the bare minimum to get started: country, email, password.",
        sec: "Act 03 · Cut it to the essentials",
        text: "Testing's clearest complaint was blunt: registration felt tedious. I stripped the form to only what we and the regulator need and collapsed the rest into a concise two-step flow, you're in before you can feel the friction." },
      { f: "reg-step2.webp", cap: "Step 2, identity details fronted by a plain-language banner.",
        sec: "Act 03 · Two steps, each earning its keep",
        text: "Identity details are fronted by a plain-language banner, “enter your name and address as it appears on your identity document.” The “why am I giving this?” confusion, answered in context, right where users hesitated." },
      { f: "ab-test.webp", cap: "The A/B comparison, the test variant against the previous flow.",
        sec: "Act 03 · Test it, and read the result honestly",
        text: "The variant showed a 76.42% win probability but never reached significance on a 20% split. The phased rollout removed the doubt: end-to-end conversion climbed from 43.3% to 54.4%, most at the exact step we'd set out to fix." },
    ],
  },
  {
    title: "Building a Research Practice",
    titleItalic: "Research",
    tag: "0 → 1 research",
    slug: "user-research-framework",
    color: "#8f86c9",
    panel: "#ddd9f0",
    stats: [["0 → 1", "built from nothing"], ["8 rounds", "of CSAT over ~3 years"]],
    shots: [
      { f: "hero.webp", cap: "Giving research a rhythm the whole team could plan around.",
        sec: "Overview · Starting from zero",
        text: "The team shipped on opinion: no users to talk to, no place to keep what we learned, no habit of asking before building. The real job was giving the team a way to keep learning after I stopped pushing." },
      { f: "csat-trend.webp", cap: "CSAT average across eight rounds, Oct 2022 to Jun 2025.",
        sec: "02 · Tracking satisfaction",
        text: "A CSAT survey every quarter, reported to leadership each time. Every score came with an open “why” and a 95% confidence interval, so we only reacted when a change was real." },
      { f: "csat-ci.webp", cap: "Each round's ratings, with 95% confidence intervals.",
        sec: "02 · Tracking satisfaction",
        text: "The method comes from Chapman & Rodden's Quantitative UX Research: confidence intervals on every round keep a noisy quarter from being mistaken for a trend." },
    ],
  },
];

/* one card per artefact, round-robined so neighbouring cards on the sphere
   come from different case studies */
const projects = [];
const deepest = Math.max(...base.map((b) => b.shots.length));
for (let r = 0; r < deepest; r++) {
  base.forEach((b) => {
    const shot = b.shots[r];
    if (!shot) return;
    projects.push({
      ...b,
      index: projects.length,
      image: `images/${b.slug}/${shot.f}`,
      caption: shot.cap,
      section: shot.sec,
      sectionText: shot.text,
      // serif line on the card: the section name without its "Goal 01 ·" prefix
      shotTitle: shot.sec.split("·").pop().trim(),
    });
  });
}

/* ----------------------------- three setup ----------------------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 0);
camera.rotation.order = "YXZ";

const CARD_W = 1.62;
const CARD_H = CARD_W * 1.34; // matches 540 / 720 canvas aspect
/* one horizontal ring around the viewer: the radius comes from how much
   circumference the cards need, so spacing stays constant if cards change */
const CARD_GAP = 0.34;
const RADIUS = (projects.length * (CARD_W + CARD_GAP)) / (Math.PI * 2);

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

function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

/* Full-bleed film card: the artefact is the whole card, a bottom grade holds
   the label row, a serif title and a short caption. */
function drawCard(ctx, p, img) {
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  const pad = 30;
  const r = 24;

  ctx.save();
  roundRect(ctx, 0, 0, TEX_W, TEX_H, r);
  ctx.clip();

  // artefact, cover-fit edge to edge with a gentle film grade
  if (img) {
    const ar = img.width / img.height;
    const tar = TEX_W / TEX_H;
    let dw, dh, dx, dy;
    if (ar > tar) { dh = TEX_H; dw = TEX_H * ar; dx = -(dw - TEX_W) / 2; dy = 0; }
    else { dw = TEX_W; dh = TEX_W / ar; dx = 0; dy = -(dh - TEX_H) / 2; }
    // pale UI shots crop from the top rather than the middle — the header of a
    // screen reads better than an arbitrary mid-slice
    if (ar < 0.9) dy = 0;
    ctx.filter = "saturate(0.92) contrast(1.04)";
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = "none";
  } else {
    const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H);
    g.addColorStop(0, "#1d1d22");
    g.addColorStop(1, "#101014");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
  }

  // bottom grade so the type always holds
  const grade = ctx.createLinearGradient(0, TEX_H, 0, TEX_H * 0.38);
  grade.addColorStop(0, "rgba(10,10,12,0.86)");
  grade.addColorStop(0.55, "rgba(10,10,12,0.38)");
  grade.addColorStop(1, "rgba(10,10,12,0)");
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // label row: project, and where this card sits in the set
  ctx.font = "600 19px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "rgba(244,243,238,0.66)";
  const label = p.title.toUpperCase().split("").join(" "); // tracked-out caps
  ctx.fillText(ellipsize(ctx, label, TEX_W - pad * 2 - 110), pad, TEX_H - 128);
  ctx.textAlign = "right";
  ctx.fillText(`${String(p.index + 1).padStart(2, "0")} / ${String(projects.length).padStart(2, "0")}`, TEX_W - pad, TEX_H - 128);
  ctx.textAlign = "left";

  // serif title: the section this artefact belongs to
  ctx.fillStyle = "#f4f3ee";
  ctx.font = "400 42px 'Instrument Serif', Georgia, serif";
  ctx.fillText(ellipsize(ctx, p.shotTitle, TEX_W - pad * 2), pad, TEX_H - 78);

  // caption
  ctx.fillStyle = "rgba(244,243,238,0.72)";
  ctx.font = "400 20px 'Inter', system-ui, sans-serif";
  wrapText(ctx, p.caption, pad, TEX_H - 44, TEX_W - pad * 2, 26, 2);

  // hairline inner border keeps card edges legible against bright artefacts
  roundRect(ctx, 1, 1, TEX_W - 2, TEX_H - 2, r - 1);
  ctx.strokeStyle = "rgba(244,243,238,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

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
  // all cards on one horizontal line: an evenly spaced ring at eye level
  const theta = (i / projects.length) * Math.PI * 2;
  const dir = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));

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

  // load the case study's own artefact, then repaint the card
  const img = new Image();
  img.onload = () => { mesh.userData.img = img; drawCard(ctx, p, img); texture.needsUpdate = true; bumpLoader(); };
  img.onerror = () => bumpLoader();
  img.src = p.image;
});

// the canvas cards use webfonts; canvas doesn't trigger CSS @font-face loading,
// so request the exact faces and repaint every card once they're in
Promise.all([
  document.fonts.load("400 42px 'Instrument Serif'"),
  document.fonts.load("600 19px 'Inter'"),
  document.fonts.load("400 20px 'Inter'"),
]).then(() => {
  cards.forEach((m) => {
    const u = m.userData;
    drawCard(u.ctx, u.project, u.img || null);
    u.texture.needsUpdate = true;
  });
}).catch(() => {});

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
const PITCH_LIMIT = 0.16; // the ring reads as one line — allow only a gentle tilt

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
  document.getElementById("detailSection").textContent = p.section;
  document.getElementById("detailDesc").textContent = p.sectionText;
  document.getElementById("detailCaption").textContent = p.caption;
  document.getElementById("detailLink").href = `/case-study/${p.slug}`;
  const dImg = document.getElementById("detailImg");
  dImg.src = p.image;
  dImg.alt = p.caption;

  // title with italic accent word
  const tEl = document.getElementById("detailTitle");
  if (p.titleItalic && p.title.includes(p.titleItalic)) {
    tEl.innerHTML = p.title.replace(p.titleItalic, `<em>${p.titleItalic}</em>`);
  } else tEl.textContent = p.title;

  // stats
  const statsEl = document.getElementById("detailStats");
  statsEl.innerHTML = (p.stats || []).map(([b, s]) =>
    `<div class="detail__stat"><b>${b}</b><span>${s}</span></div>`).join("");

  // dark room backdrop with a glow of the card's accent — the glow layer is
  // translucent, so it sits on an opaque dark base that seals off the sphere
  detailBg.style.background =
    `radial-gradient(120% 120% at 75% 20%, ${hexToRgba(p.color, 0.26)} 0%, rgba(10,10,12,0) 60%),` +
    `radial-gradient(120% 120% at 50% 40%, #17171c 0%, #0a0a0c 100%)`;

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
