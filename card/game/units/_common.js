// =============================================================
//  단원 파일들이 같이 쓰는 도구 (계산, 글자, 그림, 채점)
//  · 소수는 100배 한 정수(1/100 단위)로 계산해서 계산 오차가 없어요.
//  · 분수 답은 {n, d}(기약분수)로 저장하고, 학생은 자연수·분자·분모 칸에 써요.
// =============================================================
const rnd = n => Math.floor(Math.random() * n);
const between = (a, b) => a + rnd(b - a + 1);
const pick = arr => arr[rnd(arr.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => a / gcd(a, b) * b;

// 정수 v를 10^sc로 나눈 값 → 글자 (끝의 0은 지움) 예) dec(1405, 2) = '14.05', dec(320, 2) = '3.2'
function dec(v, sc = 2) {
  const neg = v < 0; let s = String(Math.abs(v));
  if (sc > 0) { s = s.padStart(sc + 1, '0'); const ip = s.slice(0, -sc), fp = s.slice(-sc).replace(/0+$/, ''); s = fp ? ip + '.' + fp : ip; }
  return (neg ? '-' : '') + s;
}
const h2s = v => dec(v, 2);

// ---------- 분수 ----------
const red = (n, d) => { const g = gcd(n, d); return { n: n / g, d: d / g }; };      // 약분
// 글(HTML)용 분수: fr(3, 4) → 3/4 위아래, mixed(2, 1, 3) → 2와 1/3
const fr = (n, d) => `<span class="fr"><i>${n}</i><i>${d}</i></span>`;
const mixed = (w, n, d) => (w ? `${w}` : '') + (n ? fr(n, d) : '');
// 가분수 n/d를 대분수 글로 (자연수면 자연수만)
function frText(n, d, asMixed = true) {
  const r = red(n, d);
  if (r.d === 1) return String(r.n);
  if (!asMixed || r.n < r.d) return fr(r.n, r.d);
  return mixed(Math.floor(r.n / r.d), r.n % r.d, r.d);
}
// 분수 정답 → 'w|n|d' (기약분수, 대분수 꼴) — 테스트에서 정답으로 그대로 보낼 수 있는 형식
function fracKey(n, d) {
  const r = red(n, d);
  if (r.d === 1) return `${r.n}||`;
  return r.n > r.d ? `${Math.floor(r.n / r.d)}|${r.n % r.d}|${r.d}` : `|${r.n}|${r.d}`;
}

// ---------- 조사 (숫자·낱말 끝 받침에 맞춰) ----------
function hasBatchim(word) {
  const w = String(word).replace(/<[^>]+>/g, '').trim();
  const m = w.match(/(\d+)(?:\.(\d+))?$/);
  if (m) {   // 숫자는 읽는 소리로
    if (m[2]) return '013678'.includes(m[2].slice(-1));
    const n = Number(m[1]);
    if (n === 0) return true;
    if (n % 10) return [1, 3, 6, 7, 8].includes(n % 10);
    if (n % 10000) return true;              // 십·백·천
    return false;                            // 만
  }
  const c = w.charCodeAt(w.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  if (/[a-zA-Z]$/.test(w)) return /[lmnr]$/i.test(w);
  return false;
}
// J('사과', '을를') → '를' 처럼 조사만 돌려줌
const J = (w, pair) => (hasBatchim(w) ? pair[0] : pair[1]);
const Jw = (w, pair) => w + J(w, pair);       // 낱말 + 조사
const YO = w => (hasBatchim(w) ? '이에요' : '예요');   // 26이에요 / 25예요
// 로/으로: 받침이 없거나 ㄹ 받침(숫자 1·7·8, '...길')이면 '로'
function RO(word) {
  const w = String(word).replace(/<[^>]+>/g, '').trim(), m = w.match(/(\d+)(?:\.(\d+))?$/);
  if (m) { const last = m[2] ? m[2].slice(-1) : String(Number(m[1]) % 10 || ''); if (['1', '7', '8'].includes(last)) return '로'; }
  else { const c = w.charCodeAt(w.length - 1); if (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 8) return '로'; }
  return hasBatchim(w) ? '으로' : '로';
}

// ---------- 글 꾸미기 ----------
const b = s => `<b>${s}</b>`;
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- 그림(SVG) ----------
const FONT = "Jua,'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const C = { GOLD: '#F2B84B', LIGHT: '#FBE3A6', BLUE: '#7fb3ff', ORANGE: '#D18F2C', DARK: '#140f0a', FILL: 'rgba(242,184,75,.22)', TOP: 'rgba(242,184,75,.38)', SHADE: 'rgba(242,184,75,.6)' };
const svgOpen = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}" font-weight="700">`;
const lab = (x, y, t, fs = 22, anchor = 'middle', color) => `<text x="${+(+x).toFixed(1)}" y="${+(+y).toFixed(1)}" font-size="${fs}" text-anchor="${anchor}" fill="${color || (String(t).includes('?') ? C.BLUE : C.LIGHT)}">${xml(t)}</text>`;
const line = (x1, y1, x2, y2, color = C.GOLD, w = 3, dash = '') => `<line x1="${+(+x1).toFixed(1)}" y1="${+(+y1).toFixed(1)}" x2="${+(+x2).toFixed(1)}" y2="${+(+y2).toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const P = pts => pts.map(p => `${+p[0].toFixed(1)} ${+p[1].toFixed(1)}`).join(' L');
const poly = (pts, fill = C.FILL, stroke = C.GOLD, w = 3, extra = '') => `<path d="M${P(pts)} Z" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;
// 분수 그림 글자 (가운데 x, 분수선 y)
const fracSVG = (x, y, n, d, fs = 24, color = C.LIGHT) => `<text x="${x}" y="${y - 6}" font-size="${fs}" text-anchor="middle" fill="${color}">${n}</text>${line(x - fs * 0.55, y, x + fs * 0.55, y, color, 2.5)}<text x="${x}" y="${y + fs * 0.95}" font-size="${fs}" text-anchor="middle" fill="${color}">${d}</text>`;

// ---------- 선택형 보기 ----------
const optText = s => `<span class="otext sm">${s}</span>`;
// 맞는 것 1개 + 틀린 것 3개 → { options, answer }
function choice(right, wrongs, fmt = optText) {
  const ws = shuffle(wrongs.slice()).filter((w, i, a) => w !== right && a.indexOf(w) === i).slice(0, 3);
  const all = shuffle([right, ...ws]);
  return { options: all.map(fmt), answer: all.indexOf(right), meta: { all, right } };
}

// ---------- 채점 ----------
// 숫자 답: p.answer100 (1/100 단위 정수). 단위(cm, %, 명 등)를 같이 써도 인정
function numCheck(p, value) {
  const v = String(value ?? '').replace(/,/g, '').replace(/\s/g, '').replace(/[^\d.]+$/, '');
  if (!/^\d*\.?\d+$/.test(v)) return false;
  return Math.round(Number(v) * 1000) === p.answer100 * 10;
}
// 분수 답: p.frac = {n, d} (기약분수). 학생 답 'w|n|d' 또는 '3/4', '2 1/3', '5'
// 기약분수로 써야 정답 (가분수·대분수는 둘 다 인정)
function parseFrac(value) {
  let s = String(value ?? '').trim();
  let w = '', n = '', d = '';
  if (s.includes('|')) [w, n, d] = s.split('|').map(x => x.trim());
  else { const m = s.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/); if (m) { w = m[1] || ''; n = m[2]; d = m[3]; } else w = s; }
  if (![w, n, d].every(x => x === '' || /^\d+$/.test(x))) return null;
  if ((n === '') !== (d === '')) return null;              // 분자·분모는 둘 다 쓰거나 둘 다 비우기
  if (w === '' && n === '') return null;
  const W = w === '' ? 0 : Number(w);
  if (n === '') return { n: W, d: 1, reduced: true };
  const N = Number(n), D = Number(d);
  if (D === 0 || N === 0) return null;
  if (w !== '' && N >= D) return null;                     // 대분수의 분수 부분은 진분수
  return { n: W * D + N, d: D, reduced: gcd(N, D) === 1 };
}
function fracCheck(p, value) {
  const f = parseFrac(value); if (!f || !f.reduced) return false;
  return f.n * p.frac.d === p.frac.n * f.d;
}
function check(p, value) {
  if (p.options) return String(value).trim() !== '' && Number(value) === p.answer;
  if (p.frac) return fracCheck(p, value);
  return numCheck(p, value);
}
// 정답 정리: answer100 또는 frac을 보고 answer(테스트·디버그용)를 채움
function finish(p) {
  if (p.frac) { p.frac = red(p.frac.n, p.frac.d); p.answer = fracKey(p.frac.n, p.frac.d); p.input = 'frac'; }
  else if (p.answer100 !== undefined) p.answer = Number(h2s(p.answer100));
  return p;
}
// 학생에게 보낼 내용 (정답·meta 빼고)
const publicOf = labels => p => ({ id: p.id, type: p.type, label: labels[p.type], text: p.text, figs: p.figs || [], options: p.options || null, unit: p.unit || '', input: p.input || null });

module.exports = { rnd, between, pick, shuffle, gcd, lcm, dec, h2s, red, fr, mixed, frText, fracKey, hasBatchim, J, Jw, YO, RO, b, xml,
  FONT, C, svgOpen, lab, line, P, poly, fracSVG, optText, choice, numCheck, parseFrac, fracCheck, check, finish, publicOf };
