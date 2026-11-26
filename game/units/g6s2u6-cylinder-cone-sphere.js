// =============================================================
//  원기둥, 원뿔, 구 문제 자동 생성 (6학년 2학기 6단원) — 기초·기본 문제만
//  서버에서만 실행 → 정답은 학생 화면에 가지 않음
//
//  7가지 유형
//   ① 입체도형 찾기(그림 고르기)          ② 원기둥의 구성 요소
//   ③ 원기둥의 전개도(옆면의 가로·넓이)    ④ 원뿔의 구성 요소(모선·높이·지름)
//   ⑤ 구(반지름·지름)                    ⑥ 돌려 만든 입체도형
//   ⑦ 원기둥·원뿔·구 비교
//  길이·넓이는 100배 한 정수(1/100 단위)로 계산해서 소수 계산 오차가 없어요.
//  (겉넓이·부피는 중학교 내용이라 넣지 않았어요)
// =============================================================
const rnd = n => Math.floor(Math.random() * n);
const between = (a, b) => a + rnd(b - a + 1);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = arr => arr[rnd(arr.length)];
function h2s(v) {
  let s = String(Math.abs(v)).padStart(3, '0');
  const ip = s.slice(0, -2), fp = s.slice(-2).replace(/0+$/, '');
  return (v < 0 ? '-' : '') + (fp ? ip + '.' + fp : ip);
}
const b = s => `<b>${s}</b>`;
// 받침에 맞는 조사: J('높이', '은는') → '높이는', J('밑면의 지름', '은는') → '밑면의 지름은'
const batchim = w => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
const J = (w, pair) => (batchim(w) ? pair[0] : pair[1]);
const PIS = { 314: '3.14', 310: '3.1', 300: '3' };
const piNote = p => `(원주율: ${b(PIS[p])})`;
// 직각삼각형 세 변 (밑면 반지름, 높이, 모선) — 실제로 만들 수 있는 원뿔이 되도록
const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [4, 3, 5], [8, 6, 10], [12, 9, 15], [7, 24, 25]];

// ---------- 그림(SVG) ----------
const FONT = "Jua,'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const GOLD = '#F2B84B', LIGHT = '#FBE3A6', BLUE = '#7fb3ff';
const FILL = 'rgba(242,184,75,.22)', TOP = 'rgba(242,184,75,.38)';
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svgOpen = (w, hgt) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" font-family="${FONT}" font-weight="700">`;
const lab = (x, y, t, fs = 22, anchor = 'middle') => `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="${anchor}" fill="${String(t).includes('?') ? BLUE : LIGHT}">${xml(t)}</text>`;
const L = (x1, y1, x2, y2, c = GOLD, w = 3, dash = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="${LIGHT}"/>`;
const S = 'stroke="' + GOLD + '" stroke-width="3" stroke-linejoin="round"';
const DASH = 'stroke-dasharray="6 5"';
// 아래쪽 타원: 앞쪽 반은 실선, 뒤쪽 반은 점선
const baseEllipse = (cx, cy, rx, ry) => { cx = Number(cx); cy = Number(cy); rx = Number(rx); ry = Number(ry); return `<path d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}" fill="none" ${S}/><path d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}" fill="none" ${S} ${DASH}/>`; };

// 입체도형 몸통 (라벨 없이). k: 크기 배율, (ox, oy): 왼쪽 위 기준
function solid(kind, ox = 0, oy = 0, k = 1) {
  const X = x => (ox + x * k).toFixed(1), Y = y => (oy + y * k).toFixed(1), R = v => (v * k).toFixed(1);
  if (kind === 'cylinder') return `<path d="M${X(30)} ${Y(30)} L${X(30)} ${Y(140)} A${R(50)} ${R(14)} 0 0 0 ${X(130)} ${Y(140)} L${X(130)} ${Y(30)} Z" fill="${FILL}" ${S}/>
