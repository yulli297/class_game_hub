// =============================================================
//  비례식과 비례배분 문제 자동 생성 (6학년 2학기)
//  서버에서만 실행 → 정답은 학생 화면에 가지 않음
//
//  수학 농장 차시에 맞춘 7가지 유형
//   ① 비의 구성(전항·후항, 외항·내항)   ② 비의 성질
//   ③ 간단한 자연수의 비               ④ 비례식 찾기(선택형)
//   ⑤ 비례식의 성질로 □ 구하기          ⑥ 비례식 활용 문장제
//   ⑦ 비례배분
//  입력칸에는 숫자만 쓸 수 있어서, 비로 답하는 문제는 "3 : □"처럼 빈칸 하나만 채우게 했어요.
//  정답은 모두 자연수(일부는 소수 첫째 자리)로 딱 떨어지게 만들어요.
//  (소수의 나눗셈 단원은 g6s2u2-decimal-division.js)
// =============================================================
const rnd = n => Math.floor(Math.random() * n);
const between = (a, b) => a + rnd(b - a + 1);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = arr => arr[rnd(arr.length)];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => a / gcd(a, b) * b;

// 정수 v를 10^sc로 나눈 값을 문자열로 (끝의 0은 지움) 예) dec(14,1)='1.4', dec(20,1)='2'
function dec(v, sc) {
  let s = String(Math.abs(v));
  if (sc > 0) {
    s = s.padStart(sc + 1, '0');
    const ip = s.slice(0, s.length - sc), fp = s.slice(s.length - sc).replace(/0+$/, '');
    s = fp ? ip + '.' + fp : ip;
  }
  return (v < 0 ? '-' : '') + s;
}
// 서로소인 두 수 (같지 않게)
function coprime(lo, hi) {
  for (;;) { const p = between(lo, hi), q = between(lo, hi); if (p !== q && gcd(p, q) === 1) return [p, q]; }
}

// ---------- 수 표시 ----------
// 항은 {t:'n', v:'3'} 또는 {t:'f', n:2, d:3} (분수)
const N = v => ({ t: 'n', v: String(v) });
const F = (n, d) => ({ t: 'f', n, d });
const Q = { t: 'q' };                                  // 빈칸 □
const fr = (n, d) => `<span class="fr"><i>${n}</i><i>${d}</i></span>`;
const h = x => (x.t === 'f' ? fr(x.n, x.d) : x.t === 'q' ? '□' : x.v);       // 문제 글(HTML)용
const ratioH = (a, b) => `${h(a)} : ${h(b)}`;
const b = s => `<b>${s}</b>`;

// ---------- 그림(SVG) ----------
const FONT = "Jua,'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const GOLD = '#F2B84B', LIGHT = '#FBE3A6', BLUE = '#7fb3ff', DARK = '#3b2a0b', ORANGE = '#D18F2C';
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let svgSeq = 0;
const arrowDef = () => { const id = 'ah' + (++svgSeq); return { id, def: `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${BLUE}"/></marker></defs>` }; };

// 항 하나를 (x, y)를 가운데로 그림. 분수는 위아래로, □는 파란 점선 상자
function termSVG(x, y, t, fs = 40, color = LIGHT) {
  if (t.t === 'q') return `<rect x="${x - 30}" y="${y - fs * 0.85}" width="60" height="${fs * 1.15}" rx="6" fill="none" stroke="${BLUE}" stroke-width="3" stroke-dasharray="6 5"/><text x="${x}" y="${y}" font-size="${fs * 0.9}" text-anchor="middle" fill="${BLUE}">?</text>`;
  if (t.t === 'f') {
    const s = fs * 0.72, w = Math.max(String(t.n).length, String(t.d).length) * s * 0.6 + 14;
    return `<text x="${x}" y="${y - s * 0.62}" font-size="${s}" text-anchor="middle" fill="${color}">${t.n}</text>
<line x1="${x - w / 2}" y1="${y - s * 0.38}" x2="${x + w / 2}" y2="${y - s * 0.38}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
<text x="${x}" y="${y + s * 0.62}" font-size="${s}" text-anchor="middle" fill="${color}">${t.d}</text>`;
  }
  const f = Math.min(fs, Math.floor(150 / Math.max(2, t.v.length * 0.62)));
  return `<text x="${x}" y="${y}" font-size="${f}" text-anchor="middle" fill="${color}">${xml(t.v)}</text>`;
}
const svgOpen = (w, hgt) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" font-family="${FONT}" font-weight="700">`;

