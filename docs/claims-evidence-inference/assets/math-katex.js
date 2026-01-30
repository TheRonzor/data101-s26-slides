// assets/math-katex.js
// KaTeX adapter. Loads KaTeX from CDN and renders $...$ and $$...$$ within the document.
// If you prefer vendored assets, replace CDN URLs with local paths.

const KATEX_VERSION = "0.16.11";
const CSS_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
const JS_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`;
const AUTORENDER_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js`;

function loadStyle(href) {
  return new Promise((resolve) => {
    if ([...document.styleSheets].some(s => s.href === href)) return resolve();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    document.head.append(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === src)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.append(script);
  });
}

export async function renderMath(root = document.body) {
  await loadStyle(CSS_URL);
  await loadScript(JS_URL);
  await loadScript(AUTORENDER_URL);

  if (typeof window.renderMathInElement !== "function") return;

  window.renderMathInElement(root, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false
  });
}
