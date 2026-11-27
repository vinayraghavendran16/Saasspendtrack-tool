// Limits are deliberately conservative for the initial release.
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_BODY_BYTES = Math.ceil(MAX_PDF_BYTES / 3) * 4 + 256 * 1024;
export async function readExtractionInput(request) {
  const reader = request.body?.getReader();
  if (!reader) return { error: 'invalid_json', status: 400 };
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, raw = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return {error:'too_large', status:413};
      }
      raw += decoder.decode(value, {stream:true});
    }
    raw += decoder.decode();
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('shape');
    const text = body.text ?? '';
    const pdfBase64 = body.pdf_base64 ?? '';
    if (typeof text !== 'string' || typeof pdfBase64 !== 'string') throw Error('type');
    if (pdfBase64) {
      if ((body.media_type ?? 'application/pdf') !== 'application/pdf' ||
          pdfBase64.length % 4 !== 0 ||
          /[^A-Za-z0-9+/=]/.test(pdfBase64) ||
          /=/.test(pdfBase64.slice(0,-2)) ||
          !/^JVBERi0/.test(pdfBase64)) return {error:'invalid_pdf',status:400};
      const bytes = pdfBase64.length / 4 * 3 - (pdfBase64.endsWith('==') ? 2 : pdfBase64.endsWith('=') ? 1 : 0);
      if (bytes > MAX_PDF_BYTES) return {error:'too_large',status:413};
      try { atob(pdfBase64); } catch { return {error:'invalid_pdf',status:400}; }
    } else if (text.trim().length < 40) return {error:'no_input',status:400};
    return {text, pdfBase64, hasPdf: Boolean(pdfBase64), mediaType:'application/pdf'};
  } catch {
    await reader.cancel().catch(() => {});
    return {error:'invalid_json',status:400};
  } finally { reader.releaseLock(); }
}