// 비 두 개를 위아래로 두고 같은 수를 곱하거나 나누는 화살표 (비의 성질, 간단한 자연수의 비)
function ratioPairSVG(top, bottom, op) {
  const a = arrowDef(), y1 = 64, y2 = 206;
  return `${svgOpen(360, 236)}${a.def}
${termSVG(95, y1, top[0])}<text x="180" y="${y1}" font-size="40" text-anchor="middle" fill="${GOLD}">:</text>${termSVG(265, y1, top[1])}
<line x1="95" y1="${y1 + 24}" x2="95" y2="${y2 - 60}" stroke="${BLUE}" stroke-width="3" marker-end="url(#${a.id})"/>
<line x1="265" y1="${y1 + 24}" x2="265" y2="${y2 - 60}" stroke="${BLUE}" stroke-width="3" marker-end="url(#${a.id})"/>
<text x="107" y="${(y1 + y2) / 2}" font-size="24" fill="${BLUE}">${xml(op)}</text><text x="277" y="${(y1 + y2) / 2}" font-size="24" fill="${BLUE}">${xml(op)}</text>
${termSVG(95, y2, bottom[0])}<text x="180" y="${y2}" font-size="40" text-anchor="middle" fill="${GOLD}">:</text>${termSVG(265, y2, bottom[1])}</svg>`;
}
// 비례식 a : b = c : d 와 외항(바깥)·내항(안쪽) 묶음 표시
function crossSVG(t, showWords = true) {
  const xs = [46, 140, 244, 338], y = 128;
  return `${svgOpen(384, 214)}
${t.map((v, i) => termSVG(xs[i], y, v, 34)).join('')}
<text x="93" y="${y}" font-size="32" text-anchor="middle" fill="${GOLD}">:</text><text x="192" y="${y}" font-size="32" text-anchor="middle" fill="${GOLD}">=</text><text x="291" y="${y}" font-size="32" text-anchor="middle" fill="${GOLD}">:</text>
<path d="M46 ${y - 44} V${y - 70} H338 V${y - 44}" fill="none" stroke="${ORANGE}" stroke-width="3" stroke-linejoin="round"/>
<path d="M140 ${y + 26} V${y + 48} H244 V${y + 26}" fill="none" stroke="${BLUE}" stroke-width="3" stroke-linejoin="round"/>
${showWords ? `<text x="192" y="${y - 80}" font-size="20" text-anchor="middle" fill="${ORANGE}">외항의 곱</text>
<text x="192" y="${y + 74}" font-size="20" text-anchor="middle" fill="${BLUE}">내항의 곱</text>` : ''}</svg>`;
}
// 두 줄 표 (비례식 활용)
function tableSVG(heads, row1, row2) {
  const cx = [110, 270];
  const cellR = (v, x, y) => (v === '?' ? termSVG(x, y, Q, 32) : `<text x="${x}" y="${y}" font-size="28" text-anchor="middle" fill="${LIGHT}">${xml(v)}</text>`);
  return `${svgOpen(380, 210)}
<rect x="30" y="20" width="320" height="170" rx="10" fill="none" stroke="${LIGHT}" stroke-width="2.5"/>
<line x1="30" y1="70" x2="350" y2="70" stroke="${LIGHT}" stroke-width="2"/><line x1="30" y1="130" x2="350" y2="130" stroke="${LIGHT}" stroke-width="1.5" stroke-dasharray="6 5"/>
<line x1="190" y1="20" x2="190" y2="190" stroke="${LIGHT}" stroke-width="2"/>
${heads.map((t, i) => `<text x="${cx[i]}" y="54" font-size="${t.length > 6 ? 19 : 23}" text-anchor="middle" fill="${GOLD}">${xml(t)}</text>`).join('')}
${row1.map((v, i) => cellR(v, cx[i], 112)).join('')}${row2.map((v, i) => cellR(v, cx[i], 172)).join('')}</svg>`;
}
// 비례배분 막대 그림: p칸과 q칸
function barSVG(names, p, q, total, ask) {
  const n = p + q, W = 320, cw = W / n, x0 = 30;
  let cells = '';
  for (let i = 0; i < n; i++) cells += `<rect x="${x0 + i * cw}" y="78" width="${cw}" height="52" fill="${i < p ? GOLD : ORANGE}" stroke="#5a3d10" stroke-width="2"/>`;
  const mid1 = x0 + p * cw / 2, mid2 = x0 + p * cw + q * cw / 2;
  const cl = x => Math.max(78, Math.min(302, x));
  const lab = (x, nm, k, isAsk) => `<text x="${cl(x)}" y="166" font-size="19" text-anchor="middle" fill="${isAsk ? BLUE : LIGHT}">${xml(nm)} ${k}칸</text>${isAsk ? `<text x="${cl(x)}" y="194" font-size="24" text-anchor="middle" fill="${BLUE}">?</text>` : ''}`;
  return `${svgOpen(380, 204)}
<text x="190" y="36" font-size="24" text-anchor="middle" fill="${total === '?' ? BLUE : LIGHT}">전체 ${xml(total)}</text>
<path d="M30 50 V58 H350 V50" fill="none" stroke="${LIGHT}" stroke-width="3" stroke-linejoin="round"/>
${cells}
<path d="M${x0 + 2} 140 V146 H${x0 + p * cw - 2} V140 M${x0 + p * cw + 2} 140 V146 H${x0 + W - 2} V140" fill="none" stroke="${LIGHT}" stroke-width="2"/>
${lab(mid1, names[0], p, ask === 0)}${lab(mid2, names[1], q, ask === 1)}</svg>`;
}

