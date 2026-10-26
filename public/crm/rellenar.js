// Rellena las plantillas HTML de los documentos con los datos de cada firmante.
// Se usa igual en la página de firma (navegador) y al armar el PDF final (Node).

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function rellenar(html, valores = {}, firmas = {}) {
  return html
    .replace(/<campo-k k="([^"]+)" ph="([^"]*)"><\/campo-k>/g, (_, k, ph) => {
      const v = (valores[k] ?? '').toString().trim();
      return v ? `<span class="campo ok">${esc(v)}</span>` : `<span class="campo vacio">[${esc(ph)}]</span>`;
    })
    .replace(/<firma-k k="([^"]+)"><\/firma-k>/g, (_, k) =>
      firmas[k] ? `<img class="firma-img" src="${firmas[k]}" alt="Firma">` : '<span class="firma-vacia"></span>');
}

export async function sha256Hex(texto) {
  const buf = new TextEncoder().encode(texto);
  const h = await (globalThis.crypto?.subtle ?? (await import('node:crypto')).webcrypto.subtle).digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
