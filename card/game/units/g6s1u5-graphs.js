// =============================================================
//  여러 가지 그래프 (6학년 1학기 5단원) — 기초·기본 문제만
//   ① 그림그래프 읽기            ② 그림그래프로 비교하기(차이·합)
//   ③ 표를 보고 백분율 구하기     ④ 띠그래프 읽기
//   ⑤ 원그래프 읽기              ⑥ 알맞은 그래프 고르기(선택형)
//   ⑦ 비율 그래프로 수량 구하기(전체 수 × 백분율, 띠의 길이)
//  백분율은 모두 5의 배수(띠는 15% 이상, 원은 10% 이상)라 그림 안에 글자가 잘 들어가요.
// =============================================================
const K = require('./_common');
const { between, pick, shuffle, b, C, svgOpen, lab, line, xml } = K;

const TYPES = ['pictoRead', 'pictoCompare', 'tablePct', 'band', 'pie', 'kind', 'amount'];
const TYPE_LABEL = { pictoRead: '그림그래프 읽기', pictoCompare: '그림그래프로 비교하기', tablePct: '표를 보고 백분율 구하기', band: '띠그래프 읽기',
  pie: '원그래프 읽기', kind: '알맞은 그래프 고르기', amount: '비율그래프로 수량 구하기' };

// 조사 주제: 항목 이름은 2글자 이하 (그림 안에 들어가게)
const TOPICS = [
  { title: '좋아하는 운동', items: ['축구', '야구', '농구', '수영', '배구', '탁구'], who: '좋아하는 학생' },
  { title: '좋아하는 과일', items: ['사과', '포도', '딸기', '수박', '귤', '참외'], who: '좋아하는 학생' },
  { title: '좋아하는 계절', items: ['봄', '여름', '가을', '겨울'], who: '좋아하는 학생' },
  { title: '가고 싶은 곳', items: ['바다', '산', '강', '섬', '숲'], who: '가고 싶은 학생' },
  { title: '좋아하는 색깔', items: ['빨강', '파랑', '노랑', '초록', '보라'], who: '좋아하는 학생' },
];
const SHADES = ['rgba(242,184,75,.75)', 'rgba(209,143,44,.75)', 'rgba(127,179,255,.55)', 'rgba(251,227,166,.45)', 'rgba(160,110,40,.8)'];

// 합이 100이 되는 백분율 n개 (5의 배수, 각각 min 이상)
function percents(n, min) {
  for (;;) {
    const ps = []; let left = 100;
    for (let i = 0; i < n - 1; i++) { const hi = left - min * (n - 1 - i); if (hi < min) break; ps.push(between(min / 5, hi / 5) * 5); left -= ps[i]; }
    if (ps.length !== n - 1 || left < min) continue;
    ps.push(left);
    return shuffle(ps);
  }
}

