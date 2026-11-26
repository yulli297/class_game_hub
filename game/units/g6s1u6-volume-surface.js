// =============================================================
//  직육면체의 부피와 겉넓이 (6학년 1학기 6단원) — 기초·기본 문제만
//   ① 쌓기나무(1 cm³)로 부피 알아보기     ② 직육면체의 부피
//   ③ 정육면체의 부피                    ④ m³와 cm³의 관계
//   ⑤ 직육면체의 겉넓이                  ⑥ 정육면체의 겉넓이
//   ⑦ 부피로 길이 구하기(높이, 한 모서리)
// =============================================================
const K = require('./_common');
const { between, pick, b, C, svgOpen, lab, line, poly } = K;

const TYPES = ['cubes', 'volCuboid', 'volCube', 'unit', 'surfCuboid', 'surfCube', 'reverse'];
const TYPE_LABEL = { cubes: '쌓기나무로 부피 알아보기', volCuboid: '직육면체의 부피', volCube: '정육면체의 부피', unit: 'm³와 cm³의 관계',
  surfCuboid: '직육면체의 겉넓이', surfCube: '정육면체의 겉넓이', reverse: '부피로 길이 구하기' };
const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// 직육면체 겨냥도 (가로 a, 세로 b(안쪽), 높이 c). grid=true면 1 cm 눈금(쌓기나무)
function boxSVG(a, bb, c, labels, grid = false) {
  const kx = 0.62, ky = 0.42;                                   // 안쪽(세로) 방향으로 비스듬히
  const s = Math.min(210 / (a + bb * kx), 170 / (c + bb * ky), grid ? 46 : 999);
  const W = a * s, H = c * s, dx = bb * s * kx, dy = bb * s * ky;
  const x0 = (380 - (W + dx)) / 2 + (labels ? -6 : 0), y0 = 24 + dy;
  const F = [[x0, y0], [x0 + W, y0], [x0 + W, y0 + H], [x0, y0 + H]];              // 앞면
  const T = [[x0, y0], [x0 + dx, y0 - dy], [x0 + W + dx, y0 - dy], [x0 + W, y0]];   // 윗면
  const R = [[x0 + W, y0], [x0 + W + dx, y0 - dy], [x0 + W + dx, y0 + H - dy], [x0 + W, y0 + H]];   // 옆면
  let g = '';
  if (grid) {
    const ln = (cls, x1, y1, x2, y2) => `<line class="${cls}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${C.GOLD}" stroke-width="1.5"/>`;
    for (let i = 1; i < a; i++) { g += ln('fa', x0 + i * s, y0, x0 + i * s, y0 + H) + ln('ta', x0 + i * s, y0, x0 + i * s + dx, y0 - dy); }
    for (let k = 1; k < c; k++) { g += ln('fc', x0, y0 + k * s, x0 + W, y0 + k * s) + ln('rc', x0 + W, y0 + k * s, x0 + W + dx, y0 + k * s - dy); }
    for (let j = 1; j < bb; j++) { const ox = j * s * kx, oy = j * s * ky; g += ln('tb', x0 + ox, y0 - oy, x0 + W + ox, y0 - oy) + ln('rb', x0 + W + ox, y0 - oy, x0 + W + ox, y0 + H - oy); }
  } else {   // 보이지 않는 모서리 (점선)
    g += line(x0 + dx, y0 - dy + H, x0 + dx, y0 - dy, C.GOLD, 2, '6 5') + line(x0 + dx, y0 - dy + H, x0, y0 + H, C.GOLD, 2, '6 5') + line(x0 + dx, y0 - dy + H, x0 + W + dx, y0 + H - dy, C.GOLD, 2, '6 5');
  }
  let L = '';
  if (labels) {
    if (labels.a) L += lab(x0 + W / 2, y0 + H + 26, labels.a, 20);
    if (labels.b) L += lab(x0 + W + dx / 2 + 8, y0 + H - dy / 2 + 24, labels.b, 20, 'start');
    if (labels.c) L += lab(x0 - 10, y0 + H / 2 + 7, labels.c, 20, 'end');
  }
  const h = Math.ceil(y0 + H + (labels ? 40 : 14));
  return `${svgOpen(380, h)}${poly(F, C.FILL)}${poly(T, C.TOP)}${poly(R, 'rgba(209,143,44,.3)')}${g}${L}</svg>`;
}

