/* Markdown Preview — minimal, focused reader for the AI age. */

const $ = (sel) => document.querySelector(sel);

const els = {
  body: document.body,
  doc: $('#doc'),
  source: $('#source'),
  filename: $('#filename'),
  fileInput: $('#fileInput'),
  openBtn: $('#openBtn'),
  emptyOpen: $('#emptyOpen'),
  emptySample: $('#emptySample'),
  copyBtn: $('#copyBtn'),
  printBtn: $('#printBtn'),
  themeBtn: $('#themeBtn'),
  removeBtn: $('#removeBtn'),
  segBtns: document.querySelectorAll('.seg__btn'),
  dropzone: $('#dropzone'),
  toast: $('#toast'),
  tocList: $('#tocList'),
  hljsLight: $('#hljs-light'),
  hljsDark: $('#hljs-dark'),
};

let currentMarkdown = '';
let currentFilename = 'Untitled.md';

const STORAGE_KEY = 'mdp-doc';

function saveDoc() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ markdown: currentMarkdown, filename: currentFilename, savedAt: Date.now() })
    );
  } catch (err) {
    // Quota exceeded (file too large) — fail quietly, keep session-only.
    console.warn('Could not persist document:', err);
  }
}

function loadDoc() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.markdown !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ---------- Markdown rendering ---------- */
marked.setOptions({
  gfm: true,
  breaks: false,
  highlight(code, lang) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  },
});

function render(markdown, filename, { persist = true } = {}) {
  currentMarkdown = markdown ?? '';
  if (filename) {
    currentFilename = filename;
    els.filename.textContent = filename;
    els.filename.title = filename;
    document.title = `${filename} — Markdown`;
  }

  const html = DOMPurify.sanitize(marked.parse(currentMarkdown), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });

  els.doc.innerHTML = html;
  els.source.textContent = currentMarkdown;

  // External links: open in new tab safely.
  els.doc.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  buildToc();

  els.body.dataset.state = 'loaded';
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (persist) saveDoc();
}

/* ---------- Table of contents ---------- */
let tocObserver;
const slugCounts = new Map();

