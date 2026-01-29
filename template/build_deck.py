#!/usr/bin/env python3
"""
build_deck.py

Generates static navigation + a printable single-page deck.

Why:
- Modern browsers restrict fetch() and ES modules on file:// URLs.
- This build step makes the deck fully functional via file:// and on GitHub Pages.

Outputs (in-place):
- Updates <footer class="slide-nav" data-auto-nav> ... </footer> in each slide
- Injects/updates an AUTO-SCRIPTS block in each slide (math loader + optional slide scripts)
- Writes index.html (TOC) and print.html (concatenated)

Run:
  python build_deck.py
"""

from __future__ import annotations
import json, os, re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import posixpath

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "deck.json"

RE_MAIN = re.compile(
    r'<main[^>]*\bclass="[^"]*\bslide-body\b[^"]*"[^>]*>(?P<body>[\s\S]*?)</main>',
    re.IGNORECASE
)
RE_FOOTER = re.compile(
    r'(?P<open><footer[^>]*\bclass="[^"]*\bslide-nav\b[^"]*"[^>]*\bdata-auto-nav\b[^>]*>)(?P<inner>[\s\S]*?)(?P<close></footer>)',
    re.IGNORECASE
)
RE_DECKJS = re.compile(
    r'\s*<script[^>]*\bsrc="\.\./assets/deck\.js"[^>]*>\s*</script>\s*',
    re.IGNORECASE
)

# AUTO-SCRIPTS block markers
AUTO_SCRIPTS_BEGIN = "<!-- AUTO-SCRIPTS:BEGIN -->"
AUTO_SCRIPTS_END = "<!-- AUTO-SCRIPTS:END -->"
RE_AUTO_SCRIPTS = re.compile(
    re.escape(AUTO_SCRIPTS_BEGIN) + r"[\s\S]*?" + re.escape(AUTO_SCRIPTS_END),
    re.IGNORECASE
)

# Remove any existing math loader tags (regardless of local/CDN) to avoid duplicates
RE_ANY_MATH_LOADER = re.compile(
    r'\s*<script[^>]*\bsrc="[^"]*(?:math-katex-setup\.js|math-mathjax-setup\.js)(?:\?[^"]*)?"[^>]*>\s*</script>\s*',
    re.IGNORECASE
)

ABS_PREFIXES = ("http://", "https://", "data:", "/", "#", "mailto:", "tel:")

@dataclass
class ScriptSpec:
    src: str
    type: Optional[str] = None
    defer: bool = False
    async_: bool = False  # "async" is keyword in Python

@dataclass
class Slide:
    file: str
    title: str
    math: Optional[str] = None
    scripts: List[ScriptSpec] = field(default_factory=list)

def rel_href(from_path: Path, to_path: Path) -> str:
    rel = posixpath.relpath(to_path.as_posix(), start=from_path.parent.as_posix())
    return rel

def rewrite_img_srcs(body_html: str, slide_path: Path) -> str:
    # For print.html: convert relative img src to repo-root-absolute paths
    def repl(m: re.Match) -> str:
        before, src, after = m.group(1), m.group(2), m.group(3)
        s = src.strip()
        if not s or s.startswith(ABS_PREFIXES):
            return m.group(0)
        resolved = posixpath.normpath(posixpath.join(slide_path.parent.as_posix(), s))
        return f'{before}{resolved}{after}'
    return re.sub(r'(<img[^>]*\ssrc=")([^"]+)(")', repl, body_html, flags=re.IGNORECASE)

def normalize_scripts(item: Dict[str, Any]) -> List[ScriptSpec]:
    """
    Accepts:
      - "scripts": [ "x.js", {"src":"x.js","type":"module","defer":true} ]
      - legacy "script": "x.js"
    """
    raw: Any = []
    if item.get("scripts") is not None:
        raw = item.get("scripts", [])
    elif item.get("script"):
        raw = [item["script"]]

    if raw is None:
        return []
    if not isinstance(raw, list):
        raw = [raw]

    out: List[ScriptSpec] = []
    for entry in raw:
        if isinstance(entry, str):
            out.append(ScriptSpec(src=entry))
        elif isinstance(entry, dict) and isinstance(entry.get("src"), str):
            out.append(ScriptSpec(
                src=entry["src"],
                type=entry.get("type"),
                defer=bool(entry.get("defer", False)),
                async_=bool(entry.get("async", False)),
            ))
        else:
            raise SystemExit(f"Invalid script entry in deck.json: {entry!r}")
    return out

def resolve_script_src(slide_path: Path, src: str) -> str:
    """
    Resolve script src for insertion into a slide:

    - Absolute-ish (http, https, data, /, #, mailto, tel) => keep as-is
    - Starts with ./ or ../ => keep as-is (author controls)
    - Otherwise:
        * If it contains a slash => treat as repo-root-relative and rewrite to slide-relative
          (e.g., "assets/foo.js" becomes "../assets/foo.js" from slides/)
        * If it has no slash => treat as slide-local (same folder as slide) and emit "./name.js"
          (e.g., "math-demo-full.js" becomes "./math-demo-full.js")
    """
    s = src.strip()
    if not s:
        return s

    if s.startswith(ABS_PREFIXES) or s.startswith("./") or s.startswith("../"):
        return s

    if "/" in s:
        # repo-root-relative
        target = ROOT / s
        return rel_href(slide_path, target)

    # bare filename => slide-local
    return "./" + s

