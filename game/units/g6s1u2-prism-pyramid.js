// =============================================================
//  각기둥과 각뿔 (6학년 1학기 2단원) — 기초·기본 문제만
//   ① 각기둥·각뿔 찾기(그림 고르기)       ② 이름 알아보기(그림 보고 고르기)
//   ③ 각기둥의 구성 요소 수               ④ 각뿔의 구성 요소 수
//   ⑤ 구성 요소 수로 거꾸로 구하기         ⑥ 각기둥·각뿔의 성질(옳은 설명 고르기)
//   ⑦ 각기둥의 전개도
//  n각기둥: 꼭짓점 2n, 면 n+2, 모서리 3n / n각뿔: 꼭짓점 n+1, 면 n+1, 모서리 2n
// =============================================================
const K = require('./_common');
const { between, pick, shuffle, b, C, svgOpen, lab, xml } = K;

const NUMKO = { 3: '삼', 4: '사', 5: '오', 6: '육', 7: '칠', 8: '팔', 9: '구', 10: '십' };
const pname = n => `${NUMKO[n]}각기둥`, yname = n => `${NUMKO[n]}각뿔`;
const TYPES = ['identify', 'name', 'countPrism', 'countPyramid', 'reverse', 'facts', 'net'];
const TYPE_LABEL = { identify: '각기둥·각뿔 찾기', name: '각기둥·각뿔의 이름', countPrism: '각기둥의 구성 요소', countPyramid: '각뿔의 구성 요소',
  reverse: '구성 요소의 수로 알아보기', facts: '각기둥·각뿔의 성질', net: '각기둥의 전개도' };

// ---------- 입체도형 그림 ----------
// 밑면 정n각형을 비스듬히 본 모습. kind: 'prism' | 'pyramid' | 'frustum'(각뿔대: 문제에서 '아닌 것'으로만 씀)
function solidSVG(kind, n, size = 160) {
  const k = size / 160, cx = 80 * k, R = 60 * k, r = 21 * k, yb = 124 * k, yt = 46 * k;
  let th0 = Math.PI / 2 + 0.35;
  const front = a => Math.sin(a) > 0;
  const V = [];
  for (let i = 0; i < n; i++) { const a = th0 + 2 * Math.PI * i / n; V.push({ a, x: cx + R * Math.cos(a), y: yb + r * Math.sin(a) }); }
  const mid = i => th0 + 2 * Math.PI * (i + 0.5) / n;
  const edgeFront = i => front(mid(i));                         // 밑면의 변 i (V[i]–V[i+1])
  const vVisible = i => edgeFront(i) || edgeFront((i - 1 + n) % n);
  const S = `stroke="${C.GOLD}" stroke-width="${2.6 * k}" stroke-linecap="round"`;
  const E = (p, q, vis) => `<line class="e" x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" ${S}${vis ? '' : ` stroke-dasharray="${5 * k} ${4 * k}"`}/>`;
  const B = V.map(v => [v.x, v.y]);
  let fill = '', edges = '';
  if (kind === 'pyramid') {
    const A = [cx, 18 * k];
    const sil = B.slice().sort((p, q) => p[0] - q[0]);
    fill = `<path d="M${A[0]} ${A[1]} L${sil[0][0].toFixed(1)} ${sil[0][1].toFixed(1)} L${B.filter((_, i) => vVisible(i)).sort((p, q) => p[0] - q[0]).map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} L${sil[n - 1][0].toFixed(1)} ${sil[n - 1][1].toFixed(1)} Z" fill="${C.FILL}"/>`;
    for (let i = 0; i < n; i++) edges += E(B[i], B[(i + 1) % n], edgeFront(i)) + E(A, B[i], vVisible(i));
  } else {
    const sc = kind === 'frustum' ? 0.5 : 1;
    const T = V.map(v => [cx + (v.x - cx) * sc, yt + (v.y - yb) * sc]);
    fill = `<path d="M${T.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} Z" fill="${C.TOP}"/>`;
    for (let i = 0; i < n; i++) if (edgeFront(i)) fill += `<path d="M${T[i][0].toFixed(1)} ${T[i][1].toFixed(1)} L${T[(i + 1) % n][0].toFixed(1)} ${T[(i + 1) % n][1].toFixed(1)} L${B[(i + 1) % n][0].toFixed(1)} ${B[(i + 1) % n][1].toFixed(1)} L${B[i][0].toFixed(1)} ${B[i][1].toFixed(1)} Z" fill="${C.FILL}"/>`;
    for (let i = 0; i < n; i++) edges += E(T[i], T[(i + 1) % n], true) + E(B[i], B[(i + 1) % n], edgeFront(i)) + E(T[i], B[i], vVisible(i));
  }
  return `${svgOpen(Math.round(160 * k), Math.round(160 * k))}${fill}${edges}</svg>`;
}
// 원기둥·원뿔 (보기용)
function roundSVG(kind) {
  const S = `stroke="${C.GOLD}" stroke-width="2.6"`, D = 'stroke-dasharray="5 4"';
  if (kind === 'cylinder') return `${svgOpen(160, 160)}<path d="M30 34 L30 128 A50 14 0 0 0 130 128 L130 34 Z" fill="${C.FILL}" ${S}/><ellipse cx="80" cy="34" rx="50" ry="14" fill="${C.TOP}" ${S}/><path d="M30 128 A50 14 0 0 1 130 128" fill="none" ${S} ${D}/></svg>`;
  return `${svgOpen(160, 160)}<path d="M25 128 L80 18 L135 128 A55 15 0 0 1 25 128 Z" fill="${C.FILL}" ${S}/><path d="M25 128 A55 15 0 0 1 135 128" fill="none" ${S} ${D}/></svg>`;
}
// 각기둥의 전개도: 옆면 직사각형 n개 + 위·아래 밑면(정n각형)
function netSVG(n, aLab, hLab) {
  const w = Math.min(46, 300 / n), h = 70, x0 = (380 - n * w) / 2, y0 = 92;
  let s = '';
  for (let i = 0; i < n; i++) s += `<rect class="side" x="${(x0 + i * w).toFixed(1)}" y="${y0}" width="${w.toFixed(1)}" height="${h}" fill="${C.FILL}" stroke="${C.GOLD}" stroke-width="2"/>`;
  // 정n각형을 첫째 옆면의 위·아래 변에 붙여 그림
  const polyOn = (xa, xb, y, up) => {
    const pts = [[xa, y], [xb, y]];                                    // 변을 따라 돌며 꼭짓점 만들기
    let [px, py] = [xb, y], dir = up ? -1 : 1;
    let heading = 0;                                                   // 처음 방향: 오른쪽
    for (let k = 0; k < n - 2; k++) { heading += dir * 2 * Math.PI / n; px += w * Math.cos(heading); py += w * Math.sin(heading) * 1; pts.push([px, py]); }
    return `<path class="base" d="M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} Z" fill="${C.TOP}" stroke="${C.GOLD}" stroke-width="2"/>`;
  };
  const xi = x0 + Math.floor((n - 1) / 2) * w;
  s += polyOn(xi, xi + w, y0, true) + polyOn(xi, xi + w, y0 + h, false);
  if (aLab) s += lab(x0 + w / 2, y0 + h + 22, aLab, 17);
  if (hLab) s += lab(x0 + n * w + 8, y0 + h / 2 + 6, hLab, 17, 'start');
  return `${svgOpen(380, 254)}${s}</svg>`;
}

