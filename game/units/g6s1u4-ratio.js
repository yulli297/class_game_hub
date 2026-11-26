// =============================================================
//  비와 비율 (6학년 1학기 4단원) — 기초·기본 문제만
//   ① 두 수 비교하기(뺄셈·나눗셈)        ② 비 알아보기(기준량·비교하는 양, 비 고르기)
//   ③ 비율을 분수로                      ④ 비율을 소수로
//   ⑤ 백분율로 나타내기                  ⑥ 백분율을 소수·분수로
//   ⑦ 비율이 쓰이는 경우(속력, 인구 밀도, 할인율, 소금물, 성공률)
// =============================================================
const K = require('./_common');
const { between, pick, shuffle, gcd, dec, fr, b } = K;

const TYPES = ['compare', 'ratio', 'toFrac', 'toDec', 'toPct', 'fromPct', 'use'];
const TYPE_LABEL = { compare: '두 수 비교하기', ratio: '비 알아보기', toFrac: '비율을 분수로', toDec: '비율을 소수로', toPct: '백분율로 나타내기',
  fromPct: '백분율을 소수·분수로', use: '비율이 쓰이는 경우' };
const DEN = [2, 4, 5, 10, 20, 25, 50];      // 소수 둘째 자리 안에서 딱 떨어지는 기준량

