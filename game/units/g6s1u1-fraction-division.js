// =============================================================
//  분수의 나눗셈 (6학년 1학기 1단원) — 기초·기본 문제만
//   ① (자연수)÷(자연수)의 몫을 분수로     ② (분수)÷(자연수): 분자가 자연수의 배수
//   ③ (분수)÷(자연수): 분자가 배수가 아닐 때  ④ 분수의 곱셈으로 나타내기
//   ⑤ (대분수)÷(자연수)                   ⑥ 몫 비교하기(선택형)
//   ⑦ 문장제
//  분수 답은 기약분수로 (가분수·대분수 둘 다 정답)
// =============================================================
const K = require('./_common');
const { between, pick, shuffle, gcd, red, fr, mixed, b, C, svgOpen, lab, line } = K;

// 분수 막대 그림: d칸 중 n칸 색칠 (분자를 m묶음으로)
function barSVG(n, d, m) {
  const W = 340, x0 = 20, y0 = 40, h = 56, cw = W / d;
  let s = '';
  for (let i = 0; i < d; i++) s += `<rect x="${(x0 + i * cw).toFixed(1)}" y="${y0}" width="${cw.toFixed(1)}" height="${h}" fill="${i < n ? C.SHADE : 'rgba(0,0,0,.25)'}" stroke="${C.GOLD}" stroke-width="2"/>`;
  // 색칠한 칸을 m묶음으로 나누는 괄호
  const per = n / m;
  let g = '';
  for (let k = 0; k < m; k++) {
    const xa = x0 + k * per * cw + 3, xb = x0 + (k + 1) * per * cw - 3;
    g += `<path d="M${xa.toFixed(1)} ${y0 + h + 8} V${y0 + h + 16} H${xb.toFixed(1)} V${y0 + h + 8}" fill="none" stroke="${C.BLUE}" stroke-width="2.5"/>`;
  }
  return `${svgOpen(380, 150)}${s}${g}${lab(190, 26, `1을 ${d}칸으로 나눈 것 중 ${n}칸`, 18)}${lab(190, 142, `${m}묶음으로 똑같이 나누기`, 18, 'middle', C.BLUE)}</svg>`;
}
const frx = (n, d) => fr(n, d);      // 글 속 분수
const TYPES = ['natDiv', 'fracDivMul', 'fracDivNat', 'toMul', 'mixedDiv', 'compare', 'word'];
const TYPE_LABEL = { natDiv: '(자연수)÷(자연수)', fracDivMul: '(분수)÷(자연수)', fracDivNat: '(분수)÷(자연수)', toMul: '분수의 곱셈으로 나타내기',
  mixedDiv: '(대분수)÷(자연수)', compare: '몫 비교하기', word: '분수의 나눗셈 활용' };
const ASK = '몫을 기약분수로 나타내세요.';

// 진분수 n/d (기약) 고르기
function properFrac(dLo, dHi) { for (;;) { const d = between(dLo, dHi), n = between(1, d - 1); if (gcd(n, d) === 1) return [n, d]; } }