// ---------- 옳은 설명 ----------
const FACTS = {
  prism: { name: '각기둥',
    t: ['두 밑면은 서로 평행하고 합동인 다각형이에요.', '옆면은 모두 직사각형이에요.', '두 밑면 사이의 거리를 높이라고 해요.', '밑면의 모양에 따라 이름이 정해져요.'],
    f: ['밑면이 1개예요.', '옆면은 모두 삼각형이에요.', '두 밑면의 크기가 서로 달라요.', '꼭짓점의 수는 밑면의 변의 수와 같아요.', '옆면은 굽은 면이에요.'] },
  pyramid: { name: '각뿔',
    t: ['밑면은 1개예요.', '옆면은 모두 삼각형이에요.', '옆면이 모두 만나는 점을 각뿔의 꼭짓점이라고 해요.', '밑면의 모양에 따라 이름이 정해져요.'],
    f: ['밑면이 2개예요.', '옆면은 모두 직사각형이에요.', '옆면의 수는 밑면의 변의 수보다 1 많아요.', '모서리의 수는 밑면의 변의 수와 같아요.', '두 밑면은 서로 평행해요.'] },
};
const PART = { v: '꼭짓점', f: '면', e: '모서리' };
const prismCount = (n, w) => ({ v: 2 * n, f: n + 2, e: 3 * n }[w]);
const pyrCount = (n, w) => ({ v: n + 1, f: n + 1, e: 2 * n }[w]);

