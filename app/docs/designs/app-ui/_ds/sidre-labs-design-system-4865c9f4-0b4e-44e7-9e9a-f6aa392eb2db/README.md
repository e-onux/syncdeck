# Sidre Labs — Design System

> Präzise Software für die intelligente Wirtschaft.
> *Precision software for the intelligent economy.*

Sidre Labs is a German software *Manufaktur* (one-person studio, **Emir Onuk**)
based in Kreuzau, North Rhine-Westphalia. It builds in three disciplines:
**AI model development**, **e-commerce software**, and **SEO software** —
positioned as instruments: precise, engineered, restrained. The public face is a
single bilingual landing page (German lead, English sub-copy) on a deep
teal-black canvas with oblique geometric headlines and mono technical labels.

This design system encodes that voice as reusable tokens, components, foundation
specimens, and a faithful recreation of the website.

## Sources
Everything here was reverse-engineered from the studio's own repository. If you
have access, read these to go deeper:

- **GitHub — `e-onux/sidrelabs.com`** (private): https://github.com/e-onux/sidrelabs.com
  - `website/src/` — `index.html`, `styles.css`, `main.js`, `logo.svg` (the live site source; the canonical reference for every token and layout here)
  - `design/logo/` — `Logo.svg` / `Logo.png` (stacked mark), `Logopl.svg`, plus the wordmark

No Figma file was provided; the system is derived from the production CSS/HTML,
which is the highest-fidelity source available.

---

## Content Fundamentals

**Bilingual, German-led.** Every headline carries a German lead line with an
English sub-line beneath it in smaller, quieter type; chrome (nav, buttons,
labels) swaps wholesale via a DE/EN toggle. German is primary — copy is written
for a German B2B audience first.

**Voice: the instrument.** Copy is terse, declarative, and confident — short
nominal sentences, no hype, no exclamation. It leans on the metaphor of
precision engineering. Representative lines:
- *"Drei Disziplinen. Ein Standard."* / "Three disciplines. One standard."
- *"…entwickelt mit der Präzision eines Instruments."* / "…engineered with the precision of an instrument."
- *"Sprechen wir über Ihr Projekt."* / "Let's talk about your project."

**Person & address.** Speaks as **we** (the studio), addresses the reader
formally as **Sie / Ihr** in German ("Ihr Projekt"). Never casual, never first-person-singular in marketing copy. The legal footer drops to plain facts (Impressum, USt-IdNr.).

**Casing.** Display headlines and all mono labels are **UPPERCASE**. Body copy is
sentence case. Numbers are zero-padded indices (`01`, `02`, `03`) and act as a
structural motif, not decoration.

**Punctuation.** Em dashes were deliberately removed from visible copy in favour
of commas and the middot (`·`) for a calmer read. The middot separates label
fragments: `KI · E-Commerce · SEO`, `Kontakt · Contact`.

**No emoji.** None anywhere — it would break the instrument tone. Iconography is
geometric and drawn from the brand's own chevron motif (see Iconography).

**Vibe.** Engineered, quiet, German-precise, slightly technical (geo-coordinates
of the studio appear as hero metadata: `50.75° N / 6.49° E`). Think lab bench,
not startup.

---

## Visual Foundations

**Canvas.** Deep **teal-tinted near-black** (`--bg`, oklch 0.17, hue ~172). Depth
is built from three slightly lighter teal surfaces (`--bg-2`, `--surface`,
`--surface-2`) — never from drop shadows. The entire hue family sits at ~168–172
(teal-green), giving the dark a cool, structural feel rather than a neutral grey.

**Color.** A tight palette: structural brand teal `#1c4742` (lines, the chevron
art), a single mint accent `#5fd6b6` (CTAs, focus, active states, numeric
indices), and an off-white ink ramp in three steps (`--ink` / `--ink-dim` /
`--ink-faint`). Accent ink on mint fills is a near-black green `#062b22`.
Imagery, were any used, would be cool and teal-biased to match — but the brand is
almost entirely typographic; there is no photography in the source.

**Type.** Two families only:
- **Archivo** — display + body. Headlines are heavy (800), **italic/oblique**,
  **expanded** (font-stretch ~118%), UPPERCASE, with tight tracking (−0.018em)
  and near-1.0 leading. This oblique-expanded treatment is the single strongest
  brand signal. (An `upright` mode exists: `[data-slant="upright"]` flips
  headlines to roman with tighter tracking.)
- **JetBrains Mono** — labels, kickers, nav, tags, metadata. Always UPPERCASE,
  wide tracking (0.18–0.26em), small (~0.7rem), in `--ink-faint` with mint
  numerals.

**Backgrounds & texture.** A faint **code-grid dot field** (`radial-gradient`
dots at 34px pitch, `--dot`) is fixed over the whole page and masked to fade out
toward the bottom. The hero carries a generative **signal-stack** — rows of
chevrons that widen down the canvas, echoing the logo mark. No gradients (beyond
the dot-field mask), no photographic texture, no noise/grain.

**Borders & hairlines.** Structure is drawn with **1px hairlines**: `--line-soft`
(neutral, ~9% ink) for most dividers, `--line` (mint, ~16%) for accented edges.
Section heads, service rows, and the footer are all separated by these rules.