function makeRaw(type) {
  for (let t = 0; t < 200; t++) {
    if (type === 'natDiv') {
      if (Math.random() < 0.5) { const bb = between(2, 9), a = between(1, bb - 1);
        return { type, text: `${b(a + ' ÷ ' + bb)}의 ${ASK}`, frac: { n: a, d: bb }, meta: { a, bb } }; }
      const bb = between(2, 9), a = between(bb + 1, 20); if (a % bb === 0) continue;
      return { type, text: `${b(a + ' ÷ ' + bb)}의 ${ASK}`, frac: { n: a, d: bb }, meta: { a, bb } };
    }
    if (type === 'fracDivMul') {      // (k×m)/d ÷ m = k/d
      const m = between(2, 5), k = between(1, 4), d = between(3, 15), n = k * m;
      if (n >= d || gcd(k, d) !== 1 || gcd(n, d) !== 1) continue;
      return { type, text: `${b(frx(n, d) + ' ÷ ' + m)}의 ${ASK}`, figs: [{ svg: barSVG(n, d, m), cap: `분자 ${n}${K.J(n, '을를')} ${m}${K.RO(m)} 나누어요` }], frac: { n: k, d }, meta: { n, d, m } };
    }
    if (type === 'fracDivNat') {      // n/d ÷ m = n/(d×m), 분자가 m의 배수가 아님
      const [n, d] = properFrac(2, 9), m = between(2, 6);
      if (n % m === 0) continue;
      const improper = Math.random() < 0.3;
      if (improper) { const N = n + d * between(1, 2); if (N % m === 0 || gcd(N, d) !== 1) continue;
        return { type, text: `${b(frx(N, d) + ' ÷ ' + m)}의 ${ASK}`, frac: { n: N, d: d * m }, meta: { n: N, d, m } }; }
      return { type, text: `${b(frx(n, d) + ' ÷ ' + m)}의 ${ASK}`, frac: { n, d: d * m }, meta: { n, d, m } };
    }
    if (type === 'toMul') {
      const [n, d] = properFrac(2, 9), m = between(2, 9);
      if (Math.random() < 0.5) return { type, text: `분수의 곱셈으로 나타내려고 해요. □ 안에 알맞은 수를 구하세요.<br>${b(frx(n, d) + ' ÷ ' + m + ' = ' + frx(n, d) + ' × ' + fr(1, '□'))}`, answer100: m * 100, meta: { m } };
      return { type, text: `□ 안에 알맞은 수를 구하세요.<br>${b(frx(n, d) + ' ÷ ' + m + ' = ' + fr(n, d + ' × □'))}`, answer100: m * 100, meta: { m } };
    }
    if (type === 'mixedDiv') {        // w n/d ÷ m
      const w = between(1, 3), [n, d] = properFrac(2, 6), m = between(2, 6);
      const N = w * d + n;
      return { type, text: `${b(mixed(w, n, d) + ' ÷ ' + m)}의 ${ASK}`, frac: { n: N, d: d * m }, meta: { w, n, d, m } };
    }
    if (type === 'compare') {         // 몫이 가장 큰/작은 것 (분수 ÷ 자연수 4개)
      const items = [];
      for (let i = 0; i < 40 && items.length < 4; i++) {
        const [n, d] = properFrac(2, 9), m = between(2, 5), v = n / (d * m);
        if (items.some(x => Math.abs(x.v - v) < 1e-9)) continue;
        items.push({ n, d, m, v });
      }
      if (items.length < 4) continue;
      const big = Math.random() < 0.5, target = items.reduce((a, x) => (big ? (x.v > a.v ? x : a) : (x.v < a.v ? x : a)));
      const show = shuffle(items.slice());
      return { type, text: `몫이 가장 ${big ? '큰' : '작은'} 것을 고르세요.`, options: show.map(x => K.optText(`${fr(x.n, x.d)} ÷ ${x.m}`)), answer: show.indexOf(target), meta: { items: show, big } };
    }
    // ⑦ 문장제
    const kind = pick(['water', 'rope', 'square', 'tri', 'flour']);
    if (kind === 'water') { const [n, d] = properFrac(3, 9), m = between(2, 6); if (n % m === 0) continue;
      return { type, text: `물 ${b(frx(n, d) + ' L')}를 병 ${b(m + '개')}에 똑같이 나누어 담으려고 해요. 병 한 개에 몇 L씩 담아야 할까요?`, frac: { n, d: d * m }, unit: 'L', meta: { kind } }; }
    if (kind === 'rope') { const m = between(2, 9), a = between(1, 15); if (a % m === 0) continue;
      return { type, text: `길이가 ${b(a + ' m')}인 끈을 ${b(m + '명')}이 똑같이 나누어 가지려고 해요. 한 명이 몇 m씩 가지게 될까요?`, frac: { n: a, d: m }, unit: 'm', meta: { kind } }; }
    if (kind === 'square' || kind === 'tri') { const m = kind === 'square' ? 4 : 3, [k, d] = properFrac(2, 9), n = k * m;
      if (gcd(n, d) !== 1) continue;
      return { type, text: `둘레가 ${b(frx(n, d) + ' m')}인 ${kind === 'square' ? '정사각형' : '정삼각형'}이 있어요. 한 변의 길이는 몇 m일까요?`, frac: { n: k, d }, unit: 'm', meta: { kind } }; }
    const w = between(1, 3), [n, d] = properFrac(2, 5), m = between(2, 5);
    return { type, text: `밀가루 ${b(mixed(w, n, d) + ' kg')}을 봉지 ${b(m + '개')}에 똑같이 나누어 담으려고 해요. 한 봉지에 몇 kg씩 담아야 할까요?`, frac: { n: w * d + n, d: d * m }, unit: 'kg', meta: { kind } };
  }
  throw new Error('문제를 만들지 못했어요: ' + type);
}
const makeProblem = type => K.finish(makeRaw(type));
module.exports = { TYPES, TYPE_LABEL, makeProblem, publicProblem: K.publicOf(TYPE_LABEL), check: K.check };
