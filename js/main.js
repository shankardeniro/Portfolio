/* Interaction layer: loader, GSAP scroll reveals, counters, marquee,
   word-by-word statement, custom cursor, magnetic buttons. */

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(hover:none),(pointer:coarse)").matches;

function boot() {
  if (window.gsap) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.config({ nullTargetWarn: false });
  }
  initTheme();
  runLoader();
  initCaseStudies();
  if (!isTouch) initCursor();
  if (!isTouch) initWorkPeek();
}

/* ---------- WORK-LIST PEEK ----------
   Hovering a project row floats a preview of that case (its hero image) just
   above the cursor and lets it trail the pointer, so the hover previews where
   you're going instead of only changing colour. Pointer-only (skipped on touch);
   the image is pointer-transparent so clicks still open the case. */
function initWorkPeek() {
  const list = document.querySelector("[data-projects]");
  if (!list || typeof CASES === "undefined") return;
  const peek = document.createElement("div");
  peek.className = "work-peek";
  peek.setAttribute("aria-hidden", "true");
  peek.innerHTML = '<div class="work-peek__inner"><img alt="" loading="lazy"></div>';
  document.body.appendChild(peek);
  const img = peek.querySelector("img");

  let mx = window.innerWidth / 2, my = window.innerHeight / 2, px = mx, py = my;
  const OFFX = 28, OFFY = -118;
  (function render() {
    px += (mx - px) * 0.16; py += (my - py) * 0.16;
    peek.style.transform = `translate3d(${px}px,${py}px,0)`;
    requestAnimationFrame(render);
  })();

  list.querySelectorAll("[data-case]").forEach((a) => {
    const c = CASES[a.dataset.case];
    if (!c || !c.hero) return;
    a.addEventListener("pointerenter", (e) => {
      if (img.getAttribute("src") !== c.hero) img.src = c.hero;
      mx = e.clientX + OFFX; my = e.clientY + OFFY;
      px = mx; py = my;                       // snap on enter, no fly-in from the corner
      peek.classList.add("is-on");
    });
    a.addEventListener("pointermove", (e) => { mx = e.clientX + OFFX; my = e.clientY + OFFY; });
    a.addEventListener("pointerleave", () => peek.classList.remove("is-on"));
  });
}

/* ---------- THEME (light / dark) ---------- */
function initTheme() {
  const root = document.documentElement;
  const sync = (t) => { if (window.setHeroTheme) window.setHeroTheme(t === "light"); };
  // the head script already applied the saved/system theme before paint
  sync(root.getAttribute("data-theme") || "dark");
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      sync(next);
    });
  });
}

/* ---------- LOADER ---------- */
function runLoader() {
  const loader = document.querySelector("[data-loader]");
  const countEl = document.querySelector("[data-loader-count]");
  const bar = document.querySelector("[data-loader-bar]");
  if (!loader) { startSite(); return; }

  const total = reduce ? 200 : 1200;
  const startT = performance.now();
  let done = false;

  (function tick(now) {
    const p = Math.min((now - startT) / total, 1);
    if (countEl) countEl.textContent = Math.round(easeOut(p) * 100);
    if (bar) bar.style.transform = `scaleX(${p})`;
    if (p < 1) requestAnimationFrame(tick);
    else finish();
  })(startT);

  // Safety net: requestAnimationFrame is paused while the tab is backgrounded,
  // which would freeze the loader forever. setTimeout still fires, so guarantee
  // the site reveals regardless of rAF state.
  setTimeout(finish, total + 600);

  function finish() {
    if (done) return;
    done = true;
    if (countEl) countEl.textContent = "100";
    if (bar) bar.style.transform = "scaleX(1)";
    // If gsap is unavailable, or the tab is hidden (animation ticker paused),
    // hide the loader instantly rather than waiting on a timeline that can't run.
    if (!window.gsap || document.visibilityState !== "visible") {
      loader.style.display = "none";
      startSite();
      return;
    }
    const tl = gsap.timeline({ onComplete: startSite });
    tl.to(loader.querySelectorAll(".loader__inner, .loader__bar"), {
      y: -20, opacity: 0, duration: 0.6, ease: "power3.in", stagger: 0.05,
    })
      .to(loader, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.2")
      .set(loader, { display: "none" });
    // Safety: if the ticker stalls mid-timeline, force the reveal.
    setTimeout(() => { if (!started) { loader.style.display = "none"; startSite(); } }, 2200);
  }
}

const easeOut = (x) => 1 - Math.pow(1 - x, 3);

/* ---------- SITE INTRO + SCROLL ---------- */
let started = false;
function startSite() {
  if (started) return;
  started = true;
  document.body.classList.add("ready");
  if (!window.gsap) return;
  initMagnetic();

  const runIntro = () => {
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from("[data-hero-word]", { yPercent: 120, duration: 1.2, stagger: 0.08 })
      .from("[data-fade]", { y: 24, opacity: 0, duration: 0.9, stagger: 0.06 }, "-=0.8")
      .from(".nav", { y: -20, opacity: 0, duration: 0.8 }, "-=0.7");
    if (!reduce) initScrollAnim();
    else initStaticValues();
    initMarquee();
  };

  // gsap.from() temporarily hides elements then tweens them in, but the ticker
  // is paused while the tab is hidden, which would strand them invisible. So only
  // play the intro when visible; otherwise show content now and animate on return.
  if (document.visibilityState === "visible") {
    runIntro();
  } else {
    document.addEventListener("visibilitychange", function onVis() {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVis);
      runIntro();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  }
}

/* Reduced motion skips the scroll choreography, but the numbers are data,
   not decoration — land the counters on their final values immediately. */
function initStaticValues() {
  document.querySelectorAll("[data-stat] [data-count]").forEach((el) => {
    el.textContent = (el.dataset.prefix || "") + el.dataset.count + (el.dataset.suffix || "");
  });
}

function initScrollAnim() {
  // generic fade-up for [data-fade] that aren't in the hero
  gsap.utils.toArray("[data-fade]").forEach((el) => {
    if (el.closest(".hero")) return;
    gsap.from(el, {
      y: 30, opacity: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });

  // Statement: reveal words once as the section arrives, then leave them lit
  // (a one-shot stagger — not a scroll-scrub — so key facts like "5+ years"
  // never fade back out when you scroll up).
  const words = gsap.utils.toArray("[data-word]");
  if (words.length) {
    gsap.to(words, {
      opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.06,
      scrollTrigger: { trigger: ".statement", start: "top 72%", once: true },
    });
  }

  // Stats counters
  gsap.utils.toArray("[data-stat]").forEach((stat, i) => {
    const numEl = stat.querySelector("[data-count]");
    gsap.from(stat, {
      y: 40, opacity: 0, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: ".stats", start: "top 80%", once: true }, delay: i * 0.08,
    });
    if (numEl) {
      const target = parseFloat(numEl.dataset.count);
      const dec = target % 1 !== 0 ? 1 : 0;
      const obj = { v: 0 };
      ScrollTrigger.create({
        trigger: ".stats", start: "top 80%", once: true,
        onEnter: () => gsap.to(obj, {
          v: target, duration: 1.6, ease: "power2.out",
          onUpdate: () => {
            numEl.textContent = (numEl.dataset.prefix || "") + obj.v.toFixed(dec) + (numEl.dataset.suffix || "");
          },
        }),
      });
    }
  });

  // Projects reveal + colour var
  gsap.utils.toArray("[data-project]").forEach((p) => {
    p.style.setProperty("--pcolor", p.dataset.color);
    gsap.from(p, {
      y: 50, opacity: 0, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: p, start: "top 90%", once: true },
    });
  });

  // Services + tools stagger
  gsap.from("[data-service]", {
    y: 40, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out",
    scrollTrigger: { trigger: ".services__list", start: "top 80%", once: true },
  });
  gsap.from("[data-tool]", {
    y: 30, opacity: 0, scale: 0.9, duration: 0.6, stagger: 0.05, ease: "back.out(1.5)",
    scrollTrigger: { trigger: ".tools__grid", start: "top 85%", once: true },
  });

  // Contact reveal lines
  gsap.from(".contact__big .reveal-line span", {
    yPercent: 110, duration: 1.1, stagger: 0.1, ease: "expo.out",
    scrollTrigger: { trigger: ".contact", start: "top 70%", once: true },
  });
}

/* ---------- MARQUEE ---------- */
function initMarquee() {
  const track = document.querySelector("[data-marquee]");
  if (!track || !window.gsap) return;
  const half = track.scrollWidth / 2;
  let x = 0, dir = -1, vel = 0.6;
  if (reduce) return;

  // scroll velocity nudges direction/speed
  let lastScroll = window.scrollY;
  window.addEventListener("scroll", () => {
    const d = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    dir = d >= 0 ? -1 : 1;
    vel = Math.min(0.6 + Math.abs(d) * 0.08, 5);
  }, { passive: true });

  gsap.ticker.add(() => {
    x += dir * vel;
    vel += (0.6 - vel) * 0.05;
    if (x <= -half) x += half;
    if (x >= 0) x -= half;
    track.style.transform = `translateX(${x}px)`;
  });
}

/* ---------- MAGNETIC ---------- */
function initMagnetic() {
  if (isTouch || !window.gsap) return;
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: mx * 0.12, y: my * 0.18, duration: 0.6, ease: "power3.out" });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1,0.4)" });
    });
  });
}

/* ---------- CUSTOM CURSOR ---------- */
function initCursor() {
  const cursor = document.querySelector("[data-cursor]");
  const labelEl = document.querySelector("[data-cursor-label]");
  if (!cursor) return;
  let mx = window.innerWidth / 2, my = window.innerHeight / 2, cx = mx, cy = my;

  window.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  (function render() {
    cx += (mx - cx) * 0.18; cy += (my - cy) * 0.18;
    cursor.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    requestAnimationFrame(render);
  })();

  document.querySelectorAll("[data-cursor-hover]").forEach((el) => {
    el.addEventListener("pointerenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("pointerleave", () => cursor.classList.remove("is-hover"));
  });
  document.querySelectorAll("[data-cursor-label]").forEach((el) => {
    el.addEventListener("pointerenter", () => {
      cursor.classList.add("is-label");
      if (labelEl) labelEl.textContent = el.dataset.cursorLabel;
    });
    el.addEventListener("pointerleave", () => {
      cursor.classList.remove("is-label");
      if (labelEl) labelEl.textContent = "";
    });
  });
}

/* smooth in-page anchor scrolling */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const t = document.querySelector(id);
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }
  });
});

/* nav gets a readable backdrop once you scroll off the hero */
(() => {
  const nav = document.querySelector("[data-nav]");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 32);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
})();