// ---------- 그림그래프: 큰 그림 = big, 작은 그림 = small ----------
function pictoSVG(rows, big, small, unit) {
  const H = 46, top = 16, W = 400;
  let s = '';
  rows.forEach((r, i) => {
    const y = top + i * H, cy = y + H / 2;
    s += `<rect x="10" y="${y}" width="${W - 20}" height="${H}" fill="${i % 2 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.04)'}" stroke="${C.GOLD}" stroke-width="1"/>`;
    s += lab(58, cy + 6, r.name, 17);
    let x = 128;
    for (let k = 0; k < Math.floor(r.v / big); k++) { s += `<circle class="big" cx="${x}" cy="${cy}" r="12" fill="${C.GOLD}" stroke="#5a3d10" stroke-width="2"/>`; x += 27; }
    for (let k = 0; k < (r.v % big) / small; k++) { s += `<circle class="small" cx="${x - 5}" cy="${cy}" r="6" fill="${C.LIGHT}" stroke="#5a3d10" stroke-width="1.5"/>`; x += 15; }
  });
  s += line(108, top, 108, top + rows.length * H, C.GOLD, 1.5);
  const ly = top + rows.length * H + 28;
  s += `<circle class="lg" cx="110" cy="${ly - 6}" r="12" fill="${C.GOLD}"/>${lab(128, ly, `${big}${unit}`, 18, 'start')}<circle class="lg" cx="236" cy="${ly - 6}" r="6" fill="${C.LIGHT}"/>${lab(250, ly, `${small}${unit}`, 18, 'start')}`;
  return `${svgOpen(400, ly + 14)}${s}</svg>`;
}
// ---------- 표 ----------
function tableSVG(heads, cells) {
  const n = heads.length, cw = 360 / n, x0 = 10;
  let s = `<rect x="${x0}" y="10" width="360" height="100" fill="rgba(0,0,0,.2)" stroke="${C.GOLD}" stroke-width="2"/>${line(x0, 56, x0 + 360, 56, C.GOLD, 1.5)}`;
  for (let i = 1; i < n; i++) s += line(x0 + i * cw, 10, x0 + i * cw, 110, C.GOLD, 1.2);
  heads.forEach((h, i) => { s += lab(x0 + cw * (i + 0.5), 41, h, h.length > 2 ? 16 : 18, 'middle', C.GOLD); });
  cells.forEach((c, i) => { s += lab(x0 + cw * (i + 0.5), 90, c, 19); });
  return `${svgOpen(380, 120)}${s}</svg>`;
}
// ---------- 띠그래프 (전체 340px = 100%) ----------
function bandSVG(items, show) {
  const x0 = 20, W = 340, y = 20, h = 92;
  let s = '', x = x0;
  items.forEach((it, i) => {
    const w = it.p * W / 100;
    s += `<rect class="seg" x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" fill="${SHADES[i % SHADES.length]}" stroke="#2a1d0c" stroke-width="2"/>`;
    s += lab(x + w / 2, y + 38, it.name, 19, 'middle', '#1b120a') + lab(x + w / 2, y + 68, show(it), 19, 'middle', String(show(it)).includes('?') ? '#123a7a' : '#1b120a');
    x += w;
  });
  s += `<rect x="${x0}" y="${y}" width="${W}" height="${h}" fill="none" stroke="${C.GOLD}" stroke-width="2.5"/>`;
  for (let k = 0; k <= 10; k++) s += line(x0 + k * 34, y + h + 4, x0 + k * 34, y + h + (k % 5 ? 9 : 14), C.LIGHT, 1.5);
  s += lab(x0, y + h + 34, '0', 16) + lab(x0 + 170, y + h + 34, '50', 16) + lab(x0 + W, y + h + 34, '100', 16) + lab(x0 + W + 4, y + h + 54, '(%)', 14, 'end');
  return `${svgOpen(380, 172)}${s}</svg>`;
}
// ---------- 원그래프 (12시 방향부터 시계 방향) ----------
function pieSVG(items, show) {
  const cx = 190, cy = 134, R = 118;
  let s = '', acc = 0;
  const pt = (deg, r = R) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)];
  items.forEach((it, i) => {
    const a1 = acc * 3.6, a2 = (acc + it.p) * 3.6, [x1, y1] = pt(a1), [x2, y2] = pt(a2);
    s += `<path class="seg" d="M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${it.p > 50 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${SHADES[i % SHADES.length]}" stroke="#2a1d0c" stroke-width="2"/>`;
    const [lx, ly] = pt((a1 + a2) / 2, R * (it.p < 15 ? 0.72 : 0.6));
    s += lab(lx, ly - 2, it.name, 16, 'middle', '#1b120a') + lab(lx, ly + 18, show(it), 16, 'middle', String(show(it)).includes('?') ? '#123a7a' : '#1b120a');
    acc += it.p;
  });
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.GOLD}" stroke-width="2.5"/>`;
  return `${svgOpen(380, 262)}${s}</svg>`;
}
const pctLabel = it => `${it.p}%`;

const KINDS = {
  '원그래프': '전체에 대한 각 부분의 비율을 원 모양에 나타낸 그래프',
  '띠그래프': '전체에 대한 각 부분의 비율을 띠 모양에 나타낸 그래프',
  '그림그래프': '조사한 수를 그림의 크기와 개수로 나타낸 그래프',
  '꺾은선그래프': '시간에 따라 변하는 양을 선분으로 이어 나타낸 그래프',
  '막대그래프': '조사한 수를 막대의 길이로 나타낸 그래프',
};

