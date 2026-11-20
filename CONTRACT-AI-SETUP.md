# World-class contract extraction (AI backend)

The app ships with a fast, offline rules-based contract reader. Turning on
**AI extraction** routes contract text through the Anthropic API for
dramatically more accurate, format-agnostic extraction (any vendor, any
layout, tables and clauses), returned as a strict schema.

It runs as a **Cloudflare Pages Function** in this repo at
`functions/api/extract.js`, served same-origin as `/api/extract`. The API key
lives only on Cloudflare - it never reaches the browser.

## One-time setup

1. Get an Anthropic API key: <https://console.anthropic.com> → API Keys.
2. Cloudflare dashboard → **Workers & Pages → your `saasspendtrack` project →
   Settings → Variables and Secrets → Environment variables**.
3. Add, for **Production** (and Preview if you use it):
   - `ANTHROPIC_API_KEY` = `sk-ant-...`  → click **Encrypt** (store as a secret).
   - *(optional)* `EXTRACT_MODEL` = a model your key can use. Default is
     `claude-3-5-sonnet-20241022`. Set a newer Sonnet here if your account has
     access - this is the single biggest lever on quality.
4. **Save**, then redeploy (push any commit, or "Retry deployment"). Pages
   Functions deploy automatically with the site.
5. In the app: **Contract terms → toggle "AI extraction" on** (top right). Upload
   a contract. The toast will show "(AI)" when the backend handled it.

## How it behaves

- **Off (default):** everything runs in the browser; nothing is uploaded.
- **On:** the extracted contract *text* is POSTed to your own `/api/extract`,
  which calls Anthropic and returns structured facts. If the backend is not yet
  configured (no key) or errors, the app silently falls back to the built-in
  reader and tells you.

## Privacy note

With AI extraction **on**, contract text leaves the browser for your own
Cloudflare project and the Anthropic API. The in-app signup copy ("nothing from
your contracts ever leaves your browser") is only accurate while it is **off**.
If you plan to default it on for customers, update that copy and your privacy
page accordingly, and confirm your Anthropic data-retention settings.

## Cost

Roughly one Anthropic request per contract (a few cents each, depending on the
model and contract length). You pay via your own API key.

## Endpoint override (optional)

The client calls `/api/extract` by default. To point it elsewhere (e.g. a
separate Worker), set `state.settings.extractEndpoint` to an absolute URL via
the browser console; that endpoint must accept `POST {text}` and return
`{ ok, data }` in the same shape as `functions/api/extract.js`.

## Roadmap: PDF-native extraction

This v1 sends extracted *text*. The strongest next step is sending the raw PDF
to Claude's document API (native tables + vision for scanned pages). That means
base64-ing the PDF in the client and forwarding a `document` content block in
the Function. Worth doing once the text path is proven.