/* ---------- CASE STUDIES ---------- */
const ORDER = ["winning-over-sweden", "reimagining-onboarding", "user-research-framework"];
const CASES = {
  "winning-over-sweden": {
    accent: "#c6f24e", num: "01",
    title: "Winning Over Sweden",
    tagline: "Getting a new casino licensed and launched in Sweden, one of the strictest gambling markets there is.",
    meta: { Role: "Research, Regulatory & Design Strategy", Duration: "6 months", Team: "Sole designer · PM · 8 engineers", Year: "2025" },
    hero: "images/winning-over-sweden/hero.webp",
    heroStage: {
      desktop: "images/winning-over-sweden/lobby-desktop.webp",
      mobile: "images/winning-over-sweden/lobby-mobile.webp",
      kicker: "Wunderino",
      label: "Sweden · 2025",
    },
    sections: [
      { eyebrow: "Overview", h: "Launching where the rules are strict", p: [
        "Sweden has one of the strictest, most mature gambling markets in Europe. Players know what they're doing, the big operators are established, and Spelinspektionen can revoke a licence over a single violation. Before we could convince any player of anything, we had to convince the regulator we were safe.",
        "I led the design for the launch, and owned the research and the regulatory side too. It came down to three things: <em>get the licence</em>, <em>bet on being the fairest option</em>, then <em>turn that into actual players</em>." ] },
      { eyebrow: "The results, up front", metrics: [["0", "compliance violations in 6 months"], ["58%", "uplift in claimed bonuses"], ["86%", "deposit in the first minute"]] },

      // ---------- GOAL 1 ----------
      { chapter: { no: "Goal 01", hud: "Compliance", title: "Get the licence",
        blurb: "Meet every Swedish regulation. It's the price of entry, and the first thing that makes players trust you." } },
      { eyebrow: "Turning regulation into UX",
        p: ["Swedish law hands you dozens of player-safety rules: deposit limits, reality checks, session reminders. Add them at the end and the whole experience buckles under them. So I went through every <b>Spelinspektionen</b> (the regulator) requirement and mapped each one to a UI pattern and the copy it needed. By the first wireframe, compliance was already part of the design."],
        figure: { src: "images/winning-over-sweden/requirements-map.webp", zoom: true, caption: "The UX Requirements Map, regulation → UX pattern → design action. Tap to read in full." } },
      { eyebrow: "The heaviest flows",
        p: ["Registration and the responsible-gaming screens are the heaviest parts of the product, and exactly where first-time players tend to quit. I wireframed every step to keep them clear, checked each one with compliance and local testers, then used our design system to jump straight to high-fidelity, since the licensing clock was tight."] },
      { eyebrow: "The design system", h: "One system behind every screen",
        p: ["Going straight to high-fidelity on a deadline only works if you're not redrawing everything each time. So it all sat on a shared system, tokens and components defined once and reused everywhere. That's what the licensing-critical screens were built from."] },
      { eyebrow: "Foundations", h: "Built on tokens",
        p: ["Nothing points at a raw colour or size: primitives feed <b>semantic tokens</b> named for what they're for (<code>Surface · Brand · Default</code>), and tokens feed the components. Change one token and it updates everywhere — dark mode, retheming, twenty-odd flows in sync. <em>Swipe through the foundations, tap any sheet to enlarge.</em>"],
        carousel: [
          { src: "images/winning-over-sweden/ds-token-structure.webp", caption: "Token architecture, named by UI element, colour role and modifier, so meaning travels with the value." },
          { src: "images/winning-over-sweden/ds-colors.webp", caption: "Primitives, the full brand, neutral and semantic colour ramps." },
          { src: "images/winning-over-sweden/ds-typography.webp", caption: "Type system, Bovine MVB for display, Noto Sans for everything else." },
          { src: "images/winning-over-sweden/ds-color-tokens.webp", caption: "Semantic colour tokens, each bound to a primitive so themes change in one place." }] },
      { eyebrow: "Components", h: "Each one, fully specified",
        p: ["On top of the tokens sat the components, every variant, state and rule pinned down so engineering didn't have to guess. Here's the library as I handed it over:"],
        carousel: [
          { src: "images/winning-over-sweden/ds-buttons.webp", caption: "Buttons, the full hierarchy (primary to ghost) with every state and icon pairing." },
          { src: "images/winning-over-sweden/ds-form-fields.webp", caption: "Form fields, amount, input, dropdown and OTP, with focus, error and disabled states." },
          { src: "images/winning-over-sweden/ds-tabs.webp", caption: "Tabs, the casino / live-casino and game-category navigation patterns." },
          { src: "images/winning-over-sweden/ds-header-nav.webp", caption: "Header navigation, logged-out and logged-in variants." },
          { src: "images/winning-over-sweden/ds-section-heading.webp", caption: "Section headings, the pre-heading, headline, sub-heading and icon anatomy." },
          { src: "images/winning-over-sweden/ds-game-card.webp", caption: "Game cards, the core lobby unit, with the Epic Pulse graph built in." }] },
      { eyebrow: "The screens that get us licensed",
        p: ["Engineering couldn't start on the architecture until the licensing-critical screens existed. So I took the responsible-gaming and account screens, deposit limits, account summary, reality check, straight to high-fidelity, and the team had something real to build against."],
        beat: { outcome: "Shipped the MVP the whole licence application was built on." },
        gallery: [
          { src: "images/winning-over-sweden/mvp-deposit-limit.webp", caption: "Deposit-limit step" },
          { src: "images/winning-over-sweden/mvp-account-summary.webp", caption: "Account-summary modal" },
          { src: "images/winning-over-sweden/mvp-reality-check.webp", caption: "Reality-check interruption" }] },
      { result: { n: "0", label: "compliance violations in the first six months",
        note: "Goal 1 done. Licence secured, and the baseline of trust everything else builds on." } },

      // ---------- GOAL 2 ----------
      { chapter: { no: "Goal 02", hud: "The bet", title: "Bet on being the fairest",
        blurb: "Stand out with the best payout rates in the market, but first check whether players actually care." } },
      { quote: "The whole plan rested on an assumption nobody had tested." },
      { eyebrow: "The bet",
        p: ["Compliance got us in the door, but it wouldn't make us stand out. The plan was to be the fairest casino in the market, with the best <em>Return-to-Player</em> (RTP) rates anywhere, and it hinged on one thing nobody had checked: <em>do players even understand or care about RTP?</em> So before we bet the brand on it, I treated it as a question to test. With no budget, I ran short kiosk interviews with real players, using prompt cards they could answer in seconds."],
        figrow: [
          { src: "images/winning-over-sweden/interview-guide.webp", caption: "The question guide, funnelling broad prompts down to whether players grasp RTP and let it steer game choice." },
          { src: "images/winning-over-sweden/prompt-cards.webp", caption: "The prompt cards, printed and used in the field at Svenska Spel and ATG kiosks across Stockholm." }] },
      { eyebrow: "Synthesis", h: "What we got right, and wrong",
        p: ["I grouped the interviews into an affinity map and checked them honestly against what we'd assumed. The very first theme went straight against our bet:"],
        cards: [
          { tone: "yes", label: "What we got right", items: [
            "The savvy players really do care about RTP, they compare sites for the best odds.",
            "People go for the brands and game providers they already know."] },
          { tone: "no", label: "What we got wrong", items: [
            "Trust isn't really about regulation. Players ignore licence badges and treat <b>familiar payment methods</b>, BankID and Swish, as the real proof you're safe.",
            "Most players misread fairness itself: “97% RTP” lands as “this game pays big now,” not “I lose 3% over time.”"] },
          { tone: "aha", label: "What surprised us", items: [
            "Which games a casino had, and how well they were <b>curated</b>, mattered far more to people's choice than we'd assumed."] }] },
      { eyebrow: "Reading the field",
        p: ["If players misread RTP, leading on it could be a costly mistake. To see whether an opening was still there, I scored five competitors against Nielsen's heuristics on how clearly they handled RTP, responsible gaming and onboarding."],
        beat: { outcome: "There's a growing, valuable group who actively hunt for <b>Max-RTP</b> games, and no one had claimed that ground." },
        figure: { src: "images/winning-over-sweden/competitive-audit.webp", caption: "Competitive audit, five Swedish operators scored against Nielsen's heuristics." } },
      { verdict: { label: "What we decided", text: "The bet mostly held, with a twist. Savvy players who hunt <em>Max-RTP</em> games reward visible fairness, and their loyalty is worth a little margin. Most players, though, misread the number. So the plan became: explain fairness in plain language, and reassure everyone else with the things they already trust — familiar payment methods and game providers." } },

      // ---------- GOAL 3 ----------
      { chapter: { no: "Goal 03", hud: "The journey", title: "Turn trust into players",
        blurb: "Licence in hand, now make the fairness bet obvious in the product, smooth out the journey, and show players the things they told us they look for." } },
      { eyebrow: "Making fairness legible", h: "Putting it in plain language",
        p: ["Players read <em>“97% RTP”</em> as <b>“this game pays big right now”</b>, the opposite of what it means. A fairness bet only works if people can read the fairness, so I put it where people pick a game. Every tile shows its RTP with a one-tap plain-language guide, and <b>Epic Pulse</b> plots each game's live payout numbers against the house average, where a sceptical player can check the claim themselves."],
        beat: { outcome: "RTP went from a number people misread to a reason to pick a game." },
        gallery: [
          { src: "images/winning-over-sweden/rtp-lobby.webp", caption: "RTP surfaced on every game tile in the lobby, with a tap-through “Return to player (RTP): read guide” explainer." },
          { src: "images/winning-over-sweden/epic-pulse.webp", caption: "Epic Pulse, a live transparency readout: a game's recent RTP trend against the ~96% house average, plus how often small, big and mega wins have actually landed over the last 27,000 rounds." }] },
      { eyebrow: "From BankID to gameplay",
        p: ["The end-to-end journey, BankID registration → first deposit → gameplay → responsible-gambling tools, is where a first-time player can quietly get lost. I mapped the whole thing to find where to make steps clearer and add reassurance before people needed to ask, so no one gets stranded partway through."],
        figure: { src: "images/winning-over-sweden/user-journey.webp", caption: "The complete end-to-end journey map." } },
      { eyebrow: "Watching for hesitation",
        p: ["A journey map shows the route. It doesn't show where real people stumble. So I ran moderated think-aloud sessions with ten Swedish players, first-timers and veterans, with stakeholders watching live. Seeing where they hesitated showed us exactly what to fix."],
        beat: { outcome: "19 distinct patterns, from critical blockers to positive signals." },
        figure: { src: "images/winning-over-sweden/usability-session.webp", caption: "A moderated think-aloud session in progress — participants recruited through UserInterviews.com, €100 for 30 minutes." } },
      { eyebrow: "From signal to priorities", h: "19 patterns, triaged",
        p: ["Every pattern had a participant quote, a video frame from the exact moment it happened, and a severity score. I sorted by severity and impact, and shipped fixes for the three biggest ones (below)."],
        table: { head: ["Severity", "Pattern", "Participants"], rows: [
          ["Critical", "Withdrawal flow — buried, broken & inconsistent", "4"],
          ["Critical", "Spelpaus self-exclusion silently blocked registration", "2"],
          ["High", "No in-game deposit — players forced back to the lobby", "3"],
          ["High", "Welcome-bonus opt-in appears too late in the flow", "3"],
          ["High", "Mandatory deposit-limits screen dismissed as a hurdle", "3"],
          ["High", "Game viewport bug — desktop layout rendered on mobile", "1"],
          ["High", "Live-casino entry — confusing screen-name bug", "1"] ] } },
      { eyebrow: "Finding 01 · Bonus claim",
        p: ["People struggled to claim the deposit bonus right after signing up, the moment we could least afford to lose them. I redesigned the flow to keep people in context with a clear sense of progress, and folded the bonus claim into the deposit step."],
        beat: { quote: "I would prefer to do it in one flow, like not have to go back and forth.",
          cite: "Rolf, usability participant" },
        compare: { stacked: true, before: { src: "images/winning-over-sweden/bonus-before.webp" }, after: { src: "images/winning-over-sweden/bonus-after.webp" } } },
      { eyebrow: "Craft, up close", h: "Why the redesign works, up close",
        p: ["The before/after shows <em>what</em> changed. Here's <em>why</em>, four decisions on the redesigned bonus screen. <em>Hover or tap a marker.</em>"],
        annotate: {
          src: "images/winning-over-sweden/craft-welcome-bonus.webp",
          alt: "The redesigned Welcome Bonus screen, annotated with four design-decision callouts.",
          notes: [
            { x: 93, y: 20, tag: "State · disclosure", text: "Detail on demand. The full bonus mechanics sit behind the <b>“i”</b>, a tap-through leaflet, so the screen stays scannable while the curious can still dig in. Progressive disclosure beats a wall of terms." },
            { x: 46, y: 55, tag: "Hierarchy", text: "The benefit leads. <b>“100%”</b> is the single largest element on the screen, above the brand and even the CTA, so a first-time player grasps the upside in under a second." },
            { x: 50, y: 67, tag: "Microcopy", text: "The catch, up front. Min-deposit, <b>35× wagering</b> and 60-day expiry sit inline on the offer, in plain sight. Goal 02 showed Swedish players distrust hidden conditions, so honesty is the trust play." },
            { x: 51, y: 75, tag: "Component choice", text: "Two actions become one. Deposit and bonus-claim collapse into a <b>single primary button</b>, the Finding 01 fix, ending the back-and-forth between a deposit step and a separate claim." }] } },
      { eyebrow: "Finding 02 · Live-casino navigation",
        p: ["Asked to open a live-casino game, participants couldn't find the live-casino navigation, buried in the bottom menu. I moved it up into a clear top tab bar, separating the two sections. Testers found it instantly and task success went up."],
        compare: { before: { src: "images/winning-over-sweden/livecasino-before.webp" }, after: { src: "images/winning-over-sweden/livecasino-after.webp" },
          decision: "<b>Moved up into a top tab bar.</b> Casino and Live Casino now sit side by side at the top, so the two read as separate the moment the lobby loads, no digging through the bottom menu to switch." } },
      { eyebrow: "Finding 03 · Trust signals",
        p: ["Just as Goal 02 predicted, every participant scanned first for “BankID,” “Swish” and known provider logos as proof they could trust us, and read their absence as a red flag. So I put the payment-method and provider logos front and centre, borrowing the trust people already give those names."],
        beat: { quote: "BankID is number one. That's the first thing I look at.",
          cite: "Rolf, usability participant" },
        compare: { before: { src: "images/winning-over-sweden/trust-before.webp" }, after: { src: "images/winning-over-sweden/trust-after.webp" },
          decision: "<b>Lead with the logos people already trust.</b> BankID, Swish and Trustly sit right where the decision happens, each with a plain reassurance, secure login, fast withdrawals. Goal 02 showed people read familiar payment methods as proof of safety, so the screen <em>borrows</em> trust from names they already believe." } },
      { eyebrow: "The payoff", h: "A smoother, more trusted journey", p: [
        "Fixing those three findings moved the numbers the project was judged on: the jump in claimed bonuses and first-minute deposits." ] },

      // ---------- CLOSE ----------
      { verdict: { label: "The outcome", text: "Localising for Sweden was never about translation. Compliance got us the licence, the tested bet on fairness gave the brand its reason to exist, and the smoother journey turned that into players: zero violations in six months, 58% more claimed bonuses, and 86% of deposits landing inside the first minute." } },

      // ---------- LEARNINGS & TAKEAWAY ----------
      { eyebrow: "Learnings", h: "What I'd carry into the next launch",
        p: ["Three things stuck with me, the ones I'd reach for the next time a regulated market comes up."],
        cards: [
          { tone: "yes", label: "Design compliance in", items: [
            "Mapping every <b>Spelinspektionen</b> rule to a UI pattern made safety part of the design from the first wireframe, and kept twenty-odd flows consistent under a deadline."] },
          { tone: "aha", label: "Test the bet before you build it", items: [
            "A no-budget research sprint showed most players <b>misread RTP</b> before we'd bet the brand on it. Cheapest research I've run, and the most useful, it changed the whole strategy."] },
          { tone: "no", label: "Trust comes from familiar things", items: [
            "Players ignored licence badges and treated <b>BankID, Swish</b> and familiar providers as the real proof of safety. Reassurance has to sit where people already look."] }] },
      { verdict: { label: "The takeaway", text: "In a mature, regulated market, features didn't win us anything. Trust did, and it had to be visible early. Fast, honest research, compliance in the wireframes from day one, and credibility borrowed from names players already believe. That's what I'd do again." } },
    ],
  },
  "user-research-framework": {
    accent: "#7aa2ff", num: "03",
    title: "Founding a Research Practice",
    tagline: "There was no research when I joined. I gave the team a rhythm for it, then used AI to keep that rhythm going on my own.",
    meta: { Role: "Founding researcher + product designer", Scope: "0 → 1, greenfield", Duration: "3 months to stand up · 2+ years sustained", Year: "2022" },
    hero: "images/user-research-framework/hero.webp",
    sections: [
      { eyebrow: "Overview", h: "There was no research when I joined", p: [
        "The team shipped on opinion. There were no users to talk to on any regular basis, no place to keep what we learned, and no habit of asking before building. I was the first researcher, so there was nothing to inherit.",
        "I'm a designer too, so I could run the research and design the fix myself. But the real job was bigger than any single study: giving the team a way to keep learning after I stopped pushing." ] },
      { eyebrow: "Where it went", metrics: [["0 → 1", "research, built from nothing"], ["On a schedule", "runs every month and quarter"], ["8 rounds", "of CSAT over ~3 years"]] },

      { chapter: { no: "01", hud: "Before", title: "No research, at all",
        blurb: "No users to talk to, no notes, no habit of asking. People said “we should talk to users,” then didn't." } },
      { eyebrow: "The starting point", h: "What that meant day to day", p: [
        "When I arrived, this is what having no research looked like:" ],
        list: [
          "Product decisions ran on gut feel and meeting-room consensus.",
          "There was no reliable way to reach real users.",
          "The odd study happened, then got lost in someone's drive.",
          "With no shared place for findings, we kept asking the same questions.",
          "And it wasn't anyone's job to fix that." ] },

      { chapter: { no: "02", hud: "The rhythm", title: "I put research on a schedule",
        blurb: "Research that waits to be asked for doesn't happen. So I gave it a regular beat." } },
      { eyebrow: "The rhythm", h: "A regular beat", p: [
        "Instead of waiting for someone to ask, I put research on the calendar and matched the method to what we needed to learn. It ran whether or not anyone remembered to ask." ],
        table: { head: ["How often", "What I ran", "To learn"], rows: [
          ["Every month", "User interviews", "Why people do what they do"],
          ["Every quarter", "Surveys", "How common those things are"],
          ["Per feature", "Usability tests", "Whether a design works before we build it"],
          ["Always on", "Behavioural data", "What people actually do in the product"] ] },
        cap: "A full usability round, start to readout, is in <a data-case=\"winning-over-sweden\" data-cursor-hover>Winning Over Sweden →</a>." },
      { eyebrow: "Getting people to use it", h: "A schedule only works if people show up", p: [
        "A calendar entry changes nothing on its own. I got product, design and engineering, plus data, CRM and marketing, using the same simple steps and one shared folder for findings. The readout turned into a regular meeting people came to, and after a while research was simply something the team expected." ] },
      { eyebrow: "Measuring it", h: "I started tracking satisfaction properly", p: [
        "I ran a CSAT survey every quarter and reported it to leadership each time. Every score came with an open “why” and a 95% confidence interval, so we only reacted when a change was real. The method comes from Chapman &amp; Rodden's <a href=\"https://quantuxbook.com/\" target=\"_blank\" rel=\"noopener\" data-cursor-hover>Quantitative UX Research ↗</a>." ],
        figures: [
          { src: "images/user-research-framework/csat-trend.webp", caption: "CSAT average across eight rounds, Oct 2022 to Jun 2025." },
          { src: "images/user-research-framework/csat-ci.webp", caption: "Each round's ratings, with 95% confidence intervals." } ] },

      { chapter: { no: "03", hud: "With AI", title: "Then I used AI to keep up",
        blurb: "One person can't run a team's worth of research by hand. AI closed the gap." } },
      { eyebrow: "Where AI fits", h: "It does the slow part", p: [
        "The slow part of research is going through everything afterwards. I use AI (Claude) to transcribe sessions, take a first pass at grouping what people said, and spot patterns across interviews and open survey answers. I still make the calls, but it means one person can keep the whole schedule running, and it's how I'd set research up inside an AI product from the start." ] },

      { verdict: { label: "Where it ended up", text: "When I joined there was no research. Now the team plans around it. I did most of it on my own by giving research a rhythm and letting AI take the grind, and the studies it produced fed <a data-case=\"reimagining-onboarding\" data-cursor-hover>Reimagining Onboarding →</a> (conversion up 11 points) and <a data-case=\"winning-over-sweden\" data-cursor-hover>Winning Over Sweden →</a>." } },
    ],
  },
  "reimagining-onboarding": {
    accent: "#ff8a5c", num: "02",
    title: "Reimagining Onboarding",
    tagline: "Redesigning a heavy, regulated sign-up so fewer people quit before they finish verifying.",
    meta: { Role: "UX Designer / Researcher", Duration: "Sept 2023 – Jan 2024", Team: "Sole design & research · product · engineering · CRM", Year: "2024" },
    hero: "images/reimagining-onboarding/hero.webp",
    sections: [
      { eyebrow: "The challenge", h: "When you can't take the easy sign-up", p: [
        "Most apps onboard you in a tap, Google, Apple, done. We legally can't. As a regulated <em>financial institution</em>, every player has to hand over full details and pass a KYC check, by bank transfer or government ID, before they can play.",
        "And that flow is where the money is made: getting through onboarding and making a first deposit is one of the numbers the business lives on. A third of pre-checked users were walking away right before verification, and nobody knew why." ] },
      { eyebrow: "The funnel", h: "Following the drop-off", p: [
        "I started with the data: every user tracked from sign-up through to verified, depositing player, step by step. One step leaked far more than the rest." ],
        funnel: { caption: "Every user from sign-up to depositing player, each bar as a share of everyone who registered. Scroll and watch it narrow.", rows: [
          { label: "Registered", count: 79602 },
          { label: "Activated", count: 78085, drop: "1,517" },
          { label: "Pre-checked", count: 66294, drop: "11,791" },
          { label: "Attempted verification", count: 44452, drop: "21,842", big: true },
          { label: "Verified", count: 39609, drop: "4,843" },
          { label: "Verified depositors", count: 34462, drop: "5,147" } ] } },
      { verdict: { label: "The biggest leak", text: "<b>21,842 users</b>, a full third of everyone who'd been pre-checked, vanished between <em>pre-checked</em> and <em>attempted verification</em>, right where they were meant to start KYC. Closing that gap became the goal: get the number of <em>verified</em> users as close as possible to the number who <em>registered</em>." } },
      { eyebrow: "Problem statement", h: "The question we set out to answer", p: [
        "<em>How do we guide users through sign-up and KYC verification so more of them make it out the other side?</em>",
        "Before starting discovery, we asked ourselves two questions and planned the study around them:" ],
        list: [
          "What might be the reasons for users not completing the process / getting verified?",
          "How efficient are our sign-up and KYC processes?"] },

      // ---------- ACT 1 ----------
      { chapter: { no: "01", hud: "Discovery", title: "Talk to the people who left",
        blurb: "Survey the users who dropped out of KYC, interview a screened few, then watch real people move through the flow." } },
      { eyebrow: "Research plan", h: "How I'd learn", p: [
        "Talking to the users who'd dropped off was the obvious place to start. I ran a mixed-methods study, a screener survey feeding in-depth interviews, then moderated usability testing with screen-recording and behavioural analysis, so I could check what users <em>said</em> against what they <em>did</em>." ] },
      { eyebrow: "Screener survey", h: "Start with the people who left", p: [
        "I surveyed the drop-offs directly, cognitive-testing the questionnaire first and working with CRM to reach the right customers. Asked why they hadn't completed verification, they said:" ],
        donut: { caption: "Survey — reasons for not completing the verification process.", items: [
          { label: "I tried to verify myself, but without success", value: 28.2 },
          { label: "I assumed the process might be too time-consuming", value: 17.9 },
          { label: "I have privacy and security concerns", value: 15.4 },
          { label: "I don't understand why I need to verify myself", value: 15.4 },
          { label: "I wasn't sure if I need to verify my account", value: 12.8 },
          { label: "Other", value: 7.7 },
          { label: "The instructions are unclear", value: 2.6 } ] } },
      { eyebrow: "User interviews", h: "Seven conversations, in depth", p: [
        "I screened <b>7 participants</b> for in-house interviews on the whole onboarding journey, with the verification steps under the microscope, probing where people stall, what they misread about KYC, and where privacy worries set in." ],
        figure: { src: "images/reimagining-onboarding/interview.mp4", caption: "A video snippet from a user-interview session." } },
      { eyebrow: "Research synthesis", h: "From scattered insight to clear themes", p: [
        "We clustered everything from the surveys and interviews into an affinity map: four themes covering what users expected and where they got stuck." ],
        figure: { src: "images/reimagining-onboarding/affinity-cut.webp", bare: true, wide: true, caption: "The affinity map, survey and interview data clustered into four themes: requests for assistance, technical & document issues, privacy & security, and motivation." } },

      // ---------- ACT 2 ----------
      { chapter: { no: "02", hud: "Usability test", title: "Watch where it breaks down",
        blurb: "A moderated study to surface the hiccups in the flow, the copy and the information architecture." } },
      { eyebrow: "Usability study", h: "Watching real users move through it", p: [
        "I ran a moderated study with <b>10 participants</b> (7 mobile, 3 desktop), each trying to deposit and play across the KYC states they might land in, with the cross-functional team observing live. Low task-completion and high error rates made the verdict blunt: the flow had to change." ],
        figure: { src: "images/reimagining-onboarding/usability-session.webp", caption: "A moderated session observed live, the participant and interviewer on screen, the UX, KYC, BI and operations team watching where players stalled in real time." } },
      { eyebrow: "Key observations · Registration flow", h: "What we saw", cards: [
        { tone: "yes", label: "Relevant facts", items: [
          "Most users find the amount of personal data required acceptable.",
          "Some are pleasantly surprised that no payment method or verification is needed during registration.",
          "The concept of the national limit isn't understood by many, few realise it applies across slot-sites.",
          "Still, users perceive the limit as a positive tool, it protects them and underpins trustworthiness."] },
        { tone: "no", label: "Important findings", items: [
          "The welcome offer is sometimes overlooked (though recognised as the same offer from the homepage and TV).",
          "A few users worry their telephone number might be used for marketing.",
          "“Change your limit anytime” confuses, we should state the conditions for changing limits.",
          "More information is needed to explain the national limit and its purpose."] } ] },
      { eyebrow: "Key observations · Verification flow", h: "Where trust wobbled", cards: [
        { tone: "yes", label: "Relevant facts", items: [
          "Verification is recognised as a common procedure at online casinos.",
          "The overview of three statuses is appreciated and helpful, and users like the green confirmation after verifying.",
          "“Sofort verification” is the most preferred method because it's fast; ID upload is second, as a well-known procedure."] },
        { tone: "no", label: "Important findings", items: [
          "Benefits and purpose of verification aren't clear to several users, we should explain it's German regulation / player protection.",
          "The verification reward (50 cash spins) confuses some, who mistake it for the welcome offer.",
          "Some tap <b>“Zahlungsmethode”</b> expecting to add a payment method (irritation).",
          "“Not identified” vs “identified” raises questions, some think identified already means verified.",
          "Sofort verification draws attention as the highlighted, fastest option, but many don't know how it works and are put off when asked for bank details on the next page."] } ] },
      { verdict: { label: "The pivot", text: "Four problems stood out: <b>process</b> (KYC feels long and complex), <b>technical</b> (verification simply fails: broken scans, failed uploads), <b>privacy</b> (reluctance to share documents) and <b>motivation</b> (no clear payoff). Privacy and motivation sat with legal and CRM. The two doing the most damage, and the two I could move, were process and technical. So the redesign ran on two fronts: the registration form, and the verification step itself." } },

      // ---------- ACT 3 ----------
      { chapter: { no: "03", hud: "The redesign", title: "Rebuilding onboarding",
        blurb: "Bring registration in-house, cut it to the essentials, and test it honestly before rolling it out." } },
      { eyebrow: "The opportunity", h: "Make the case to build in-house",
        beat: {
          challenge: "Registration ran on an external provider, a black box we couldn't tune. Every fix the research pointed to was a vendor ticket and a wait.",
          moveLabel: "What I did",
          move: "I turned the usability evidence into the case for bringing registration in-house: control and faster iteration on the UX side, cheaper than the vendor on the financial side. Leadership bought it, and I owned the flow end-to-end from there.",
          outcomeLabel: "Why it mattered",
          outcome: "It turned a fixed, outsourced funnel into something the team controlled. Every problem the research had found was now ours to fix directly." } },
      { eyebrow: "Two-step registration", h: "Cut it to the essentials",
        beat: {
          challenge: "Testing's clearest complaint was blunt: registration felt <em>tedious</em>. People quit not because the steps were hard, but because there were too many of them.",
          move: "I benchmarked competitors and industry leaders, stripped the form to only what we and the regulator need, and collapsed the rest into a concise <b>two-step</b> flow.",
          outcomeLabel: "Why it works",
          outcome: "Fewer fields, fewer screens, less time on task, aimed squarely at the step where the funnel lost the most people." } },
      { eyebrow: "Design process", h: "From happy path to hi-fi",
        beat: {
          challenge: "A tight timeline meant I couldn't afford to design the same screens twice.",
          move: "I mapped the happy path, prototyped in Figma for fast internal and guerrilla tests, then used the design system to jump straight to high-fidelity.",
          outcomeLabel: "Why this way",
          outcome: "Skipping mid-fi was a calculated bet: the design system made hi-fi cheap, so the time saved went into testing the flow instead of polishing throwaway screens." },
        gallery: [
          { src: "images/reimagining-onboarding/iteration-6.webp", caption: "An early iteration of the registration → activation flow." },
          { src: "images/reimagining-onboarding/iteration-7.webp", caption: "Happy path, iteration 7, with regulatory requirements integrated." }] },
      { eyebrow: "The new flow", h: "Two steps, each earning its keep", p: [
        "The redesign splits registration into two deliberate steps, each answering a specific thing the research said was breaking patience or trust." ],
        gallery: [
          { src: "images/reimagining-onboarding/reg-step1.webp", caption: "Step 1, the bare minimum to get started: country, email, password. A direct answer to the “it's tedious” complaint, you're in before you can feel the friction." },
          { src: "images/reimagining-onboarding/reg-step2.webp", caption: "Step 2, identity details fronted by a plain-language banner, “enter your name and address as it appears on your identity document.” The “why am I giving this?” confusion, answered in context, right where users hesitated." }] },
      { eyebrow: "The KYC bottleneck", h: "Fix verification itself",
        beat: {
          challenge: "A leaner form only got users <em>to</em> verification faster, and verification was where they dropped off. The top reason for quitting was blunt: <b>they tried to verify, and it failed.</b> No copy could rewrite that.",
          moveLabel: "What I did",
          move: "I pushed the team to treat the KYC provider as a decision we owned. We benchmarked vendors and moved to <b>Sonio</b>, paired with faster verification methods, so more users cleared KYC on the first attempt.",
          outcomeLabel: "Why it mattered",
          outcome: "It hit the single biggest drop-off at its source, and it meant we weren't tied to one onboarding partner any more, which is where both the conversion lift and the cost saving came from." } },
      { eyebrow: "A/B testing", h: "Test it, and read the result honestly", p: [
        "I tested the new flow against the old with only <b>20%</b> of traffic on the variant: less statistical power than a 50/50 split, but it capped the downside of a risky new flow while still gathering data." ],
        table: { head: ["Variant", "Registrations", "Exposure", "Win probability"], rows: [
          ["Control (previous flow)", "8,875", "22,181", "23.58%"],
          ["Test (new flow)", "2,352", "5,782", "76.42%"] ] },
        figure: { src: "images/reimagining-onboarding/ab-test.webp", caption: "A/B comparison, the test variant against the previous flow." } },
      { verdict: { label: "Read honestly", text: "The test variant showed a higher win probability, <b>76.42%</b> vs <b>23.58%</b>, so it's <em>likely</em> the stronger flow for driving registrations. But the results weren't statistically significant, so we couldn't confidently conclude the test variant was superior on that data alone." } },
      { eyebrow: "Phased improvements", h: "Ship value early, improve over time", p: [
        "Rather than wait on a clean experiment, we rolled the flow out in phases, a good experience out of the box, improvements prioritised over time, then watched the live funnel instead of a 20% sample." ] },
      { eyebrow: "The payoff", h: "What the funnel did next", p: [
        "The controlled A/B never reached significance, but the full rollout removed the doubt. Once the leaner registration and <b>Sonio</b> reached every user, the live funnel moved, most at the exact step we'd set out to fix." ],
        metrics: [["54.4%", "end-to-end conversion, up from 43.3%"], ["75.2%", "cleared the KYC step, up from 67.1%"], ["25%", "drop-off before KYC, down from 33%"]] },
      { eyebrow: "Before / after", h: "The funnel, re-measured", p: [
        "Cumulative conversion at every step, the original flow against the redesigned one." ],
        table: { head: ["Step", "Before", "After"], rows: [
          ["Registered", "100%", "100%"],
          ["Activated", "98.1%", "98.6%"],
          ["Pre-checked", "83.3%", "84.6%"],
          ["Attempted verification", "55.8%", "63.6%"],
          ["Verified", "49.8%", "58.4%"],
          ["Verified depositors", "43.3%", "54.4%"] ] } },
      { result: { n: "+11 pts", label: "end-to-end onboarding conversion",
        note: "Registered → verified depositor climbed from 43.3% to 54.4% once the leaner flow and Sonio reached every user." } },
      { verdict: { label: "The business case", text: "The redesign paid off beyond conversion. Bringing registration in-house and moving KYC to <b>Sonio</b> cut onboarding costs and ended our dependence on a single partner. Verified users moved measurably closer to registered, which was the goal. Privacy and motivation are the next things to tackle." } },
      { eyebrow: "Learnings", h: "What I'd carry, and change", p: [
        "<b>The experiment trade-off was mine to own.</b> I capped the test at 20% of traffic to protect the business from a risky new flow, but that caution cost me the sample size to reach significance. Next time I'd size exposure against the runway up front, and decide deliberately whether I'm optimising to protect the funnel or to prove the lift.",
        "<b>Shipping beats certainty when the system keeps learning.</b> Rather than wait for a clean result, we rolled the flow out in phases and kept improving it. The more durable win was cultural: sharing findings openly moved the team from one-off projects toward continuous discovery.",
        "Across all of it, I led the research, the plan, interview guides and survey design, and owned the end-to-end onboarding design against our design system, the work that made a heavy, regulated flow feel manageable." ] },
    ],
  },
};

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Intrinsic image dimensions, emitted as width/height so the browser reserves
// layout space before the (lazy) image loads. Without this, lazy images grow the
// page as you scroll and the reading/path progress can never settle at 100%.
const IMG_DIMS = {
  "winning-over-sweden/hero.webp": [1440, 1240], "winning-over-sweden/mvp-sketches.webp": [2528, 1527],
  "winning-over-sweden/hero-phone-a.webp": [786, 1728], "winning-over-sweden/hero-phone-b.webp": [786, 1728],
  "winning-over-sweden/wireframe-1.webp": [316, 682], "winning-over-sweden/wireframe-2.webp": [278, 632], "winning-over-sweden/wireframe-3.webp": [298, 672],
  "winning-over-sweden/user-journey.webp": [1688, 1086], "winning-over-sweden/problem-bonus.webp": [1362, 777], "winning-over-sweden/solution-bonus.webp": [1390, 842],
  "winning-over-sweden/live-casino-problem.webp": [460, 936], "winning-over-sweden/live-casino-solution.webp": [526, 1016],
  "winning-over-sweden/requirements-map.webp": [1566, 2112], "winning-over-sweden/competitive-audit.webp": [1630, 1056],
  "winning-over-sweden/usability-session.webp": [3018, 1946], "winning-over-sweden/trust-screen-before.webp": [393, 836], "winning-over-sweden/trust-screen-after.webp": [393, 850],
  "winning-over-sweden/mvp-deposit-limit.webp": [393, 864], "winning-over-sweden/mvp-account-summary.webp": [393, 864], "winning-over-sweden/mvp-reality-check.webp": [393, 864],
  "winning-over-sweden/rtp-lobby.webp": [716, 1482], "winning-over-sweden/epic-pulse.webp": [430, 574],
  "winning-over-sweden/craft-welcome-bonus.webp": [327, 753],
  "winning-over-sweden/ds-buttons.webp": [3774, 6977], "winning-over-sweden/ds-form-fields.webp": [3774, 4056],
  "winning-over-sweden/ds-tabs.webp": [3774, 3504], "winning-over-sweden/ds-header-nav.webp": [3774, 4156],
  "winning-over-sweden/ds-section-heading.webp": [3774, 3102], "winning-over-sweden/ds-game-card.webp": [3774, 6920],
  "winning-over-sweden/ds-token-structure.webp": [3456, 3976], "winning-over-sweden/ds-colors.webp": [3456, 8884],
  "winning-over-sweden/ds-typography.webp": [1728, 4367], "winning-over-sweden/ds-color-tokens.webp": [1728, 8440],
  "winning-over-sweden/interview-guide.webp": [2824, 2144],
  "winning-over-sweden/bonus-before.webp": [1537, 870], "winning-over-sweden/bonus-after.webp": [1521, 876],
  "winning-over-sweden/livecasino-before.webp": [810, 1688], "winning-over-sweden/livecasino-after.webp": [1022, 1586],
  "winning-over-sweden/trust-before.webp": [393, 836], "winning-over-sweden/trust-after.webp": [784, 1692],
  "winning-over-sweden/usability-session.webp": [1233, 690],
  "winning-over-sweden/usability-session.webp": [720, 402],
  "winning-over-sweden/prompt-cards.webp": [1152, 2048],
  "user-research-framework/hero.webp": [1344, 768], "user-research-framework/framework.webp": [1035, 487],
  "user-research-framework/csat-trend.webp": [1600, 1088], "user-research-framework/gold-value.webp": [1600, 687],
  "user-research-framework/csat-ci.webp": [1600, 1075],
  "reimagining-onboarding/hero.webp": [1344, 768], "reimagining-onboarding/interview.mp4": [600, 218],
  "reimagining-onboarding/affinity.webp": [1920, 978], "reimagining-onboarding/affinity-cut.webp": [1719, 564], "reimagining-onboarding/ab-test.webp": [1920, 1159],
  "reimagining-onboarding/iteration-6.webp": [1920, 1165], "reimagining-onboarding/iteration-7.webp": [1920, 937],
  "reimagining-onboarding/reg-step1.webp": [375, 779], "reimagining-onboarding/reg-step2.webp": [375, 1177],
  "reimagining-onboarding/usability-session.webp": [1600, 1198],
};
function imgTag(src, alt) {
  const d = IMG_DIMS[src.split("/").slice(-2).join("/")];
  const wh = d ? ` width="${d[0]}" height="${d[1]}"` : "";
  // looping, muted, autoplaying video reads like a gif but at a fraction of the weight
  if (/\.(mp4|webm)$/i.test(src)) {
    const type = /\.webm$/i.test(src) ? "video/webm" : "video/mp4";
    return `<video${wh} autoplay loop muted playsinline preload="metadata" aria-label="${esc(alt || "")}"><source src="${src}" type="${type}"></video>`;
  }
  return `<img loading="lazy" src="${src}"${wh} alt="${esc(alt || "")}">`;
}
// wrap raw screenshots in a modern, on-brand "device" frame so they read as
// polished product shots rather than bare images
function framed(src, alt) {
  return `<span class="cs-frame">${imgTag(src, alt)}</span>`;
}
// Horizontal, space-saving carousel for dense reference sheets: scroll-snap track
// + prev/next + dots, each slide click-to-zoom. Behaviour wired by initCarousels().
function carouselHTML(items) {
  const chev = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const expand = `<span class="cs-expand" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></span>`;
  const slides = items.map((g) =>
    `<figure class="cs-car__slide" data-zoom-src="${g.src}" tabindex="0" role="button" aria-label="${esc("Expand: " + (g.caption || "image"))}">
        ${framed(g.src, g.caption)}${expand}
        ${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}
      </figure>`).join("");
  return `<div class="cs-car" data-carousel>
    <div class="cs-car__viewport"><div class="cs-car__track" data-carousel-track>${slides}</div></div>
    <div class="cs-car__ctl">
      <button class="cs-car__nav" data-carousel-prev aria-label="Previous">${chev("M15 18l-6-6 6-6")}</button>
      <div class="cs-car__dots" data-carousel-dots></div>
      <button class="cs-car__nav" data-carousel-next aria-label="Next">${chev("M9 18l6-6-6-6")}</button>
    </div>
  </div>`;
}
// Annotated craft figure: a real screen with numbered pins cross-linked to a legend
// of design-decision rationale (hierarchy, state, microcopy, component choice).
// Cross-highlighting wired by initAnnotations().
function annotateHTML(a) {
  const pins = a.notes.map((n, i) =>
    `<button class="cs-annot__pin" style="left:${n.x}%;top:${n.y}%" data-annot-i="${i}" aria-label="${esc(n.tag + ": " + n.text)}">${i + 1}</button>`).join("");
  const legend = a.notes.map((n, i) =>
    `<li class="cs-annot__item" data-annot-i="${i}"><span class="cs-annot__num">${i + 1}</span><div class="cs-annot__txt"><span class="cs-annot__tag">${esc(n.tag)}</span><p>${n.text}</p></div></li>`).join("");
  return `<figure class="cs-annot" data-annot>
    <div class="cs-annot__stage">${framed(a.src, a.alt || "")}${pins}</div>
    <ol class="cs-annot__legend">${legend}</ol>
  </figure>`;
}
// Height-matched figure row: columns flex-grow in proportion to each image's aspect
// ratio, so images of different shapes still render at the SAME height and fill the
// row width, no crop, no letterbox. (height = rowWidth / Σ aspect-ratios.)
function figrowHTML(items) {
  const cells = items.map((g) => {
    const d = IMG_DIMS[g.src.split("/").slice(-2).join("/")];
    const ar = d ? (d[0] / d[1]) : 1;
    return `<figure style="flex-grow:${ar.toFixed(4)}">${framed(g.src, g.caption)}${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`;
  }).join("");
  return `<div class="cs-figrow">${cells}</div>`;
}
// Donut chart for categorical findings: an SVG ring of proportional slices in the
// case accent (largest share = most saturated, via fill-opacity so it blends over
// either theme's background), paired with a labelled legend that carries the exact
// values. Slices are separated by a small angular gap rather than a stroke.
function donutHTML(d) {
  const items = d.items;
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  const cx = 110, cy = 110, R = 100, r = 58, gap = 0.04;
  const op = (i) => (1 - (i / items.length) * 0.72).toFixed(3);
  let a = -Math.PI / 2;
  const paths = items.map((it, i) => {
    const sweep = (it.value / total) * Math.PI * 2;
    const a0 = a + gap / 2, a1 = a + sweep - gap / 2;
    a += sweep;
    const big = (a1 - a0) > Math.PI ? 1 : 0;
    const pt = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
    const dd = `M${pt(R, a0)} A${R} ${R} 0 ${big} 1 ${pt(R, a1)} L${pt(r, a1)} A${r} ${r} 0 ${big} 0 ${pt(r, a0)} Z`;
    return `<path d="${dd}" style="fill:var(--ca);fill-opacity:${op(i)}"></path>`;
  }).join("");
  const legend = items.map((it, i) =>
    `<li class="cs-donut__row"><span class="cs-donut__sw" style="background:var(--ca);opacity:${op(i)}"></span><span class="cs-donut__lbl">${esc(it.label)}</span><b class="cs-donut__val">${(it.value / total * 100).toFixed(1)}%</b></li>`).join("");
  return `<figure class="cs-donut">
    <div class="cs-donut__body">
      <div class="cs-donut__chart"><svg viewBox="0 0 220 220" role="img" aria-label="${esc(d.caption || "Survey results")}">${paths}</svg></div>
      <ol class="cs-donut__legend">${legend}</ol>
    </div>
    ${d.caption ? `<figcaption class="cs-donut__cap">${esc(d.caption)}</figcaption>` : ""}
  </figure>`;
}
// Singleton zoom lightbox shared by every carousel. Built once, reused.
let _zoom;
function ensureZoom() {
  if (_zoom) return _zoom;
  const el = document.createElement("div");
  el.className = "cs-zoom";
  el.setAttribute("hidden", "");
  el.innerHTML = `<button class="cs-zoom__close" aria-label="Close">✕</button><div class="cs-zoom__scroll"><img alt=""></div>`;
  document.body.appendChild(el);
  const img = el.querySelector("img");
  const hide = () => { el.setAttribute("hidden", ""); img.removeAttribute("src"); document.body.classList.remove("zoom-open"); };
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest(".cs-zoom__close")) hide(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hasAttribute("hidden")) hide(); });
  _zoom = { el, img, show: (src) => { img.src = src; el.removeAttribute("hidden"); el.querySelector(".cs-zoom__scroll").scrollTop = 0; document.body.classList.add("zoom-open"); } };
  return _zoom;
}
// Wire each carousel: prev/next, dots, snap-scroll sync, and click/keyboard zoom.
function initCarousels(root) {
  root.querySelectorAll("[data-carousel]").forEach((car) => {
    const track = car.querySelector("[data-carousel-track]");
    const slides = Array.from(track.children);
    const dotsWrap = car.querySelector("[data-carousel-dots]");
    const prev = car.querySelector("[data-carousel-prev]");
    const next = car.querySelector("[data-carousel-next]");
    if (!slides.length) return;
    slides.forEach((_, i) => {
      const d = document.createElement("button");
      d.className = "cs-car__dot";
      d.setAttribute("aria-label", `Go to item ${i + 1}`);
      d.addEventListener("click", () => to(i));
      dotsWrap.appendChild(d);
    });
    const dots = Array.from(dotsWrap.children);
    const base = () => slides[0].offsetLeft;
    const current = () => {
      const x = track.scrollLeft, b = base();
      let best = 0, bd = Infinity;
      slides.forEach((s, i) => { const dd = Math.abs(s.offsetLeft - b - x); if (dd < bd) { bd = dd; best = i; } });
      return best;
    };
    const update = () => {
      const i = current();
      dots.forEach((d, j) => d.classList.toggle("is-active", j === i));
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
    };
    const to = (i) => {
      const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
      track.scrollTo({ left: s.offsetLeft - base(), behavior: "smooth" });
    };
    prev.addEventListener("click", () => to(current() - 1));
    next.addEventListener("click", () => to(current() + 1));
    let raf; track.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    slides.forEach((s) => {
      const src = s.getAttribute("data-zoom-src");
      const open = () => ensureZoom().show(src);
      s.addEventListener("click", open);
      s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    update();
  });
}
// Cross-highlight an annotated figure's pins and legend rows, hover/focus on either
// lights both; tapping a pin (touch) pins it active and scrolls its rationale in.
function initAnnotations(root) {
  root.querySelectorAll("[data-annot]").forEach((fig) => {
    const pins = Array.from(fig.querySelectorAll(".cs-annot__pin"));
    const items = Array.from(fig.querySelectorAll(".cs-annot__item"));
    const set = (i, on) => { pins[i] && pins[i].classList.toggle("is-active", on); items[i] && items[i].classList.toggle("is-active", on); };
    const hoverBind = (els) => els.forEach((el, i) => {
      el.addEventListener("mouseenter", () => set(i, true));
      el.addEventListener("mouseleave", () => set(i, false));
    });
    hoverBind(pins); hoverBind(items);
    pins.forEach((p, i) => {
      p.addEventListener("focus", () => set(i, true));
      p.addEventListener("blur", () => set(i, false));
      p.addEventListener("click", () => { items[i] && items[i].scrollIntoView({ block: "nearest", behavior: "smooth" }); });
    });
  });
}
// Standalone click-to-zoom figures (capped images). Carousel slides handle their own
// zoom, so they're excluded here. Buttons fire on Enter/Space natively.
function initZoomables(root) {
  root.querySelectorAll(".cs-figzoom[data-zoom-src]").forEach((el) => {
    el.addEventListener("click", () => ensureZoom().show(el.getAttribute("data-zoom-src")));
  });
}
function heroStage(c) {
  const s = c.heroStage;
  return `<figure class="cs-scanhero" data-reel aria-label="${esc(c.title + " — product walkthrough")}">
    <div class="reel__shot reel__shot--desk">${imgTag(s.desktop, c.title + " lobby")}</div>
  </figure>`;
}

// Drive the hero: pan the desktop lobby down on a loop, then ease back to the top
// and repeat. No overlays — the title and meta live in the header above. Killed +
// rebuilt on each open; degrades to a static framed shot without motion.
let _reelTL = null;
let _reelCleanup = null;
function initReel(root) {
  if (_reelTL) { _reelTL.kill(); _reelTL = null; }
  if (_reelCleanup) { _reelCleanup(); _reelCleanup = null; }
  const reel = root.querySelector("[data-reel]");
  if (!reel) return;
  const desk = reel.querySelector(".reel__shot--desk img");
  if (!desk) return;
  const g = window.gsap;
  if (reduce || !g) { if (g) g.set(desk, { yPercent: -6 }); return; }
  // one cycle: pan down through the lobby, ease back to the top, then halt
  _reelTL = g.timeline()
    .fromTo(desk, { yPercent: 0 }, { yPercent: -74, duration: 10, ease: "none" })
    .to(desk, { yPercent: 0, duration: 2.6, ease: "power2.inOut" });
}

/* ---------- ANIMATED FRAMEWORK GRAPH (three.js field + SVG + GSAP) ----------
   The framework workflow as a live node-graph: a drifting particle field for
   depth (echoes the hero), an SVG graph on top, and GSAP choreography, connectors
   draw in, nodes stagger up, idle float, hover lights the connected path. Falls
   back to a clean static SVG when WebGL or reduced-motion is in play. */
const FLOW = {
  vb: [1320, 480],
  caption: "The research framework as a live workflow, a user question flows left to right into interview goals and the work that delivers them.",
  full: "images/user-research-framework/framework.webp",
  nodes: [
    { id: "bo", t: "brown", x: 100,  y: 240, w: 152, h: 56, lines: ["Business", "outcome"] },
    { id: "pb", t: "brown", x: 312,  y: 128, w: 150, h: 50, lines: ["Player", "behaviour"] },
    { id: "uo", t: "brown", x: 312,  y: 352, w: 150, h: 50, lines: ["User", "outcomes"] },
    { id: "ui", t: "hub",   x: 548,  y: 240, w: 188, h: 66, lines: ["User", "interview"] },
    { id: "tl", t: "amber", x: 792,  y: 128, w: 168, h: 50, lines: ["Targeted", "learning"] },
    { id: "no", t: "amber", x: 792,  y: 352, w: 168, h: 50, lines: ["New", "opportunities"] },
    { id: "ig", t: "green", x: 1018, y: 128, w: 164, h: 50, lines: ["Interview", "goals"] },
    { id: "rp", t: "green", x: 1018, y: 352, w: 164, h: 50, lines: ["Record the", "problems"] },
    { id: "rc", t: "blue",  x: 1228, y: 62,  w: 150, h: 44, lines: ["Recruit"] },
    { id: "pr", t: "blue",  x: 1228, y: 134, w: 150, h: 44, lines: ["Prepare"] },
    { id: "cn", t: "blue",  x: 1228, y: 206, w: 150, h: 44, lines: ["Conduct"] },
    { id: "sy", t: "blue",  x: 1228, y: 278, w: 150, h: 44, lines: ["Synthesise"] },
  ],
  edges: [["bo","pb"],["bo","uo"],["pb","ui"],["ui","tl"],["ui","no"],
          ["tl","ig"],["no","rp"],["ig","rc"],["ig","pr"],["ig","cn"],["ig","sy"]],
};
function flowHTML() {
  const F = FLOW, byId = {}; F.nodes.forEach((n) => (byId[n.id] = n));
  const edges = F.edges.map(([a, b]) => {
    const s = byId[a], t = byId[b];
    const sx = s.x + s.w / 2, sy = s.y, tx = t.x - t.w / 2, ty = t.y;
    const c = Math.max(40, (tx - sx) * 0.5);
    return `<path class="fl-edge" data-from="${a}" data-to="${b}" fill="none" d="M${sx} ${sy} C${sx + c} ${sy} ${tx - c} ${ty} ${tx} ${ty}"/>`;
  }).join("");
  const nodes = F.nodes.map((n) => {
    const x = n.x - n.w / 2, y = n.y - n.h / 2, multi = n.lines.length > 1;
    const tspans = n.lines.map((l, i) => `<tspan x="${n.x}" dy="${i === 0 ? (multi ? "-0.52em" : "0") : "1.18em"}">${esc(l)}</tspan>`).join("");
    return `<g class="fl-node fl-node--${n.t}" data-id="${n.id}" tabindex="0" role="img" aria-label="${esc(n.lines.join(" "))}">
      <rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="13"/>
      <text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="central">${tspans}</text></g>`;
  }).join("");
  return `<figure class="cs-flow cs-figure--wide" data-flow>
    <canvas class="cs-flow__bg" data-flow-bg aria-hidden="true"></canvas>
    <svg class="cs-flow__svg" viewBox="0 0 ${F.vb[0]} ${F.vb[1]}" role="img" aria-label="The research framework workflow, business outcome through to interview goals and execution">
      <g class="fl-edges">${edges}</g><g class="fl-nodes">${nodes}</g>
    </svg>
    <figcaption>${esc(F.caption)} <button class="cs-flow__full" data-zoom-src="${F.full}">See the original map ↗</button></figcaption>
  </figure>`;
}
// Scroll-scrubbed funnel: each bar fills to its share of the top-of-funnel count
// and the number ticks up, all driven by the case reader's own scroll position,
// so scrolling down literally walks the drop-off. A high-water mark keeps a bar
// filled once reached (it never un-fills on scroll-up), and reduced-motion just
// paints the final state.
let _funnelCleanup = null;
function initFunnel(root) {
  if (_funnelCleanup) { _funnelCleanup(); _funnelCleanup = null; }
  const fig = root.querySelector("[data-funnel]");
  if (!fig) return;
  const scroll = root.closest("[data-case-scroll]") || document.querySelector("[data-case-scroll]");
  if (!scroll) return;
  const rows = [...fig.querySelectorAll(".cs-funnel__row")].map((r) => ({
    el: r, w: parseFloat(r.dataset.w) || 100, count: parseInt(r.dataset.count, 10) || 0, max: 0,
    fill: r.querySelector(".cs-funnel__fill"), num: r.querySelector(".cs-funnel__num"),
  }));
  const paint = (r, p) => {
    if (r.fill) r.fill.style.transform = `scaleX(${(p * r.w / 100).toFixed(4)})`;
    if (r.num) r.num.textContent = Math.round(p * r.count).toLocaleString("en-US");
    r.el.classList.toggle("is-on", p > 0.02);
  };
  if (reduce) { rows.forEach((r) => paint(r, 1)); return; }
  const update = () => {
    const vh = scroll.clientHeight, top = scroll.getBoundingClientRect().top;
    rows.forEach((r) => {
      const y = r.el.getBoundingClientRect().top - top;   // row position within the reader viewport
      let p = (vh * 0.88 - y) / (vh * 0.33);              // 0 as it enters low, 1 by ~mid-screen
      p = Math.max(0, Math.min(1, p));
      if (p > r.max) r.max = p;                            // high-water mark: fill, don't un-fill
      paint(r, r.max);
    });
  };
  update();
  scroll.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  _funnelCleanup = () => { scroll.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
}
let _flow = null;
function disposeFlow() { if (_flow) { try { _flow(); } catch (e) {} _flow = null; } }
function initFlow(root) {
  disposeFlow();
  const fig = root.querySelector("[data-flow]");
  if (!fig) return;
  const cleanups = [];
  const nodes = [...fig.querySelectorAll(".fl-node")];
  const edges = [...fig.querySelectorAll(".fl-edge")];

  // hover / focus → light the connected edges
  nodes.forEach((n) => {
    const lit = edges.filter((e) => e.dataset.from === n.dataset.id || e.dataset.to === n.dataset.id);
    const on = () => lit.forEach((e) => e.classList.add("is-lit"));
    const off = () => lit.forEach((e) => e.classList.remove("is-lit"));
    n.addEventListener("pointerenter", on); n.addEventListener("pointerleave", off);
    n.addEventListener("focus", on); n.addEventListener("blur", off);
    cleanups.push(() => { n.removeEventListener("pointerenter", on); n.removeEventListener("pointerleave", off); n.removeEventListener("focus", on); n.removeEventListener("blur", off); });
  });

  // "see the original map" → reuse the zoom lightbox
  const full = fig.querySelector("[data-zoom-src]");
  if (full) { const op = () => ensureZoom().show(full.getAttribute("data-zoom-src")); full.addEventListener("click", op); cleanups.push(() => full.removeEventListener("click", op)); }

  // three.js particle field behind the graph — three loads on demand here,
  // so the homepage never pays for the 1.2MB module
  if (!reduce) {
    let gone = false;
    cleanups.push(() => { gone = true; });
    (async () => {
    try {
      const THREE = await import("three");
      if (gone) return;
      const canvas = fig.querySelector("[data-flow-bg]");
      const accent = ((getComputedStyle(fig).getPropertyValue("--ca") || "").trim()) || "#7aa2ff";
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const size = () => { const r = fig.getBoundingClientRect(); return [Math.max(1, r.width), Math.max(1, r.height)]; };
      let [W, H] = size(); renderer.setSize(W, H, false);
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000); cam.position.z = 60;
      const N = 90, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i*3] = (Math.random()-.5)*150; pos[i*3+1] = (Math.random()-.5)*82; pos[i*3+2] = (Math.random()-.5)*70; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: new THREE.Color(accent), size: 0.85, transparent: true, opacity: .5, depthWrite: false });
      const points = new THREE.Points(geo, mat); scene.add(points);
      let mx = 0, my = 0;
      const onMove = (e) => { const r = fig.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; };
      fig.addEventListener("pointermove", onMove);
      const t0 = performance.now(); let raf;
      const tick = (now) => { const t = (now - t0) / 1000; points.rotation.y = t * .04 + mx * .35; points.rotation.x = my * .25; renderer.render(scene, cam); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      const ro = new ResizeObserver(() => { const [w, h] = size(); cam.aspect = w / h; cam.updateProjectionMatrix(); renderer.setSize(w, h, false); });
      ro.observe(fig);
      cleanups.push(() => { cancelAnimationFrame(raf); ro.disconnect(); fig.removeEventListener("pointermove", onMove); geo.dispose(); mat.dispose(); renderer.dispose(); });
    } catch (e) { /* no WebGL → static SVG remains */ }
    })();
  }

  // GSAP choreography: draw connectors, pop nodes, then idle float
  if (window.gsap && !reduce) {
    const scroller = root.closest("[data-case-scroll]");
    let played = false;
    const play = () => {
      if (played) return; played = true;
      gsap.timeline()
        .to(edges, { strokeDashoffset: 0, duration: .9, stagger: .04, ease: "power2.out" })
        .to(nodes, { opacity: 1, scale: 1, duration: .5, stagger: .035, ease: "back.out(1.6)" }, "-=.55")
        .add(() => nodes.forEach((n, i) => gsap.to(n, { y: "+=6", duration: 2 + Math.random(), repeat: -1, yoyo: true, ease: "sine.inOut", delay: i * .08 })));
    };
    // reveal on the reader's own scroll (IntersectionObserver misfires in this overlay)
    const check = () => {
      if (played || !scroller) return;
      const sr = scroller.getBoundingClientRect(), fr = fig.getBoundingClientRect();
      if (fr.top < sr.bottom - 80 && fr.bottom > sr.top + 40) play();
    };
    // only hide-then-animate when the tab can actually run rAF; otherwise leave the
    // graph statically visible so it's never stranded at opacity 0 on a hidden tab
    const arm = () => {
      edges.forEach((e) => { const len = e.getTotalLength ? e.getTotalLength() : 400; e.style.strokeDasharray = len; e.style.strokeDashoffset = len; });
      gsap.set(nodes, { opacity: 0, scale: .82, transformOrigin: "50% 50%" });
      if (scroller) scroller.addEventListener("scroll", check, { passive: true });
      requestAnimationFrame(check); setTimeout(check, 500);
      cleanups.push(() => { if (scroller) scroller.removeEventListener("scroll", check); gsap.killTweensOf(nodes); gsap.killTweensOf(edges); });
    };
    if (document.visibilityState === "visible") arm();
    else {
      const onVis = () => { if (document.visibilityState !== "visible") return; document.removeEventListener("visibilitychange", onVis); arm(); };
      document.addEventListener("visibilitychange", onVis);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVis));
    }
  }

  _flow = () => cleanups.forEach((fn) => { try { fn(); } catch (e) {} });
}