function pictoData() {
  const big = pick([100, 1000]), small = big / 10, unit = big === 100 ? pick(['명', '상자']) : 'kg';
  const subj = { 명: ['마을별 학생 수', '마을'], 상자: ['과수원별 사과 생산량', '과수원'], kg: ['농장별 감자 생산량', '농장'] }[unit];
  const names = ['가', '나', '다', '라'].map(x => `${x} ${subj[1]}`);
  for (;;) {
    const rows = names.map(name => ({ name, full: name, v: (between(1, 5) * 10 + between(1, 9)) * small }));
    if (new Set(rows.map(r => r.v)).size !== 4) continue;
    return { rows, big, small, unit, title: subj[0], place: subj[1] };
  }
}

function makeRaw(type) {
  for (let t = 0; t < 300; t++) {
    if (type === 'pictoRead' || type === 'pictoCompare') {
      const d = pictoData(), svg = pictoSVG(d.rows, d.big, d.small, d.unit);
      const unitWord = d.unit;
      const fig = [{ svg, cap: `${d.title} (큰 그림 ${d.big}${unitWord}, 작은 그림 ${d.small}${unitWord})` }];
      const what = { 명: '학생 수', 상자: '사과 생산량', kg: '감자 생산량' }[d.unit];
      if (type === 'pictoRead') { const r = pick(d.rows);
        return { type, text: `그림그래프를 보고 ${b(r.full)}의 ${what}${K.J(what, '은는')} 몇 ${unitWord}인지 구하세요.`, figs: fig, answer100: r.v * 100, unit: unitWord, meta: d }; }
      const sorted = d.rows.slice().sort((a, c) => c.v - a.v);
      if (Math.random() < 0.5) return { type, text: `그림그래프에서 ${what}${K.J(what, '이가')} 가장 많은 ${d.place}${K.J(d.place, '과와')} 가장 적은 ${d.place}의 차는 몇 ${unitWord}일까요?`, figs: fig, answer100: (sorted[0].v - sorted[3].v) * 100, unit: unitWord, meta: d };
      const [x, y] = shuffle(d.rows.slice()).slice(0, 2);
      return { type, text: `그림그래프에서 ${b(x.full)}${K.J(x.full, '과와')} ${b(y.full)}의 ${what}${K.J(what, '을를')} 더하면 몇 ${unitWord}일까요?`, figs: fig, answer100: (x.v + y.v) * 100, unit: unitWord, meta: d };
    }
    if (type === 'tablePct') {         // 각 항목 수 × 100 ÷ 합계가 자연수가 되게
      const T = pick(TOPICS), names = shuffle(T.items.slice()).slice(0, 4), total = pick([20, 25, 40, 50, 200]), step = { 20: 1, 25: 1, 40: 2, 50: 1, 200: 2 }[total];
      const counts = []; let left = total;
      for (let i = 0; i < 3; i++) { const hi = Math.min(left - step * (3 - i), Math.floor(total * 0.45)); const c = between(1, Math.floor(hi / step)) * step; counts.push(c); left -= c; }
      if (left < step || left % step) continue;
      counts.push(left);
      const k = between(0, 3), p = counts[k] * 100 / total;
      if (!Number.isInteger(p)) continue;
      return { type, text: `${T.title}${K.J(T.title, '을를')} 조사한 표예요. ${b(names[k])}${K.J(names[k], '을를')} ${T.who}은 전체의 몇 %일까요?`, figs: [{ svg: tableSVG([...names, '합계'], [...counts.map(String), String(total)]), cap: `${T.title} (단위: 명)` }], answer100: p * 100, unit: '%', meta: { names, counts, total, k } };
    }
    if (type === 'band' || type === 'pie') {
      const T = pick(TOPICS), n = Math.min(type === 'band' ? 4 : between(4, 5), T.items.length), min = type === 'band' ? 15 : 10;   // 항목이 4개뿐인 주제도 있음
      const ps = percents(n, min), names = shuffle(T.items.slice()).slice(0, n), items = names.map((name, i) => ({ name, p: ps[i] }));
      const draw = type === 'band' ? bandSVG : pieSVG, gname = type === 'band' ? '띠그래프' : '원그래프';
      if (Math.random() < 0.55) {      // 빠진 백분율 구하기
        const k = between(0, n - 1);
        return { type, text: `${T.title}${K.J(T.title, '을를')} 조사하여 나타낸 ${gname}예요. ${b(items[k].name)}${K.J(items[k].name, '을를')} ${T.who}은 전체의 몇 %일까요?`,
          figs: [{ svg: draw(items, it => (it === items[k] ? '?%' : pctLabel(it))), cap: `${T.title}` }], answer100: items[k].p * 100, unit: '%', meta: { items, k } };
      }
      // 가장 많은 항목은 가장 적은 항목의 몇 배 (자연수 배일 때만) 또는 두 항목의 백분율 차
      const sorted = items.slice().sort((a, c) => c.p - a.p);
      if (sorted[0].p === sorted[1].p || sorted[n - 1].p === sorted[n - 2].p) continue;
      if (sorted[0].p % sorted[n - 1].p === 0 && Math.random() < 0.5)
        return { type, text: `${gname}에서 백분율이 가장 큰 항목은 가장 작은 항목의 몇 배일까요?`, figs: [{ svg: draw(items, pctLabel), cap: `${T.title}` }], answer100: sorted[0].p / sorted[n - 1].p * 100, unit: '배', meta: { items } };
      const [x, y] = shuffle(items.slice()).slice(0, 2), [hi, lo] = x.p > y.p ? [x, y] : [y, x];
      if (hi.p === lo.p) continue;
      return { type, text: `${gname}에서 ${b(hi.name)}${K.J(hi.name, '을를')} ${T.who}은 ${b(lo.name)}${K.J(lo.name, '을를')} ${T.who}보다 전체의 몇 % 더 많을까요?`, figs: [{ svg: draw(items, pctLabel), cap: `${T.title}` }], answer100: (hi.p - lo.p) * 100, unit: '%', meta: { items } };
    }
    if (type === 'kind') {
      const names = Object.keys(KINDS), right = pick(names);
      const c = K.choice(right, names.filter(x => x !== right));
      return { type, text: `${b(KINDS[right])}는 무엇일까요?`, ...c };
    }
    // ⑦ 비율그래프로 수량 구하기
    const T = pick(TOPICS), n = 4, ps = percents(n, 15), names = shuffle(T.items.slice()).slice(0, n), items = names.map((name, i) => ({ name, p: ps[i] }));
    const k = between(0, n - 1);
    if (Math.random() < 0.65) {
      const N = pick([20, 40, 60, 80, 100, 200, 300, 400, 500]);
      if ((N * items[k].p) % 100) continue;
      const usePie = Math.random() < 0.5;
      return { type, text: `${T.title}${K.J(T.title, '을를')} 조사한 학생은 모두 ${b(N + '명')}이에요. ${b(items[k].name)}${K.J(items[k].name, '을를')} ${T.who}은 몇 명일까요?`,
        figs: [{ svg: (usePie ? pieSVG : bandSVG)(items, pctLabel), cap: T.title }], answer100: N * items[k].p, unit: '명', meta: { items, k, N } };
    }
    const L = pick([10, 20, 30, 40]);
    return { type, text: `이 띠그래프를 전체 길이가 ${b(L + ' cm')}인 띠그래프로 다시 그리려고 해요. ${b(items[k].name)}${K.J(items[k].name, '이가')} 차지하는 부분의 길이는 몇 cm일까요?`,
      figs: [{ svg: bandSVG(items, pctLabel), cap: T.title }], answer100: L * items[k].p, unit: 'cm', meta: { items, k, L } };
  }
  throw new Error('문제를 만들지 못했어요: ' + type);
}
const makeProblem = type => K.finish(makeRaw(type));
module.exports = { TYPES, TYPE_LABEL, makeProblem, publicProblem: K.publicOf(TYPE_LABEL), check: K.check, KINDS };
