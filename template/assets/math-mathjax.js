// assets/math-mathjax.js
// MathJax adapter (v3). Loads MathJax from CDN and renders TeX within the document.
// If you prefer vendored assets, replace CDN URLs with local paths.

const MJ_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === src)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.append(script);
  });
}

export async function renderMath(_root = document.body) {
  // Configure BEFORE loading MathJax
  window.MathJax = window.MathJax || {
    tex: {
      inlineMath: [["$", "$"]],
      displayMath: [["$$", "$$"]]
    },
    options: {
      skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    }
  };

  await loadScript(MJ_URL);

  if (window.MathJax?.typesetPromise) {
    await window.MathJax.typesetPromise();
  }
}