function makeRaw(type) {
  for (let t = 0; t < 300; t++) {
    if (type === 'identify') {
      const target = pick(['prism', 'pyramid']), n = between(3, 6);
      const pool = target === 'prism'
        ? [['pyramid', between(3, 6)], ['frustum', between(3, 6)], ['cylinder'], ['cone']]
        : [['prism', between(3, 6)], ['frustum', between(3, 6)], ['cylinder'], ['cone']];
      const kinds = shuffle([[target, n], ...shuffle(pool).slice(0, 3)]);
      const svgOf = ([kd, m]) => (kd === 'cylinder' || kd === 'cone' ? roundSVG(kd) : solidSVG(kd, m));
      return { type, text: `다음 중 ${b(target === 'prism' ? '각기둥' : '각뿔')}${K.J(target === 'prism' ? '각기둥' : '각뿔', '을를')} 고르세요.`, figs: [], options: kinds.map(svgOf),
        answer: kinds.findIndex(x => x[0] === target), meta: { kinds } };
    }
    if (type === 'name') {
      const isPrism = Math.random() < 0.5, n = between(3, 6);
      const right = isPrism ? pname(n) : yname(n);
      const wrong = [isPrism ? yname(n) : pname(n), isPrism ? pname(n + 1) : yname(n + 1), isPrism ? pname(n === 3 ? 5 : n - 1) : yname(n === 3 ? 5 : n - 1)];
      const c = K.choice(right, wrong);
      return { type, text: '입체도형의 이름을 고르세요.', figs: [{ svg: solidSVG(isPrism ? 'prism' : 'pyramid', n, 230), cap: '밑면의 모양을 살펴보아요' }], ...c };
    }
    if (type === 'countPrism' || type === 'countPyramid') {
      const n = between(3, 10), w = pick(['v', 'f', 'e']), isP = type === 'countPrism';
      const nm = isP ? pname(n) : yname(n), part = PART[w];
      return { type, text: `${b(nm)}의 ${b(part)}${K.J(part, '은는')} 몇 개일까요?`, figs: n <= 6 ? [{ svg: solidSVG(isP ? 'prism' : 'pyramid', n, 230), cap: nm }] : [],
        answer100: (isP ? prismCount(n, w) : pyrCount(n, w)) * 100, unit: '개', meta: { n, w } };
    }
    if (type === 'reverse') {
      const isP = Math.random() < 0.5, n = between(3, 9), [w1, w2] = shuffle(['v', 'f', 'e']).slice(0, 2);
      const solid = isP ? '각기둥' : '각뿔', c1 = (isP ? prismCount : pyrCount)(n, w1);
      if (Math.random() < 0.4) {     // 이름 고르기
        const right = isP ? pname(n) : yname(n);
        const wrong = (isP ? [pname(n + 1), pname(n - 1 < 3 ? n + 2 : n - 1), yname(n)] : [yname(n + 1), yname(n - 1 < 3 ? n + 2 : n - 1), pname(n)]);
        const c = K.choice(right, wrong);
        return { type, text: `${PART[w1]}${K.J(PART[w1], '이가')} ${b(c1 + '개')}인 ${solid}의 이름을 고르세요.`, figs: [], ...c, meta: { n, w1 } };
      }
      return { type, text: `${PART[w1]}${K.J(PART[w1], '이가')} ${b(c1 + '개')}인 ${solid}${K.J(solid, '이가')} 있어요. 이 ${solid}의 ${b(PART[w2])}${K.J(PART[w2], '은는')} 몇 개일까요?`,
        answer100: (isP ? prismCount : pyrCount)(n, w2) * 100, unit: '개', meta: { n, w1, w2 } };
    }
    if (type === 'facts') {
      const kd = pick(['prism', 'pyramid']), F = FACTS[kd], right = pick(F.t);
      const c = K.choice(right, F.f);
      return { type, text: `${F.name}에 대한 설명으로 옳은 것을 고르세요.`, figs: [{ svg: solidSVG(kd, between(4, 6), 200), cap: F.name }], ...c };
    }
    // ⑦ 각기둥의 전개도 (밑면은 정다각형)
    const n = between(3, 6), a = between(2, 9), h = between(3, 12), nm = pname(n);
    const v = pick(['sides', 'width', 'area']);
    const base = `밑면이 한 변의 길이가 ${b(a + ' cm')}인 정${NUMKO[n]}각형이고 높이가 ${b(h + ' cm')}인 ${nm}의 전개도예요.`;
    if (v === 'sides') return { type, text: `${base} 전개도에서 ${b('옆면')}은 모두 몇 개일까요?`, figs: [{ svg: netSVG(n, `${a} cm`, `${h} cm`), cap: '옆면은 직사각형' }], answer100: n * 100, unit: '개', meta: { n } };
    if (v === 'width') return { type, text: `${base} 옆면을 모두 이어 붙인 큰 직사각형의 가로는 몇 cm일까요?`, figs: [{ svg: netSVG(n, `${a} cm`, `${h} cm`), cap: '옆면의 가로를 모두 더해요' }], answer100: n * a * 100, unit: 'cm', meta: { n, a } };
    return { type, text: `${base} 옆면 한 개의 넓이는 몇 cm²일까요?`, figs: [{ svg: netSVG(n, `${a} cm`, `${h} cm`), cap: '옆면은 가로가 밑면의 한 변, 세로가 높이인 직사각형' }], answer100: a * h * 100, unit: 'cm²', meta: { a, h } };
  }
  throw new Error('문제를 만들지 못했어요: ' + type);
}
const makeProblem = type => K.finish(makeRaw(type));
module.exports = { TYPES, TYPE_LABEL, makeProblem, publicProblem: K.publicOf(TYPE_LABEL), check: K.check, solidSVG, netSVG };