<ellipse cx="${X(80)}" cy="${Y(30)}" rx="${R(50)}" ry="${R(14)}" fill="${TOP}" ${S}/>${baseEllipse(X(80), Y(140), R(50), R(14))}`;
  if (kind === 'cone') return `<path d="M${X(25)} ${Y(140)} L${X(80)} ${Y(18)} L${X(135)} ${Y(140)} A${R(55)} ${R(15)} 0 0 1 ${X(25)} ${Y(140)} Z" fill="${FILL}" ${S}/>
<path d="M${X(25)} ${Y(140)} A${R(55)} ${R(15)} 0 0 1 ${X(135)} ${Y(140)}" fill="none" ${S} ${DASH}/>`;
  if (kind === 'sphere') return `<circle cx="${X(80)}" cy="${Y(85)}" r="${R(60)}" fill="${FILL}" ${S}/>${baseEllipse(X(80), Y(85), R(60), R(16))}`;
  if (kind === 'frustum') return `<path d="M${X(55)} ${Y(35)} L${X(25)} ${Y(140)} A${R(55)} ${R(15)} 0 0 0 ${X(135)} ${Y(140)} L${X(105)} ${Y(35)} Z" fill="${FILL}" ${S}/>
<ellipse cx="${X(80)}" cy="${Y(35)}" rx="${R(25)}" ry="${R(7)}" fill="${TOP}" ${S}/><path d="M${X(25)} ${Y(140)} A${R(55)} ${R(15)} 0 0 1 ${X(135)} ${Y(140)}" fill="none" ${S} ${DASH}/>`;
  if (kind === 'hemisphere') return `<path d="M${X(20)} ${Y(115)} A${R(60)} ${R(60)} 0 0 1 ${X(140)} ${Y(115)} A${R(60)} ${R(16)} 0 0 1 ${X(20)} ${Y(115)} Z" fill="${FILL}" ${S}/>
<path d="M${X(20)} ${Y(115)} A${R(60)} ${R(16)} 0 0 1 ${X(140)} ${Y(115)}" fill="none" ${S} ${DASH}/>`;
  if (kind === 'prism') {     // 삼각기둥
    const P = (x, y) => `${X(x)} ${Y(y)}`;
    return `<path d="M${P(25, 45)} L${P(105, 45)} L${P(140, 22)} L${P(140, 122)} L${P(105, 145)} L${P(25, 145)} Z" fill="${FILL}" ${S}/>
<path d="M${P(25, 45)} L${P(140, 22)} M${P(105, 45)} L${P(105, 145)}" fill="none" ${S}/><path d="M${P(25, 145)} L${P(140, 122)}" fill="none" ${S} ${DASH}/>`;
  }
  // 사각뿔
  const P = (x, y) => `${X(x)} ${Y(y)}`;
  return `<path d="M${P(80, 15)} L${P(22, 140)} L${P(112, 140)} L${P(140, 116)} Z" fill="${FILL}" ${S}/><path d="M${P(80, 15)} L${P(112, 140)}" fill="none" ${S}/>
<path d="M${P(80, 15)} L${P(50, 116)} M${P(22, 140)} L${P(50, 116)} L${P(140, 116)}" fill="none" ${S} ${DASH}/>`;
}
const NAME = { cylinder: '원기둥', cone: '원뿔', sphere: '구', frustum: '원뿔대', hemisphere: '반구', prism: '삼각기둥', pyramid: '사각뿔' };
const optSVG = kind => `${svgOpen(160, 165)}${solid(kind, 0, 0, 1)}</svg>`;

// 원기둥 (밑면 반지름 r, 높이 h 표시)
function cylinderFig(rLab, hLab, dLab) {
  const cx = 180, rx = 95, ry = 24, top = 58, bot = 200;
  return `${svgOpen(380, 240)}<path d="M${cx - rx} ${top} L${cx - rx} ${bot} A${rx} ${ry} 0 0 0 ${cx + rx} ${bot} L${cx + rx} ${top} Z" fill="${FILL}" ${S}/>
