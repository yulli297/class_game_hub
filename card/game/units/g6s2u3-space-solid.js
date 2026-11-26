// =============================================================
//  공간과 입체 (6학년 2학기 3단원, 쌓기나무) — 기초·기본 문제만
//   ① 위에서 본 모양에 쓴 수로 개수 구하기   ② 몇 층에 있는 쌓기나무 개수
//   ③ 쌓기나무 그림 보고 개수 구하기         ④ 위에서 본 모양 고르기
//   ⑤ 앞에서 본 모양 고르기                 ⑥ 층별로 나타낸 모양으로 개수 구하기
//   ⑦ 정육면체 모양을 만들려면 더 필요한 개수
//  · 쌓기나무 그림은 뒤로 갈수록 높아지는 계단 모양이라 보이지 않는 쌓기나무가 없어요.
//  · 위에서 본 모양은 항상 '앞'이 아래쪽에 오도록 그려요.
// =============================================================
const K = require('./_common');
const { between, pick, shuffle, b, C, svgOpen, lab, xml } = K;

const TYPES = ['topCount', 'layerCount', 'isoCount', 'topView', 'frontView', 'layers', 'complete'];
const TYPE_LABEL = { topCount: '위에서 본 모양으로 개수 구하기', layerCount: '층별 쌓기나무 개수', isoCount: '쌓기나무 개수 세기', topView: '위에서 본 모양',
  frontView: '앞에서 본 모양', layers: '층별로 나타낸 모양', complete: '정육면체 모양 만들기' };

// 높이 표 h[y][x] (y = 0이 맨 뒤, 마지막 줄이 맨 앞)
const H = (rows, cols, f) => Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => f(x, y)));
const sum = h => h.flat().reduce((a, c) => a + c, 0);
// 뒤로 갈수록, 왼쪽으로 갈수록 높아지는 계단 모양 (모든 쌓기나무가 보임)
function stairs(rows, cols, maxH) {
  for (;;) {
    const h = H(rows, cols, () => 0);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const lim = Math.min(y ? h[y - 1][x] : maxH, x ? h[y][x - 1] : maxH);
      h[y][x] = lim ? between(y === 0 && x === 0 ? Math.max(1, lim - 1) : 0, lim) : 0;
    }
    const cnt = sum(h);
    if (cnt >= 4 && h[rows - 1].some(v => v) && h.every(r => r[0] > 0) && h[0].every(v => v > 0)) return h;
  }
}
// 아무 모양 (위에서 본 모양에 수를 쓰는 문제용): 빈칸이 있어도 되지만 붙어 있게
function anyShape(rows, cols, maxH) {
  for (;;) {
    const h = H(rows, cols, () => (Math.random() < 0.8 ? between(1, maxH) : 0));
    if (sum(h) < 4 || h.flat().filter(v => v).length < 3) continue;
    if (!h[0].some(v => v) || !h[rows - 1].some(v => v) || !h.some(r => r[0]) || !h.some(r => r[cols - 1])) continue;
    // 연결되어 있는지 확인
    const cells = []; h.forEach((r, y) => r.forEach((v, x) => v && cells.push([x, y])));
    const seen = new Set([cells[0].join()]), st = [cells[0]];
    while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = [x + dx, y + dy].join(); if (h[y + dy] && h[y + dy][x + dx] && !seen.has(k)) { seen.add(k); st.push([x + dx, y + dy]); } } }
    if (seen.size === cells.length) return h;
  }
}

