/* ==========================================================================
   SaaS Spend Track — Phase 14
   Download bridge + artifact-safe PDF export
   ---------------------------------------------------------------------------
   The Claude artifact viewer blocks ordinary <a download> and script-driven
   saves (the warning on every publish calls this out). On any other host —
   Cloudflare Pages, Vercel, Netlify, self-hosted — the normal browser save
   works, so this bridge is transparent there.

   Strategy:
   - Try window.claude.downloads.save() first if it's present (works inside
     the artifact once the capability is declared).
   - Fall back to classic <a download> which works in every normal browser.
   - Wrap downloadFile() in app.js and the html2pdf save pipeline in
     extensions3.js so EVERY download button is covered by one layer.
   ========================================================================== */

/* --- Resolve the artifact "downloads" capability once, memoized --- */
let _dlNs = undefined; // undefined = not asked, null = unavailable, obj = ready
async function _getDownloadsNs() {
  if (_dlNs !== undefined) return _dlNs;
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      _dlNs = await window.claude.use('downloads');
    } else { _dlNs = null; }
  } catch (_) { _dlNs = null; }
  return _dlNs;
}

/* --- The single save entry point --- */
async function saveFileUniversal(filename, blobOrContent, mime) {
  let blob = blobOrContent;
  if (!(blobOrContent instanceof Blob)) {
    blob = new Blob([blobOrContent], { type: mime || 'application/octet-stream' });
  }
  // 1) Artifact viewer path (if the capability is granted)
  try {
    const dl = await _getDownloadsNs();
    if (dl && typeof dl.save === 'function') {
      // Per contract: pass data (not blob)
      await dl.save({ filename, data: blob });
      if (typeof toast === 'function') toast(`${filename} downloaded.`, 'success');
      return true;
    }
  } catch (e) { console.warn('claude downloads save failed, falling back', e); }
  // 2) Normal browser
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    return true;
  } catch (e) {
    console.error('download failed', e);
    if (typeof toast === 'function') toast(`Could not download ${filename}.`, 'error');
    return false;
  }
}

/* --- Replace downloadFile() so every caller routes through the bridge --- */
if (typeof window.downloadFile === 'function') {
  const _origDownloadFile = window.downloadFile;
  window.downloadFile = function (filename, content, mime) {
    return saveFileUniversal(filename, content, mime);
  };
  window._origDownloadFile = _origDownloadFile; // preserved in case anything needs the raw
}
window.saveFileUniversal = saveFileUniversal;

/* --- Patch the html2pdf flow: instead of its auto .save(), produce a Blob
       and route through the bridge --- */
function patchHtml2PdfExport() {
  // extensions3.js defines exportElementToPdf(el, filename). We wrap it on first
  // call so we work with whatever version is loaded.
  if (window._pdfExportPatched) return;
  const origBinder = window.exportElementToPdf;
  if (typeof origBinder !== 'function') return;
  window.exportElementToPdf = async function (el, filename) {
    try {
      const html2pdf = await (window.loadHtml2Pdf ? window.loadHtml2Pdf() : window.html2pdf);
      const lib = html2pdf || window.html2pdf;
      if (!lib) { if (typeof toast === 'function') toast('PDF library failed to load.', 'error'); return; }
      const opt = {
        margin: 10,
        filename: filename || 'report.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };
      const worker = lib().set(opt).from(el);
      const blob = await worker.outputPdf('blob');
      await saveFileUniversal(filename || 'report.pdf', blob, 'application/pdf');
    } catch (e) {
      console.error('PDF export failed', e);
      if (typeof toast === 'function') toast('PDF export failed: ' + (e?.message || 'unknown'), 'error');
    }
  };
  window._pdfExportPatched = true;
}

/* --- Also catch any <a> with a download attribute as a last-resort fallback.
       (Belt and braces for custom code paths that build their own link.) --- */
document.addEventListener('click', function (e) {
  const a = e.target.closest && e.target.closest('a[download]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  // Only intercept inside an artifact viewer with the capability available
  if (!(window.claude && typeof window.claude.use === 'function')) return;
  if (!href.startsWith('blob:') && !href.startsWith('data:')) return;
  e.preventDefault();
  fetch(href).then(r => r.blob()).then(b => saveFileUniversal(a.download || 'download', b, b.type));
}, true);

/* --- Try patching early and also after a tick (extensions3 may define
       exportElementToPdf after this file loads in some orderings) --- */
patchHtml2PdfExport();
setTimeout(patchHtml2PdfExport, 300);
setTimeout(patchHtml2PdfExport, 1500);
document.addEventListener('DOMContentLoaded', patchHtml2PdfExport);

/* --- Visible health banner: if we detect we're inside an artifact viewer
       AND window.claude.downloads is NOT present, show a one-line hint
       below the topbar explaining why downloads might be constrained. --- */
function _detectArtifactViewer() {
  try {
    if (window.location.hostname.endsWith('claudeusercontent.com')) return true;
    if (window.parent !== window && document.referrer && /claude\.ai/i.test(document.referrer)) return true;
  } catch (_) {}
  return false;
}
function _maybeShowDownloadsHint() {
  if (document.getElementById('dl-hint')) return;
  const inArtifact = _detectArtifactViewer();
  const hasBridge = !!(window.claude && typeof window.claude.use === 'function');
  if (!inArtifact || hasBridge) return;
  const bar = document.createElement('div');
  bar.id = 'dl-hint';
  bar.style.cssText = 'background:#fef3c7;color:#78350f;padding:6px 14px;font-size:12px;border-bottom:1px solid #fde68a;text-align:center;';
  bar.innerHTML = `Downloads are limited inside the Claude artifact preview. For full download + print, open this tool on your own host (saasspendtrack.com or a subdomain). <button style="margin-left:8px;border:0;background:transparent;color:#78350f;font-weight:600;cursor:pointer" onclick="this.parentElement.remove()">dismiss</button>`;
  const top = document.querySelector('.topbar') || document.body.firstChild;
  if (top && top.parentNode) top.parentNode.insertBefore(bar, top);
}
setTimeout(_maybeShowDownloadsHint, 800);
