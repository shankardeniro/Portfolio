const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink,
  AlignmentType, LevelFormat, BorderStyle, TabStopType, TabStopPosition,
} = require("docx");

// ---- palette ----
const INK = "1A202C";      // near-black for name + body
const HEAD = "1A2B4A";     // deep navy for section headings
const MUTED = "4A5568";    // slate for title / secondary
const RULE = "CBD5E0";     // light gray rule

const FONT = "Calibri";
const LINE = 324; // ~1.35x line spacing to match the PDF's airy rhythm

// ---- helpers ----
const bottomRule = (color, size) => ({
  bottom: { style: BorderStyle.SINGLE, size: size || 6, color, space: 3 },
});

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    border: bottomRule(RULE, 6),
    children: [new TextRun({ text, bold: true, size: 22, color: HEAD, characterSpacing: 30, font: FONT })],
  });
}

// bullet from an array of {text, bold} segments
function bullet(segs) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 130, line: LINE, lineRule: "auto" },
    children: segs.map((s) => new TextRun({ text: s.text, bold: !!s.bold, size: 21, color: INK, font: FONT })),
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 80, line: LINE, lineRule: "auto" },
    children: [new TextRun({ text, size: opts.size ?? 21, color: opts.color ?? INK, italics: !!opts.italics, font: FONT })],
  });
}

