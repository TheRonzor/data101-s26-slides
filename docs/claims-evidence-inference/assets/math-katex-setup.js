// assets/math-katex-setup.js
// Local-first KaTeX loader with CDN fallback.
// "local/online" logging reflects what actually loaded and is being used.
// Expected local paths (relative to repo root):
//   vendor/katex/katex.min.css
//   vendor/katex/katex.min.js
//   vendor/katex/contrib/auto-render.min.js
// Also ensure vendor/katex/fonts/ exists (referenced by katex.min.css).
(function () {
  const KATEX_VERSION = "0.16.11";
  const CDN_BASE = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;

  function repoBaseFromCurrentScript() {
    const cs = document.currentScript && document.currentScript.src;
    if (!cs) return ""; // best-effort
    // Strip everything after the repo root (where /assets/ lives)
    return cs.replace(/\/assets\/math-katex-setup\.js(?:\?.*)?$/, "/");
  }

  const BASE = repoBaseFromCurrentScript();

  const LOCAL = {
    css: `${BASE}vendor/katex/katex.min.css`,
    js: `${BASE}vendor/katex/katex.min.js`,
    autorender: `${BASE}vendor/katex/contrib/auto-render.min.js`,
  };

  const CDN = {
    css: `${CDN_BASE}/katex.min.css`,
    js: `${CDN_BASE}/katex.min.js`,
    autorender: `${CDN_BASE}/contrib/auto-render.min.js`,
  };

  function hasLink(href) {
    return !!document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
  }
  function hasScript(src) {
    return !!document.querySelector(`script[src="${src}"]`);
  }

  function loadCSS(href) {
    return new Promise((resolve, reject) => {
      if (!href) return resolve();
      if (hasLink(href)) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`CSS failed: ${href}`));
      document.head.appendChild(link);
    });
  }

  function loadScript(src) {
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

  async function tryLoadKatexFrom(source) {
    // Load CSS + JS + auto-render from the specified source.
    // Only declare success if the expected globals exist.
    await loadCSS(source.css);
    await loadScript(source.js);
    await loadScript(source.autorender);

    const ok = !!(window.katex && window.renderMathInElement);
    if (!ok) {
      throw new Error("KaTeX globals not available after load.");
    }
    return true;
  }

  async function ensureKatexLoaded() {
    // If already present (e.g., user included KaTeX manually), don't reload.
    if (window.katex && window.renderMathInElement) {
      console.log(`[math] KaTeX v${KATEX_VERSION} source=preloaded`);
      return { ok: true, source: "preloaded" };
    }

    // 1) Local vendor first
    try {
      await tryLoadKatexFrom(LOCAL);
      console.log(
        `[math] KaTeX v${KATEX_VERSION} source=local ` +
          `(css=${LOCAL.css}, js=${LOCAL.js})`
      );
      return { ok: true, source: "local" };
    } catch (e) {
      // Only a warning; we will try CDN next.
      console.warn("[math] KaTeX local load failed; falling back to CDN.", e);
    }

    // 2) CDN fallback
    try {
      await tryLoadKatexFrom(CDN);
      console.log(
        `[math] KaTeX v${KATEX_VERSION} source=cdn ` +
          `(css=${CDN.css}, js=${CDN.js})`
      );
      return { ok: true, source: "cdn" };
    } catch (e) {
      console.warn("[math] KaTeX CDN load failed.", e);
      return { ok: false, source: "none" };
    }
  }

  async function renderKatex(rootEl) {
    const res = await ensureKatexLoaded();
    if (!res.ok) {
      console.warn(
        "KaTeX failed to load (local and CDN). Math will not render."
      );
      return;
    }

    window.renderMathInElement(rootEl, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }

  window.SlideMath = window.SlideMath || {};
  window.SlideMath.renderKatex = renderKatex;

  document.addEventListener("DOMContentLoaded", () => {
    // render entire document (works for print.html and single slides)
    renderKatex(document.body); // KaTeX
  });
})();