**Corners.** Machined and near-sharp: **2px** (`--r-sharp`) on buttons, tags,
cards, inputs. The *only* pill-rounded element is the DE/EN language toggle
(`--r-pill`). Avoid soft, friendly radii — they are off-brand.

**Cards.** Flat surface fill + 1px hairline border + 2px corners. **No drop
shadow.** On hover the border brightens to mint and the fill steps one level
lighter. A `flush` variant is transparent (border only).

**Shadows / elevation.** There is effectively no shadow system on the dark
canvas. The one "shadow" is a **mint focus/hover glow ring**
(`box-shadow: 0 0 0 4px mint@18%`) used on the primary button and a tighter
`0 0 0 3px mint@45%` for `:focus-visible`. A `--shadow-panel` token exists for
the rare elevated panel but is seldom used.

**Hover states.** Consistent and quiet: links reveal a mint underline that wipes
in left→right; nav text lightens to full ink; service rows wipe a mint hairline
across their top edge and their index recolors to mint; ghost buttons swap their
border + text to mint; the primary button gains the glow ring and its arrow
slides 5px right.

**Press / active.** Active language/segment fills solid mint with dark-green ink.
There is no shrink-on-press; emphasis is by **color**, not scale.

**Motion.** Calm and snappy. The signature easing is
`cubic-bezier(.2,.7,.2,1)` (`--ease-out`) — a quick decelerate. Entrances are
**fade + 22px rise** over ~0.8s via IntersectionObserver (`.reveal`). Hover
transitions are 0.2–0.35s. The hero art drifts on scroll (parallax). No bounces,
no springs, no looping/infinite decorative animation. All of it respects
`prefers-reduced-motion`.

**Transparency & blur.** Used sparingly and only where it earns it: the header,
once scrolled, becomes a translucent canvas wash (`color-mix` 78%) with
`backdrop-filter: blur(14px) saturate(1.2)` and a hairline bottom border.

**Layout.** Centered column, `max-width 1320px`, fluid page gutters
(`clamp(1.4rem, 6vw, 7rem)`) and generous section rhythm
(`clamp(5rem, 11vh, 9rem)`). The header is sticky; the dot-field is fixed.
Content blocks cap their measure (30–62ch) for readability.

---

## Iconography

Sidre Labs is **near-iconless by design** — the system is typographic and
geometric, and that restraint is intentional.

- **No icon font, no icon library** ships in the source. Don't introduce Lucide /
  Heroicons / Font Awesome unless a new surface genuinely needs them; if you must,
  pick a **thin, geometric, single-stroke** set to match (and flag the addition).
- **The chevron is the de-facto icon.** The logo's stacked-chevron motif (inside
  the "A" of LABS) is reused as the hero's generative **signal-stack** art. When
  you need a graphic accent, reach for this chevron language rather than a
  conventional icon.
- **Unicode arrows as glyphs.** The only "icons" in the live UI are typographic
  arrows: `→` (button CTAs, slides right on hover), `↗` (the email link). Use
  these rather than SVG arrow icons.
- **Zero-padded numerals** (`01`, `02`, `03`) function as iconography — they label
  services, sections, and tags in mint.
- **No emoji. Ever.**
- **Logos** live in `assets/logos/`:
  - `sidre-wordmark.svg` — horizontal "SIDRE LABS" lockup, authored with
    `fill: currentColor` so it tints to any ink (used in header + footer; the kit
    tints it via CSS `mask`).
  - `sidre-mark-stacked.svg` / `.png` — the full stacked mark with the chevron
    detail (for tiles, avatars, social).
  - `sidre-mark-plain.svg` — simplified variant.

---

## Index / Manifest

**Root**
- `styles.css` — global entry point (imports only). Consumers link this.
- `components.css` — class styles for the React primitives (shipped via `styles.css`).
- `README.md` — this guide. · `SKILL.md` — Agent-Skill manifest.

**`tokens/`** — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`
(all `@import`ed by `styles.css`).

**`assets/logos/`** — wordmark + stacked marks (SVG/PNG).

**`components/`** — React primitives (`Name.jsx` + `.d.ts` + `.prompt.md`, with a
`@dsCard` showcase per directory):
- `core/` — **Button**, **MonoLabel**, **Tag**, **Card**, **LangToggle**, **ServiceRow**
- `forms/` — **Input** (text + textarea)

All exported on `window.SidreLabsDesignSystem_4865c9` after `_ds_bundle.js` loads.

**`ui_kits/website/`** — full interactive recreation of the Sidre Labs homepage
(`index.html` + screen JSX + `content.js` + `site.css`). See its README.

**`guidelines/`** — foundation specimen cards (Colors, Type, Spacing, Brand) that
populate the Design System tab.

---

### Substitutions & caveats
- **Fonts** load from Google Fonts (Archivo + JetBrains Mono) via `tokens/fonts.css`
  — same as the production site's dev mode. To self-host, drop the `.woff2`
  files in `assets/fonts/` and replace the `@import` with `@font-face` rules.
  These are the brand's real families (no substitution).
- No photography or illustration exists in the source, so none is included here;
  the brand is intentionally typographic.