// role header: company (bold) ... location on right ; then title | dates
function roleHeader(company, location, title, dates) {
  return [
    new Paragraph({
      spacing: { before: 160, after: 0 },
      tabStops: [{ type: TabStopType.RIGHT, position: 9602 }],
      children: [
        new TextRun({ text: company, bold: true, size: 22, color: INK, font: FONT }),
        new TextRun({ text: `\t${location}`, size: 20, color: MUTED, font: FONT }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 100 },
      tabStops: [{ type: TabStopType.RIGHT, position: 9602 }],
      children: [
        new TextRun({ text: title, size: 21, color: MUTED, italics: true, font: FONT }),
        new TextRun({ text: `\t${dates}`, size: 20, color: MUTED, font: FONT }),
      ],
    }),
  ];
}

// competency line: "Label: items"
function competency(label, items) {
  return new Paragraph({
    spacing: { after: 120, line: LINE, lineRule: "auto" },
    children: [
      new TextRun({ text: `${label}  `, bold: true, size: 21, color: INK, font: FONT }),
      new TextRun({ text: items, size: 21, color: INK, font: FONT }),
    ],
  });
}

const link = (text, url) =>
  new ExternalHyperlink({ children: [new TextRun({ text, style: "Hyperlink", size: 19, font: FONT })], link: url });

const doc = new Document({
  creator: "Sankaranarayanan Subramanian",
  title: "Sankaranarayanan Subramanian — Resume",
  styles: { default: { document: { run: { font: FONT, size: 21, color: INK } } } },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 300, hanging: 180 } } } },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1152, right: 1152, bottom: 1152, left: 1152 }, // 0.8"
        },
      },
      children: [
        // ---------- HEADER ----------
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: "SANKARANARAYANAN SUBRAMANIAN", bold: true, size: 36, color: INK, characterSpacing: 20, font: FONT })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: "Product Designer & UX Researcher", size: 26, color: MUTED, font: FONT })],
        }),
        new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({ text: "Stockholm, Sweden  |  ", size: 19, color: MUTED, font: FONT }),
            link("mail2contactshankar@gmail.com", "mailto:mail2contactshankar@gmail.com"),
            new TextRun({ text: "  |  +46 76 404 1366", size: 19, color: MUTED, font: FONT }),
          ],
        }),
        new Paragraph({
          spacing: { after: 40 },
          children: [
            link("designshanky.com", "https://designshanky.com"),
            new TextRun({ text: "  |  ", size: 19, color: MUTED, font: FONT }),
            link("linkedin.com/in/sankaranarayanan-subramanian", "https://www.linkedin.com/in/sankaranarayanan-subramanian-553379212/"),
          ],
        }),
        new Paragraph({
          spacing: { after: 60 },
          border: bottomRule(RULE, 6),
          children: [new TextRun({ text: "Permanent resident — authorized to work in Sweden, no visa sponsorship required.", size: 19, italics: true, color: MUTED, font: FONT })],
        }),

        // ---------- SUMMARY ----------
        sectionHeading("SUMMARY"),
        new Paragraph({
          spacing: { after: 60, line: LINE, lineRule: "auto" },
          children: [
            new TextRun({ text: "Product designer and UX researcher with 5+ years turning ambiguous, high-stakes problems into measurable product outcomes — and the rare profile that ", size: 21, color: INK, font: FONT }),
            new TextRun({ text: "frames the problem with research and ships the design, with no hand-off in between", bold: true, size: 21, color: INK, font: FONT }),
            new TextRun({ text: ". I founded a user-research practice from 0→1, led the go-to-market design for a regulated Swedish launch (zero compliance violations), and lifted end-to-end onboarding conversion 11 points. AI-native in my workflow (Figma Make, Cursor, Claude, Lovable), I compress the path from insight to shipped, evidence-based interface.", size: 21, color: INK, font: FONT }),
          ],
        }),

        // ---------- COMPETENCIES ----------
        sectionHeading("CORE COMPETENCIES"),
        competency("User Research", "Mixed-methods research · User interviews · Moderated & unmoderated usability testing · Surveys · A/B testing & experimentation · Quantitative analysis (95% CI) · Affinity mapping · Competitive audits · Continuous discovery · ResearchOps & repositories"),
        competency("Product Design", "End-to-end UX · User journeys · Information architecture · Wireframing · High-fidelity prototyping · Interaction design · Accessibility (WCAG)"),
        competency("Design Systems", "Design tokens & semantic token architecture · Component libraries · Theming / dark mode · Multi-market consistency"),
        competency("Data & Strategy", "Funnel & conversion-rate optimization (CRO) · Product analytics · North-star metrics · Product-market fit · Go-to-market · 0→1 product"),
        competency("AI-Augmented Workflow", "Figma Make · Cursor · Claude · Lovable · Rapid prototyping"),
        competency("Tools", "Figma · Adobe XD · Miro · PostHog · Hotjar · Notion · R / R Studio"),

        // ---------- EXPERIENCE ----------
        sectionHeading("EXPERIENCE"),
        ...roleHeader("Epiceros", "Stockholm, Sweden", "Product Designer & UX Researcher", "Aug 2022 – Present"),
        bullet([
          { text: "Led go-to-market design for the company’s regulated Swedish casino launch as the sole designer alongside a PM and 8 engineers, translating every Spelinspektionen (regulator) requirement into a UX requirements map so compliance was designed in, not bolted on. Launched with " },
          { text: "zero compliance violations in the first six months", bold: true },
          { text: " and a " },
          { text: "58% uplift in claimed bonuses", bold: true },
          { text: "." },
        ]),
        bullet([
          { text: "Lifted " },
          { text: "end-to-end onboarding conversion 11 points (43% → 54%)", bold: true },
          { text: " on a regulated, KYC-heavy flow: ran funnel analysis across ~80,000 users plus mixed-methods research (survey, interviews, moderated usability testing), built the business case to bring registration in-house, and switched the KYC vendor to eliminate the #1 drop-off cause, cutting onboarding cost in the process." },
        ]),
        bullet([
          { text: "Founded the company’s " },
          { text: "user-research practice from 0→1", bold: true },
          { text: ", standing it up in 3 months and sustaining it 2+ years: launched a recurring CSAT program (8 waves over ~3 years, reported with 95% confidence intervals) and a shared framework and repository that aligned product, design, engineering, data, CRM and marketing. Research now opens strategy sessions and steers the roadmap." },
        ]),
        bullet([
          { text: "Built and maintained a " },
          { text: "token-based design system", bold: true },
          { text: " (semantic tokens → component library) that kept 20+ flows consistent across markets and made retheming and dark mode trivial, letting the team ship high-fidelity under a licensing deadline." },
        ]),
        bullet([
          { text: "Ran moderated think-aloud studies with Swedish players and " },
          { text: "triaged 19 usability findings", bold: true },
          { text: " on a shared severity rubric, shipping the highest-leverage fixes (bonus claim, live-casino navigation, payment-trust signals)." },
        ]),
        bullet([
          { text: "Championed an " },
          { text: "AI-augmented design workflow", bold: true },
          { text: " (Figma Make, Cursor, Claude, Lovable), compressing the path from research insight to shipped interface and accelerating the team’s design cycle." },
        ]),

        ...roleHeader("Early-Stage Startup (Food-tech)", "Stockholm, Sweden", "UX Researcher & Designer · Part-time", "2020 – Aug 2022"),
        bullet([
          { text: "Planned and led generative research, user interviews, competitor audits and usability studies, for an early-stage food-tech product, then turned insights into information architecture, wireframes and prototypes (Figma, Adobe XD)." },
        ]),
        bullet([
          { text: "Synthesized findings into MVP feature priorities that shaped the team’s product-market-fit bets." },
        ]),

        ...roleHeader("IIT Madras", "Chennai, India", "Senior Research Fellow", "2012 – 2016"),
        bullet([
          { text: "Designed and ran quantitative and qualitative experiments for micro/nano biosensing devices; published and presented findings. The statistical and experimental rigour built here now powers my approach to product experimentation and quantitative UX." },
        ]),

        // ---------- EDUCATION ----------
        sectionHeading("EDUCATION"),
        bullet([{ text: "Google UX Design Professional Certificate — Coursera, 2021" }]),
        bullet([{ text: "M.Tech, Chemical Engineering — Anna University, 2011" }]),
        bullet([{ text: "B.Tech, Chemical Engineering — Anna University" }]),

        // ---------- CERTIFICATIONS ----------
        sectionHeading("CERTIFICATIONS"),
        body("Google UX Design Specialization · Data-Driven Design: Quantitative Research for UX · High-Fidelity Designs & Prototypes in Figma · Foundations of User Experience (UX) Design", { after: 0 }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/Users/shankarnarayanan/Downloads/Sankaranarayanan_Subramanian_Resume_2026.docx";
  fs.writeFileSync(out, buf);
  console.log("Wrote " + out);
});
