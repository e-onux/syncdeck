/* @ds-bundle: {"format":3,"namespace":"SidreLabsDesignSystem_4865c9","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"LangToggle","sourcePath":"components/core/LangToggle.jsx"},{"name":"MonoLabel","sourcePath":"components/core/MonoLabel.jsx"},{"name":"ServiceRow","sourcePath":"components/core/ServiceRow.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"}],"sourceHashes":{"components/core/Button.jsx":"82a3b112e9cf","components/core/Card.jsx":"d250ea8f120c","components/core/LangToggle.jsx":"a7283c519163","components/core/MonoLabel.jsx":"00fdb5d21685","components/core/ServiceRow.jsx":"4410ffba916a","components/core/Tag.jsx":"5277199bcef1","components/forms/Input.jsx":"54a82ef6e034","ui_kits/website/Contact.jsx":"74d651d237d2","ui_kits/website/Hero.jsx":"425f04794937","ui_kits/website/HeroArt.jsx":"b7907cf75279","ui_kits/website/Services.jsx":"c39e2001e6df","ui_kits/website/SiteFooter.jsx":"198bcf5fa2c5","ui_kits/website/SiteHeader.jsx":"418cbd84be76","ui_kits/website/Wordmark.jsx":"fa87299b7a1c","ui_kits/website/app.jsx":"394e202660da","ui_kits/website/content.js":"504d90c1dd9d"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SidreLabsDesignSystem_4865c9 = window.SidreLabsDesignSystem_4865c9 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sidre Labs primary action. Mono uppercase label, machined 2px corners,
 * mint focus glow. Renders an <a> when `href` is set, otherwise a <button>.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  arrow = false,
  disabled = false,
  onClick,
  type = "button",
  className = "",
  ...rest
}) {
  const cls = ["sl-btn", `sl-btn--${size}`, variant === "ghost" ? "sl-btn--ghost" : "", variant === "quiet" ? "sl-btn--quiet" : "", className].filter(Boolean).join(" ");
  const content = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, children), arrow && /*#__PURE__*/React.createElement("span", {
    className: "sl-btn__arr",
    "aria-hidden": "true"
  }, "\u2192"));
  if (href && !disabled) {
    return /*#__PURE__*/React.createElement("a", _extends({
      className: cls,
      href: href,
      onClick: onClick
    }, rest), content);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    type: type,
    disabled: disabled,
    "aria-disabled": disabled || undefined,
    onClick: onClick
  }, rest), content);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sidre Labs surface card. Hairline border, machined 2px corners, optional
 * hover lift (border brightens, surface raises).
 */