// ---------- 그림 ----------
// 위에서 본 모양 + 칸마다 쌓인 개수
function numGridSVG(h, showNums = true, cell = 52) {
  const rows = h.length, cols = h[0].length, W = cols * cell, x0 = (380 - W) / 2, y0 = 14;
  let s = '';
  h.forEach((r, y) => r.forEach((v, x) => {
    if (!v) return;
    s += `<rect class="cell" x="${x0 + x * cell}" y="${y0 + y * cell}" width="${cell}" height="${cell}" fill="${C.FILL}" stroke="${C.GOLD}" stroke-width="2.5"/>`;
    if (showNums) s += lab(x0 + x * cell + cell / 2, y0 + y * cell + cell / 2 + 9, String(v), 26);
  }));
  const yb = y0 + rows * cell;
  return `${svgOpen(380, yb + 34)}${s}${lab(190, yb + 26, '▲ 앞', 18, 'middle', C.BLUE)}</svg>`;
}
// 쌓기나무 그림 (등각 투상). 앞은 왼쪽 아래 방향 (y가 커지는 쪽), x는 오른쪽 아래 방향
function isoSVG(h) {
  const rows = h.length, cols = h[0].length, maxH = Math.max(...h.flat());
  const a = Math.min(30, 230 / (cols + rows + 0.6), 150 / (maxH + (cols + rows) * 0.5)), hx = a * 0.866, hy = a * 0.5;
  const X = (x, y) => (x - y) * hx, Y = (x, y, z) => (x + y) * hy - z * a;
  // 화면 범위
  const xs = [], ys = [];
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) for (const z of [0, maxH]) { xs.push(X(x, y)); ys.push(Y(x, y, z)); }
  const ox = 200 - (Math.min(...xs) + Math.max(...xs)) / 2, oy = 22 - Math.min(...ys);
  const pt = (x, y, z) => `${(ox + X(x, y)).toFixed(1)} ${(oy + Y(x, y, z)).toFixed(1)}`;
  const cubes = [];
  h.forEach((r, y) => r.forEach((v, x) => { for (let z = 0; z < v; z++) cubes.push([x, y, z]); }));
  cubes.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]) || p[2] - q[2]);      // 뒤에서 앞으로, 아래에서 위로
  const S = `stroke="#3a2608" stroke-width="1.6" stroke-linejoin="round"`;
  let s = '';
  for (const [x, y, z] of cubes) {
    s += `<g class="cube" data-p="${x},${y},${z}">`
      + `<path d="M${pt(x, y, z + 1)} L${pt(x + 1, y, z + 1)} L${pt(x + 1, y + 1, z + 1)} L${pt(x, y + 1, z + 1)} Z" fill="#F7CE72" ${S}/>`
      + `<path d="M${pt(x, y + 1, z + 1)} L${pt(x + 1, y + 1, z + 1)} L${pt(x + 1, y + 1, z)} L${pt(x, y + 1, z)} Z" fill="#C98A2B" ${S}/>`
      + `<path d="M${pt(x + 1, y, z + 1)} L${pt(x + 1, y + 1, z + 1)} L${pt(x + 1, y + 1, z)} L${pt(x + 1, y, z)} Z" fill="#E0A646" ${S}/></g>`;
  }
  // '앞' 화살표: 앞면(y가 큰 쪽)을 향해
  const fx = ox + X(cols / 2, rows) - 2 * hx, fy = oy + Y(cols / 2, rows, 0) + 2 * hy;
  const H2 = Math.ceil(oy + Math.max(...ys) + 50);
  return `${svgOpen(400, H2)}${s}<path d="M${(fx - 18).toFixed(1)} ${(fy + 14).toFixed(1)} L${(fx + 4).toFixed(1)} ${(fy + 1).toFixed(1)}" stroke="${C.BLUE}" stroke-width="3"/><path d="M${(fx + 10).toFixed(1)} ${(fy - 2).toFixed(1)} L${(fx - 2).toFixed(1)} ${(fy - 3).toFixed(1)} L${(fx + 3).toFixed(1)} ${(fy + 8).toFixed(1)} Z" fill="${C.BLUE}"/>${lab(fx - 26, fy + 26, '앞', 18, 'middle', C.BLUE)}</svg>`;
}
// 본 모양(보기용): 칸 목록 [[x,y]...] → 정사각형 그림 (y가 클수록 아래)
function viewSVG(cells, cell = 30) {
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  cells = cells.map(([x, y]) => [x - mx, y - my]);                  // 왼쪽 위로 맞춤
  const maxX = Math.max(...cells.map(c => c[0])), maxY = Math.max(...cells.map(c => c[1]));
  const W = (maxX + 1) * cell, Hh = (maxY + 1) * cell, x0 = (160 - W) / 2, y0 = (150 - Hh) / 2;
  let s = '';
  for (const [x, y] of cells) s += `<rect class="v" x="${x0 + x * cell}" y="${y0 + y * cell}" width="${cell}" height="${cell}" fill="${C.FILL}" stroke="${C.GOLD}" stroke-width="2.2"/>`;
  return `${svgOpen(160, 160)}${s}</svg>`;
}
const key = cells => { const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1])); return cells.map(c => [c[0] - mx, c[1] - my].join()).sort().join(';'); };   // 옮겨서 같으면 같은 모양
// 앞에서 본 모양: 열(x)마다 가장 높은 층 → 칸 목록 (y는 위가 0)
function frontCells(h) {
  const cols = h[0].length, top = Math.max(...h.flat()), cells = [];
  for (let x = 0; x < cols; x++) { const m = Math.max(...h.map(r => r[x])); for (let z = 0; z < m; z++) cells.push([x, top - 1 - z]); }
  return cells;
}
const heightsToCells = (hs, top) => hs.flatMap((m, x) => Array.from({ length: m }, (_, z) => [x, top - 1 - z]));
// 층별 모양 그림 (1층, 2층, 3층)
function layersSVG(h) {
  const rows = h.length, cols = h[0].length, maxH = Math.max(...h.flat()), cell = Math.min(26, 110 / Math.max(rows, cols)), gw = 380 / maxH;
  let s = '';
  for (let k = 1; k <= maxH; k++) {
    const x0 = (k - 1) * gw + (gw - cols * cell) / 2, y0 = 14;
    h.forEach((r, y) => r.forEach((v, x) => { if (v >= k) s += `<rect class="L${k}" x="${(x0 + x * cell).toFixed(1)}" y="${y0 + y * cell}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${C.FILL}" stroke="${C.GOLD}" stroke-width="2"/>`; }));
    // 칸 위치를 알 수 있게 바닥 칸 테두리(점선)
    h.forEach((r, y) => r.forEach((v, x) => { if (v && v < k) s += `<rect x="${(x0 + x * cell).toFixed(1)}" y="${y0 + y * cell}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="none" stroke="${C.GOLD}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>`; }));
    s += lab(x0 + cols * cell / 2, y0 + rows * cell + 26, `${k}층`, 18);
  }
  return `${svgOpen(380, 14 + rows * cell + 40)}${s}</svg>`;
}

