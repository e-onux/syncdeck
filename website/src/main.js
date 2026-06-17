/* SYNCDECK - site interactions (intentionally tiny) */
(function () {
  /* footer year */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
