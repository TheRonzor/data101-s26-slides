// slides/math-demo-full.js
// Engine-agnostic math + SVG graphs demo.
// - Updates math strings as text ($...$ / $$...$$) and re-typesets using SlideMath adapter.
// - Renders one static plot and one slider-driven plot (SVG).

function renderMath(rootEl) {
  // Preferred: our adapter methods
  if (window.SlideMath?.renderKatex)
    return window.SlideMath.renderKatex(rootEl);
  if (window.SlideMath?.typesetMathJax)
    return window.SlideMath.typesetMathJax(rootEl);

  // Fallback (if someone loaded MathJax directly)
  if (window.MathJax?.typesetPromise)
    return window.MathJax.typesetPromise([rootEl]);

  return Promise.resolve();
}

// ---- SVG plot helpers ----
function makeParabolaPath({ a, xMin, xMax, n, xToSvg, yToSvg }) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = xMin + (i / (n - 1)) * (xMax - xMin);
    const y = a * x * x;
    const X = xToSvg(x);
    const Y = yToSvg(y);
    d += (i === 0 ? "M" : "L") + X.toFixed(2) + " " + Y.toFixed(2) + " ";
  }
  return d.trim();
}

function setupPlotTransform(svgEl, { xMin, xMax, yMin, yMax }) {
  // Match axes drawn in SVG: left=40, right=500, top=20, bottom=240
  const left = 40,
    right = 500,
    top = 20,
    bottom = 240;
  const w = right - left;
  const h = bottom - top;

  const xToSvg = (x) => left + ((x - xMin) / (xMax - xMin)) * w;
  const yToSvg = (y) => bottom - ((y - yMin) / (yMax - yMin)) * h;

  return { xToSvg, yToSvg, left, right, top, bottom };
}

// ---- Demo logic ----
function updateAll() {
  const slider = document.querySelector("#a");
  const a = Number(slider?.value ?? 1);
  const aLabel = document.querySelector("#a_readout");
  if (aLabel) aLabel.textContent = a.toFixed(1);

  // Update dynamic math as TEXT (no HTML inside delimiters)
  const dynInline = document.querySelector("#dyn_inline");
  const dynDisplay = document.querySelector("#dyn_display");

  if (dynInline) dynInline.textContent = `$a = ${a.toFixed(1)}$`;
  if (dynDisplay)
    dynDisplay.textContent = `$$y = a x^2,\\quad a=${a.toFixed(1)}$$`;

  // Update dynamic plot: y = a x^2
  const dynSvg = document.querySelector("#plot_dynamic");
  const dynPath = document.querySelector("#dyn_curve");
  const marker = document.querySelector("#dyn_marker");
  const markerLabel = document.querySelector("#dyn_marker_label");

  if (dynSvg && dynPath) {
    // Keep y-range fixed to avoid rescaling “jumpiness”
    const xMin = -3,
      xMax = 3;
    const yMin = 0,
      yMax = 36; // since max a=4 => y=4*3^2=36

    const T = setupPlotTransform(dynSvg, { xMin, xMax, yMin, yMax });
    dynPath.setAttribute(
      "d",
      makeParabolaPath({
        a,
        xMin,
        xMax,
        n: 121,
        xToSvg: T.xToSvg,
        yToSvg: T.yToSvg,
      })
    );

    // marker at x=2
    const xm = 2;
    const ym = a * xm * xm;
    if (marker) {
      marker.setAttribute("cx", String(T.xToSvg(xm)));
      marker.setAttribute("cy", String(T.yToSvg(ym)));
    }
    if (markerLabel) {
      markerLabel.setAttribute("x", String(T.xToSvg(xm) + 8));
      markerLabel.setAttribute("y", String(T.yToSvg(ym) - 8));
      markerLabel.textContent = `(${xm.toFixed(0)}, ${ym.toFixed(1)})`;
    }
  }

  // Re-typeset within slide body
  const root = document.querySelector(".slide-body") || document.body;
  renderMath(root);
}

function initStaticPlot() {
  const svg = document.querySelector("#plot_static");
  const path = document.querySelector("#static_curve");
  const pointsG = document.querySelector("#static_points");
  if (!svg || !path || !pointsG) return;

  const xMin = -3,
    xMax = 3;
  const yMin = 0,
    yMax = 9; // y=x^2 up to 9 at x=3
  const T = setupPlotTransform(svg, { xMin, xMax, yMin, yMax });

  // Static curve a=1
  path.setAttribute(
    "d",
    makeParabolaPath({
      a: 1,
      xMin,
      xMax,
      n: 121,
      xToSvg: T.xToSvg,
      yToSvg: T.yToSvg,
    })
  );

  // Add a few sample scatter points
  const samples = [-3, -2, -1, 0, 1, 2, 3];
  pointsG.innerHTML = samples
    .map((x) => {
      const y = x * x;
      const cx = T.xToSvg(x);
      const cy = T.yToSvg(y);
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(
        2
      )}" r="3"></circle>`;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  initStaticPlot();

  const slider = document.querySelector("#a");
  if (slider) {
    slider.addEventListener("input", updateAll);
    updateAll();
  }
});