function renderCase(slug) {
  const c = CASES[slug];
  if (!c) return "";
  const meta = Object.entries(c.meta).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  const totalCh = String(c.sections.filter((s) => s.chapter).length).padStart(2, "0");
  const body = c.sections.map((s) => {
    let h = "";
    if (s.chapter) {
      const ghost = (s.chapter.no.match(/\d+/) || [""])[0];
      return `<section class="cs-section cs-chapter" data-chapter data-chapter-no="${s.chapter.no}" data-chapter-title="${esc(s.chapter.title)}" data-chapter-hud="${esc(s.chapter.hud || s.chapter.title)}">
        <span class="cs-chapter__ghost" aria-hidden="true">${ghost}</span>
        <div class="cs-stage">
          <span class="cs-chapter__no">${s.chapter.no} / ${totalCh}</span>
          <h2 class="cs-chapter__title">${s.chapter.title}</h2>
          ${s.chapter.blurb ? `<p class="cs-chapter__blurb">${s.chapter.blurb}</p>` : ""}
        </div></section>`;
    }
    let txt = "", media = "";
    if (s.eyebrow) txt += `<p class="cs-eyebrow">${s.eyebrow}</p>`;
    if (s.h) txt += `<h3 class="cs-h">${s.h}</h3>`;
    // problem/solution beat: the work as Challenge -> Move -> Outcome, scannable
    if (s.p) txt += s.p.map((p) => `<p class="cs-p">${p}</p>`).join("");
    if (s.beat) {
      const b = s.beat;
      txt += `<div class="cs-beat">`;
      if (b.challenge) txt += `<div class="cs-beat__block cs-beat__block--challenge"><span class="cs-beat__tag">${esc(b.challengeLabel || "The challenge")}</span><p class="cs-beat__challenge">${b.challenge}</p></div>`;
      if (b.move) txt += `<div class="cs-beat__block cs-beat__block--move"><span class="cs-beat__tag">${esc(b.moveLabel || "What I did")}</span>${(Array.isArray(b.move) ? b.move : [b.move]).map((m) => `<p class="cs-beat__move">${m}</p>`).join("")}</div>`;
      if (b.outcome) txt += `<div class="cs-beat__block cs-beat__block--outcome"><span class="cs-beat__tag">${esc(b.outcomeLabel || "Outcome")}</span><p class="cs-beat__outcome">${b.outcome}</p></div>`;
      if (b.quote) txt += `<blockquote class="cs-beat__quote">“${b.quote}”${b.cite ? `<cite>— ${esc(b.cite)}</cite>` : ""}</blockquote>`;
      txt += `</div>`;
    }
    if (s.list) txt += `<ul class="cs-list">${s.list.map((li) => `<li>${li}</li>`).join("")}</ul>`;
    // labelled synthesis cards, e.g. what we got right / wrong / didn't expect
    if (s.cards) txt += `<div class="cs-cards" style="--cols:${s.cards.length}">${s.cards.map((c) => `<div class="cs-card cs-card--${c.tone || "neutral"}"><span class="cs-card__label">${esc(c.label)}</span><ul>${c.items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`).join("")}</div>`;
    if (s.table) txt += `<div class="cs-table-wrap"><table class="cs-table"><thead><tr>${s.table.head.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    if (s.funnel) {
      const fmax = s.funnel.rows[0].count;
      const frows = s.funnel.rows.map((r) => {
        const w = (r.count / fmax * 100).toFixed(2);
        return `<div class="cs-funnel__row${r.big ? " cs-funnel__row--big" : ""}" data-w="${w}" data-count="${r.count}"><div class="cs-funnel__head"><span class="cs-funnel__label">${esc(r.label)}</span><span class="cs-funnel__num" aria-hidden="true">0</span></div><div class="cs-funnel__track"><span class="cs-funnel__fill"></span></div>${r.drop ? `<span class="cs-funnel__drop">&minus;${esc(r.drop)} dropped</span>` : ""}</div>`;
      }).join("");
      txt += `<figure class="cs-funnel" data-funnel role="img" aria-label="Onboarding funnel: from 79,602 registered (100%) down to 34,462 verified depositors (43%). The biggest single drop is 21,842 users at attempted verification.">${frows}${s.funnel.caption ? `<figcaption class="cs-cap">${esc(s.funnel.caption)}</figcaption>` : ""}</figure>`;
    }
    if (s.metrics) txt += `<div class="cs-metrics">${s.metrics.map((m) => `<div class="cs-metric"><b>${esc(m[0])}</b><span>${esc(m[1])}</span></div>`).join("")}</div>`;
    if (s.result) txt += `<div class="cs-result"><span class="cs-result__n">${esc(s.result.n)}</span><span class="cs-result__label">${esc(s.result.label)}</span>${s.result.note ? `<p class="cs-result__note">${s.result.note}</p>` : ""}</div>`;
    if (s.verdict) txt += `<div class="cs-verdict"><span class="cs-verdict__label">${esc(s.verdict.label)}</span><p class="cs-verdict__text">${s.verdict.text}</p></div>`;
    if (s.quote) txt += `<blockquote class="cs-quote">${s.quote}</blockquote>`;
    if (s.figure) {
      const f = s.figure;
      const cap = f.caption ? `<figcaption>${esc(f.caption)}</figcaption>` : "";
      // bare variant: a frameless (typically transparent-PNG) figure that floats
      // directly on the page background; zoom variant: capped height, click to read full
      media += f.bare
        ? `<figure class="cs-figure cs-figure--bare${f.wide ? " cs-figure--wide" : ""}">${imgTag(f.src, f.caption)}${cap}</figure>`
        : f.zoom
        ? `<figure class="cs-figure cs-figure--capped"><button class="cs-figzoom" data-zoom-src="${f.src}" aria-label="${esc("Expand: " + (f.caption || "image"))}">${framed(f.src, f.caption)}<span class="cs-expand" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></span></button>${cap}</figure>`
        : `<figure class="cs-figure">${framed(f.src, f.caption)}${cap}</figure>`;
    }
    // stacked full-width figures, for images of different aspect ratios that would
    // be squashed side-by-side in a gallery
    if (s.figures) media += s.figures.map((f) => `<figure class="cs-figure">${framed(f.src, f.caption)}${f.caption ? `<figcaption>${esc(f.caption)}</figcaption>` : ""}</figure>`).join("");
    if (s.gallery) media += `<div class="cs-gallery">${s.gallery.map((g) => `<figure>${framed(g.src, g.caption)}${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`).join("")}</div>`;
    if (s.carousel) media += carouselHTML(s.carousel);
    if (s.flow) media += flowHTML();
    if (s.figrow) media += figrowHTML(s.figrow);
    if (s.donut) media += donutHTML(s.donut);
    if (s.annotate) media += annotateHTML(s.annotate);
    if (s.compare) {
      media += `<div class="cs-compare${s.compare.stacked ? " cs-compare--stacked" : ""}"><figure><span class="lbl">Before</span>${framed(s.compare.before.src, "Before")}</figure><figure><span class="lbl lbl--after">After</span>${framed(s.compare.after.src, "After")}</figure></div>`;
      // optional design-decision note explaining the "why" behind the redesign
      if (s.compare.decision) media += `<aside class="cs-decision"><span class="cs-decision__tag">Design decision</span><p>${s.compare.decision}</p></aside>`;
    }
    if (s.cap) media += `<p class="cs-cap">${s.cap}</p>`;
    const split = s.split && media;
    const inner = split
      ? `<div class="cs-split"><div class="cs-col cs-col--text">${txt}</div><div class="cs-col cs-col--media">${media}</div></div>`
      : txt + media;
    return `<section class="cs-section${split ? " cs-section--split" : ""}"><div class="cs-stage">${inner}</div></section>`;
  }).join("");
  // Title + contents sit in the header on top; heroStage cases follow it with the
  // looping desktop-scan hero, other cases with a still hero image.
  const head = `<header class="case__head">
      <div class="cs-stage">
        ${c.heroStage ? "" : `<span class="case__num">Selected Work · ${c.num}</span>`}
        <h2 class="case__title">${c.title}</h2>
        <p class="case__tagline">${c.tagline}</p>
        <div class="case__meta">${meta}</div>
      </div>
    </header>
    ${c.heroStage ? heroStage(c) : c.hero ? `<figure class="cs-figure cs-hero"><div class="cs-stage">${framed(c.hero, c.title)}</div></figure>` : ""}`;
  return `
    ${head}
    ${body}
    <div class="case__foot">
      <div class="cs-stage">
        <button class="case__next" data-case-next data-cursor-hover>Next case →</button>
      </div>
    </div>`;
}

function initCaseStudies() {
  const overlay = document.querySelector("[data-case-overlay]");
  const content = document.querySelector("[data-case-content]");
  const scroll = document.querySelector("[data-case-scroll]");
  const progress = document.querySelector("[data-case-progress]");
  const eyebrow = document.querySelector("[data-case-eyebrow]");
  const chapterLabel = document.querySelector("[data-case-chapter]");
  if (!overlay || !content) return;
  let current = null;
  let lastFocus = null;      // element to return focus to when the dialog closes
  let suppressURL = false;   // true while history itself drives open/close
  const BASE_TITLE = document.title;
  const CASE_PATH = /^\/case-study\/([a-z0-9-]+)\/?$/;
  // Reader-first: the case reads as a normal vertical document and the reader
  // owns the pace. Motion is limited to a one-time reveal as each block enters
  // view, a scroll-progress bar, and a live "which act am I in" chapter label.
  let readCleanup = null;    // detaches the open-slide transition listener, or null
  let railWrap = null;       // the goal-progress rail element, or null

  // Reveal sections as they scroll into view (once each), driven by the reader's
  // own scroll position rather than an IntersectionObserver, so content can never
  // get stranded invisible if the observer misfires.
  function revealVisible() {
    const top = scroll.getBoundingClientRect().top;
    const h = scroll.clientHeight || 800;
    content.querySelectorAll(".cs-section:not(.in)").forEach((s) => {
      if (s.getBoundingClientRect().top < top + h * 0.9) {
        s.classList.add("in");
        if (!reduce) s.querySelectorAll(".cs-metric b, .cs-result__n").forEach(countUp);
      }
    });
  }

  // Count a number up from zero the first time its card reveals. Preserves any
  // prefix/suffix (%, ×, +, →) and decimals, restoring the exact original text
  // at the end so values like "2.4×" or "100%" are never mangled.
  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const original = el.textContent;
    const m = original.match(/(\d[\d,]*\.?\d*)/);
    if (!m) return;
    const numStr = m[1];
    const target = parseFloat(numStr.replace(/,/g, ""));
    if (!isFinite(target) || target === 0) return;
    const dec = (numStr.split(".")[1] || "").length;
    const pre = original.slice(0, m.index), post = original.slice(m.index + numStr.length);
    const dur = 1100, t0 = performance.now();
    requestAnimationFrame(function tick(now) {
      const k = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + (target * e).toFixed(dec) + post;
      if (k < 1) requestAnimationFrame(tick);
      else el.textContent = original;
    });
  }

  function setupReading() {
    if (reduce) { content.querySelectorAll(".cs-section").forEach((s) => s.classList.add("in")); return; }
    // first paint now, then again once the open-slide settles (the slide
    // transforms child rects, so an immediate pass alone misses the first screen)
    requestAnimationFrame(revealVisible);
    const onEnd = (e) => { if (e.propertyName === "transform") revealVisible(); };
    overlay.addEventListener("transitionend", onEnd);
    readCleanup = () => overlay.removeEventListener("transitionend", onEnd);
  }

  // Reveals + reading progress + a live chapter label, all from the reader's
  // scroll. The active act is the last chapter heading to cross the top third.
  function updateReading() {
    revealVisible();
    const max = scroll.scrollHeight - scroll.clientHeight;
    const p = max > 0 ? Math.min(scroll.scrollTop / max, 1) : 0;
    if (progress) progress.style.width = (p * 100).toFixed(2) + "%";
    if (!chapterLabel) return;
    const chaps = content.querySelectorAll("[data-chapter]");
    if (!chaps.length) return;
    const line = scroll.getBoundingClientRect().top + scroll.clientHeight * 0.33;
    let cur = chaps[0];
    chaps.forEach((ch) => { if (ch.getBoundingClientRect().top <= line) cur = ch; });
    const label = `<i></i>${cur.dataset.chapterNo} <b>${cur.dataset.chapterHud}</b>`;
    if (chapterLabel.innerHTML !== label) chapterLabel.innerHTML = label;
    if (railWrap) {
      const idx = [...chaps].indexOf(cur);
      [...railWrap.children].forEach((it, i) => it.classList.toggle("is-active", i === idx));
    }
  }

  // Slim side rail listing the acts, so the reader always knows where they are
  // and can jump. Built from the chapter markers in the rendered content.
  function buildRail() {
    if (railWrap) { railWrap.remove(); railWrap = null; }
    const chaps = [...content.querySelectorAll("[data-chapter]")];
    if (chaps.length < 2) return;
    railWrap = document.createElement("nav");
    railWrap.className = "case__rail";
    railWrap.setAttribute("aria-label", "Case sections");
    chaps.forEach((ch) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "case__rail-item";
      item.setAttribute("data-cursor-hover", "");
      item.innerHTML = `<span class="case__rail-lbl">${esc(ch.dataset.chapterNo)} · ${esc(ch.dataset.chapterHud)}</span><span class="case__rail-dot"></span>`;
      item.addEventListener("click", () => {
        const target = ch.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 8;
        scroll.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
      });
      railWrap.appendChild(item);
    });
    overlay.appendChild(railWrap);
  }

  function teardownReading() {
    if (readCleanup) { readCleanup(); readCleanup = null; }
    if (railWrap) { railWrap.remove(); railWrap = null; }
  }

  function open(slug) {
    current = slug;
    const c = CASES[slug];
    overlay.style.setProperty("--ca", c.accent);
    if (eyebrow) eyebrow.textContent = "Case Study · " + c.num;
    content.setAttribute("data-slug", slug);
    content.innerHTML = renderCase(slug);
    initCarousels(content);
    initAnnotations(content);
    initZoomables(content);
    initReel(content);
    initFlow(content);
    initFunnel(content);
    document.body.classList.add("case-open");
    overlay.setAttribute("aria-hidden", "false");
    // The slide itself is a CSS transition (class toggle), so it never depends on
    // the gsap ticker, the reader always opens, even if animations are throttled.
    overlay.classList.add("is-open");
    scroll.scrollTop = 0;
    if (progress) progress.style.width = "0%";
    if (chapterLabel) chapterLabel.innerHTML = "";
    teardownReading();
    setupReading();
    buildRail();
    updateReading();
    bindNav();
    // deep link: every case is a real URL (rewritten to index by the host)
    if (!suppressURL) {
      const path = "/case-study/" + slug;
      if (location.pathname !== path) history.pushState({ case: slug }, "", path);
    }
    document.title = c.title + " — Shanky";
    // a11y: focus moves into the dialog; Tab is trapped while it's open
    lastFocus = lastFocus || document.activeElement;
    closeBtn?.focus({ preventScroll: true });
  }

  function close() {
    overlay.classList.remove("is-open");
    overlay.classList.remove("is-flip");
    overlay.style.clipPath = "";
    overlay.style.opacity = "";
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("case-open");
    teardownReading();
    setTimeout(reset, 800);
    if (!suppressURL && CASE_PATH.test(location.pathname)) history.pushState({}, "", "/");
    document.title = BASE_TITLE;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
  function reset() {
    if (overlay.classList.contains("is-open")) return; // re-opened during the delay
    disposeFlow();
    if (_funnelCleanup) { _funnelCleanup(); _funnelCleanup = null; }
    if (_reelTL) { _reelTL.kill(); _reelTL = null; }
    if (_reelCleanup) { _reelCleanup(); _reelCleanup = null; }
    content.innerHTML = "";
    current = null;
  }

  // Shared-element open: the clicked project title flies up and grows into the
  // case-study header, so opening reads as one continuous space rather than a
  // panel sliding over. We suppress the CSS slide and crossfade the overlay
  // instead, flying a fixed clone of the title from the card to the header, then
  // handing off to the real title. Falls back to a plain open when there's no
  // source title (cross-links), reduced-motion is on, or GSAP is unavailable.
  function flipOpen(sourceEl, slug) {
    const titleEl = sourceEl && sourceEl.querySelector && sourceEl.querySelector(".project__title");
    if (reduce || !window.gsap || !titleEl) { open(slug); return; }
    const first = titleEl.getBoundingClientRect();
    const ss = getComputedStyle(titleEl);
    overlay.classList.add("is-flip");
    overlay.style.opacity = "0";
    open(slug);
    const target = content.querySelector(".case__title");
    if (!target) { overlay.classList.remove("is-flip"); overlay.style.opacity = ""; return; }
    // Clone keeps the card title's own width and wrapping, so the motion begins
    // seamlessly from exactly what was on screen (no first-frame jump).
    const clone = titleEl.cloneNode(true);
    Object.assign(clone.style, {
      position: "fixed", left: "0", top: "0", margin: "0", zIndex: "600", pointerEvents: "none",
      width: first.width + "px", transformOrigin: "0 0",
      fontFamily: ss.fontFamily, fontWeight: ss.fontWeight, fontStyle: ss.fontStyle,
      fontSize: ss.fontSize, lineHeight: ss.lineHeight, letterSpacing: ss.letterSpacing, color: ss.color,
    });
    document.body.appendChild(clone);
    gsap.set(clone, { x: first.left, y: first.top, scale: 1 });
    titleEl.style.visibility = "hidden";
    target.style.visibility = "hidden";

    // Header content rises in just behind the settling title, so the page builds
    // around it rather than the whole panel appearing at once.
    const header = content.querySelector(".case__head");
    const followers = [
      content.querySelector(".case__num"),
      content.querySelector(".case__tagline"),
      content.querySelector(".case__meta"),
      header && header.nextElementSibling,
    ].filter(Boolean);

    requestAnimationFrame(() => {
      const last = target.getBoundingClientRect();
      const ts = getComputedStyle(target);
      const scale = parseFloat(ts.fontSize) / parseFloat(ss.fontSize) || 1;

      gsap.to(overlay, { opacity: 1, duration: 0.5, ease: "power2.out",
        onComplete: () => { overlay.style.opacity = ""; overlay.classList.remove("is-flip"); } });
      gsap.set(followers, { opacity: 0, y: 18 });

      const tl = gsap.timeline();
      // the title glides up and eases to a stop (power3 = smooth glide-to-settle)
      tl.to(clone, { x: last.left, y: last.top, scale: scale, color: ts.color, duration: 0.62, ease: "power3.out" }, 0);
      // soft handoff as it lands: real title fades in, clone fades out, which also
      // hides any difference in how the two titles wrap
      tl.add(() => { target.style.visibility = ""; }, 0.44);
      tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.34, ease: "power1.out" }, 0.44);
      tl.to(clone, { opacity: 0, duration: 0.28, ease: "power1.out",
        onComplete: () => { titleEl.style.visibility = ""; clone.remove(); } }, 0.46);
      // the rest of the header rises in with a gentle, tight stagger
      tl.to(followers, { opacity: 1, y: 0, duration: 0.55, stagger: 0.05, ease: "power3.out" }, 0.5);
    });
  }

  // Alternative open: the overlay unmasks from the clicked row — a clip-path band
  // sitting where the row is expands to fill the screen — while the header
  // staggers up. No title morph, so it's robust to any wrapping. Reduced-motion
  // or no-GSAP falls back to a plain open.
  function unmaskOpen(sourceEl, slug) {
    if (reduce || !window.gsap) { open(slug); return; }
    const rowEl = (sourceEl && sourceEl.closest && sourceEl.closest(".project")) || sourceEl;
    const r = rowEl.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const topPct = Math.max(0, Math.min(100, r.top / vh * 100));
    const botPct = Math.max(0, Math.min(100, (vh - r.bottom) / vh * 100));
    overlay.classList.add("is-flip");
    overlay.style.opacity = "1";
    overlay.style.clipPath = `inset(${topPct.toFixed(2)}% 0% ${botPct.toFixed(2)}% 0%)`;
    open(slug);
    const header = content.querySelector(".case__head");
    const followers = [
      content.querySelector(".case__num"),
      content.querySelector(".case__title"),
      content.querySelector(".case__tagline"),
      content.querySelector(".case__meta"),
      header && header.nextElementSibling,
    ].filter(Boolean);
    gsap.set(followers, { opacity: 0, y: 24 });
    requestAnimationFrame(() => {
      const tl = gsap.timeline({ onComplete: () => {
        overlay.style.clipPath = ""; overlay.style.opacity = ""; overlay.classList.remove("is-flip");
      } });
      tl.to(overlay, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.72, ease: "power3.inOut" }, 0);
      tl.to(followers, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: "power3.out" }, 0.3);
    });
  }

  function bindNav() {
    const next = content.querySelector("[data-case-next]");
    if (next) next.addEventListener("click", () => {
      const i = ORDER.indexOf(current);
      open(ORDER[(i + 1) % ORDER.length]);
    });
  }

  // open from project links
  document.querySelectorAll("[data-case]").forEach((a) => {
    a.addEventListener("click", (e) => { e.preventDefault(); lastFocus = a; unmaskOpen(a, a.dataset.case); });
  });
  // open from cross-references inside case content (links injected after boot)
  content.addEventListener("click", (e) => {
    const a = e.target.closest("[data-case]");
    if (a) { e.preventDefault(); open(a.dataset.case); }
  });
  const closeBtn = document.querySelector("[data-case-close]");
  closeBtn?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current) { close(); return; }
    // keep Tab inside the dialog while it's open
    if (e.key === "Tab" && current) {
      const els = [...overlay.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });
  // back/forward moves between the homepage and open case studies
  window.addEventListener("popstate", () => {
    const m = location.pathname.match(CASE_PATH);
    suppressURL = true;
    if (m && CASES[m[1]]) { if (current !== m[1]) open(m[1]); }
    else if (current) close();
    suppressURL = false;
  });
  // landing directly on /case-study/<slug> opens that case
  const deepLink = location.pathname.match(CASE_PATH);
  if (deepLink && CASES[deepLink[1]]) {
    history.replaceState({ case: deepLink[1] }, "", location.pathname);
    suppressURL = true;
    open(deepLink[1]);
    suppressURL = false;
  }
  // reading progress + chapter label follow the reader's own scroll
  scroll?.addEventListener("scroll", () => { if (current) updateReading(); }, { passive: true });
}

// Kick things off. Run at the very end so every const/function above is
// initialised before boot() executes (module scripts may run after DOMContentLoaded).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
