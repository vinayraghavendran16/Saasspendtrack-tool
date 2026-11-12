# Hosting SaaS Spend Track on Cloudflare Pages

Static site, no build step, deploys from `main` in this repo. Serving the
single `index.html` is all that's needed — everything is inlined-friendly
and all state lives in the user's browser.

## One-time setup

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**
2. Authorise GitHub for Cloudflare (first time only), pick repo
   `vinayraghavendran16/Saasspendtrack-tool`
3. **Set up builds and deployments**:
   - Project name: `saasspendtrack`
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
   - Root directory: `/`
4. **Save and Deploy** — first build takes ~15 seconds.

## Custom domain

After the first deploy succeeds:

1. Open the project → **Custom domains** → **Set up a custom domain**
2. Enter `app.saasspendtrack.com`
3. Cloudflare auto-creates the CNAME because `saasspendtrack.com` is already
   on Cloudflare nameservers — click Activate
4. SSL cert issues in ~60 seconds

## Automatic deploys

Every push to `main` triggers a new deploy. Every PR gets a preview URL.
No CI config needed.

## Files that make this work

- `_headers` — security headers, cache policy
- `_redirects` — SPA-style fallback to index.html
- All `*.js` and `styles.css` served as-is

## On-prem variant

Same bundle. Serve `index.html` from any nginx / Apache / Caddy. See
`OnPrem_System_Requirements_Guide.pdf` in the distributor dossier.
