# Offline math libraries (optional)

This template supports **offline** math rendering by vendoring KaTeX and/or MathJax into this folder.

If the local files exist, slides will load them. If they don't, slides will fall back to a CDN.

## KaTeX (recommended default)

**Expected local layout** (copied from KaTeX `dist/`):

- `vendor/katex/katex.min.css`
- `vendor/katex/katex.min.js`
- `vendor/katex/contrib/auto-render.min.js`
- `vendor/katex/fonts/` *(entire folder — required because `katex.min.css` references these webfonts)*

How to install (one-time, then commit to repo):

1. Download a KaTeX release OR install via npm:
   - `npm i katex`
2. Copy these paths from `node_modules/katex/dist/` into `vendor/katex/`:
   - `katex.min.css`
   - `katex.min.js`
   - `contrib/auto-render.min.js`
   - `fonts/` (folder)

Also consider copying KaTeX's LICENSE file into `vendor/katex/` to preserve upstream licensing.

## MathJax (use when you need broader TeX support)

MathJax v3+ combined component files (like `tex-chtml.js`) may still load additional assets relative to themselves (fonts and supporting components). For reliable offline use, vendor the **entire `es5/` folder**.

**Expected local layout:**

- `vendor/mathjax/es5/tex-chtml.js`
- `vendor/mathjax/es5/` *(rest of folder, including output fonts, etc.)*

How to install:

1. Download MathJax v3+ distribution OR install via npm:
   - `npm i mathjax-full`
2. Copy the full folder `node_modules/mathjax-full/es5/` into `vendor/mathjax/es5/`.

Also consider copying MathJax's LICENSE file into `vendor/mathjax/`.

## Notes

- Slides choose the engine by including either:
  - `assets/math-katex-setup.js` or
  - `assets/math-mathjax-setup.js`
- The build script does not fetch or manage these libraries for you (by design).