def script_tag(spec: ScriptSpec, slide_path: Path) -> str:
    src = resolve_script_src(slide_path, spec.src)
    attrs = [f'src="{src}"']
    if spec.type:
        attrs.append(f'type="{spec.type}"')
    if spec.defer:
        attrs.append("defer")
    if spec.async_:
        attrs.append("async")
    return f"<script {' '.join(attrs)}></script>"

def choose_slide_math_engine(deck_math_cfg: Dict[str, Any], slide_math: Optional[str]) -> str:
    # slide override wins; else deck default
    sm = (slide_math or "").strip().lower()
    if sm:
        if sm in ("none", "off", "false", "0"):
            return ""
        if sm in ("katex", "tex"):
            return "katex"
        if sm in ("mathjax", "mj"):
            return "mathjax"
        raise SystemExit(f"Unknown slide math engine: {slide_math!r}")

    deck_engine = (deck_math_cfg.get("engine") or "").strip().lower()
    if deck_engine in ("katex", "tex"):
        return "katex"
    if deck_engine in ("mathjax", "mj"):
        return "mathjax"
    return ""

def build_auto_scripts_block(slide_path: Path, deck_math_cfg: Dict[str, Any], slide: Slide) -> str:
    tags: List[str] = []

    engine = choose_slide_math_engine(deck_math_cfg, slide.math)
    if engine == "katex":
        tags.append(f'<script src="{rel_href(slide_path, ROOT / "assets" / "math-katex-setup.js")}"></script>')
    elif engine == "mathjax":
        tags.append(f'<script src="{rel_href(slide_path, ROOT / "assets" / "math-mathjax-setup.js")}"></script>')

    for sp in slide.scripts:
        tags.append(script_tag(sp, slide_path))

    inner = "\n    ".join(tags) if tags else ""
    return f"{AUTO_SCRIPTS_BEGIN}\n    {inner}\n    {AUTO_SCRIPTS_END}"

def remove_script_tag_by_src(html: str, slide_path: Path, raw_src: str) -> str:
    """
    Remove <script ... src="..."> for a given src, considering that we may rewrite
    repo-root-relative src into a slide-relative form.
    """
    candidates = set()
    s = (raw_src or "").strip()
    if not s:
        return html

    # raw as given
    candidates.add(s)

    # if repo-root-relative, also consider its slide-relative rewritten form
    if not (s.startswith(ABS_PREFIXES) or s.startswith("./") or s.startswith("../")):
        candidates.add(resolve_script_src(slide_path, s))

    # remove any script tag whose src matches any candidate exactly
    for cand in candidates:
        esc = re.escape(cand)
        html = re.sub(
            rf'\s*<script[^>]*\bsrc="{esc}"[^>]*>\s*</script>\s*',
            "\n",
            html,
            flags=re.IGNORECASE
        )
    return html

def upsert_auto_scripts(html: str, block: str) -> str:
    if RE_AUTO_SCRIPTS.search(html):
        return RE_AUTO_SCRIPTS.sub(block, html, count=1)
    # Insert before </body> if present
    if "</body>" in html.lower():
        # case-insensitive safe replace: find last </body> ignoring case
        m = re.search(r"</body>", html, flags=re.IGNORECASE)
        if m:
            i = m.start()
            return html[:i] + "\n    " + block + "\n  " + html[i:]
    # Fallback append
    return html + "\n" + block + "\n"

def update_slide_file(
    slide_path: Path,
    prev_path: Optional[Path],
    next_path: Optional[Path],
    idx: int,
    total: int,
    deck_math_cfg: Dict[str, Any],
    slide: Slide,
) -> None:
    html = slide_path.read_text(encoding="utf-8")

    # Remove old runtime loader if present
    html = RE_DECKJS.sub("\n", html)

    # Remove any existing math loader tags (we will re-insert deterministically)
    html = RE_ANY_MATH_LOADER.sub("\n", html)

    # Remove any existing script tags matching scripts declared in deck.json for this slide
    for sp in slide.scripts:
        html = remove_script_tag_by_src(html, slide_path, sp.src)

    # Update nav footer
    prev_href = rel_href(slide_path, prev_path) if prev_path else "#"
    next_href = rel_href(slide_path, next_path) if next_path else "#"
    index_href = rel_href(slide_path, ROOT / "index.html")

    nav_lines = [
        f'      <a class="nav-prev" href="{prev_href}"' + ('' if prev_path else ' aria-disabled="true"') + '>‹ Prev</a>',
        f'      <a class="nav-index" href="{index_href}">Index</a>',
        f'      <a class="nav-next" href="{next_href}"' + ('' if next_path else ' aria-disabled="true"') + '>Next ›</a>',
        f'      <span class="nav-counter">{idx}/{total}</span>',
    ]
    nav_html = "\n" + "\n".join(nav_lines) + "\n    "

    if not RE_FOOTER.search(html):
        raise SystemExit(f"{slide_path}: missing <footer class=\"slide-nav\" data-auto-nav>...</footer>")
    html = RE_FOOTER.sub(lambda m: f"{m.group('open')}{nav_html}{m.group('close')}", html)

    # Upsert AUTO-SCRIPTS block
    block = build_auto_scripts_block(slide_path, deck_math_cfg, slide)
    html = upsert_auto_scripts(html, block)

    slide_path.write_text(html, encoding="utf-8")

