/* SYNCDECK - site interactions (intentionally tiny) */
(function () {
  /* footer year */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- rotating hero word ----------
     Tweakable, matching the Claude Design: pick the animation style and whether
     a meaning-matched symbol trails the word. Sidre avoids emoji, so the
     defaults are the calm slide with no symbol. */
  var HERO_ANIM = 'slide'; // 'slide' | 'blur' | 'typewriter'
  var HERO_SYMBOL = false; // show a per-word symbol (🤫 sessizce, 🚀 uçarak, …)
  var WORDS = ['sessizce', 'güvenle', 'hayvanca', 'hızlıca', 'uçarak', 'vahşice', 'mutlu mutlu'];
  var SYMBOLS = ['🤫', '🛡️', '🦁', '⚡', '🚀', '🐯', '😄'];

  var el = document.getElementById('hero-word');
  var inner = el && el.querySelector('.sd-heroword__inner');
  if (!el || !inner) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anim = reduce ? 'reduce' : HERO_ANIM;
  el.setAttribute('data-anim', anim === 'reduce' ? 'slide' : anim);

  var wi = 0;
  function sym(i) {
    return HERO_SYMBOL ? '<span class="sd-heroword__sym">' + SYMBOLS[i] + '</span>' : '';
  }
  function esc(s) {
    return s.replace(/[&<>]/g, function (c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'; });
  }
  function setWord(i) {
    inner.innerHTML = esc(WORDS[i]) + sym(i);
    el.setAttribute('aria-label', WORDS[i]);
  }

  if (anim === 'reduce') {
    setWord(0);
    setInterval(function () { wi = (wi + 1) % WORDS.length; setWord(wi); }, 2400);
    return;
  }

  if (anim === 'typewriter') {
    var ti = 0;
    var dir = 1;
    var render = function (text, done) {
      inner.innerHTML = esc(text) + '<span class="sd-heroword__caret"></span>' + (done ? sym(wi) : '');
    };
    var tick = function () {
      var word = WORDS[wi];
      if (dir === 1) {
        ti++;
        render(word.slice(0, ti), ti >= word.length);
        if (ti >= word.length) { dir = -1; setTimeout(tick, 1300); }
        else setTimeout(tick, 78);
      } else {
        ti--;
        render(word.slice(0, Math.max(0, ti)), false);
        if (ti <= 0) { dir = 1; wi = (wi + 1) % WORDS.length; el.setAttribute('aria-label', WORDS[wi]); setTimeout(tick, 120); }
        else setTimeout(tick, 44);
      }
    };
    render('', false);
    setTimeout(tick, 400);
    return;
  }

  /* slide / blur: hold, fade-out, swap, fade-in */
  setWord(0);
  var HOLD = 2100;
  var OUT = 430;
  var step = function () {
    inner.classList.add('is-out');
    setTimeout(function () {
      wi = (wi + 1) % WORDS.length;
      setWord(wi);
      inner.classList.remove('is-out');
      setTimeout(step, HOLD);
    }, OUT);
  };
  setTimeout(step, HOLD);
})();