<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="${TOP}" ${S}/>${baseEllipse(cx, bot, rx, ry)}
${rLab ? `${L(cx, top, cx + rx, top, LIGHT)}${dot(cx, top)}${lab(cx + rx / 2, top - ry - 8, rLab, 20)}${L(cx + rx / 2, top - ry - 2, cx + rx / 2, top - 3, LIGHT, 1.5, '3 4')}` : ''}
${dLab ? `${L(cx - rx, top, cx + rx, top, LIGHT)}${dot(cx, top)}${lab(cx, top - ry - 8, dLab, 20)}` : ''}
${L(cx + rx + 14, top, cx + rx + 14, bot, LIGHT, 2)}${L(cx + rx + 8, top, cx + rx + 20, top, LIGHT, 2)}${L(cx + rx + 8, bot, cx + rx + 20, bot, LIGHT, 2)}
${lab(cx + rx + 24, (top + bot) / 2 + 8, hLab, 20, 'start')}</svg>`;
}
// 원뿔 (모선, 높이, 밑면 반지름 표시)
function coneFig(lLab, hLab, rLab) {
  const cx = 170, ax = 170, ay = 22, cy = 200, rx = 105, ry = 24;
  return `${svgOpen(380, 252)}<path d="M${cx - rx} ${cy} L${ax} ${ay} L${cx + rx} ${cy} A${rx} ${ry} 0 0 1 ${cx - rx} ${cy} Z" fill="${FILL}" ${S}/>
<path d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}" fill="none" ${S} ${DASH}/>
${L(ax, ay, cx, cy, LIGHT, 2.5, '7 6')}<path d="M${cx} ${cy - 14} H${cx + 14} V${cy}" fill="none" stroke="${LIGHT}" stroke-width="2"/>
${L(cx, cy, cx + rx, cy, LIGHT, 2.5)}${dot(cx, cy)}${dot(ax, ay)}
${lab(cx + rx / 2 + 26, (ay + cy) / 2 - 4, lLab, 21, 'start')}${lab(cx + 10, cy - 40, hLab, 20, 'start')}${lab(cx + rx / 2, cy + 46, rLab, 21)}</svg>`;
}
// 구 (반지름 또는 지름 표시)
function sphereFig(label, diameter) {
  const cx = 190, cy = 118, R = 100;
  return `${svgOpen(380, 236)}<circle cx="${cx}" cy="${cy}" r="${R}" fill="${FILL}" ${S}/>${baseEllipse(cx, cy, R, 26)}
${diameter ? L(cx - R, cy, cx + R, cy, LIGHT, 2.5) : L(cx, cy, cx + R * 0.866, cy - R * 0.5, LIGHT, 2.5)}${dot(cx, cy)}
${diameter ? lab(cx, cy - 34, label, 21) : lab(cx + 22, cy - 40, label, 21)}</svg>`;
}
// 원기둥의 전개도: 밑면 원 2개 + 옆면 직사각형
function netFig(rLab, hLab, gaLab) {
  const x0 = 60, x1 = 300, top = 78, bot = 178, cx = 180, cr = 32;
  return `${svgOpen(380, 254)}<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bot - top}" fill="${FILL}" ${S}/>
