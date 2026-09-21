# StyleSense AI — Personal Fashion Stylist

A modern, production-ready **static fashion website** built around the StyleSense AI
chatbot — an AI stylist specialised in university outfits, casual, smart-casual, formal,
weddings, modest fashion, colour combinations and fabrics.

The original chatbot was a **Gradio + Hugging Face Transformers** app using the very large
`openai/gpt-oss-120b` model. Because that model is impractical to run in a normal browser
deployment, this project ships **two interchangeable answer engines behind one chat UI**:

| Engine | When it's used | Needs a key? |
| --- | --- | --- |
| **Hosted engine** | Calls any OpenAI-compatible `/chat/completions` endpoint (Hugging Face Inference API, OpenAI, Groq, Together, Ollama, or the bundled proxy) with the exact StyleSense system prompt. | Yes (optional) |
| **Stylist engine** | A fully offline, deterministic fashion-advice engine built into `js/chatbot.js`. Understands occasion, season, climate, dress code, colour, fabric, body-shape and budget keywords. | No |

**Out of the box the site works with zero setup and zero API keys.** If a hosted endpoint is
configured and the request fails for any reason, the chatbot **silently falls back** to the
offline engine, so the site is never broken.

---

## 1. Project structure

```
fashion_assistant chatbot/
├─ index.html            # Single-page site: hero, features, chatbot, gallery, about, footer
├─ css/
│  └─ styles.css         # Design system + responsive layout + dark mode
├─ js/
│  ├─ config.js          # System prompt, branding, optional API settings, UI prefs
│  ├─ chatbot.js         # Chat UI + hosted engine + offline "Stylist engine"
│  └─ main.js            # Nav, theme toggle, gallery, scroll animations, toast
├─ assets/
│  └─ favicon.svg
├─ server/               # Optional key-hiding proxy (Node, zero dependencies)
│  ├─ server.js
│  └─ package.json
└─ README.md
```

---

## 2. Run locally (recommended)

The site is plain HTML/CSS/JS — no build step. Because it loads fonts and images over
HTTPS, it's best served over a local HTTP server rather than opened as a `file://` page.

**Option A — Python (already on most machines):**

```bash
cd "fashion_assistant chatbot"
python -m http.server 5500
```

Then open <http://localhost:5500>.

**Option B — Node (no install needed):**

```bash
cd "fashion_assistant chatbot"
npx serve -l 5500
```

**Option C — VS Code:** install the *Live Server* extension, right-click `index.html`,
and choose **Open with Live Server**.

> On Windows you can also just double-click `index.html`. Everything works except the
> optional hosted model call, which browsers block from `file://` origins — the offline
> Stylist engine will handle all questions instead.

---

## 3. Using the chatbot (no API key)

Just open the site and start typing, or tap one of the suggestion chips. Examples:

- *"What should I wear to my first university lecture?"*
- *"Style me for a job interview in a conservative office."*
- *"Wedding guest outfit for a summer evening ceremony."*
- *"Which colours go best with olive green?"*
- *"Is linen a good choice for hot humid weather?"*

The engine detects the occasion (campus, interview, formal, wedding, modest, casual,
streetwear, date, hot/humid, cold), named colours, fabrics and budget/body-shape intent,
then replies in the same structured, stylist-style format used by the original system
prompt — intro, base outfit, layering, shoes, accessories, colour palette, fabrics,
stylist tip and an alternative.

---

## 4. Connecting a hosted model (optional)

Open **`js/config.js`** and edit the `api` block.

### 4a. Hugging Face Inference API (matches the original notebook)

```js
api: {
  enabled: true,
  baseUrl: "https://api-inference.huggingface.co/models/openai/gpt-oss-120b/v1/chat/completions",
  apiKey: "hf_xxxxxxxxxxxxxxxxxxxx",
  authStyle: "bearer",
  model: "openai/gpt-oss-120b",
  // ...
}
```

> The 120B model is large; a serverless HF endpoint may be cold or rate-limited. If the
> call fails, the site falls back to the offline engine automatically.

### 4b. OpenAI / Groq / Together / any OpenAI-compatible API

```js
api: {
  enabled: true,
  baseUrl: "https://api.openai.com/v1/chat/completions",  // or groq, together, ...
  apiKey: "sk-...",
  authStyle: "bearer",
  model: "gpt-4o-mini"                                    // or your chosen model
}
```

