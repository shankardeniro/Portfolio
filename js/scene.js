import * as THREE from "three";

/* Animated, noise-displaced sphere with fresnel rim, the hero centrepiece.
   Lightweight, reacts to scroll + pointer, and degrades on small screens. */

const canvas = document.querySelector("[data-webgl]");
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const noiseGLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const vertex = `
uniform float uTime;uniform float uAmp;uniform float uPointer;
varying float vNoise;varying vec3 vNormal;varying vec3 vView;
${noiseGLSL}
void main(){
  float t=uTime*0.28;
  float n=snoise(position*0.9+vec3(t))*0.55+snoise(position*2.1-vec3(t*0.6))*0.25;
  vNoise=n;
  vec3 displaced=position+normal*n*uAmp*(1.0+uPointer*0.6);
  vNormal=normalize(normalMatrix*normal);
  vec4 mv=modelViewMatrix*vec4(displaced,1.0);
  vView=normalize(-mv.xyz);
  gl_Position=projectionMatrix*mv;
}`;

const fragment = `
uniform vec3 uColorA;uniform vec3 uColorB;uniform float uLight;
varying float vNoise;varying vec3 vNormal;varying vec3 vView;
void main(){
  float fres=pow(1.0-max(dot(vNormal,vView),0.0),2.4);
  vec3 base=mix(uColorA,uColorB,smoothstep(-0.5,0.6,vNoise));
  if(uLight>0.5){
    // light theme: a soft dark-glass orb over the pale page (normal blending)
    vec3 c=mix(vec3(0.10,0.14,0.03), uColorB*0.55, fres);
    gl_FragColor=vec4(c, clamp(0.18+fres*0.55,0.0,0.82));
  } else {
    vec3 col=base*0.16+vec3(0.78,0.95,0.30)*fres*1.2;
    gl_FragColor=vec4(col, clamp(fres*1.1+0.1,0.0,1.0));
  }
}`;

let renderer, scene, camera, mesh, mat, wireMat, raf;
const pointer = { x: 0, y: 0, tx: 0, ty: 0, intensity: 0, ti: 0 };
let scrollY = 0;

function init() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  const geo = new THREE.IcosahedronGeometry(1.4, window.innerWidth < 768 ? 5 : 6);

  mat = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0.0 },
      uPointer: { value: 0 },
      uLight: { value: 0 },
      uColorA: { value: new THREE.Color("#1b2a0a") },
      uColorB: { value: new THREE.Color("#c6f24e") },
    },
  });

  // let the page theme switch the orb between additive glow (dark) and a soft
  // dark-glass look (light) so it never washes out on the pale background
  window.setHeroTheme = function (light) {
    if (!mat) return;
    mat.uniforms.uLight.value = light ? 1 : 0;
    mat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    mat.needsUpdate = true;
    if (wireMat) wireMat.opacity = light ? 0.12 : 0.05;
  };

  mesh = new THREE.Mesh(geo, mat);
  // sit the blob slightly right/back so the headline reads over it
  mesh.position.set(window.innerWidth < 768 ? 0 : 1.4, window.innerWidth < 768 ? 0.4 : 0, 0);
  scene.add(mesh);

  // a faint second wireframe shell for depth
  wireMat = new THREE.MeshBasicMaterial({ color: 0xc6f24e, wireframe: true, transparent: true, opacity: 0.05 });
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 2), wireMat);
  mesh.add(wire);

  addEvents();
  animateIntro();
  loop();
}

function animateIntro() {
  if (prefersReduced) { mat.uniforms.uAmp.value = 0.36; return; }
  const start = performance.now();
  const dur = 2200;
  (function ramp(now) {
    const p = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    mat.uniforms.uAmp.value = e * 0.36;
    if (p < 1) requestAnimationFrame(ramp);
  })(performance.now());
}

function addEvents() {
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = -(e.clientY / window.innerHeight) * 2 + 1;
    pointer.ti = 1;
  }, { passive: true });
  window.addEventListener("pointerout", () => (pointer.ti = 0));
  window.addEventListener("scroll", () => (scrollY = window.scrollY), { passive: true });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mesh.position.x = window.innerWidth < 768 ? 0 : 1.4;
}

const clock = new THREE.Clock();
function loop() {
  raf = requestAnimationFrame(loop);
  const t = clock.getElapsedTime();
  mat.uniforms.uTime.value = t;

  pointer.x += (pointer.tx - pointer.x) * 0.05;
  pointer.y += (pointer.ty - pointer.y) * 0.05;
  pointer.intensity += (pointer.ti - pointer.intensity) * 0.06;
  mat.uniforms.uPointer.value = pointer.intensity;

  if (mesh) {
    mesh.rotation.y += 0.0016 + pointer.x * 0.004;
    mesh.rotation.x = pointer.y * 0.25;
    // gentle drift + scroll-linked sink/scale
    const sp = scrollY / window.innerHeight;
    mesh.position.y = (window.innerWidth < 768 ? 0.4 : 0) - sp * 1.2;
    const base = window.innerWidth < 768 ? 0.66 : 1;
    const s = Math.max(0.001, base * (1 - sp * 0.25));
    mesh.scale.setScalar(s);
    // recede the canvas after the hero so content reads on clean black
    canvas.style.opacity = String(Math.max(0, 1 - sp * 1.25));
    mat.uniforms.uColorB.value.lerpColors(
      new THREE.Color("#c6f24e"),
      new THREE.Color("#7aa2ff"),
      Math.min(sp * 0.5, 0.5)
    );
  }
  renderer.render(scene, camera);
}

// guard: WebGL may be unavailable
try {
  if (canvas) init();
} catch (err) {
  console.warn("WebGL init failed, falling back to gradient", err);
  if (canvas) canvas.style.display = "none";
  document.body.style.background =
    "radial-gradient(60% 60% at 70% 30%, rgba(198,242,78,.12), transparent 70%), #0a0a0c";
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