<circle cx="${cx}" cy="${top - cr}" r="${cr}" fill="${TOP}" ${S}/><circle cx="${cx}" cy="${bot + cr}" r="${cr}" fill="${TOP}" ${S}/>
${L(cx, top - cr, cx + cr, top - cr, LIGHT, 2.5)}${dot(cx, top - cr)}${lab(cx + cr + 8, top - cr + 7, rLab, 19, 'start')}
${lab(cx, (top + bot) / 2 + 8, gaLab, 20)}
${L(x1 + 12, top, x1 + 12, bot, LIGHT, 2)}${L(x1 + 6, top, x1 + 18, top, LIGHT, 2)}${L(x1 + 6, bot, x1 + 18, bot, LIGHT, 2)}
${lab(x1 + 22, (top + bot) / 2 + 8, hLab, 19, 'start')}</svg>`;
}
// 돌리기: 기준이 되는 선(점선)과 도는 화살표
const axis = (x, y1, y2) => `${L(x, y1, x, y2, BLUE, 2.5, '8 6')}<path d="M${x - 34} ${y1 + 12} A34 9 0 1 0 ${x + 34} ${y1 + 12}" fill="none" stroke="${BLUE}" stroke-width="2.5"/><path d="M${x + 27} ${y1 + 4} L${x + 37} ${y1 + 12} L${x + 25} ${y1 + 16} Z" fill="${BLUE}"/>`;
function rotateFig(kind, a, bLab, c) {
  if (kind === 'rect') return `${svgOpen(380, 246)}${axis(150, 10, 236)}<rect x="150" y="50" width="130" height="150" fill="${FILL}" ${S}/>
${lab(215, 42, a, 20)}${lab(290, 132, bLab, 20, 'start')}</svg>`;
  if (kind === 'tri') return `${svgOpen(380, 246)}${axis(150, 10, 236)}<path d="M150 40 L150 200 L290 200 Z" fill="${FILL}" ${S}/>