function makeRaw(type) {
  for (let t = 0; t < 300; t++) {
    if (type === 'cubes') {
      const a = between(2, 5), bb = between(2, 4), c = between(2, 4);
      return { type, text: `부피가 ${b('1 cm³')}인 쌓기나무로 빈틈없이 쌓아 직육면체를 만들었어요. 이 직육면체의 부피는 몇 cm³일까요?`,
        figs: [{ svg: boxSVG(a, bb, c, null, true), cap: '쌓기나무 한 개의 부피는 1 cm³' }], answer100: a * bb * c * 100, unit: 'cm³', meta: { a, bb, c } };
    }
    if (type === 'volCuboid') {
      const a = between(2, 15), bb = between(2, 12), c = between(2, 12);
      return { type, text: `가로가 ${b(a + ' cm')}, 세로가 ${b(bb + ' cm')}, 높이가 ${b(c + ' cm')}인 직육면체의 부피는 몇 cm³일까요?`,
        figs: [{ svg: boxSVG(a, bb, c, { a: `${a} cm`, b: `${bb} cm`, c: `${c} cm` }), cap: '직육면체의 부피 = 가로 × 세로 × 높이' }], answer100: a * bb * c * 100, unit: 'cm³', meta: { a, bb, c } };
    }
    if (type === 'volCube') {
      const a = between(2, 12);
      return { type, text: `한 모서리의 길이가 ${b(a + ' cm')}인 정육면체의 부피는 몇 cm³일까요?`,
        figs: [{ svg: boxSVG(a, a, a, { a: `${a} cm` }), cap: '정육면체의 부피 = 한 모서리 × 한 모서리 × 한 모서리' }], answer100: a * a * a * 100, unit: 'cm³', meta: { a } };
    }
    if (type === 'unit') {
      const v = pick(['m2c', 'm2c', 'c2m', 'box']);
      if (v === 'm2c') { const m10 = pick([between(1, 9) * 10, between(1, 9) * 10, between(1, 9)]);   // 1~9 m³ 또는 0.1~0.9 m³
        const m = m10 % 10 === 0 ? m10 / 10 : m10 / 10;
        return { type, text: `${b(K.dec(m10, 1) + ' m³')}는 몇 cm³일까요?`, answer100: m10 * 100000 * 100, unit: 'cm³', meta: { m } }; }
      if (v === 'c2m') { const m = between(1, 9);
        return { type, text: `${b(comma(m * 1000000) + ' cm³')}는 몇 m³일까요?`, answer100: m * 100, unit: 'm³', meta: { m } }; }
      const a = between(1, 5), bb = between(1, 4), c = between(1, 3);
      return { type, text: `가로가 ${b(a * 100 + ' cm')}, 세로가 ${b(bb * 100 + ' cm')}, 높이가 ${b(c * 100 + ' cm')}인 직육면체의 부피는 몇 m³일까요?`,
        figs: [{ svg: boxSVG(a, bb, c, { a: `${a * 100} cm`, b: `${bb * 100} cm`, c: `${c * 100} cm` }), cap: '100 cm = 1 m' }], answer100: a * bb * c * 100, unit: 'm³', meta: { a, bb, c } };
    }
    if (type === 'surfCuboid') {
      const a = between(2, 12), bb = between(2, 10), c = between(2, 10);
      return { type, text: `가로가 ${b(a + ' cm')}, 세로가 ${b(bb + ' cm')}, 높이가 ${b(c + ' cm')}인 직육면체의 겉넓이는 몇 cm²일까요?`,
        figs: [{ svg: boxSVG(a, bb, c, { a: `${a} cm`, b: `${bb} cm`, c: `${c} cm` }), cap: '여섯 면의 넓이를 모두 더해요' }], answer100: 2 * (a * bb + bb * c + c * a) * 100, unit: 'cm²', meta: { a, bb, c } };
    }
    if (type === 'surfCube') {
      const a = between(2, 12);
      if (Math.random() < 0.3) return { type, text: `겉넓이가 ${b(6 * a * a + ' cm²')}인 정육면체의 한 모서리의 길이는 몇 cm일까요?`,
        figs: [{ svg: boxSVG(3, 3, 3, { a: '?' }), cap: '정육면체의 여섯 면은 모두 합동인 정사각형' }], answer100: a * 100, unit: 'cm', meta: { a } };
      return { type, text: `한 모서리의 길이가 ${b(a + ' cm')}인 정육면체의 겉넓이는 몇 cm²일까요?`,
        figs: [{ svg: boxSVG(a, a, a, { a: `${a} cm` }), cap: '정육면체의 겉넓이 = 한 면의 넓이 × 6' }], answer100: 6 * a * a * 100, unit: 'cm²', meta: { a } };
    }
    // ⑦ 부피로 길이 구하기
    if (Math.random() < 0.6) {
      const a = between(2, 12), bb = between(2, 10), c = between(2, 12);
      return { type, text: `부피가 ${b(a * bb * c + ' cm³')}인 직육면체가 있어요. 가로가 ${b(a + ' cm')}, 세로가 ${b(bb + ' cm')}일 때 높이는 몇 cm일까요?`,
        figs: [{ svg: boxSVG(a, bb, c, { a: `${a} cm`, b: `${bb} cm`, c: '?' }), cap: '높이 = 부피 ÷ (가로 × 세로)' }], answer100: c * 100, unit: 'cm', meta: { a, bb, c } };
    }
    const a = between(2, 10);
    return { type, text: `부피가 ${b(a * a * a + ' cm³')}인 정육면체의 한 모서리의 길이는 몇 cm일까요?`,
      figs: [{ svg: boxSVG(3, 3, 3, { a: '?' }), cap: '같은 수를 세 번 곱해 보아요' }], answer100: a * 100, unit: 'cm', meta: { a } };
  }
  throw new Error('문제를 만들지 못했어요: ' + type);
}
const makeProblem = type => K.finish(makeRaw(type));
module.exports = { TYPES, TYPE_LABEL, makeProblem, publicProblem: K.publicOf(TYPE_LABEL), check: K.check };
