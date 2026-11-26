// =============================================================
//  소수의 나눗셈 (6학년 1학기 3단원: 소수 ÷ 자연수) — 기초·기본 문제만
//   ① 자연수의 나눗셈을 이용하기        ② 몫이 1보다 큰 (소수)÷(자연수)
//   ③ 몫이 1보다 작은 (소수)÷(자연수)    ④ 소수점 아래 0을 내려 계산하기
//   ⑤ 몫의 소수 첫째 자리에 0이 있는 나눗셈 ⑥ (자연수)÷(자연수)의 몫을 소수로
//   ⑦ 몫의 소수점 위치 어림하기(선택형)
//  수는 모두 100배 한 정수로 계산하고, 몫은 소수 둘째 자리 안에서 딱 떨어져요.
// =============================================================
const K = require('./_common');
const { between, pick, shuffle, dec, b } = K;

const TYPES = ['useNat', 'gt1', 'lt1', 'zeroDown', 'zeroInQuot', 'natNat', 'estimate'];
const TYPE_LABEL = { useNat: '자연수의 나눗셈 이용하기', gt1: '몫이 1보다 큰 (소수)÷(자연수)', lt1: '몫이 1보다 작은 (소수)÷(자연수)', zeroDown: '소수점 아래 0을 내려 계산하기',
  zeroInQuot: '몫에 0이 있는 나눗셈', natNat: '(자연수)÷(자연수)의 몫을 소수로', estimate: '몫의 소수점 위치 어림하기' };
const ask = (x, m) => `${b(x + ' ÷ ' + m)}의 몫을 구하세요.`;
// 문장제 (나누어지는 수 x, 나누는 수 m) — 몫이 답
const WORDS = [
  (x, m) => `길이가 ${b(x + ' m')}인 리본을 ${b(m + '명')}이 똑같이 나누어 가지려고 해요. 한 명이 몇 m씩 가지게 될까요?`,
  (x, m) => `똑같은 상자 ${b(m + '개')}의 무게가 ${b(x + ' kg')}이에요. 상자 한 개의 무게는 몇 kg일까요?`,
  (x, m) => `주스 ${b(x + ' L')}를 컵 ${b(m + '개')}에 똑같이 나누어 담으려고 해요. 컵 한 개에 몇 L씩 담아야 할까요?`,
];
const WUNIT = ['m', 'kg', 'L'];

function makeRaw(type) {
  for (let t = 0; t < 400; t++) {
    const m = between(2, 9);
    if (type === 'useNat') {           // a ÷ m = q 이용 → a/10 ÷ m, a/100 ÷ m
      const q = between(12, 99), a = q * m; if (a > 999 || a % 10 === 0) continue;   // a가 10의 배수면 a÷10이 자연수가 돼서 뺌
      const sc = pick([1, 2]);
      return { type, text: `${b(a + ' ÷ ' + m + ' = ' + q)}${K.YO(q)}. 이것을 이용하여 ${b(dec(a, sc) + ' ÷ ' + m)}의 몫을 구하세요.`, answer100: q * (sc === 1 ? 10 : 1), meta: { a, m, q, sc } };
    }
    if (type === 'gt1' || type === 'lt1') {
      // 몫 q (1/100 단위): gt1은 1.1~9.99, lt1은 0.11~0.99
      const q = type === 'gt1' ? between(110, 999) : between(11, 99);
      if (type === 'gt1' && Math.random() < 0.5 && q % 10) continue;      // 절반은 소수 한 자리 몫
      const x = q * m;                                                     // 나누어지는 수 (1/100 단위)
      if (x % 100 === 0) continue;                                          // 나누어지는 수는 소수
      if (Math.random() < 0.35) { const wi = between(0, WORDS.length - 1);
        return { type, text: WORDS[wi](dec(x, 2), m), answer100: q, unit: WUNIT[wi], meta: { x, m, word: wi } }; }
      return { type, text: ask(dec(x, 2), m), answer100: q, meta: { x, m } };
    }
    if (type === 'zeroDown') {         // 나누어지는 수는 소수 한 자리, 몫은 소수 두 자리 (예: 6.3 ÷ 2 = 3.15)
      const q = between(11, 999); if (q % 10 === 0) continue;
      const x = q * m; if (x % 10 !== 0 || x % 100 === 0) continue;
      return { type, text: ask(dec(x, 2), m), answer100: q, meta: { x, m } };
    }
    if (type === 'zeroInQuot') {       // 몫의 소수 첫째 자리가 0 (예: 6.24 ÷ 6 = 1.04)
      const q = between(1, 9) * 100 + between(1, 9);
      const x = q * m; if (x % 100 === 0) continue;
      return { type, text: ask(dec(x, 2), m), answer100: q, meta: { x, m } };
    }
    if (type === 'natNat') {           // 자연수 ÷ 자연수 → 소수 (예: 7 ÷ 4 = 1.75)
      const d = pick([2, 4, 5, 20, 25, 4, 5]), a = between(1, 40);
      if (a % d === 0 || (a * 100) % d !== 0) continue;
      return { type, text: `${b(a + ' ÷ ' + d)}의 몫을 소수로 나타내세요.`, answer100: a * 100 / d, meta: { a, d } };
    }
    // ⑦ 어림하여 소수점 위치 찾기: 보기는 같은 숫자에 소수점 위치만 다름
    const q = between(101, 999); if (q % 10 === 0) continue;        // 몫 1.01~9.99 (숫자 3개)
    const x = q * m; if (x % 100 === 0 || x >= 10000) continue;
    const digits = String(q);                                        // 예: '486'
    const opts = [dec(q, 3), dec(q, 2), dec(q, 1), digits];         // 0.486, 4.86, 48.6, 486
    const right = dec(q, 2);
    const order = shuffle(opts.slice());
    return { type, text: `어림하여 몫의 소수점 위치를 찾아보세요. ${b(dec(x, 2) + ' ÷ ' + m)}의 몫으로 알맞은 것을 고르세요.`,
      options: order.map(o => K.optText(o)), answer: order.indexOf(right), meta: { x, m, order } };
  }
  throw new Error('문제를 만들지 못했어요: ' + type);
}
const makeProblem = type => K.finish(makeRaw(type));
module.exports = { TYPES, TYPE_LABEL, makeProblem, publicProblem: K.publicOf(TYPE_LABEL), check: K.check };