### 4c. Local Ollama (no key required)

```js
api: {
  enabled: true,
  baseUrl: "http://localhost:11434/v1/chat/completions",
  apiKey: "",
  allowKeyless: true,          // <-- lets the request through without a key
  model: "qwen2.5:1.5b"        // or phi3:mini, llama3.2, etc.
}
```

> If you hit CORS issues with Ollama, start it with
> `OLLAMA_ORIGINS=* ollama serve`.

### 4d. Recommended: the bundled key-hiding proxy

Putting a real API key in front-end JavaScript exposes it to anyone who opens DevTools.
For anything public, run the tiny proxy in `server/` — the key stays on the machine.

```bash
cd server
npm start                     # starts http://localhost:8787
```

Configure it with environment variables, then point the front end at it:

```bash
# Windows (cmd)
set UPSTREAM_URL=https://api.groq.com/openai/v1/chat/completions
set UPSTREAM_KEY=your_real_key_here
set UPSTREAM_MODEL=llama-3.1-8b-instant
set PROXY_TOKEN=proxy
npm start
```

```js
// js/config.js
api: {
  enabled: true,
  baseUrl: "http://localhost:8787/v1/chat/completions",
  apiKey: "proxy",                 // must match PROXY_TOKEN
  authStyle: "x-proxy-token",
  model: "llama-3.1-8b-instant"
}
```

The proxy only sends the `system` message and conversation turns — the StyleSense
personality is unchanged.

---

## 5. Customising

| What | Where |
| --- | --- |
| Personality / system prompt | `js/config.js` → `systemPrompt` |
| Greeting message | `js/config.js` → `brand.greeting` |
| Suggestion chips | `js/config.js` → `ui.suggestions` |
| Typewriter speed / thinking delay | `js/config.js` → `ui` |
| Colours, fonts, spacing | `css/styles.css` → `:root` design tokens |
| Gallery looks | `js/main.js` → `LOOKS` array |
| Offline answers (occasions/colours/fabrics) | `js/chatbot.js` → knowledge base sections |

### Brand tokens (CSS)

All colours live as CSS custom properties at the top of `css/styles.css`:

```css
:root {
  --gold:  #c9a227;
  --ink:   #0f0e0d;
  --cream: #f3efe7;
  /* ... */
}
```

Dark mode is applied via `[data-theme="dark"]` on `<html>` and toggled by the sun/moon
button in the header (the choice is remembered in `localStorage`).

---

## 6. Features

- **Premium, editorial design** — Playfair Display + Inter, soft pastels, black/white and gold accents.
- **Fully responsive** — mobile-first layout with a slide-in navigation drawer.
- **Dark / light mode** — persisted, respects the OS preference on first visit.
- **Chat UI** — message bubbles, avatars, typing indicator, progressive typewriter reveal, auto-growing composer, Enter to send / Shift+Enter for newline.
- **Conversation memory** — context is sent to the hosted model; the last session is restored from `localStorage` (within 24 hours).
- **Gallery hand-off** — tap any look card and it seeds the chatbot with a tailored prompt.
- **Accessibility** — semantic landmarks, `aria-live` chat log, keyboard-operable cards, visible focus states, `prefers-reduced-motion` support.
- **Graceful degradation** — hosted failures fall back offline; broken images degrade to a soft placeholder.

---

## 7. Deploying

Everything except the optional proxy is static, so you can host it on GitHub Pages,
Netlify, Vercel or Cloudflare Pages by uploading the folder as-is:

1. Push the folder to a repository (or drag it into Netlify Drop).
2. Set the publish directory to the project root.
3. If you use a hosted model in production, **do not** ship a real key in `config.js` —
   deploy the proxy (adapted for your host) and point `api.baseUrl` at it.

---

## 8. Notes & credits

- Original chatbot: Gradio + Hugging Face Transformers, `openai/gpt-oss-120b`.
- Photography: [Unsplash](https://unsplash.com).
- Fonts: [Google Fonts](https://fonts.google.com) (Playfair Display, Inter).
- Advice is AI-generated — always use your own judgement for a specific event's dress code.

Built as a fashion-tech student project. No frameworks, no build step, no tracking.