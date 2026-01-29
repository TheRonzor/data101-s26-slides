// assets/deck.js
// Shared runtime:
// - Loads deck.json
// - Renders TOC on index.html
// - Injects Prev/Next nav on slide pages
// - Assembles print.html by fetching slides
// - Loads math engine per deck/slide configuration
// - Loads optional per-slide module

const DECK_CANDIDATES = ["deck.json", "../deck.json", "../../deck.json"];

async function fetchFirstOk(urls) {
  let lastErr;
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (res.ok) return { res, url: new URL(u, location.href) };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Unable to fetch deck manifest.");
}

async function loadDeck() {
  const { res, url } = await fetchFirstOk(DECK_CANDIDATES);
  const deck = await res.json();
  return { deck, deckUrl: url };
}

function resolveFromDeck(deckUrl, relPath) {
  return new URL(relPath, deckUrl);
}

function samePath(a, b) {
  // Compare pathnames ignoring trailing slashes.
  const norm = (p) => p.replace(/\/+$/, "");
  return norm(a) === norm(b);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function link(href, text, disabled=false) {
  const a = el("a", { href: disabled ? "#" : href, text });
  if (disabled) a.setAttribute("aria-disabled", "true");
  return a;
}

function currentSlideIndex(deck, deckUrl) {
  const here = location.pathname;
  for (let i = 0; i < deck.slides.length; i++) {
    const u = resolveFromDeck(deckUrl, deck.slides[i].file);
    if (samePath(u.pathname, here)) return i;
  }
  return -1;
}

function getMathEngine(deck, slide) {
  const slideOverride = slide?.math;
  const deckDefault = deck?.math?.engine;
  return (slideOverride ?? deckDefault ?? "none");
}

async function ensureThemeLink(deck) {
  // Optional: allow deck.json to override theme alias. If omitted, slides link theme.css directly.
  if (!deck.theme) return;
  const existing = document.querySelector('link[data-deck-theme]');
  if (existing) return;

  // If the document already includes assets/theme.css, that's fine; this is opt-in.
  const href = new URL(deck.theme, (await loadDeck()).deckUrl).pathname;
  const l = el("link", { rel: "stylesheet", href, "data-deck-theme": "1" });
  document.head.append(l);
}

async function loadMath(engine) {
  if (!engine || engine === "none") return;
  if (engine === "katex") {
    const mod = await import("./math-katex.js");
    await mod.renderMath();
    return;
  }
  if (engine === "mathjax") {
    const mod = await import("./math-mathjax.js");
    await mod.renderMath();
    return;
  }
  console.warn("Unknown math engine:", engine);
}

function injectNav(deck, deckUrl) {
  const nav = document.querySelector("[data-deck-nav]");
  if (!nav) return;

  const idx = currentSlideIndex(deck, deckUrl);
  const prev = idx > 0 ? resolveFromDeck(deckUrl, deck.slides[idx - 1].file) : null;
  const next = (idx >= 0 && idx < deck.slides.length - 1) ? resolveFromDeck(deckUrl, deck.slides[idx + 1].file) : null;

  const left = link(prev?.pathname ?? "#", "← Previous", !prev);
  const mid = link(resolveFromDeck(deckUrl, "index.html").pathname, "Index");
  const right = link(next?.pathname ?? "#", "Next →", !next);

  nav.innerHTML = "";
  nav.append(left, mid, right);
}

async function renderIndex(deck, deckUrl) {
  const host = document.querySelector("[data-deck-index]");
  if (!host) return;

  document.title = deck.title || "Slides";

  const h = el("h1", { class: "slide-title", text: deck.title || "Slides" });
  const list = el("ol", { class: "bullets" });

  for (const s of deck.slides) {
    const u = resolveFromDeck(deckUrl, s.file);
    const a = el("a", { href: u.pathname, text: s.title || s.file });
    list.append(el("li", {}, [a]));
  }

  const printLink = el("a", {
    href: resolveFromDeck(deckUrl, "print.html").pathname,
    text: "Print deck",
    class: "print-link"
  });

  host.innerHTML = "";
  host.append(h, list, el("p", {}, [printLink]));
}

async function renderPrint(deck, deckUrl) {
  const host = document.querySelector("[data-deck-print]");
  if (!host) return;

  document.title = (deck.title ? `${deck.title} — Print` : "Print");

  const container = el("div", { class: "print-container" });
  host.innerHTML = "";
  host.append(container);

  for (const s of deck.slides) {
    const u = resolveFromDeck(deckUrl, s.file);
    const res = await fetch(u.pathname, { cache: "no-store" });
    if (!res.ok) {
      const err = el("section", { class: "print-slide" }, [
        el("h2", { text: s.title || s.file }),
        el("p", { text: `Failed to load ${u.pathname} (${res.status})` })
      ]);
      container.append(err);
      continue;
    }
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const titleEl = doc.querySelector(".slide-title");
    const bodyEl = doc.querySelector(".slide-body");

    const section = el("section", { class: "print-slide" });
    section.append(
      el("h1", { class: "slide-title", text: titleEl?.textContent?.trim() || s.title || "" })
    );
    if (bodyEl) {
      // Import the slide body content
      section.append(bodyEl.cloneNode(true));
    } else {
      section.append(el("p", { text: "Missing .slide-body in slide HTML." }));
    }
    container.append(section);
  }

  // Render math after assembling content.
  // Printing uses ONE engine for the whole assembled document.
  // If any slide requests MathJax, prefer it (it can also render simpler math).
  let engine = deck?.math?.engine ?? "none";
  const overrides = new Set((deck.slides || []).map(s => s.math).filter(Boolean));
  if (overrides.has("mathjax")) engine = "mathjax";
  else if (overrides.has("katex")) engine = (engine === "none" ? "katex" : engine);

  await loadMath(engine);
}

async function loadPerSlideModule(deck, deckUrl) {
  const idx = currentSlideIndex(deck, deckUrl);
  if (idx < 0) return;

  const slide = deck.slides[idx];
  if (!slide.script) return;

  const u = resolveFromDeck(deckUrl, slide.script);
  await import(u.pathname);
}

async function main() {
  const { deck, deckUrl } = await loadDeck();

  // Theme override (optional; slides already link theme.css)
  // await ensureThemeLink(deck);

  // Index?
  await renderIndex(deck, deckUrl);

  // Print?
  await renderPrint(deck, deckUrl);

  // Slide nav?
  injectNav(deck, deckUrl);

  // Slide math?
  const idx = currentSlideIndex(deck, deckUrl);
  const slide = idx >= 0 ? deck.slides[idx] : null;
  const engine = getMathEngine(deck, slide);
  await loadMath(engine);

  // Per-slide module
  await loadPerSlideModule(deck, deckUrl);
}

main().catch((err) => {
  console.error(err);
});