function makeRaw(type) {
  for (let t = 0; t < 300; t++) {
    if (type === 'topCount') {
      const h = anyShape(between(2, 3), 3, 3);
      return { type, text: '쌓기나무로 쌓은 모양을 위에서 본 모양에 각 자리에 쌓인 쌓기나무의 개수를 썼어요. 쌓기나무는 모두 몇 개일까요?', figs: [{ svg: numGridSVG(h), cap: '수는 그 자리에 쌓인 개수' }], answer100: sum(h) * 100, unit: '개', meta: { h } };
    }
    if (type === 'layerCount') {
      const h = anyShape(between(2, 3), 3, 3), maxH = Math.max(...h.flat()); if (maxH < 2) continue;
      const k = between(1, maxH), cnt = h.flat().filter(v => v >= k).length;
      return { type, text: `위에서 본 모양에 쌓인 쌓기나무의 개수를 썼어요. ${b(k + '층')}에 있는 쌓기나무는 몇 개일까요?`, figs: [{ svg: numGridSVG(h), cap: `${k}층에 쌓기나무가 있는 자리를 세어 보아요` }], answer100: cnt * 100, unit: '개', meta: { h, k } };
    }
    if (type === 'isoCount') {
      const h = stairs(between(2, 3), between(2, 3), 3);
      return { type, text: '쌓기나무로 쌓은 모양이에요. 보이지 않는 쌓기나무는 없어요. 쌓기나무는 모두 몇 개일까요?', figs: [{ svg: isoSVG(h), cap: '아래층부터 차례로 세어 보아요' }], answer100: sum(h) * 100, unit: '개', meta: { h } };
    }
    if (type === 'topView') {
      const h = stairs(between(2, 3), between(2, 3), 3);
      const right = []; h.forEach((r, y) => r.forEach((v, x) => v && right.push([x, y])));
      const rows = h.length, cols = h[0].length;
      const cand = [
        right.map(([x, y]) => [cols - 1 - x, y]),                    // 좌우로 뒤집음
        right.map(([x, y]) => [x, rows - 1 - y]),                    // 앞뒤로 뒤집음
        right.map(([x, y]) => [y, x]),                               // 가로·세로를 바꿈
        right.filter(c => !(c[0] === right[right.length - 1][0] && c[1] === right[right.length - 1][1])),   // 한 칸 빠짐
        [...right, ...(h[rows - 1].includes(0) ? [[h[rows - 1].indexOf(0), rows - 1]] : [[cols, rows - 1]])],  // 한 칸 더함
      ].filter(c => c.length && key(c) !== key(right));
      const uniq = []; for (const c of shuffle(cand)) if (!uniq.some(u => key(u) === key(c))) uniq.push(c);
      if (uniq.length < 3) continue;
      const opts = shuffle([right, ...uniq.slice(0, 3)]);
      return { type, text: '쌓기나무로 쌓은 모양을 위에서 본 모양을 고르세요. (보기는 앞쪽이 아래가 되도록 그렸어요)', figs: [{ svg: isoSVG(h), cap: '파란 화살표 쪽이 앞' }], options: opts.map(c => viewSVG(c)), answer: opts.indexOf(right), meta: { h } };
    }
    if (type === 'frontView') {
      const h = anyShape(between(2, 3), 3, 3), top = Math.max(...h.flat());
      const fr = h[0].map((_, x) => Math.max(...h.map(r => r[x])));                    // 앞에서 본 열 높이
      const side = h.map(r => Math.max(...r)).reverse();                              // 오른쪽 옆에서 본 모양 (헷갈리는 보기)
      const cands = [side, fr.slice().reverse(), fr.map((v, i) => (i === 0 ? Math.max(1, v - 1) : v)), fr.map((v, i) => (i === fr.length - 1 ? Math.min(3, v + 1) : v)), h[h.length - 1].map(v => v)];
      const right = fr.join(), uniq = [];
      for (const c of shuffle(cands)) if (c.every(v => v >= 0) && c.some(v => v) && c.join() !== right && !uniq.some(u => u.join() === c.join()) && !c.includes(0)) uniq.push(c);
      if (uniq.length < 3 || fr.includes(0)) continue;
      const opts = shuffle([fr, ...uniq.slice(0, 3)]), T = Math.max(...opts.flat());
      return { type, text: '위에서 본 모양에 쌓인 쌓기나무의 개수를 썼어요. 앞에서 본 모양을 고르세요.', figs: [{ svg: numGridSVG(h), cap: '앞에서 보면 줄마다 가장 높은 층까지 보여요' }],
        options: opts.map(c => viewSVG(heightsToCells(c, T))), answer: opts.findIndex(c => c.join() === right), meta: { h, top } };
    }
    if (type === 'layers') {
      const h = anyShape(between(2, 3), 3, 3); if (Math.max(...h.flat()) < 2) continue;
      return { type, text: '쌓기나무로 쌓은 모양을 층별로 나타냈어요. 쌓기나무는 모두 몇 개일까요?', figs: [{ svg: layersSVG(h), cap: '층마다 쌓기나무 수를 세어 더해요 (점선은 빈 자리)' }], answer100: sum(h) * 100, unit: '개', meta: { h } };
    }
    // ⑦ 정육면체 모양 만들기
    const n = pick([2, 2, 3]), h = H(n, n, () => between(n === 2 ? 0 : 1, n));
    if (sum(h) === n ** 3 || sum(h) < 3 || h[0].every(v => !v) || h[n - 1].every(v => !v)) continue;
    if (h.some(r => r.every(v => !v)) || h[0].map((_, x) => h.every(r => !r[x])).some(Boolean)) continue;
    return { type, text: `위에서 본 모양에 쌓인 쌓기나무의 개수를 썼어요. 쌓기나무를 더 쌓아서 한 모서리에 쌓기나무가 ${b(n + '개')}씩 놓이는 정육면체 모양을 만들려면 쌓기나무가 몇 개 더 필요할까요?`,
      figs: [{ svg: numGridSVG(h), cap: `정육면체 모양에는 쌓기나무가 ${n} × ${n} × ${n}개` }], answer100: (n ** 3 - sum(h)) * 100, unit: '개', meta: { h, n } };
  }
  throw new Error('문제를 만들지 못했어요: ' + type);
}
const makeProblem = type => K.finish(makeRaw(type));
module.exports = { TYPES, TYPE_LABEL, makeProblem, publicProblem: K.publicOf(TYPE_LABEL), check: K.check };