function slugify(text) {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section';
  const count = slugCounts.get(base) ?? 0;
  slugCounts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function buildToc() {
  if (tocObserver) tocObserver.disconnect();
  slugCounts.clear();
  els.tocList.innerHTML = '';

  const headings = els.doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (!headings.length) {
    els.tocList.innerHTML = '<li class="toc__empty">No sections</li>';
    return;
  }

  const frag = document.createDocumentFragment();
  headings.forEach((h) => {
    if (!h.id) h.id = slugify(h.textContent || '');
    const li = document.createElement('li');
    li.className = `toc__item toc__item--${h.tagName.toLowerCase()}`;
    const a = document.createElement('a');
    a.className = 'toc__link';
    a.href = `#${h.id}`;
    a.textContent = h.textContent || '';
    a.title = a.textContent;
    a.dataset.target = h.id;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${h.id}`);
    });
    li.appendChild(a);
    frag.appendChild(li);
  });
  els.tocList.appendChild(frag);

  // Active-section highlighting
  const linksById = new Map(
    Array.from(els.tocList.querySelectorAll('.toc__link')).map((a) => [a.dataset.target, a])
  );
  const visible = new Set();

  tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });

      // Pick the first heading (in document order) that's currently visible.
      let activeId = null;
      for (const h of headings) {
        if (visible.has(h.id)) {
          activeId = h.id;
          break;
        }
      }
      // Fallback: nearest heading above the viewport.
      if (!activeId) {
        let last = null;
        for (const h of headings) {
          if (h.getBoundingClientRect().top < 100) last = h.id;
          else break;
        }
        activeId = last ?? headings[0].id;
      }

      linksById.forEach((link, id) => link.classList.toggle('is-active', id === activeId));
    },
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
  );
  headings.forEach((h) => tocObserver.observe(h));
}

/* ---------- File handling ---------- */
async function handleFile(file) {
  if (!file) return;
  const isMd =
    /\.(md|markdown|mdown|mkd|txt)$/i.test(file.name) ||
    file.type === 'text/markdown' ||
    file.type === 'text/plain' ||
    file.type === '';
  if (!isMd) {
    toast(`Unsupported file: ${file.type || 'unknown'}`);
    return;
  }
  const text = await file.text();
  render(text, file.name);
  toast(`Loaded ${file.name}`);
}

els.openBtn.addEventListener('click', () => els.fileInput.click());
els.emptyOpen.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleFile(file);
  e.target.value = '';
});

/* ---------- Drag & drop ---------- */
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer?.types?.includes('Files')) return;
  dragDepth++;
  els.dropzone.classList.add('is-active');
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) els.dropzone.classList.remove('is-active');
});
window.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
});
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  dragDepth = 0;
  els.dropzone.classList.remove('is-active');
  handleFile(e.dataTransfer.files[0]);
});

/* ---------- Paste markdown ---------- */
window.addEventListener('paste', (e) => {
  const target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }
  const text = e.clipboardData?.getData('text/plain');
  if (!text) return;
  if (text.length < 1) return;
  e.preventDefault();
  render(text, 'Pasted.md');
  toast('Rendered from clipboard');
});

/* ---------- View toggle ---------- */
els.segBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    els.segBtns.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    els.body.dataset.view = view;
  });
});

/* ---------- Copy ---------- */
els.copyBtn.addEventListener('click', async () => {
  if (!currentMarkdown) return toast('Nothing to copy yet');
  try {
    await navigator.clipboard.writeText(currentMarkdown);
    toast('Markdown copied');
  } catch {
    toast('Copy failed');
  }
});

/* ---------- Remove file ---------- */
function clearDoc() {
  currentMarkdown = '';
  currentFilename = 'Untitled.md';
  els.doc.innerHTML = '';
  els.source.textContent = '';
  els.tocList.innerHTML = '';
  if (tocObserver) tocObserver.disconnect();
  els.filename.textContent = 'Untitled.md';
  els.filename.title = 'No file loaded';
  document.title = 'Markdown Preview';
  els.body.dataset.state = 'empty';
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

els.removeBtn.addEventListener('click', () => {
  clearDoc();
  toast('File removed');
});

/* ---------- Print ---------- */
els.printBtn.addEventListener('click', () => {
  if (!currentMarkdown) return toast('Open a file first');
  window.print();
});

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  if (els.hljsLight) els.hljsLight.disabled = dark;
  if (els.hljsDark) els.hljsDark.disabled = !dark;
  localStorage.setItem('mdp-theme', theme);
}
function initTheme() {
  const saved = localStorage.getItem('mdp-theme');
  applyTheme(saved === 'dark' ? 'dark' : 'light');
}
els.themeBtn.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});
initTheme();

/* ---------- Restore last document ---------- */
(function restore() {
  const saved = loadDoc();
  if (saved && saved.markdown) {
    render(saved.markdown, saved.filename || 'Untitled.md', { persist: false });
  }
})();

/* ---------- Toast ---------- */
let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('is-show'), 2000);
}

/* ---------- Sample ---------- */
const SAMPLE = `# Markdown Preview

A focused reader for the **AI age** — drop in any \`.md\` and read it the way it deserves.

## Why this exists

Most markdown is generated, pasted, or shipped between agents. This is a calm place to read it:

- No editing distractions
- No sidebars
- No accounts, nothing leaves your browser

> "Make the content the interface." — somebody, probably.

## Features

| Feature | Shortcut |
|---|---|
| Open file | \`⌘O\` |
| Paste markdown | \`⌘V\` |
| Copy markdown | \`⌘⇧C\` |
| Toggle theme | \`⌘J\` |
| Print / PDF | \`⌘P\` |

## Code looks good too

\`\`\`ts
export function greet(name: string) {
  return \`Hello, \${name}\`;
}
\`\`\`

## Lists, tasks, and links

- [x] Render GFM
- [x] Sanitize HTML
- [ ] Add your own file →  click **Open** above

Made with care. Read [the source](https://daringfireball.net/projects/markdown/) for the spec.
`;

els.emptySample.addEventListener('click', () => render(SAMPLE, 'Sample.md'));

/* ---------- Keyboard shortcuts ---------- */
window.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'o') {
    e.preventDefault();
    els.fileInput.click();
  } else if (key === 'j') {
    e.preventDefault();
    els.themeBtn.click();
  } else if (key === 'c' && e.shiftKey) {
    e.preventDefault();
    els.copyBtn.click();
  }
});
