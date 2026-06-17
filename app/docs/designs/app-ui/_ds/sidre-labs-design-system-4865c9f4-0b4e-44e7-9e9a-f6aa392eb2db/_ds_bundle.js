/* @ds-bundle: {"format":3,"namespace":"SidreLabsDesignSystem_4865c9","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"LangToggle","sourcePath":"components/core/LangToggle.jsx"},{"name":"MonoLabel","sourcePath":"components/core/MonoLabel.jsx"},{"name":"ServiceRow","sourcePath":"components/core/ServiceRow.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"}],"sourceHashes":{"components/core/Button.jsx":"82a3b112e9cf","components/core/Card.jsx":"d250ea8f120c","components/core/LangToggle.jsx":"a7283c519163","components/core/MonoLabel.jsx":"00fdb5d21685","components/core/ServiceRow.jsx":"4410ffba916a","components/core/Tag.jsx":"5277199bcef1","components/forms/Input.jsx":"54a82ef6e034"},"inlinedExternals":[],"unexposedExports":[]} */

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
 * Sidre Labs DE/EN language toggle — the brand's bilingual pill switch.
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
 * Sidre Labs mono label / kicker — wide-tracked uppercase JetBrains Mono.
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
 * Sidre Labs numbered service row — the signature list item with a big
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

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.LangToggle = __ds_scope.LangToggle;

__ds_ns.MonoLabel = __ds_scope.MonoLabel;

__ds_ns.ServiceRow = __ds_scope.ServiceRow;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Input = __ds_scope.Input;

})();
