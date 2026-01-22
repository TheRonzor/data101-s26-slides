# HTML Slideshow Template

A static-first slideshow system where **each slide is a separate HTML file**, ordering is controlled by **one manifest (`deck.json`)**, navigation is injected automatically, and the entire deck can be printed from **one `print.html`** page.

## Quick start

1. Edit `deck.json` to set the deck title and slide order.
2. Create/edit slides in `/slides/*.html` (copy one of the examples).
3. Open `index.html` to view the deck (use a static server for best results).

### GitHub Pages (recommended)

Enable GitHub Pages for the repo (Settings → Pages). View:

- `index.html` — table of contents
- `slides/...` — individual slides with Prev/Next
- `print.html` — print the full deck in one go

## How ordering works

`deck.json` is the single source of truth. To insert a slide in the middle, add a new entry in `deck.json`—no renaming required.

## Theming

All slides link to:

- `assets/base.css` (structure/layout utilities)
- `assets/theme.css` (theme alias)

To swap theme without touching slide files, change `assets/theme.css` to import a different theme:

```css
@import url("themes/light.css");
```

or

```css
@import url("themes/dark.css");
```

## Math

Default engine is configured in `deck.json`:

```json
"math": { "engine": "katex" }
```

Per-slide override:

```json
{ "file": "slides/math.html", "title": "Math", "math": "mathjax" }
```

## Interactivity

Add a per-slide script module:

```json
{ "file": "slides/demo.html", "title": "Demo", "scripts": ["slides/demo.js"] }
```

## Testing

See `docs/TESTING.md`.

## Local testing (file:// and http://)

Run:

```bash
python build_deck.py
```

Then open `index.html` via file://.

## Offline math libraries

- Slides will try **local first**, then fall back to a CDN.

For web-server parity:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`.
