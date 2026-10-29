// Marca CDH Maker — "Lobo Circuito"
// Isotipo: lobo geométrico facetado cuyo frente lleva la "C" de circuito
// (la traza cian con nodos del logo anterior), ojos de luz cian→azul y una
// base en cubo isométrico (fabricación). Fuente única de la geometría:
// public/brand/*.svg se generan a partir de este módulo.

export const PALETA = {
  noche: '#060B14',   // fondo principal (negro azulado)
  noche2: '#0C1A2A',  // fondo secundario / superficies
  cian: '#22D3EE',    // acento eléctrico (pantalla, fondos oscuros)
  cianPapel: '#0891B2', // acento para papel / fondos claros
  ojo: '#3BA4E6',     // azul de los ojos (heredado del lobo original)
  hueso: '#EEF2F6',   // trazo claro (blanco hueso)
  tinta: '#0B1220',   // trazo sobre papel
};

let _n = 0; // contador para ids únicos de degradados

// ---------- Geometría del lobo (rejilla 100×100, eje de simetría x=50) ----------
const LOBO = {
  contorno: 'M17 3L37 25H63L83 3L89 41L96 56L84 69V81L50 97L16 81V69L4 56L11 41Z',
  facetas: [
    'M20.5 13L27 35L37 25', 'M79.5 13L73 35L63 25',      // orejas internas
    'M11 41L27 35', 'M89 41L73 35', 'M41 35H59',          // ceja
    'M59 35H73L84 69L50 82',                              // medio rostro derecho (espejo de la C)
    'M41 35L46 62', 'M59 35L54 62',                   // puente del hocico
    'M50 66V70.5M44 73.5L50 70.5L56 73.5',                // boca
    'M50 82V97',                                          // arista del cubo
  ],
  nariz: 'M44.6 62H55.4L52.4 66.2H47.6Z',
  ojos: ['M28 39.6L39.6 42.4L41.6 46.4L31.6 44.6Z', 'M72 39.6L60.4 42.4L58.4 46.4L68.4 44.6Z'],
  // La "C" de circuito: medio rostro izquierdo trazado como pista de circuito
  circuito: ['M41 35H27L16 69L50 82', 'M21.8 52H30.5'],
  nodos: [[41, 35, 2.3], [50, 82, 2.3], [30.5, 52, 2]],
};

// Versión reducida para favicon (menos facetas, trazo más grueso)
const LOBO_MINI = {
  contorno: 'M16 2L37 25H63L84 2L90 41L97 56L84 69V81L50 98L16 81V69L3 56L10 41Z',
  facetas: ['M59 35H73L84 69L50 82', 'M50 82V98'],
  nariz: 'M42 60H58L54 66H46Z',
  ojos: ['M27 39L41 42.5L43 48L31.5 45.5Z', 'M73 39L59 42.5L57 48L68.5 45.5Z'],
  circuito: ['M41 35H27L16 69L50 82'],
  nodos: [],
};

function colores(tema) {
  return tema === 'claro'
    ? { linea: PALETA.tinta, acento: PALETA.cianPapel, ojo1: PALETA.cianPapel, ojo2: '#1D6FB8' }
    : { linea: PALETA.hueso, acento: PALETA.cian, ojo1: PALETA.cian, ojo2: PALETA.ojo };
}

// Grupo SVG del lobo en coordenadas de la rejilla 100×100
function loboGrupo({ tema = 'oscuro', mini = false, trazo } = {}) {
  const c = colores(tema);
  const g = mini ? LOBO_MINI : LOBO;
  const sw = trazo ?? (mini ? 5.2 : 1.95);
  const id = `cdhOjo${++_n}`;
  const st = `<stop offset="0" stop-color="${c.ojo1}"/><stop offset="1" stop-color="${c.ojo2}"/>`;
  const grad = `<defs><linearGradient id="${id}a" x1="1" y1="0" x2="0" y2="0">${st}</linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0">${st}</linearGradient></defs>`;
  const lineas = `<g fill="none" stroke="${c.linea}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"><path d="${g.contorno}"/>${g.facetas.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  const nariz = `<path d="${g.nariz}" fill="${c.linea}"/>`;
  const ojos = g.ojos.map((d, i) => `<path d="${d}" fill="url(#${id}${i ? 'b' : 'a'})"/>`).join('');
  const swc = mini ? sw : sw * 1.1;
  const circ = `<g fill="none" stroke="${c.acento}" stroke-width="${swc}" stroke-linecap="round" stroke-linejoin="round">${g.circuito.map((d) => `<path d="${d}"/>`).join('')}</g>` +
    g.nodos.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.acento}"/>`).join('');
  return grad + lineas + circ + nariz + ojos;
}