// ---------- 문제 유형 ----------
const TYPES = ['parts', 'property', 'simplify', 'find', 'solve', 'apply', 'distribute'];
const TYPE_LABEL = { parts: '전항·후항, 외항·내항', property: '비의 성질', simplify: '간단한 자연수의 비', find: '비례식 찾기',
  solve: '비례식의 성질', apply: '비례식 활용', distribute: '비례배분' };

// ③ 간단한 자연수의 비로 나타낼 비 만들기 → { a, b(항), p, q(답이 되는 서로소 비) }
function genSimplify() {
  for (;;) {
    const kind = pick(['dec', 'dec', 'frac', 'frac', 'mix', 'nat']);
    if (kind === 'nat') {                       // 24 : 36 → 2 : 3
      const [p, q] = coprime(1, 9), k = between(4, 12);
      if (p * k > 99 || q * k > 99) continue;
      return { kind, a: N(p * k), b: N(q * k), p, q };
    }
    if (kind === 'dec') {                       // 0.6 : 1.4 → 3 : 7 (가끔 소수 둘째 자리)
      const [p, q] = coprime(1, 9), sc = Math.random() < 0.75 ? 1 : 2, m = between(1, sc === 1 ? 9 : 25);
      const A = p * m, B = q * m;
      if (A % P10(sc) === 0 && B % P10(sc) === 0) continue;   // 둘 다 자연수면 다시
      if (A / P10(sc) > 20 || B / P10(sc) > 20) continue;
      if (sc === 2 && A % 10 === 0 && B % 10 === 0) continue;   // 실제로 둘째 자리가 있어야 함
      return { kind, a: N(dec(A, sc)), b: N(dec(B, sc)), p, q };
    }
    if (kind === 'frac') {                      // 2/3 : 3/4 → 8 : 9
      const d1 = between(2, 9), d2 = between(2, 9); if (d1 === d2) continue;
      const n1 = between(1, d1 - 1), n2 = between(1, d2 - 1);
      if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) continue;
      const L = lcm(d1, d2); let p = n1 * L / d1, q = n2 * L / d2; const g = gcd(p, q); p /= g; q /= g;
      if (p === q || p > 30 || q > 30) continue;
      return { kind, a: F(n1, d1), b: F(n2, d2), p, q };
    }
    // mix: 0.4 : 3/5 → 2 : 3 (소수와 분수)
    const dv = between(2, 9), nv = between(1, dv - 1); if (gcd(nv, dv) !== 1) continue;
    const t = between(1, 19); if (t % 10 === 0) continue;            // 소수 t/10
    let p = t * dv, q = nv * 10; const g = gcd(p, q); p /= g; q /= g;
    if (p === q || p > 30 || q > 30) continue;
    return Math.random() < 0.5 ? { kind, a: N(dec(t, 1)), b: F(nv, dv), p, q } : { kind, a: F(nv, dv), b: N(dec(t, 1)), p: q, q: p };
  }
}
const P10 = k => Math.pow(10, k);

