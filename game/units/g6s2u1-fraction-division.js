// =============================================================
//  분수의 나눗셈 (6학년 2학기 1단원: 분수 ÷ 분수) — 기초·기본 문제만
//   ① 분모가 같은 (분수)÷(분수)        ② 분모가 다른 (분수)÷(분수)
//   ③ (자연수)÷(분수)                 ④ 분수의 곱셈으로 나타내기
//   ⑤ 대분수가 있는 나눗셈             ⑥ 몫 비교하기(선택형)
//   ⑦ 문장제
//  분수 답은 기약분수로 (가분수·대분수 둘 다 정답)
// =============================================================
const K = require('./_common');
const { between, pick, shuffle, gcd, fr, mixed, b } = K;

const TYPES = ['sameDen', 'diffDen', 'natByFrac', 'toMul', 'mixedDiv', 'compare', 'word'];
const TYPE_LABEL = { sameDen: '분모가 같은 (분수)÷(분수)', diffDen: '분모가 다른 (분수)÷(분수)', natByFrac: '(자연수)÷(분수)', toMul: '분수의 곱셈으로 나타내기',
  mixedDiv: '대분수의 나눗셈', compare: '몫 비교하기', word: '분수의 나눗셈 활용' };
const ASK = '몫을 기약분수로 나타내세요.';
function properFrac(dLo, dHi) { for (;;) { const d = between(dLo, dHi), n = between(1, d - 1); if (gcd(n, d) === 1) return [n, d]; } }