<path d="M150 186 H164 V200" fill="none" stroke="${LIGHT}" stroke-width="2"/>${lab(220, 226, a, 20)}${lab(140, 126, bLab, 20, 'end')}${c ? lab(232, 112, c, 20, 'start') : ''}</svg>`;
  return `${svgOpen(380, 246)}${axis(150, 10, 236)}<path d="M150 33 A90 90 0 0 1 150 213 Z" fill="${FILL}" ${S}/>${lab(140, 128, a, 20, 'end')}</svg>`;
}

// ---------- 고르기 문장 (맞는 말 1개 + 틀린 말 3개) ----------
const FACTS = {
  cylinder: { name: '원기둥',
    t: ['두 밑면은 서로 평행하고 합동인 원이에요.', '옆면은 굽은 면이에요.', '두 밑면에 수직인 선분의 길이를 높이라고 해요.', '밑면은 2개예요.'],
    f: ['밑면이 1개예요.', '꼭짓점이 1개 있어요.', '옆면은 평평한 면이에요.', '두 밑면의 크기가 서로 달라요.', '밑면의 모양은 삼각형이에요.'] },
  cone: { name: '원뿔',
    t: ['꼭짓점이 1개 있어요.', '모선은 셀 수 없이 많아요.', '밑면은 원 1개예요.', '모선의 길이는 높이보다 길어요.'],
    f: ['밑면이 2개예요.', '꼭짓점이 없어요.', '높이와 모선의 길이는 항상 같아요.', '모선은 1개뿐이에요.', '옆면은 평평한 면이에요.'] },
  sphere: { name: '구',
    t: ['어느 방향에서 보아도 모양이 원이에요.', '구의 중심은 1개예요.', '구의 반지름은 셀 수 없이 많아요.', '구의 지름은 반지름의 2배예요.'],
    f: ['꼭짓점이 1개 있어요.', '밑면이 2개 있어요.', '구의 반지름은 지름의 2배예요.', '평평한 면이 1개 있어요.', '구의 중심은 2개예요.'] },
};
function factChoice(kind) {
  const F = FACTS[kind], right = pick(F.t), opts = shuffle([right, ...shuffle(F.f.slice()).slice(0, 3)]);
  return { text: `${F.name}에 대한 설명으로 옳은 것을 고르세요.`, figs: [{ svg: kind === 'cylinder' ? cylinderFig('', '') : kind === 'cone' ? coneFig('', '', '') : sphereFig('', false), cap: F.name }],
    options: opts.map(o => `<span class="otext sm">${xml(o)}</span>`), answer: opts.indexOf(right), meta: { right } };
}
// 원기둥·원뿔·구 비교 문장 → 정답 도형
const COMPARE = [
  ['꼭짓점이 있는 입체도형은 무엇일까요?', 'cone'],
  ['밑면이 2개인 입체도형은 무엇일까요?', 'cylinder'],
  ['밑면이 없는 입체도형은 무엇일까요?', 'sphere'],
  ['위에서 본 모양은 원이고, 앞에서 본 모양은 삼각형인 입체도형은 무엇일까요?', 'cone'],
  ['위에서 본 모양은 원이고, 앞에서 본 모양은 직사각형인 입체도형은 무엇일까요?', 'cylinder'],
  ['위, 앞, 옆 어느 방향에서 보아도 모양이 원인 입체도형은 무엇일까요?', 'sphere'],
  ['평평한 면 없이 굽은 면으로만 둘러싸인 입체도형은 무엇일까요?', 'sphere'],
  ['평평한 면이 1개만 있는 입체도형은 무엇일까요?', 'cone'],
  ['평평한 면이 2개 있는 입체도형은 무엇일까요?', 'cylinder'],
];
const solidOpt = kind => `${optSVG(kind)}<span class="otext sm">${NAME[kind]}</span>`;

// ---------- 문제 유형 ----------
const TYPES = ['identify', 'cylParts', 'cylNet', 'coneParts', 'sphere', 'rotate', 'compare'];
const TYPE_LABEL = { identify: '입체도형 찾기', cylParts: '원기둥의 구성 요소', cylNet: '원기둥의 전개도', coneParts: '원뿔의 구성 요소',
  sphere: '구', rotate: '돌려 만든 입체도형', compare: '원기둥·원뿔·구 비교' };
const DISTRACT = { cylinder: ['frustum', 'prism', 'cone', 'pyramid', 'sphere'], cone: ['frustum', 'pyramid', 'cylinder', 'prism', 'hemisphere'], sphere: ['hemisphere', 'cylinder', 'cone', 'frustum'] };

function makeRaw(type) {
  // ① 입체도형 그림 고르기
  if (type === 'identify') {
    const target = pick(['cylinder', 'cone', 'sphere']), kinds = shuffle([target, ...shuffle(DISTRACT[target].slice()).slice(0, 3)]);
    return { type, text: `다음 중 ${b(NAME[target])}${J(NAME[target], '을를')} 고르세요.`, figs: [], options: kinds.map(optSVG), answer: kinds.indexOf(target), meta: { kinds } };
  }
  // ② 원기둥의 구성 요소
  if (type === 'cylParts') {
    if (Math.random() < 0.35) return { type, ...factChoice('cylinder') };
    const r = between(2, 12); let h = between(3, 20); if (h === r || h === 2 * r) h += 1;
    const ask = pick(['height', 'diam', 'rad']);
    if (ask === 'rad') { const d = 2 * r;  // 지름을 알려 주고 반지름 묻기
      return { type, text: `원기둥의 밑면의 지름이 ${b(d + ' cm')}예요. 밑면의 반지름은 몇 cm일까요?`, figs: [{ svg: cylinderFig('', `${h} cm`, `${d} cm`), cap: '밑면은 서로 합동인 원 2개' }], answer100: r * 100, unit: 'cm', meta: { r, h } }; }
    return { type, text: `원기둥을 보고 ${b(ask === 'height' ? '높이' : '밑면의 지름')}${J(ask === 'height' ? '높이' : '밑면의 지름', '이가')} 몇 cm인지 구하세요.`,
      figs: [{ svg: cylinderFig(`${r} cm`, `${h} cm`), cap: '두 밑면 사이의 거리가 높이' }], answer100: (ask === 'height' ? h : 2 * r) * 100, unit: 'cm', meta: { r, h, ask } };
  }
  // ③ 원기둥의 전개도: 옆면 가로 = 밑면의 둘레(원주), 세로 = 높이
  if (type === 'cylNet') {
    const P = pick([314, 314, 310, 300]), r = between(2, 10), h = between(3, 15), ga = 2 * r * P;
    const ask = pick(['ga', 'ga', 'r', 'area', 'what']);
    if (ask === 'what') {
      const opts = shuffle(['밑면의 둘레', '밑면의 지름', '밑면의 반지름', '원기둥의 높이']);
      return { type, text: '원기둥의 전개도에서 옆면의 가로와 길이가 같은 것을 고르세요.', figs: [{ svg: netFig('r', '세로', '옆면의 가로 = ?'), cap: '옆면을 말아서 원기둥을 만든다고 생각해 보아요' }],
        options: opts.map(o => `<span class="otext sm">${o}</span>`), answer: opts.indexOf('밑면의 둘레'), meta: {} };
    }
    if (ask === 'r') return { type, text: `원기둥의 전개도에서 옆면의 가로가 ${b(h2s(ga) + ' cm')}예요. 밑면의 반지름은 몇 cm일까요? ${piNote(P)}`,
      figs: [{ svg: netFig('?', `${h} cm`, `가로 ${h2s(ga)} cm`), cap: '옆면의 가로 = 밑면의 둘레' }], answer100: r * 100, unit: 'cm', meta: { r, P } };
    if (ask === 'area') return { type, text: `밑면의 반지름이 ${b(r + ' cm')}, 높이가 ${b(h + ' cm')}인 원기둥의 전개도를 그렸어요. 옆면의 넓이는 몇 cm²일까요? ${piNote(P)}`,
      figs: [{ svg: netFig(`${r} cm`, `${h} cm`, '옆면'), cap: '옆면 넓이 = 가로 × 세로' }], answer100: ga * h, unit: 'cm²', meta: { r, h, P } };
    return { type, text: `밑면의 반지름이 ${b(r + ' cm')}, 높이가 ${b(h + ' cm')}인 원기둥의 전개도를 그렸어요. 옆면의 가로는 몇 cm일까요? ${piNote(P)}`,
      figs: [{ svg: netFig(`${r} cm`, `${h} cm`, '가로 = ?'), cap: '옆면의 가로 = 밑면의 둘레' }], answer100: ga, unit: 'cm', meta: { r, h, P } };
  }
  // ④ 원뿔의 구성 요소: 모선, 높이, 밑면의 지름
  if (type === 'coneParts') {
    if (Math.random() < 0.35) return { type, ...factChoice('cone') };
    const [r, h, l] = pick(TRIPLES), ask = pick(['l', 'h', 'd']);
    const word = { l: '모선의 길이', h: '높이', d: '밑면의 지름' }[ask];
    return { type, text: `원뿔을 보고 ${b(word)}${J(word, '이가')} 몇 cm인지 구하세요.`, figs: [{ svg: coneFig(`${l} cm`, `${h} cm`, `${r} cm`), cap: '꼭짓점과 밑면 둘레의 한 점을 이은 선분이 모선' }],
      answer100: { l, h, d: 2 * r }[ask] * 100, unit: 'cm', meta: { r, h, l, ask } };
  }
  // ⑤ 구
  if (type === 'sphere') {
    if (Math.random() < 0.3) return { type, ...factChoice('sphere') };
    const r = between(2, 15), ask = pick(['d', 'r', 'semi']);
    if (ask === 'd') return { type, text: `구의 반지름이 ${b(r + ' cm')}예요. 구의 지름은 몇 cm일까요?`, figs: [{ svg: sphereFig(`${r} cm`, false), cap: '구의 중심에서 겉면까지가 반지름' }], answer100: 2 * r * 100, unit: 'cm', meta: { r } };
    if (ask === 'r') return { type, text: `구의 지름이 ${b(2 * r + ' cm')}예요. 구의 반지름은 몇 cm일까요?`, figs: [{ svg: sphereFig(`${2 * r} cm`, true), cap: '지름 = 반지름 × 2' }], answer100: r * 100, unit: 'cm', meta: { r } };
    return { type, text: `지름이 ${b(2 * r + ' cm')}인 반원을 지름을 기준으로 한 바퀴 돌려 구를 만들었어요. 이 구의 반지름은 몇 cm일까요?`,
      figs: [{ svg: rotateFig('semi', `${2 * r} cm`), cap: '반원의 지름이 구의 지름' }], answer100: r * 100, unit: 'cm', meta: { r } };
  }
  // ⑥ 돌려 만든 입체도형
  if (type === 'rotate') {
    const kind = pick(['rect', 'tri', 'which']);
    if (kind === 'which') {
      const shape = pick(['rect', 'tri', 'semi']), right = { rect: 'cylinder', tri: 'cone', semi: 'sphere' }[shape];
      const kinds = ['cylinder', 'cone', 'sphere'];
      const nm = { rect: '직사각형', tri: '직각삼각형', semi: '반원' }[shape];
      return { type, text: `${nm}${J(nm, '을를')} 파란 점선을 기준으로 한 바퀴 돌리면 어떤 입체도형이 될까요?`,
        figs: [{ svg: rotateFig(shape, '', '', ''), cap: '한 바퀴 돌려요' }], options: kinds.map(solidOpt), answer: kinds.indexOf(right), meta: { shape } };
    }
    if (kind === 'rect') {
      const a = between(2, 10); let h = between(3, 15); if (h === a || h === 2 * a) h += 1;
      const ask = pick(['d', 'h']);
      return { type, text: `가로 ${b(a + ' cm')}, 세로 ${b(h + ' cm')}인 직사각형을 세로를 기준으로 한 바퀴 돌려 원기둥을 만들었어요. 원기둥의 ${b(ask === 'd' ? '밑면의 지름' : '높이')}${J(ask === 'd' ? '밑면의 지름' : '높이', '은는')} 몇 cm일까요?`,
        figs: [{ svg: rotateFig('rect', `${a} cm`, `${h} cm`), cap: ask === 'd' ? '가로가 밑면의 반지름이 돼요' : '세로가 원기둥의 높이가 돼요' }], answer100: (ask === 'd' ? 2 * a : h) * 100, unit: 'cm', meta: { a, h, ask } };
    }
    const [r, h, l] = pick(TRIPLES), ask = pick(['d', 'h', 'l']);
    const word = { d: '밑면의 지름', h: '높이', l: '모선의 길이' }[ask];
    return { type, text: `직각삼각형을 길이가 ${b(h + ' cm')}인 변을 기준으로 한 바퀴 돌려 원뿔을 만들었어요. 원뿔의 ${b(word)}${J(word, '은는')} 몇 cm일까요?`,
      figs: [{ svg: rotateFig('tri', `${r} cm`, `${h} cm`, `${l} cm`), cap: '밑변이 밑면의 반지름, 빗변이 모선' }], answer100: { d: 2 * r, h, l }[ask] * 100, unit: 'cm', meta: { r, h, l, ask } };
  }
  // ⑦ 원기둥·원뿔·구 비교
  const [q, right] = pick(COMPARE), kinds = ['cylinder', 'cone', 'sphere'];
  return { type: 'compare', text: q, figs: [], options: kinds.map(solidOpt), answer: kinds.indexOf(right), meta: { right } };
}

function makeProblem(type) {
  const p = makeRaw(type);
  if (p.answer100 !== undefined) p.answer = Number(h2s(p.answer100));
  return p;
}
const publicProblem = p => ({ id: p.id, type: p.type, label: TYPE_LABEL[p.type], text: p.text, figs: p.figs, options: p.options || null, unit: p.unit || '' });
function check(p, value) {
  if (p.options) return String(value ?? '').trim() !== '' && Number(value) === p.answer;
  const v = String(value ?? '').trim().replace(/,/g, '').replace(/\s/g, '').replace(/(cm²|cm2|㎠|cm)$/i, '');
  if (!/^\d*\.?\d+$/.test(v)) return false;
  return Math.round(Number(v) * 1000) === p.answer100 * 10;
}

module.exports = { publicProblem, check, TYPES, TYPE_LABEL, makeProblem, h2s, FACTS, COMPARE, NAME };
