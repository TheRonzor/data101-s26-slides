// slides/math-demo.js
// Engine-agnostic interactive math demo:
// - updates plain-text $...$ strings
// - asks the active engine adapter to re-typeset the relevant container

function renderMath(rootEl) {
  // Prefer the SlideMath adapter injected by our loaders.
  if (window.SlideMath?.renderKatex)
    return window.SlideMath.renderKatex(rootEl);
  if (window.SlideMath?.typesetMathJax)
    return window.SlideMath.typesetMathJax(rootEl);

  // Fallbacks (in case someone loaded engines manually)
  if (window.MathJax?.typesetPromise)
    return window.MathJax.typesetPromise([rootEl]);
  return Promise.resolve();
}

function update() {
  const slider = document.querySelector("#x");
  const x = Number(slider?.value ?? 0);
  const fx = x * x;

  // Update the math *as text* (no tags inside delimiters).
  const xMathEl = document.querySelector("#x_math");
  const fxMathEl = document.querySelector("#fx_math");

  if (xMathEl) xMathEl.textContent = `$x = ${x}$`;
  if (fxMathEl) fxMathEl.textContent = `$f(x) = ${fx}$`;

  // Re-render math only within the slide body (fast + avoids touching nav).
  const root = document.querySelector(".slide-body") || document.body;
  renderMath(root);
}

document.addEventListener("DOMContentLoaded", () => {
  const slider = document.querySelector("#x");
  if (slider) {
    slider.addEventListener("input", update);
    update();
  }
});