function Card({
  children,
  hover = false,
  flush = false,
  className = "",
  ...rest
}) {
  const cls = ["sl-card", hover ? "sl-card--hover" : "", flush ? "sl-card--flush" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/LangToggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sidre Labs DE/EN language toggle - the brand's bilingual pill switch.
 * Controlled: pass `value` and `onChange`.
 */
function LangToggle({
  value = "de",
  onChange,
  options = ["de", "en"],
  className = "",
  ...rest
}) {
  const cls = ["sl-langtoggle", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    role: "group",
    "aria-label": "Sprache / Language"
  }, rest), options.map(opt => /*#__PURE__*/React.createElement("button", {
    key: opt,
    type: "button",
    className: opt === value ? "is-active" : "",
    "aria-pressed": opt === value,
    onClick: () => onChange && onChange(opt)
  }, opt.toUpperCase())));
}
Object.assign(__ds_scope, { LangToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/LangToggle.jsx", error: String((e && e.message) || e) }); }

// components/core/MonoLabel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sidre Labs mono label / kicker - wide-tracked uppercase JetBrains Mono.
 * Optional leading number (mint) and/or accent tick rule.
 */
function MonoLabel({
  children,
  num,
  tick = false,
  className = "",
  ...rest
}) {
  const cls = ["sl-mono", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), tick && /*#__PURE__*/React.createElement("span", {
    className: "sl-mono__tick",
    "aria-hidden": "true"
  }), num != null && /*#__PURE__*/React.createElement("span", {
    className: "sl-mono__num"
  }, num), /*#__PURE__*/React.createElement("span", null, children));
}
Object.assign(__ds_scope, { MonoLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/MonoLabel.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sidre Labs mono tag chip. Bordered by default; `accent` mint outline or
 * `solid` mint fill for emphasis.
 */
function Tag({
  children,
  variant = "default",
  className = "",
  ...rest
}) {
  const cls = ["sl-tag", variant === "accent" ? "sl-tag--accent" : "", variant === "solid" ? "sl-tag--solid" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/core/ServiceRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sidre Labs numbered service row - the signature list item with a big
 * oblique index, display title, optional mint kicker, and a hover rule that
 * wipes across the top edge.
 */
function ServiceRow({
  index,
  title,
  kicker,
  children,
  tag,
  className = "",
  ...rest
}) {
  const cls = ["sl-svc", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("article", _extends({
    className: cls
  }, rest), index != null && /*#__PURE__*/React.createElement("div", {
    className: "sl-svc__idx"
  }, index), /*#__PURE__*/React.createElement("div", {
    className: "sl-svc__body"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "sl-svc__title"
  }, title), kicker && /*#__PURE__*/React.createElement("p", {
    className: "sl-svc__kicker"
  }, kicker), children && /*#__PURE__*/React.createElement("p", null, children)), tag && /*#__PURE__*/React.createElement("div", {
    className: "sl-svc__tag"
  }, /*#__PURE__*/React.createElement(__ds_scope.Tag, null, tag)));
}
Object.assign(__ds_scope, { ServiceRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ServiceRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sidre Labs text field. Mono uppercase label over a dark input with a
 * hairline border and mint focus glow. Set `multiline` for a textarea.
 */
function Input({
  label,
  id,
  multiline = false,
  invalid = false,
  className = "",
  ...rest
}) {
  const inputCls = ["sl-input", className].filter(Boolean).join(" ");
  const field = multiline ? /*#__PURE__*/React.createElement("textarea", _extends({
    id: id,
    className: inputCls,
    "aria-invalid": invalid || undefined
  }, rest)) : /*#__PURE__*/React.createElement("input", _extends({
    id: id,
    className: inputCls,
    "aria-invalid": invalid || undefined
  }, rest));
  if (!label) return field;
  return /*#__PURE__*/React.createElement("div", {
    className: "sl-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "sl-field__label",
    htmlFor: id
  }, label), field);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Contact.jsx
try { (() => {
/* SIDRE LABS - contact section with a working (fake) project form */
function Contact({
  t
}) {
  const [sent, setSent] = React.useState(false);
  function submit(e) {
    e.preventDefault();
    setSent(true);
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "sect contact",
    id: "kontakt"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "contact-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "reveal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      marginBottom: "1.6rem"
    }
  }, /*#__PURE__*/React.createElement(MonoLabel, {
    num: "02"
  }, t.contact.label)), /*#__PURE__*/React.createElement("h2", {
    className: "display"
  }, t.contact.titleLead, /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, t.contact.titleSub)), /*#__PURE__*/React.createElement("a", {
    className: "mail",
    href: "mailto:info@sidrelabs.com"
  }, "info@sidrelabs.com ", /*#__PURE__*/React.createElement("span", {
    className: "arr"
  }, "\u2197"))), /*#__PURE__*/React.createElement("div", {
    className: "reveal"
  }, sent ? /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(MonoLabel, {
    num: "\u2713"
  }, t.contact.sentLabel), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: ".8rem 0 0",
      color: "var(--ink-dim)"
    }
  }, t.contact.sentBody)) : /*#__PURE__*/React.createElement("form", {
    className: "contact-form",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(Input, {
    label: t.contact.fEmail,
    type: "email",
    placeholder: "info@sidrelabs.com",
    required: true
  }), /*#__PURE__*/React.createElement(Input, {
    label: t.contact.fMsg,
    multiline: true,
    placeholder: t.contact.fMsgPlaceholder,
    required: true
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    type: "submit",
    arrow: true,
    style: {
      justifySelf: "start"
    }
  }, t.contact.send))))));
}
window.Contact = Contact;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Contact.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Hero.jsx
try { (() => {
/* SIDRE LABS - hero */
function Hero({
  lang,
  t
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "hero",
    id: "top"
  }, /*#__PURE__*/React.createElement(HeroArt, null), /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kicker"
  }, /*#__PURE__*/React.createElement(MonoLabel, {
    tick: true
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent)"
    }
  }, lang.toUpperCase()), "\xA0\xA0\xB7\xA0\xA0KI / E-Commerce / SEO")), /*#__PURE__*/React.createElement("h1", {
    className: "display"
  }, t.hero.lead, /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, t.hero.sub)), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, t.hero.lede), /*#__PURE__*/React.createElement("div", {
    className: "cta"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    arrow: true,
    href: "#kontakt"
  }, t.hero.ctaPrimary), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    href: "#leistungen"
  }, t.hero.ctaSecondary)), /*#__PURE__*/React.createElement("div", {
    className: "hero-meta"
  }, /*#__PURE__*/React.createElement("span", null, "Sidre Labs \xB7 Kreuzau, DE"), /*#__PURE__*/React.createElement("span", null, "50.75\xB0\xA0N\xA0\xA0/\xA0\xA06.49\xB0\xA0E")))));
}
window.Hero = Hero;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/HeroArt.jsx
try { (() => {
/* SIDRE LABS - hero "signal-stack" chevron art (echoes the logo mark) */
function HeroArt({
  shift = 0
}) {
  const W = 480,
    H = 600,
    cx = W * 0.52,
    rows = 22;
  const paths = [];
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const y = 24 + t * (H - 48);
    const halfW = 22 + t * 215,
      dip = 30;
    const lead = i % 5 === 2;
    const op = 0.22 + Math.sin(t * Math.PI) * 0.62;
    paths.push(React.createElement("path", {
      key: i,
      d: `M ${cx - halfW} ${y} L ${cx} ${y + dip} L ${cx + halfW} ${y}`,
      stroke: lead ? "var(--accent)" : "var(--brand)",
      strokeWidth: lead ? 2 : 1.4,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      opacity: lead ? Math.min(0.95, op + 0.2).toFixed(2) : op.toFixed(2)
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "hero-art",
    "aria-hidden": "true",
    style: {
      transform: `translateY(calc(-50% - ${shift}px))`
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    fill: "none"
  }, paths));
}
window.HeroArt = HeroArt;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/HeroArt.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Services.jsx
try { (() => {
/* SIDRE LABS - services section */
function Services({
  t
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "sect",
    id: "leistungen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sect-head reveal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, /*#__PURE__*/React.createElement(MonoLabel, {
    num: "01"
  }, t.services.label)), /*#__PURE__*/React.createElement("h2", {
    className: "display"
  }, t.services.titleLead, /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, t.services.titleSub))), /*#__PURE__*/React.createElement("div", {
    className: "sl-svc-list"
  }, t.services.items.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "reveal",
    key: i
  }, /*#__PURE__*/React.createElement(ServiceRow, {
    index: s.idx,
    title: s.title,
    kicker: s.kicker,
    tag: s.tag
  }, s.body))))));
}
window.Services = Services;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Services.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/SiteFooter.jsx
try { (() => {
/* SIDRE LABS - footer / Impressum */
function SiteFooter({
  t
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "site-ftr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ftr-top"
  }, /*#__PURE__*/React.createElement(Wordmark, {
    style: {
      height: "22px",
      color: "var(--ink-faint)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "imp"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cap"
  }, "Impressum \xB7 Angaben gem\xE4\xDF \xA7 5 TMG"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Sidre Labs \xB7 Emir Onuk")), /*#__PURE__*/React.createElement("p", null, "Erlenweg 5, 52372 Kreuzau, Deutschland"), /*#__PURE__*/React.createElement("p", null, "USt-IdNr.: DE458523078"), /*#__PURE__*/React.createElement("p", null, "Steuernummer: 207/5175/4226"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("a", {
    href: "mailto:info@sidrelabs.com"
  }, "info@sidrelabs.com")))), /*#__PURE__*/React.createElement("div", {
    className: "ftr-base"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 ", new Date().getFullYear(), " Sidre Labs"), /*#__PURE__*/React.createElement("span", null, "KI \xA0\xB7\xA0 E-Commerce \xA0\xB7\xA0 SEO"))));
}
window.SiteFooter = SiteFooter;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/SiteFooter.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/SiteHeader.jsx
try { (() => {
/* SIDRE LABS - site header */
function SiteHeader({
  lang,
  setLang,
  t
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "site-hdr"
  }, /*#__PURE__*/React.createElement("a", {
    className: "brand",
    href: "#top",
    "aria-label": "Sidre Labs"
  }, /*#__PURE__*/React.createElement(Wordmark, null)), /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, /*#__PURE__*/React.createElement("a", {
    className: "navlink hide-sm",
    href: "#leistungen"
  }, t.nav.services), /*#__PURE__*/React.createElement("a", {
    className: "navlink hide-sm",
    href: "#kontakt"
  }, t.nav.contact), /*#__PURE__*/React.createElement(LangToggle, {
    value: lang,
    onChange: setLang
  })));
}
window.SiteHeader = SiteHeader;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/SiteHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Wordmark.jsx
try { (() => {
/* SIDRE LABS - wordmark. Inlines the SVG so fill:currentColor tints to ink/accent. */
let _sidreWordmarkCache = null;
function Wordmark({
  className = "",
  style
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    let alive = true;
    function paint(svg) {
      if (alive && ref.current) ref.current.innerHTML = svg;
    }
    if (_sidreWordmarkCache) {
      paint(_sidreWordmarkCache);
      return;
    }
    fetch("../../assets/logos/sidre-wordmark.svg").then(r => r.text()).then(svg => {
      _sidreWordmarkCache = svg;
      paint(svg);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    className: "sl-wordmark " + className,
    style: style,
    role: "img",
    "aria-label": "Sidre Labs"
  });
}
window.Wordmark = Wordmark;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Wordmark.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/app.jsx
try { (() => {
/* SIDRE LABS - website app shell.
   Language is the only React state. Scroll effects (header chrome + hero
   parallax) are applied directly to the DOM so the tree never re-renders on
   scroll - otherwise the one-shot reveal animations restart every frame. */
function SidreSite() {
  const [lang, setLang] = React.useState(() => {
    try {
      return localStorage.getItem("sidre_lang") || "de";
    } catch (e) {
      return "de";
    }
  });
  const t = window.SIDRE_CONTENT[lang];
  React.useEffect(() => {
    try {
      localStorage.setItem("sidre_lang", lang);
    } catch (e) {}
  }, [lang]);
  React.useEffect(() => {
    const hdr = document.querySelector(".site-hdr");
    const art = document.querySelector(".hero-art");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ticking = false;
    function apply() {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (hdr) hdr.classList.toggle("is-scrolled", y > 24);
      if (art && !reduce) {
        const shift = Math.min(y * 0.18, 260);
        art.style.transform = `translateY(calc(-50% - ${shift}px))`;
      }
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    }
    window.addEventListener("scroll", onScroll, {
      passive: true
    });
    apply();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SiteHeader, {
    lang: lang,
    setLang: setLang,
    t: t
  }), /*#__PURE__*/React.createElement(Hero, {
    lang: lang,
    t: t
  }), /*#__PURE__*/React.createElement(Services, {
    t: t
  }), /*#__PURE__*/React.createElement(Contact, {
    t: t
  }), /*#__PURE__*/React.createElement(SiteFooter, {
    t: t
  }));
}
window.SidreSite = SidreSite;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/content.js
try { (() => {
/* SIDRE LABS - bilingual copy (DE lead / EN). The kit's source of truth for text. */
window.SIDRE_CONTENT = {
  de: {
    nav: {
      services: "Leistungen",
      contact: "Kontakt"
    },
    hero: {
      lead: "Präzise Software für die intelligente Wirtschaft.",
      sub: "Precision software for the intelligent economy.",
      lede: "Wir bauen KI-Modelle, E-Commerce-Systeme und SEO-Software, entwickelt mit der Präzision eines Instruments.",
      ctaPrimary: "Projekt anfragen",
      ctaSecondary: "Leistungen ansehen"
    },
    services: {
      label: "Leistungen · Services",
      titleLead: "Drei Disziplinen. Ein Standard.",
      titleSub: "Three disciplines. One standard.",
      items: [{
        idx: "01",
        title: "KI-Modellentwicklung",
        kicker: "AI Model Development",
        tag: "01 / AI",
        body: "Individuell trainierte Modelle für reale geschäftliche Aufgaben, vom Fine-Tuning bis zum produktiven Deployment."
      }, {
        idx: "02",
        title: "E-Commerce-Software",
        kicker: "E-Commerce Software",
        tag: "02 / Commerce",
        body: "Performance-orientierte Tools und Integrationen für den modernen Online-Handel."
      }, {
        idx: "03",
        title: "SEO-Software",
        kicker: "SEO Software",
        tag: "03 / SEO",
        body: "Datengetriebene Automatisierung, die Suchsichtbarkeit in messbares Wachstum verwandelt."
      }]
    },
    contact: {
      label: "Kontakt · Contact",
      titleLead: "Sprechen wir über Ihr Projekt.",
      titleSub: "Let's talk about your project.",
      fEmail: "E-Mail",
      fMsg: "Nachricht",
      fMsgPlaceholder: "Worum geht es in Ihrem Projekt?",
      send: "Anfrage senden",
      sentLabel: "Gesendet",
      sentBody: "Danke. Wir melden uns innerhalb eines Werktags."
    }
  },
  en: {
    nav: {
      services: "Services",
      contact: "Contact"
    },
    hero: {
      lead: "Precision software for the intelligent economy.",
      sub: "Präzise Software für die intelligente Wirtschaft.",
      lede: "We build AI models, e-commerce systems and SEO software, engineered with the precision of an instrument.",
      ctaPrimary: "Start a project",
      ctaSecondary: "View services"
    },
    services: {
      label: "Services · Leistungen",
      titleLead: "Three disciplines. One standard.",
      titleSub: "Drei Disziplinen. Ein Standard.",
      items: [{
        idx: "01",
        title: "AI Model Development",
        kicker: "KI-Modellentwicklung",
        tag: "01 / AI",
        body: "Custom-trained models for real business problems, from fine-tuning to production deployment."
      }, {
        idx: "02",
        title: "E-Commerce Software",
        kicker: "E-Commerce-Software",
        tag: "02 / Commerce",
        body: "Performance-first tools and integrations built for modern online retail."
      }, {
        idx: "03",
        title: "SEO Software",
        kicker: "SEO-Software",
        tag: "03 / SEO",
        body: "Data-driven automation that turns search visibility into measurable growth."
      }]
    },
    contact: {
      label: "Contact · Kontakt",
      titleLead: "Let's talk about your project.",
      titleSub: "Sprechen wir über Ihr Projekt.",
      fEmail: "Email",
      fMsg: "Message",
      fMsgPlaceholder: "What is your project about?",
      send: "Send enquiry",
      sentLabel: "Sent",
      sentBody: "Thanks. We'll get back to you within one business day."
    }
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/content.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.LangToggle = __ds_scope.LangToggle;

__ds_ns.MonoLabel = __ds_scope.MonoLabel;

__ds_ns.ServiceRow = __ds_scope.ServiceRow;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Input = __ds_scope.Input;

})();