function makeRaw(type) {
  for (let t = 0; t < 300; t++) {
    if (type === 'compare') {
      const bb = between(2, 12), k = between(2, 6), a = bb * k;
      const [x, y, u] = pick([['사과', '귤', '개'], ['남학생', '여학생', '명'], ['연필', '지우개', '개'], ['의자', '책상', '개']]);
      if (Math.random() < 0.3) return { type, text: `${x} ${b(a + u)}${K.J(u, '과와')} ${y} ${b(bb + u)}${K.J(u, '을를')} 뺄셈으로 비교하려고 해요. ${K.Jw(x, '은는')} ${y}보다 몇 ${u} 더 많을까요?`, answer100: (a - bb) * 100, unit: u, meta: { a, bb } };
      return { type, text: `${x} ${b(a + u)}${K.J(u, '과와')} ${y} ${b(bb + u)}${K.J(u, '을를')} 나눗셈으로 비교하려고 해요. ${x} 수는 ${y} 수의 몇 배일까요?`, answer100: k * 100, unit: '배', meta: { a, bb } };
    }
    if (type === 'ratio') {
      const a = between(1, 15), bb = between(2, 15); if (a === bb) continue;
      const v = Math.random();
      if (v < 0.25) return { type, text: `비 ${b(a + ' : ' + bb)}에서 ${b('기준량')}은 얼마일까요?`, answer100: bb * 100, meta: { a, bb } };
      if (v < 0.5) return { type, text: `비 ${b(a + ' : ' + bb)}에서 ${b('비교하는 양')}은 얼마일까요?`, answer100: a * 100, meta: { a, bb } };
      // a를 비교하는 양, bb를 기준량으로 하는 여러 가지 말 → 비 고르기
      const say = pick([`${K.Jw(a, '과와')} ${bb}의 비`, `${a}의 ${bb}에 대한 비`, `${bb}에 대한 ${a}의 비`, `${a} 대 ${bb}`]);
      if (a + bb === a || a + bb === bb) continue;
      const c = K.choice(`${a} : ${bb}`, [`${bb} : ${a}`, `${a} : ${a + bb}`, `${bb} : ${a + bb}`]);
      return { type, text: `${b(say)}${K.J(say, '을를')} 비로 바르게 나타낸 것을 고르세요.`, ...c, meta: { a, bb, say } };
    }
    if (type === 'toFrac') {            // 비율 = 비교하는 양 ÷ 기준량 (기약분수)
      const bb = between(2, 20), a = between(1, bb - 1);
      if (gcd(a, bb) === 1 && Math.random() < 0.4) continue;           // 약분이 필요한 문제를 조금 더 많이
      return { type, text: `비 ${b(a + ' : ' + bb)}의 비율을 기약분수로 나타내세요.`, frac: { n: a, d: bb }, meta: { a, bb } };
    }
    if (type === 'toDec') {
      const bb = pick(DEN), a = between(1, bb * 2); if (a % bb === 0) continue;
      if (Math.random() < 0.5) return { type, text: `비 ${b(a + ' : ' + bb)}의 비율을 소수로 나타내세요.`, answer100: a * 100 / bb, meta: { a, bb } };
      return { type, text: `${b(bb + '에 대한 ' + a + '의 비')}의 비율을 소수로 나타내세요.`, answer100: a * 100 / bb, meta: { a, bb } };
    }
    if (type === 'toPct') {
      const v = pick(['frac', 'dec', 'ratio', 'people']);
      if (v === 'frac') { const bb = pick(DEN), a = between(1, bb - 1); if (gcd(a, bb) !== 1) continue;
        return { type, text: `비율 ${b(fr(a, bb))}${K.J(a, '을를')} 백분율로 나타내면 몇 %일까요?`, answer100: a * 100 / bb * 100, unit: '%', meta: { a, bb } }; }
      if (v === 'dec') { const p = between(1, 150); if (p % 100 === 0) continue;
        return { type, text: `비율 ${b(dec(p, 2))}${K.J(dec(p, 2), '을를')} 백분율로 나타내면 몇 %일까요?`, answer100: p * 100, unit: '%', meta: { p } }; }
      if (v === 'ratio') { const bb = pick(DEN), a = between(1, bb); if (a === bb) continue;
        return { type, text: `비 ${b(a + ' : ' + bb)}의 비율을 백분율로 나타내면 몇 %일까요?`, answer100: a * 100 / bb * 100, unit: '%', meta: { a, bb } }; }
      const bb = pick([20, 25, 50, 200, 300, 400, 500]), a = between(1, bb - 1); if ((a * 100) % bb) continue;
      return { type, text: `우리 학교 학생 ${b(bb + '명')} 중에서 ${b(a + '명')}이 안경을 썼어요. 전체 학생 수에 대한 안경을 쓴 학생 수의 비율은 몇 %일까요?`, answer100: a * 100 / bb * 100, unit: '%', meta: { a, bb } };
    }
    if (type === 'fromPct') {
      const p = between(1, 99);
      if (Math.random() < 0.5) return { type, text: `${b(p + '%')}를 소수로 나타내세요.`, answer100: p, meta: { p } };
      if (p % 5 && Math.random() < 0.7) continue;                       // 분수는 5의 배수 %를 주로
      return { type, text: `${b(p + '%')}를 기약분수로 나타내세요.`, frac: { n: p, d: 100 }, meta: { p } };
    }
    // ⑦ 비율이 쓰이는 경우
    const v = pick(['speed', 'density', 'sale', 'salt', 'shoot']);
    if (v === 'speed') { const h = between(2, 5), k = between(4, 12) * 10, d = h * k;
      return { type, text: `자동차가 ${b(d + ' km')}를 가는 데 ${b(h + '시간')}이 걸렸어요. 걸린 시간에 대한 간 거리의 비율을 구하세요.`, answer100: k * 100, meta: { v } }; }
    if (v === 'density') { const A = between(2, 9), k = between(10, 90) * 10, P = A * k;
      return { type, text: `넓이가 ${b(A + ' km²')}인 마을에 ${b(P + '명')}이 살아요. 넓이에 대한 인구의 비율을 구하세요.`, answer100: k * 100, meta: { v } }; }
    if (v === 'sale') { const X = pick([2000, 4000, 5000, 8000, 10000, 20000]), r = pick([10, 20, 25, 30, 40, 50]), Y = X * (100 - r) / 100;
      if (!Number.isInteger(Y)) continue;
      return { type, text: `정가가 ${b(X + '원')}인 물건을 할인하여 ${b(Y + '원')}에 샀어요. 이 물건의 할인율은 몇 %일까요?`, answer100: r * 100, unit: '%', meta: { v } }; }
    if (v === 'salt') { const W = pick([100, 200, 250, 300, 400, 500]), r = between(2, 20), s = W * r / 100;
      if (!Number.isInteger(s)) continue;
      return { type, text: `소금 ${b(s + ' g')}을 물에 녹여 소금물 ${b(W + ' g')}을 만들었어요. 소금물 양에 대한 소금 양의 비율은 몇 %일까요?`, answer100: r * 100, unit: '%', meta: { v } }; }
    const n = pick([10, 20, 25, 50]), k = between(1, n - 1); if ((k * 100) % n) continue;
    return { type, text: `농구 시합에서 슛을 ${b(n + '번')} 던져서 ${b(k + '번')} 넣었어요. 던진 슛 수에 대한 넣은 슛 수의 비율은 몇 %일까요?`, answer100: k * 100 / n * 100, unit: '%', meta: { v } };
  }
  throw new Error('문제를 만들지 못했어요: ' + type);
}
const makeProblem = type => K.finish(makeRaw(type));
module.exports = { TYPES, TYPE_LABEL, makeProblem, publicProblem: K.publicOf(TYPE_LABEL), check: K.check };