function makeRaw(type) {
  for (let t = 0; t < 300; t++) {
    if (type === 'sameDen') {         // a/d ÷ c/d = a ÷ c
      const d = between(3, 13), a = between(1, d - 1), c = between(1, d - 1);
      if (a === c || gcd(a, d) !== 1 || gcd(c, d) !== 1) continue;
      const ask = a % c === 0 ? '몫을 구하세요.' : ASK;
      return { type, text: `${b(fr(a, d) + ' ÷ ' + fr(c, d))}의 ${ask}`, frac: { n: a, d: c }, meta: { a, c, d } };
    }
    if (type === 'diffDen') {         // a/b ÷ c/d
      const [a, bb] = properFrac(2, 9), [c, d] = properFrac(2, 9);
      if (bb === d) continue;
      return { type, text: `${b(fr(a, bb) + ' ÷ ' + fr(c, d))}의 ${ASK}`, frac: { n: a * d, d: bb * c }, meta: { a, bb, c, d } };
    }
    if (type === 'natByFrac') {       // n ÷ a/b, n은 a의 배수 → 자연수 답
      const [a, bb] = properFrac(2, 9), n = a * between(1, 5);
      if (n > 30) continue;
      return { type, text: `${b(n + ' ÷ ' + fr(a, bb))}의 몫을 구하세요.`, answer100: n / a * bb * 100, meta: { n, a, bb } };
    }
    if (type === 'toMul') {           // a/b ÷ c/d = a/b × d/c
      const [a, bb] = properFrac(2, 9), [c, d] = properFrac(2, 9);
      if (c === 1 && Math.random() < 0.7) continue;
      const askD = Math.random() < 0.6;
      return { type, text: `분수의 곱셈으로 나타내려고 해요. □ 안에 알맞은 수를 구하세요.<br>${b(fr(a, bb) + ' ÷ ' + fr(c, d) + ' = ' + fr(a, bb) + ' × ' + (askD ? fr('□', c) : fr(d, '□')))}`, answer100: (askD ? d : c) * 100, meta: { askD } };
    }
    if (type === 'mixedDiv') {        // 대분수 ÷ 분수, 분수 ÷ 대분수, 대분수 ÷ 대분수
      const kind = pick(['m/f', 'm/f', 'f/m', 'm/m']);
      const w1 = between(1, 3), [n1, d1] = properFrac(2, 6), [n2, d2] = properFrac(2, 6), w2 = between(1, 2);
      const A = kind === 'f/m' ? [n1, d1] : [w1 * d1 + n1, d1], B = kind === 'm/f' ? [n2, d2] : [w2 * d2 + n2, d2];
      const ta = kind === 'f/m' ? fr(n1, d1) : mixed(w1, n1, d1), tb = kind === 'm/f' ? fr(n2, d2) : mixed(w2, n2, d2);
      return { type, text: `${b(ta + ' ÷ ' + tb)}의 ${ASK}`, frac: { n: A[0] * B[1], d: A[1] * B[0] }, meta: { kind } };
    }
    if (type === 'compare') {         // 몫이 1보다 큰 것 / 가장 큰 것
      const items = [];
      for (let i = 0; i < 60 && items.length < 4; i++) {
        const [a, bb] = properFrac(2, 9), [c, d] = properFrac(2, 9), v = (a * d) / (bb * c);
        if (Math.abs(v - 1) < 1e-9 || items.some(x => Math.abs(x.v - v) < 1e-9)) continue;
        items.push({ a, bb, c, d, v });
      }
      if (items.length < 4) continue;
      const over1 = items.filter(x => x.v > 1);
      if (Math.random() < 0.5) {
        if (over1.length !== 1) continue;
        const show = shuffle(items.slice());
        return { type, text: '몫이 1보다 큰 것을 고르세요.', options: show.map(x => K.optText(`${fr(x.a, x.bb)} ÷ ${fr(x.c, x.d)}`)), answer: show.indexOf(over1[0]), meta: { items: show } };
      }
      const target = items.reduce((p, x) => (x.v > p.v ? x : p)), show = shuffle(items.slice());
      return { type, text: '몫이 가장 큰 것을 고르세요.', options: show.map(x => K.optText(`${fr(x.a, x.bb)} ÷ ${fr(x.c, x.d)}`)), answer: show.indexOf(target), meta: { items: show } };
    }
    // ⑦ 문장제
    const kind = pick(['walk', 'steel', 'bottle', 'rect']);
    if (kind === 'walk') { const [a, bb] = properFrac(2, 6), [c, d] = properFrac(2, 9); if (bb === d) continue;
      return { type, text: `민수는 ${b(fr(a, bb) + '시간')} 동안 ${b(fr(c, d) + ' km')}를 걸었어요. 같은 빠르기로 1시간 동안 걸으면 몇 km를 걸을 수 있을까요?`, frac: { n: c * bb, d: d * a }, unit: 'km', meta: { kind } }; }
    if (kind === 'steel') { const [a, bb] = properFrac(2, 9), [c, d] = properFrac(2, 9); if (bb === d) continue;
      return { type, text: `철근 ${b(fr(a, bb) + ' m')}의 무게가 ${b(fr(c, d) + ' kg')}이에요. 이 철근 1 m의 무게는 몇 kg일까요?`, frac: { n: c * bb, d: d * a }, unit: 'kg', meta: { kind } }; }
    if (kind === 'bottle') { const [a, bb] = properFrac(2, 9), n = a * between(1, 4); if (n > 12) continue;
      return { type, text: `물 ${b(n + ' L')}를 한 병에 ${b(fr(a, bb) + ' L')}씩 나누어 담으려고 해요. 병은 몇 개 필요할까요?`, answer100: n / a * bb * 100, unit: '개', meta: { kind } }; }
    const [a, bb] = properFrac(2, 9), [c, d] = properFrac(2, 9); if (bb === d) continue;
    return { type, text: `넓이가 ${b(fr(c, d) + ' m²')}인 직사각형이 있어요. 가로가 ${b(fr(a, bb) + ' m')}일 때 세로는 몇 m일까요?`, frac: { n: c * bb, d: d * a }, unit: 'm', meta: { kind } };
  }
  throw new Error('문제를 만들지 못했어요: ' + type);
}
const makeProblem = type => K.finish(makeRaw(type));
module.exports = { TYPES, TYPE_LABEL, makeProblem, publicProblem: K.publicOf(TYPE_LABEL), check: K.check };
