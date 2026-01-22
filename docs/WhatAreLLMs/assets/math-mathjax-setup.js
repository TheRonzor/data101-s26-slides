// assets/math-mathjax-setup.js
// Local-first MathJax loader with CDN fallback.
// Logs the *actual* source and version in use.
// Expected local path (relative to repo root):
//   vendor/mathjax/es5/tex-chtml.js
(function () {
  const MJ_MAJOR = "3";
  const CDN_URL = `https://cdn.jsdelivr.net/npm/mathjax@${MJ_MAJOR}/es5/tex-chtml.js`;

  function repoBaseFromCurrentScript() {
    const cs = document.currentScript && document.currentScript.src;
    if (!cs) return "";
    return cs.replace(/\/assets\/math-mathjax-setup\.js(?:\?.*)?$/, "/");
  }

  const BASE = repoBaseFromCurrentScript();
  const LOCAL_URL = `${BASE}vendor/mathjax/es5/tex-chtml.js`;

  function hasScript(src) {
    return [...document.scripts].some((s) => s.src === src);
  }

  function loadScriptOrThrow(src) {
    return new Promise((resolve, reject) => {
      if (!src) return resolve();
      if (hasScript(src)) return resolve();

      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Script failed: ${src}`));
      document.head.appendChild(s);
    });
  }

  function getMathJaxVersionString() {
    // MathJax v3 exposes version on startup (and often on MathJax.version too),
    // but we guard for undefined.
    const v =
      (window.MathJax &&
        window.MathJax.startup &&
        window.MathJax.startup.version) ||
      (window.MathJax && window.MathJax.version) ||
      null;
    return v ? String(v) : `major=${MJ_MAJOR}`;
  }

  async function ensureMathJaxLoaded() {
    // Configure BEFORE loading MathJax
    window.MathJax = window.MathJax || {};
    window.MathJax.tex = window.MathJax.tex || {};
    window.MathJax.tex.inlineMath = window.MathJax.tex.inlineMath || [
      ["$", "$"],
      ["\\(", "\\)"],
    ];
    window.MathJax.tex.displayMath = window.MathJax.tex.displayMath || [
      ["$$", "$$"],
      ["\\[", "\\]"],
    ];
    window.MathJax.options = window.MathJax.options || {};
    window.MathJax.options.skipHtmlTags = window.MathJax.options
      .skipHtmlTags || [
      "script",
      "noscript",
      "style",
      "textarea",
      "pre",
      "code",
    ];

    // If already present (e.g., user included MathJax manually), don't reload.
    if (window.MathJax && window.MathJax.typesetPromise) {
      console.log(
        `[math] MathJax ${getMathJaxVersionString()} source=preloaded`
      );
      return { ok: true, source: "preloaded" };
    }

    // 1) Try local vendor first
    try {
      await loadScriptOrThrow(LOCAL_URL);
      if (!(window.MathJax && window.MathJax.typesetPromise)) {
        throw new Error("MathJax globals not available after local load.");
      }
      console.log(
        `[math] MathJax ${getMathJaxVersionString()} source=local (url=${LOCAL_URL})`
      );
      return { ok: true, source: "local" };
    } catch (e) {
      console.warn("[math] MathJax local load failed; falling back to CDN.", e);
    }

    // 2) CDN fallback
    try {
      await loadScriptOrThrow(CDN_URL);
      if (!(window.MathJax && window.MathJax.typesetPromise)) {
        throw new Error("MathJax globals not available after CDN load.");
      }
      console.log(
        `[math] MathJax ${getMathJaxVersionString()} source=cdn (url=${CDN_URL})`
      );
      return { ok: true, source: "cdn" };
    } catch (e) {
      console.warn("[math] MathJax CDN load failed.", e);
      console.warn(
        "MathJax failed to load (local and CDN). Math will not render."
      );
      return { ok: false, source: "none" };
    }
  }

  async function typeset(rootEl) {
    const res = await ensureMathJaxLoaded();
    if (!res.ok) return;

    if (rootEl) await window.MathJax.typesetPromise([rootEl]);
    else await window.MathJax.typesetPromise();
  }

  window.SlideMath = window.SlideMath || {};
  window.SlideMath.typesetMathJax = typeset;

  document.addEventListener("DOMContentLoaded", () => {
    typeset(document.body); // MathJax
  });
})();