// Isotipo cuadrado. fondo:true → ícono de app (cuadrado redondeado oscuro);
// fondo:false → solo trazo, fondo transparente (para fondos oscuros).
// opciones extra: tema ('oscuro'|'claro', solo con fondo:false), mini (versión favicon).
export const isotipo = (t = 40, { fondo = true, tema = 'oscuro', mini = false } = {}) => {
  const escala = mini ? 4.55 : 3.75;
  const tx = 256 - 50 * escala;
  const ty = 256 - 51 * escala;
  const bg = fondo && mini
    ? `<rect width="512" height="512" rx="96" fill="${PALETA.noche}"/>`
    : fondo
    ? `<rect width="512" height="512" rx="112" fill="${PALETA.noche}"/><rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="${PALETA.cian}" stroke-opacity=".16" stroke-width="3"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${t}" height="${t}" role="img" aria-label="CDH Maker">${bg}<g transform="translate(${tx} ${ty}) scale(${escala})">${loboGrupo({ tema: fondo ? 'oscuro' : tema, mini })}</g></svg>`;
};

// ---------- Logotipo: letras geométricas de trazo (altura de mayúscula 40) ----------
// Esquinas achaflanadas que repiten las facetas del lobo.
const LETRAS = {
  C: { w: 30, d: 'M30 0H10L0 10V30L10 40H30' },
  D: { w: 30, d: 'M0 0H20L30 10V30L20 40H0Z' },
  H: { w: 30, d: 'M0 0V40M30 0V40M0 20H30' },
  M: { w: 36, d: 'M0 40V0L18 20L36 0V40' },
  A: { w: 32, d: 'M0 40V10L10 0H22L32 10V40M0 25H32' },
  K: { w: 29, d: 'M0 0V40M29 0L0 25M10 16L29 40' },
  E: { w: 27, d: 'M27 0H0V40H27M0 20H21' },
  R: { w: 30, d: 'M0 40V0H21L30 9V13L21 22H0M15 22L30 40' },
};

function palabra(texto, { x = 0, tracking = 10, sw = 5, color }) {
  let cx = x;
  const partes = [];
  for (const ch of texto) {
    const L = LETRAS[ch];
    partes.push(`<path transform="translate(${cx} 0)" d="${L.d}"/>`);
    cx += L.w + tracking;
  }
  return { svg: `<g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="miter" stroke-miterlimit="4" stroke-linecap="butt">${partes.join('')}</g>`, ancho: cx - tracking - x };
}

// Logo horizontal: isotipo + "CDH MAKER" + lema.
// tema 'oscuro' para fondos oscuros, 'claro' para papel / fondos blancos.
export const logoHorizontal = ({ alto = 44, tema = 'oscuro', lema = true } = {}) => {
  const c = colores(tema);
  const gris = tema === 'claro' ? '#4A5668' : '#8FA3B8';
  // Lobo: 100 de rejilla → 120 de alto (contorno y 6..96)
  const k = 1.3;
  const lobo = `<g transform="translate(${-6 * k + 4} ${-6 * k + 8}) scale(${k})">${loboGrupo({ tema, trazo: 2.4 })}</g>`;
  const x0 = 148;
  const cdh = palabra('CDH', { x: 0, tracking: 11, sw: 6.2, color: c.linea });
  const mk = palabra('MAKER', { x: 0, tracking: 11, sw: 6.2, color: c.acento });
  const sep = 26;
  const yTxt = lema ? 28 : 44;
  const texto = `<g transform="translate(${x0} ${yTxt})">${cdh.svg}<g transform="translate(${cdh.ancho + sep} 0)">${mk.svg}</g></g>`;
  const anchoTxt = cdh.ancho + sep + mk.ancho;
  const lemaSvg = lema
    ? `<path d="M${x0} 92H${x0 + 22}" stroke="${c.acento}" stroke-width="2"/><text x="${x0 + 32}" y="96" fill="${gris}" font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif" font-size="11" font-weight="600" textLength="${anchoTxt - 32}" lengthAdjust="spacing">INGENIERÍA · SOFTWARE · FABRICACIÓN</text>`
    : '';
  const W = Math.ceil(x0 + anchoTxt + 4);
  const H = 128;
  const ancho = Math.round((alto * W) / H);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${ancho}" height="${alto}" role="img" aria-label="CDH Maker">${lobo}${texto}${lemaSvg}</svg>`;
};

export default { isotipo, logoHorizontal, PALETA };
