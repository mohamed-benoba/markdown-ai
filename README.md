# Markdown Preview

A minimal, focused markdown reader for the AI age. Drop in a `.md` file, read it cleanly, copy or print. Nothing leaves your browser.

## Run it

It's a single static page — no build, no install.

```bash
# from this folder
open index.html      # macOS
# or
python3 -m http.server 5173    # then visit http://localhost:5173
```

## Features

- Drag-and-drop or **Open** any `.md` / `.markdown` / `.txt` file
- Paste markdown anywhere on the page (`⌘V`) to render it instantly
- Toggle between rendered **Preview** and raw **Source**
- One-click **Copy** of raw markdown
- Print / Save as PDF
- Light & dark theme (follows system, remembers your choice)
- GitHub-flavored markdown, syntax highlighting, sanitized HTML

## Shortcuts

| Action | Shortcut |
|---|---|
| Open file | `⌘O` |
| Paste markdown | `⌘V` |
| Copy markdown | `⌘⇧C` |
| Toggle theme | `⌘J` |
| Print / PDF | `⌘P` |

## Stack

Plain HTML + CSS + JS. CDN libraries:

- [`marked`](https://marked.js.org) — markdown parser
- [`DOMPurify`](https://github.com/cure53/DOMPurify) — HTML sanitizer
- [`highlight.js`](https://highlightjs.org) — code highlighting
- [Inter](https://rsms.me/inter/) — typeface

## Files

- `index.html` — markup & toolbar
- `styles.css` — Stripe-inspired design system
- `app.js` — file handling, rendering, shortcuts