// ---------- 조사 (숫자·이름 끝 받침에 맞춰 와/과, 을/를, 은/는, 이/가) ----------
function hasBatchim(word) {
  const w = String(word).trim();
  const m = w.match(/(\d+)(?:\.(\d+))?$/);
  if (m) {   // 숫자는 읽는 소리로: 소수면 마지막 숫자, 자연수면 끝자리(0이면 십·백·천)
    const digits = m[2] || m[1];
    if (m[2]) return '013678'.includes(digits.slice(-1));
    const n = Number(m[1]);
    if (n === 0) return true;
    if (n % 10) return [1, 3, 6, 7, 8].includes(n % 10);
    if (n % 100) return true;                 // 십(ㅂ)
    if (n % 1000) return true;                // 백(ㄱ)
    if (n % 10000) return true;               // 천(ㄴ)
    return false;                             // 만
  }
  const c = w.charCodeAt(w.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  return false;
}
const J = (word, pair) => word + (hasBatchim(word) ? pair[0] : pair[1]);   // J('형', '과와') → '형과'
// 로/으로: 받침이 있으면 '으로' (단, ㄹ 받침인 1·7·8은 '로')
function ro(word) {
  const w = String(word).trim(), m = w.match(/(\d+)(?:\.(\d+))?$/);
  if (m && !m[2] && Number(m[1]) % 10 && [1, 7, 8].includes(Number(m[1]) % 10)) return w + '로';
  if (m && m[2] && '178'.includes(m[2].slice(-1))) return w + '로';
  return w + (hasBatchim(w) ? '으로' : '로');
}
const lastNum = x => (x.t === 'f' ? String(x.n) : x.v);

const APPLY = [   // [두 양의 이름], 비 p:q 에서 알려준 값 → 모르는 값
  () => { const [p, q] = coprime(1, 6), t = between(2, 12) * 10;
    return { text: `매실 주스를 만들 때 매실 원액과 물을 ${b(p + ' : ' + q)}${ro(q).slice(String(q).length)} 섞어요. 매실 원액을 ${b(p * t + ' mL')} 넣으면 물은 몇 mL 넣어야 할까요?`, heads: ['원액(mL)', '물(mL)'], r1: [p, q], r2: [p * t, '?'], answer: q * t, unit: 'mL' }; },
  () => { const [p, q] = coprime(1, 5), t = between(2, 8);
    return { text: `밥을 지을 때 쌀과 물을 ${b(p + ' : ' + q)}의 비로 넣어요. 쌀을 ${b(p * t + '컵')} 넣으면 물은 몇 컵 넣어야 할까요?`, heads: ['쌀(컵)', '물(컵)'], r1: [p, q], r2: [p * t, '?'], answer: q * t, unit: '컵' }; },
  () => { const h1 = between(2, 4), sp = between(4, 9) * 10; let h2 = between(2, 7); if (h2 === h1) h2++;
    return { text: `자동차가 일정한 빠르기로 ${b(h1 + '시간')}에 ${b(h1 * sp + ' km')}를 가요. 같은 빠르기로 ${b(h2 + '시간')} 동안 가면 몇 km를 갈까요?`, heads: ['시간', '거리(km)'], r1: [h1, h1 * sp], r2: [h2, '?'], answer: h2 * sp, unit: 'km' }; },
  () => { const n1 = between(2, 5), pr = between(5, 15) * 100; let n2 = between(3, 9); if (n2 === n1) n2++;
    return { text: `공책 ${b(n1 + '권')}의 값이 ${b(n1 * pr + '원')}이에요. 같은 공책 ${b(n2 + '권')}을 사려면 얼마가 필요할까요?`, heads: ['공책(권)', '값(원)'], r1: [n1, n1 * pr], r2: [n2, '?'], answer: n2 * pr, unit: '원' }; },
  () => { const [p, q] = coprime(2, 9), t = between(2, 9);
    return { text: `가로와 세로의 비가 ${b(p + ' : ' + q)}인 직사각형 모양 액자를 만들려고 해요. 가로를 ${b(p * t + ' cm')}로 하면 세로는 몇 cm로 해야 할까요?`, heads: ['가로(cm)', '세로(cm)'], r1: [p, q], r2: [p * t, '?'], answer: q * t, unit: 'cm' }; },
  () => { const [p, q] = coprime(1, 5), t = between(2, 9);
    return { text: `같은 시각에 길이가 ${b(p + ' m')}인 막대의 그림자 길이는 ${b(q + ' m')}예요. 그림자 길이가 ${b(q * t + ' m')}인 나무의 높이는 몇 m일까요?`, heads: ['물체 높이(m)', '그림자(m)'], r1: [p, q], r2: ['?', q * t], answer: p * t, unit: 'm' }; },
];
const SHARE = [   // 비례배분 상황: [이름 두 개, 물건, 단위, 묶음 크기]
  { names: ['형', '동생'], thing: '구슬', u: '개', step: 1 },
  { names: ['지우', '민서'], thing: '사탕', u: '개', step: 1 },
  { names: ['가 모둠', '나 모둠'], thing: '색종이', u: '장', step: 1 },
  { names: ['언니', '오빠'], thing: '용돈', u: '원', step: 100 },
  { names: ['1반', '2반'], thing: '공책', u: '권', step: 1 },
];

function makeProblem(type) {
  for (let attempt = 0; attempt < 60; attempt++) {
    // ① 전항·후항, 외항·내항
    if (type === 'parts') {
      const [p, q] = coprime(2, 9), k = between(2, 6);
      const t = [p, q, p * k, q * k];
      if (new Set(t).size < 4) continue;
      const ask = pick(['front', 'back', 'outer', 'inner', 'outerMul', 'innerMul']);
      if (ask === 'front' || ask === 'back') {
        const [x, y] = Math.random() < 0.5 ? [p, q] : [p * k, q * k];
        return { type, text: `비 ${b(x + ' : ' + y)}에서 ${ask === 'front' ? '전항' : '후항'}은 얼마일까요?`, figs: [], answer: ask === 'front' ? x : y, unit: '', meta: { x, y, ask } };
      }
      const eq = `${p} : ${q} = ${p * k} : ${q * k}`;
      if (ask === 'outer') return { type, text: `비례식 ${b(eq)}에서 외항은 ${b(p)}${hasBatchim(String(p)) ? '과' : '와'} □예요. □는 얼마일까요?`, figs: [], answer: q * k, unit: '', meta: { t, ask } };
      if (ask === 'inner') return { type, text: `비례식 ${b(eq)}에서 내항은 ${b(q)}${hasBatchim(String(q)) ? '과' : '와'} □예요. □는 얼마일까요?`, figs: [], answer: p * k, unit: '', meta: { t, ask } };
      const outer = ask === 'outerMul';
      return { type, text: `비례식 ${b(eq)}에서 ${outer ? '외항' : '내항'}의 곱은 얼마일까요?`,
        figs: [{ svg: crossSVG(t.map(N), false), cap: '바깥쪽 두 수는 외항, 안쪽 두 수는 내항' }], answer: p * q * k, unit: '', meta: { t, ask } };
    }
    // ② 비의 성질: 전항과 후항에 0이 아닌 같은 수를 곱하거나 나누어도 비율은 같아요
    if (type === 'property') {
      const [p, q] = coprime(1, 9), k = between(2, 9);
      if (p * k > 81 || q * k > 81) continue;
      const mul = Math.random() < 0.55, blankFront = Math.random() < 0.5;
      const small = [N(p), N(q)], big = [N(p * k), N(q * k)];
      // 곱하기: p : q = pk : □   /  나누기: pk : qk = p : □
      const [top, bottom] = mul ? [small, big] : [big, small];
      const shown = bottom.slice(); shown[blankFront ? 0 : 1] = Q;
      const ans = Number(bottom[blankFront ? 0 : 1].v);
      return { type, text: `비의 성질을 이용하여 □ 안에 알맞은 수를 구하세요. ${b(ratioH(top[0], top[1]) + ' = ' + ratioH(shown[0], shown[1]))}`,
        figs: [{ svg: ratioPairSVG(top, shown, mul ? '× ?' : '÷ ?'), cap: `전항과 후항에 같은 수를 ${mul ? '곱해요' : '나누어요'}` }], answer: ans, unit: '', meta: { p, q, k, mul } };
    }
    // ③ 간단한 자연수의 비로 나타내기
    if (type === 'simplify') {
      const g = genSimplify(), blankFront = Math.random() < 0.3;
      const ansShown = blankFront ? `□ : ${g.q}` : `${g.p} : □`;
      const hint = { dec: '소수는 10, 100을 곱해요', frac: '분모의 공배수를 곱해요', mix: '분수를 소수로, 또는 소수를 분수로 바꿔요', nat: '두 수의 공약수로 나누어요' }[g.kind];
      return { type, text: `${b(ratioH(g.a, g.b))}${hasBatchim(lastNum(g.b)) ? '을' : '를'} 가장 간단한 자연수의 비로 나타내려고 해요. □ 안에 알맞은 수를 구하세요.<br>${b(ratioH(g.a, g.b) + ' = ' + ansShown)}`,
        figs: [{ svg: ratioPairSVG([g.a, g.b], blankFront ? [Q, N(g.q)] : [N(g.p), Q], g.kind === 'nat' ? '÷ ?' : '× ?'), cap: hint }], answer: blankFront ? g.p : g.q, unit: '', meta: g };
    }
    // ④ 비례식 찾기 (선택형)
    if (type === 'find') {
      const [p, q] = coprime(2, 9), k = between(2, 5);
      if (p * k + k > 60 || q * k + k > 60) continue;
      const right = `${p} : ${q} = ${p * k} : ${q * k}`;
      const wrongs = shuffle([
        `${p} : ${q} = ${q * k} : ${p * k}`,                 // 앞뒤를 바꿈
        `${p} : ${q} = ${p + k} : ${q + k}`,                 // 같은 수를 더함
        `${p} : ${q} = ${p * k} : ${q * k + 1}`,             // 하나만 다름
        `${p} : ${q} = ${p * k} : ${q * (k + 1)}`,           // 서로 다른 수를 곱함
      ]).slice(0, 3);
      if (new Set([right, ...wrongs]).size < 4) continue;
      const ask = Math.random() < 0.5;
      const list = ask
        ? shuffle([right, ...wrongs])
        : null;
      if (ask) return { type, text: `다음 중 비례식을 고르세요.`, figs: [], options: list.map(o => `<span class="otext sm">${o}</span>`), answer: list.indexOf(right), meta: { list, right } };
      // 비율이 같은 비 고르기
      const base = `${p * 2} : ${q * 2}`;
      const ok = `${p * (k + 2)} : ${q * (k + 2)}`;
      const ws = shuffle([`${q * (k + 2)} : ${p * (k + 2)}`, `${p * 2 + 3} : ${q * 2 + 3}`, `${p * (k + 2)} : ${q * (k + 2) + 2}`, `${p + 1} : ${q + 1}`]).slice(0, 3);
      const opts = shuffle([ok, ...ws]);
      if (new Set(opts).size < 4 || opts.includes(base)) continue;
      return { type, text: `${b(base)}${hasBatchim(base) ? '과' : '와'} 비율이 같은 비를 고르세요.`, figs: [], options: opts.map(o => `<span class="otext sm">${o}</span>`), answer: opts.indexOf(ok), meta: { base, ok } };
    }
    // ⑤ 비례식의 성질 (외항의 곱 = 내항의 곱)으로 □ 구하기
    if (type === 'solve') {
      const kind = pick(['nat', 'nat', 'dec', 'frac']);
      let t, blank;
      if (kind === 'nat') {                       // 4 : 6 = 10 : □ 처럼 곱하는 수가 자연수가 아니도록
        const [p, q] = coprime(2, 9), m1 = between(1, 4), m2 = between(2, 9);
        if (m2 % m1 === 0 || p * m2 > 70 || q * m2 > 70) continue;
        t = [p * m1, q * m1, p * m2, q * m2].map(N); blank = between(0, 3);
      } else if (kind === 'dec') {                // 2.5 : 4 = 10 : □
        const [p, q] = coprime(2, 9), m1 = pick([1, 3, 5, 7, 9]), m2 = between(2, 8);
        const A = p * m1, B = q * m1;               // ÷10 해서 소수로
        if (A % 10 === 0 && B % 10 === 0) continue;
        if (p * m2 > 70 || q * m2 > 70) continue;
        t = [N(dec(A, 1)), N(dec(B, 1)), N(p * m2), N(q * m2)]; blank = between(2, 3);
      } else {                                    // 1/2 : 3 = □ : 18   (u/v × d = n × c)
        const v = between(2, 5), u = between(1, v - 1); if (gcd(u, v) !== 1) continue;
        const n = between(2, 6), c = between(2, 9) * u, d = c * v * n / u;
        if (d > 90) continue;
        t = [F(u, v), N(n), N(c), N(d)]; blank = between(2, 3);
      }
      const ans = Number(t[blank].v);
      const shown = t.slice(); shown[blank] = Q;
      return { type, text: `비례식의 성질을 이용하여 □ 안에 알맞은 수를 구하세요. ${b(ratioH(shown[0], shown[1]) + ' = ' + ratioH(shown[2], shown[3]))}`,
        figs: [{ svg: crossSVG(shown), cap: '외항의 곱과 내항의 곱은 같아요' }], answer: ans, unit: '', meta: { kind, blank } };
    }
    // ⑥ 비례식 활용 문장제
    if (type === 'apply') {
      const s = pick(APPLY)();
      return { type, text: s.text, figs: [{ svg: tableSVG(s.heads, s.r1.map(String), s.r2.map(String)), cap: '비례식을 세워 보아요' }], answer: s.answer, unit: s.unit, meta: s };
    }
    // ⑦ 비례배분
    if (type === 'distribute') {
      const sit = pick(SHARE), [p, q] = coprime(1, 9);
      if (p + q > 12) continue;
      const t = between(2, sit.step > 1 ? 9 : 12) * sit.step, total = (p + q) * t;
      if (total > (sit.step > 1 ? 10000 : 120)) continue;
      const [n1, n2] = sit.names, thingU = `${sit.thing}`;
      const reverse = Math.random() < 0.3;
      if (reverse) {                              // 한 사람 몫을 알 때 전체 구하기
        const who = rnd(2), share = who === 0 ? p * t : q * t;
        const giver = who === 0 ? n1 : n2;
        return { type, text: `${J(n1, '과와')} ${J(n2, '이가')} ${J(thingU, '을를')} ${b(p + ' : ' + q)}${ro(q).slice(String(q).length)} 나누어 가졌더니 ${J(giver, '이가')} ${b(share + sit.u)}${hasBatchim(sit.u) ? '을' : '를'} 가졌어요. 처음 ${J(thingU, '은는')} 모두 몇 ${sit.u}${hasBatchim(sit.u) ? '이었' : '였'}을까요?`,
          figs: [{ svg: barSVG([n1, n2], p, q, '?', -1), cap: `${who === 0 ? n1 : n2} ${who === 0 ? p : q}칸이 ${share}${sit.u}` }], answer: total, unit: sit.u, meta: { p, q, t, reverse } };
      }
      const ask = rnd(2);
      const who2 = ask === 0 ? n1 : n2;
      return { type, text: `${thingU} ${b(total + sit.u)}${hasBatchim(sit.u) ? '을' : '를'} ${J(n1, '과와')} ${J(n2, '이가')} ${b(p + ' : ' + q)}${ro(q).slice(String(q).length)} 나누어 가지려고 해요. ${J(who2, '은는')} 몇 ${sit.u}${hasBatchim(sit.u) ? '을' : '를'} 가질까요?`,
        figs: [{ svg: barSVG([n1, n2], p, q, total + sit.u, ask), cap: `전체를 ${p + q}칸으로 나누어요` }], answer: ask === 0 ? p * t : q * t, unit: sit.u, meta: { p, q, t } };
    }
  }
  return makeProblem('property');
}

// 학생마다 유형 주머니를 섞어서 차례로 꺼냄 → 일곱 유형이 골고루 나옴
function nextProblem(student) {
  if (!student.typeBag || !student.typeBag.length) student.typeBag = shuffle(TYPES.slice());
  return makeProblem(student.typeBag.pop());
}
// 학생에게 보낼 때는 정답과 meta를 뺀다
const publicProblem = p => ({ id: p.id, type: p.type, label: TYPE_LABEL[p.type], text: p.text, figs: p.figs, options: p.options || null, unit: p.unit || '' });
function check(p, value) {
  if (p.options) return String(value ?? '').trim() !== '' && Number(value) === p.answer;
  const v = String(value ?? '').replace(/,/g, '').replace(/\s/g, '').replace(/[^\d.]+$/, '');   // 단위를 같이 써도 인정
  if (!/^\d*\.?\d+$/.test(v)) return false;           // 숫자와 소수점 하나만
  return Math.abs(Number(v) - p.answer) < 1e-9;
}

module.exports = { nextProblem, publicProblem, check, TYPES, makeProblem };