def read_manifest() -> Tuple[str, str, Dict[str, Any], List[Slide]]:
    deck = json.loads(MANIFEST.read_text(encoding="utf-8"))
    deck_title = deck.get("title", "Deck")
    theme = deck.get("theme", "assets/theme.css")
    math_cfg = deck.get("math", {}) or {}

    slides: List[Slide] = []
    for item in deck.get("slides", []):
        slides.append(Slide(
            file=item["file"],
            title=item.get("title") or Path(item["file"]).stem,
            math=item.get("math"),
            scripts=normalize_scripts(item),
        ))
    if not slides:
        raise SystemExit("deck.json has no slides.")
    return deck_title, theme, math_cfg, slides

def build_index(deck_title: str, theme_href: str, slides: List[Slide]) -> None:
    items = []
    for i, s in enumerate(slides, start=1):
        items.append(f'        <li><a href="{s.file}">{i}. {s.title}</a></li>')

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{deck_title}</title>
  <link rel="stylesheet" href="assets/base.css" />
  <link rel="stylesheet" href="{theme_href}" />
</head>
<body>
  <div class="slide">
    <header class="slide-header">
      <h1 class="slide-title">{deck_title}</h1>
      <hr />
    </header>
    <main class="slide-body">
      <div><a href="print.html">Experimental: Single page for printing (most interactivity disabled, figure/font sizing/placement not preserved).</a></div>
      <h2>Table of Contents</h2>
      <ul class = "bullets" style="list-style-type: none;">
{os.linesep.join(items)}
      </ul>
    </main>
  </div>
</body>
</html>
"""
    (ROOT / "index.html").write_text(html, encoding="utf-8")

def choose_print_math_engine(deck_math_cfg: Dict[str, Any], slides: List[Slide]) -> str:
    deck_engine = (deck_math_cfg.get("engine") or "").lower().strip()
    any_mathjax = any((s.math or "").lower().strip() in ("mathjax", "mj") for s in slides)
    if any_mathjax or deck_engine in ("mathjax", "mj"):
        return "mathjax"
    if deck_engine in ("katex", "tex"):
        return "katex"
    return ""

def build_print(deck_title: str, theme_href: str, deck_math_cfg: Dict[str, Any], slides: List[Slide]) -> None:
    sections: List[str] = []
    for i, s in enumerate(slides, start=1):
        slide_path = ROOT / s.file
        src = slide_path.read_text(encoding="utf-8")
        m = RE_MAIN.search(src)
        if not m:
            raise SystemExit(f"{s.file}: missing <main class=\"slide-body\">...</main>")
        body = rewrite_img_srcs(m.group("body"), slide_path)
        sections.append(f"""
    <section class="print-slide">
      <header class="print-header">
        <h2 class="print-title">{i}. {s.title}</h2>
      </header>
      <div class="print-body">
{body}
      </div>
    </section>
""".rstrip())

    engine = choose_print_math_engine(deck_math_cfg, slides)
    math_script = ""
    if engine == "katex":
        math_script = '  <script defer src="assets/math-katex-setup.js"></script>\n'
    elif engine == "mathjax":
        math_script = '  <script defer src="assets/math-mathjax-setup.js"></script>\n'

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Print — {deck_title}</title>
  <link rel="stylesheet" href="assets/base.css" />
  <link rel="stylesheet" href="{theme_href}" />
  <link rel="stylesheet" href="assets/print.css" />
</head>
<body>
  <main class="print-deck">
    <header class="print-cover">
      <h1 class="slide-title">{deck_title}</h1>
      <p class="muted">Generated by <code>build_deck.py</code>. Use your browser’s Print dialog.</p>
    </header>
{os.linesep.join(sections)}
  </main>

{math_script}</body>
</html>
"""
    (ROOT / "print.html").write_text(html, encoding="utf-8")

def main() -> None:
    deck_title, theme, deck_math_cfg, slides = read_manifest()
    total = len(slides)

    for i, s in enumerate(slides, start=1):
        slide_path = ROOT / s.file
        if not slide_path.exists():
            raise SystemExit(f"Missing slide file: {s.file}")
        prev_path = (ROOT / slides[i-2].file) if i > 1 else None
        next_path = (ROOT / slides[i].file) if i < total else None
        update_slide_file(slide_path, prev_path, next_path, i, total, deck_math_cfg, s)

    build_index(deck_title, theme, slides)
    build_print(deck_title, theme, deck_math_cfg, slides)

    print(f"OK: updated {total} slide files (nav + auto scripts); wrote index.html and print.html.")

if __name__ == "__main__":
    main()
