// =============================================================
//  원의 넓이 문제 자동 생성 (6학년 2학기 5단원) — 기초·기본 문제만
//  서버에서만 실행 → 정답은 학생 화면에 가지 않음
//
//  7가지 유형
//   ① 원주율(원주 ÷ 지름, 원주율 개념 고르기)   ② 원주 구하기
//   ③ 원주로 지름·반지름 구하기                ④ 원의 넓이 어림하기(안·밖 정사각형)
//   ⑤ 원의 넓이 구하는 방법(잘라서 직사각형)     ⑥ 원의 넓이 구하기
//   ⑦ 여러 가지 원의 넓이(반원, 원의 1/4, 고리 모양, 정사각형 − 원)
//  소수 계산 오차가 없도록 길이·넓이는 모두 100배 한 정수(1/100 단위)로 계산해요.
//  원주율은 문제마다 3.14 / 3.1 / 3 중 하나를 문제 글에 알려 줘요.
// =============================================================
const rnd = n => Math.floor(Math.random() * n);
const between = (a, b) => a + rnd(b - a + 1);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = arr => arr[rnd(arr.length)];

// 1/100 단위 정수 → 글자 (끝의 0은 지움) 예) 3140 → '31.4', 7850 → '78.5', 500 → '5'
function h2s(v) {
  const neg = v < 0; let s = String(Math.abs(v)).padStart(3, '0');
  const ip = s.slice(0, -2), fp = s.slice(-2).replace(/0+$/, '');
  return (neg ? '-' : '') + (fp ? ip + '.' + fp : ip);
}
const b = s => `<b>${s}</b>`;
// 원주율 (1/100 단위): 3.14 → 314
const PIS = { 314: '3.14', 310: '3.1', 300: '3' };
const piNote = p => `(원주율: ${b(PIS[p])})`;

// ---------- 그림(SVG) ----------
const FONT = "Jua,'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const GOLD = '#F2B84B', LIGHT = '#FBE3A6', BLUE = '#7fb3ff', ORANGE = '#D18F2C', HOLE = '#140f0a';
const FILL = 'rgba(242,184,75,.16)', SHADE = 'rgba(242,184,75,.55)';
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svgOpen = (w, hgt) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" font-family="${FONT}" font-weight="700">`;
const lab = (x, y, t, fs = 24, anchor = 'middle') => `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="${anchor}" fill="${t.includes('?') ? BLUE : LIGHT}">${xml(t)}</text>`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${LIGHT}"/>`;
const seg = (x1, y1, x2, y2, c = LIGHT, dash = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="3" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;

// 원 하나: 지름(d) 또는 반지름(r) 선과 길이, 아래에 원주 표시
function circleSVG(kind, len, circum) {
  const cx = 190, cy = 122, R = 92;
  const line = kind === 'd'
    ? `${seg(cx - R, cy, cx + R, cy)}${dot(cx - R, cy)}${dot(cx + R, cy)}${dot(cx, cy)}${lab(cx, cy - 14, `지름 ${len}`)}`
    : `${seg(cx, cy, cx + R, cy)}${dot(cx, cy)}${dot(cx + R, cy)}${lab(cx + R / 2, cy - 14, `반지름 ${len}`, 22)}`;
  return `${svgOpen(380, circum ? 266 : 240)}<circle cx="${cx}" cy="${cy}" r="${R}" fill="${FILL}" stroke="${GOLD}" stroke-width="4"/>${line}
${circum ? lab(cx, 254, `원주 ${circum}`) : ''}</svg>`;
}
// 원 안과 밖의 정사각형 (넓이 어림)
function estimateSVG(d) {
  const cx = 190, cy = 120, R = 92;
  return `${svgOpen(380, 236)}
<rect x="${cx - R}" y="${cy - R}" width="${2 * R}" height="${2 * R}" fill="rgba(209,143,44,.18)" stroke="${ORANGE}" stroke-width="3"/>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="${FILL}" stroke="${GOLD}" stroke-width="4"/>
<path d="M${cx - R} ${cy} L${cx} ${cy - R} L${cx + R} ${cy} L${cx} ${cy + R} Z" fill="rgba(127,179,255,.16)" stroke="${BLUE}" stroke-width="3"/>
${seg(cx - R, cy, cx + R, cy, LIGHT, '7 6')}${lab(cx, cy + 30, `지름 ${d} cm`, 22)}</svg>`;
}
// 원을 잘게 잘라 붙인 직사각형
function rectSVG(r, gaLabel) {
  const ccx = 62, ccy = 118, R = 48, n = 12;
  let wedges = '';
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * 2 * Math.PI, a2 = ((i + 1) / n) * 2 * Math.PI;
    const p = (a) => `${(ccx + R * Math.cos(a)).toFixed(1)} ${(ccy + R * Math.sin(a)).toFixed(1)}`;
    wedges += `<path d="M${ccx} ${ccy} L${p(a1)} A${R} ${R} 0 0 1 ${p(a2)} Z" fill="${i % 2 ? 'rgba(209,143,44,.6)' : 'rgba(242,184,75,.35)'}" stroke="${GOLD}" stroke-width="1.5"/>`;
  }
  // 직사각형: 위쪽 꼭짓점 7개, 아래쪽은 반 칸씩 어긋나게 → 삼각형으로 빈틈없이 채움
  const x0 = 150, w = 190, top = 72, bot = 164, s = w / 6;
  const A = 'rgba(242,184,75,.35)', B = 'rgba(209,143,44,.6)';
  const tri = (d, f) => `<path d="${d}" fill="${f}" stroke="${GOLD}" stroke-width="1.5"/>`;
  let t = '';
  for (let k = 0; k < 6; k++) t += tri(`M${x0 + k * s} ${top} L${x0 + (k + 1) * s} ${top} L${x0 + (k + 0.5) * s} ${bot} Z`, A);
  for (let k = 1; k < 6; k++) t += tri(`M${x0 + (k - 0.5) * s} ${bot} L${x0 + (k + 0.5) * s} ${bot} L${x0 + k * s} ${top} Z`, B);
  t += tri(`M${x0} ${top} L${x0} ${bot} L${x0 + 0.5 * s} ${bot} Z`, B) + tri(`M${x0 + w} ${top} L${x0 + w} ${bot} L${x0 + w - 0.5 * s} ${bot} Z`, B);
  const my = (top + bot) / 2;
  return `${svgOpen(420, 230)}${wedges}${seg(ccx, ccy, ccx + R, ccy)}${lab(ccx + 24, ccy - 9, `${r} cm`, 16)}
<path d="M116 118 L134 118" stroke="${BLUE}" stroke-width="3"/><path d="M131 111 L141 118 L131 125 Z" fill="${BLUE}"/>
${t}<rect x="${x0}" y="${top}" width="${w}" height="${bot - top}" fill="none" stroke="${LIGHT}" stroke-width="2"/>
<path d="M${x0} 178 V184 H${x0 + w} V178" fill="none" stroke="${LIGHT}" stroke-width="2"/>${lab(x0 + w / 2, 210, gaLabel, 20)}
<path d="M${x0 + w + 8} ${top} H${x0 + w + 14} V${bot} H${x0 + w + 8}" fill="none" stroke="${LIGHT}" stroke-width="2"/>
${lab(x0 + w + 20, my - 6, '세로', 18, 'start')}${lab(x0 + w + 20, my + 18, `${r} cm`, 18, 'start')}</svg>`;
}
// 색칠한 부분이 있는 도형들
function shapeSVG(kind, a, c) {
  const cx = 190;
  if (kind === 'semi') {               // 반원: 지름 a
    const cy = 168, R = 130;
    return `${svgOpen(380, 214)}<path d="M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy} Z" fill="${SHADE}" stroke="${GOLD}" stroke-width="4"/>
${dot(cx - R, cy)}${dot(cx + R, cy)}${lab(cx, cy + 32, `${a} cm`)}</svg>`;
  }
  if (kind === 'quarter') {            // 원의 1/4: 반지름 a
    const ox = 110, oy = 200, R = 160;
    return `${svgOpen(380, 236)}<path d="M${ox} ${oy} L${ox + R} ${oy} A${R} ${R} 0 0 0 ${ox} ${oy - R} Z" fill="${SHADE}" stroke="${GOLD}" stroke-width="4"/>
<path d="M${ox} ${oy - 18} H${ox + 18} V${oy}" fill="none" stroke="${LIGHT}" stroke-width="2"/>${dot(ox, oy)}
${lab(ox + R / 2, oy + 28, `${a} cm`, 22)}${lab(ox - 12, oy - R / 2, `${a} cm`, 22, 'end')}</svg>`;
  }
  if (kind === 'ring') {               // 큰 원 반지름 a, 작은 원 반지름 c
    const cy = 118, R = 104, r = Math.round(R * c / a);
    return `${svgOpen(380, 236)}<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SHADE}" stroke="${GOLD}" stroke-width="4"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${HOLE}" stroke="${GOLD}" stroke-width="3"/>${dot(cx, cy)}
${seg(cx, cy, cx + R, cy)}${seg(cx, cy, cx - r * 0.7071, cy - r * 0.7071, BLUE)}
${lab(cx + R + 8, cy + 8, `${a} cm`, 21, 'start')}${lab(cx - 10, cy + 30, `${c} cm`, 19, 'end').replace(LIGHT, BLUE)}</svg>`;
  }
  // 정사각형 안에 꼭 맞는 원: 한 변 a
  const cy = 112, R = 92;
  return `${svgOpen(380, 236)}<rect x="${cx - R}" y="${cy - R}" width="${2 * R}" height="${2 * R}" fill="${SHADE}" stroke="${GOLD}" stroke-width="4"/>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="${HOLE}" stroke="${GOLD}" stroke-width="3"/>${lab(cx, cy + R + 30, `${a} cm`, 22)}</svg>`;
}

// ---------- 문제 유형 ----------
const TYPES = ['pi', 'circum', 'diameter', 'estimate', 'method', 'area', 'shapes'];
const TYPE_LABEL = { pi: '원주율', circum: '원주 구하기', diameter: '지름·반지름 구하기', estimate: '원의 넓이 어림하기',
  method: '원의 넓이 구하는 방법', area: '원의 넓이 구하기', shapes: '여러 가지 원의 넓이' };

// 원주율 개념 고르기: 맞는 말 1개 + 틀린 말 3개
const PI_TRUE = [
  '원의 크기와 관계없이 (원주) ÷ (지름)은 일정해요.',
  '원주율은 (원주) ÷ (지름)이에요.',
  '원주율은 3.1415926…과 같이 끝없이 이어져요.',
  '원주는 지름의 약 3배예요.',
];
const PI_FALSE = [
  '원이 클수록 원주율도 커져요.',
  '원주율은 (지름) ÷ (원주)예요.',
  '원주율은 3.14로 끝나는 수예요.',
  '원주는 지름의 약 2배예요.',
  '원주율은 반지름에 따라 달라져요.',
  '원주는 반지름의 약 3배예요.',
];

function makeRaw(type) {
  // ① 원주율
  if (type === 'pi') {
    if (Math.random() < 0.4) {
      const right = pick(PI_TRUE), opts = shuffle([right, ...shuffle(PI_FALSE.slice()).slice(0, 3)]);
      return { type, text: '원주율에 대한 설명으로 옳은 것을 고르세요.', figs: [], options: opts.map(o => `<span class="otext sm">${xml(o)}</span>`), answer: opts.indexOf(right), meta: { right } };
    }
    const d = between(2, 30), C = d * 314;
    if (Math.random() < 0.5) return { type, text: `원주가 ${b(h2s(C) + ' cm')}, 지름이 ${b(d + ' cm')}인 원이 있어요. (원주) ÷ (지름)은 얼마일까요?`,
      figs: [{ svg: circleSVG('d', `${d} cm`, `${h2s(C)} cm`), cap: '원주율 = 원주 ÷ 지름' }], answer100: 314, unit: '', meta: { d } };
    if (d % 2) return makeRaw('pi');
    return { type, text: `반지름이 ${b(d / 2 + ' cm')}인 원의 원주는 ${b(h2s(C) + ' cm')}예요. 이 원의 원주율은 얼마일까요?`,
      figs: [{ svg: circleSVG('r', `${d / 2} cm`, `${h2s(C)} cm`), cap: '지름은 반지름의 2배' }], answer100: 314, unit: '', meta: { d } };
  }
  // ② 원주 구하기: 원주 = 지름 × 원주율
  if (type === 'circum') {
    const P = pick([314, 314, 310, 300]), kind = pick(['d', 'd', 'r', 'word']);
    if (kind === 'word') {
      const d = between(3, 8) * 10;    // 굴렁쇠·바퀴 지름 30~80 cm
      const thing = pick(['굴렁쇠', '자전거 바퀴', '훌라후프']);
      return { type, text: `지름이 ${b(d + ' cm')}인 ${thing}를 한 바퀴 굴렸어요. 굴러간 거리는 몇 cm일까요? ${piNote(P)}`,
        figs: [{ svg: circleSVG('d', `${d} cm`, '?'), cap: '한 바퀴 굴러간 거리 = 원주' }], answer100: d * P, unit: 'cm', meta: { d, P } };
    }
    if (kind === 'r') {
      const r = between(2, 15);
      return { type, text: `반지름이 ${b(r + ' cm')}인 원의 원주는 몇 cm일까요? ${piNote(P)}`,
        figs: [{ svg: circleSVG('r', `${r} cm`, '?'), cap: '원주 = 지름 × 원주율' }], answer100: 2 * r * P, unit: 'cm', meta: { r, P } };
    }
    const d = between(2, 25);
    return { type, text: `지름이 ${b(d + ' cm')}인 원의 원주는 몇 cm일까요? ${piNote(P)}`,
      figs: [{ svg: circleSVG('d', `${d} cm`, '?'), cap: '원주 = 지름 × 원주율' }], answer100: d * P, unit: 'cm', meta: { d, P } };
  }
  // ③ 원주로 지름·반지름 구하기: 지름 = 원주 ÷ 원주율
  if (type === 'diameter') {
    const P = pick([314, 314, 310, 300]), askR = Math.random() < 0.4;
    const d = askR ? between(1, 12) * 2 : between(2, 25), C = d * P;
    if (askR) return { type, text: `원주가 ${b(h2s(C) + ' cm')}인 원의 반지름은 몇 cm일까요? ${piNote(P)}`,
      figs: [{ svg: circleSVG('r', '?', `${h2s(C)} cm`), cap: '지름 = 원주 ÷ 원주율, 반지름 = 지름 ÷ 2' }], answer100: d / 2 * 100, unit: 'cm', meta: { d, P } };
    return { type, text: `원주가 ${b(h2s(C) + ' cm')}인 원의 지름은 몇 cm일까요? ${piNote(P)}`,
      figs: [{ svg: circleSVG('d', '?', `${h2s(C)} cm`), cap: '지름 = 원주 ÷ 원주율' }], answer100: d * 100, unit: 'cm', meta: { d, P } };
  }
  // ④ 원의 넓이 어림하기: 원 안의 정사각형(지름 × 지름 ÷ 2) < 원 < 원 밖의 정사각형(지름 × 지름)
  if (type === 'estimate') {
    const d = between(2, 10) * 2, inner = d * d / 2, outer = d * d, askIn = Math.random() < 0.5;
    return { type, text: `지름이 ${b(d + ' cm')}인 원 안과 밖에 정사각형을 그렸어요.<br>원의 넓이는 ${askIn ? '□' : b(inner)} cm²보다 크고, ${askIn ? b(outer) : '□'} cm²보다 작아요. □ 안에 알맞은 수를 구하세요.`,
      figs: [{ svg: estimateSVG(d), cap: '안쪽 정사각형은 마름모처럼 대각선이 지름이에요' }], answer100: (askIn ? inner : outer) * 100, unit: '', meta: { d, askIn } };
  }
  // ⑤ 원의 넓이 구하는 방법: 원을 잘라 붙이면 가로 = 원주의 1/2, 세로 = 반지름
  if (type === 'method') {
    const P = pick([314, 314, 310, 300]), r = between(2, 10), ask = pick(['ga', 'ga', 'area']);
    if (ask === 'ga') return { type, text: `반지름이 ${b(r + ' cm')}인 원을 잘게 잘라서 직사각형 모양으로 붙였어요. 이 직사각형의 가로는 몇 cm일까요? ${piNote(P)}`,
      figs: [{ svg: rectSVG(r, '가로 = 원주의 1/2 = ?'), cap: '가로는 원주의 반, 세로는 반지름' }], answer100: r * P, unit: 'cm', meta: { r, P } };
    return { type, text: `반지름이 ${b(r + ' cm')}인 원을 잘게 잘라서 직사각형 모양으로 붙였어요. 이 직사각형의 넓이는 몇 cm²일까요? ${piNote(P)}`,
      figs: [{ svg: rectSVG(r, '가로 = 원주의 1/2'), cap: '직사각형 넓이 = 가로 × 세로' }], answer100: r * r * P, unit: 'cm²', meta: { r, P } };
  }
  // ⑥ 원의 넓이 구하기: 반지름 × 반지름 × 원주율 (넓이로 반지름 구하기도 조금)
  if (type === 'area') {
    const P = pick([314, 314, 310, 300]), kind = pick(['r', 'r', 'd', 'rev']);
    if (kind === 'rev') {
      const r = between(2, 10);
      return { type, text: `넓이가 ${b(h2s(r * r * P) + ' cm²')}인 원의 반지름은 몇 cm일까요? ${piNote(P)}`,
        figs: [{ svg: circleSVG('r', '?', null), cap: '반지름 × 반지름 = 넓이 ÷ 원주율' }], answer100: r * 100, unit: 'cm', meta: { r, P } };
    }
    if (kind === 'd') {
      const d = between(1, 10) * 2;
      return { type, text: `지름이 ${b(d + ' cm')}인 원의 넓이는 몇 cm²일까요? ${piNote(P)}`,
        figs: [{ svg: circleSVG('d', `${d} cm`, null), cap: '반지름을 먼저 구해요 (지름 ÷ 2)' }], answer100: (d / 2) * (d / 2) * P, unit: 'cm²', meta: { d, P } };
    }
    const r = between(2, 12);
    return { type, text: `반지름이 ${b(r + ' cm')}인 원의 넓이는 몇 cm²일까요? ${piNote(P)}`,
      figs: [{ svg: circleSVG('r', `${r} cm`, null), cap: '원의 넓이 = 반지름 × 반지름 × 원주율' }], answer100: r * r * P, unit: 'cm²', meta: { r, P } };
  }
  // ⑦ 여러 가지 원의 넓이 (색칠한 부분)
  const P = pick([314, 314, 310, 300]), kind = pick(['semi', 'quarter', 'ring', 'square']);
  if (kind === 'semi') {                 // 반원: 지름 d → 반지름 r = d ÷ 2
    const r = between(2, 10), d = 2 * r;
    return { type: 'shapes', text: `지름이 ${b(d + ' cm')}인 반원이에요. 반원의 넓이는 몇 cm²일까요? ${piNote(P)}`,
      figs: [{ svg: shapeSVG('semi', d), cap: '반원 = 원의 넓이 ÷ 2' }], answer100: r * r * P / 2, unit: 'cm²', meta: { r, P, kind } };
  }
  if (kind === 'quarter') {              // 원의 1/4: 반지름 짝수 → 1/100 단위로 딱 떨어짐
    const r = between(1, 6) * 2;
    return { type: 'shapes', text: `반지름이 ${b(r + ' cm')}인 원을 똑같이 4로 나눈 것 중 하나예요. 색칠한 부분의 넓이는 몇 cm²일까요? ${piNote(P)}`,
      figs: [{ svg: shapeSVG('quarter', r), cap: '원의 넓이 ÷ 4' }], answer100: r * r * P / 4, unit: 'cm²', meta: { r, P, kind } };
  }
  if (kind === 'ring') {                 // 큰 원 − 작은 원 (중심이 같은 원)
    const R = between(4, 10), r = between(2, R - 2);
    return { type: 'shapes', text: `중심이 같은 두 원이에요. 큰 원의 반지름은 ${b(R + ' cm')}, 작은 원의 반지름은 ${b(r + ' cm')}예요. 색칠한 부분의 넓이는 몇 cm²일까요? ${piNote(P)}`,
      figs: [{ svg: shapeSVG('ring', R, r), cap: '큰 원의 넓이 − 작은 원의 넓이' }], answer100: (R * R - r * r) * P, unit: 'cm²', meta: { R, r, P, kind } };
  }
  const r = between(2, 10), a = 2 * r;   // 정사각형 − 꼭 맞는 원
  return { type: 'shapes', text: `한 변이 ${b(a + ' cm')}인 정사각형 안에 꼭 맞는 원을 그렸어요. 색칠한 부분의 넓이는 몇 cm²일까요? ${piNote(P)}`,
    figs: [{ svg: shapeSVG('square', a), cap: '정사각형의 넓이 − 원의 넓이' }], answer100: a * a * 100 - r * r * P, unit: 'cm²', meta: { r, P, kind } };
}

// 숫자 문제는 정답을 answer(숫자)에도 넣어 둠 (테스트용 DEBUG_ANSWERS와 같은 형식)
function makeProblem(type) {
  const p = makeRaw(type);
  if (p.answer100 !== undefined) p.answer = Number(h2s(p.answer100));
  return p;
}
// 학생에게 보낼 때는 정답과 meta를 뺀다
const publicProblem = p => ({ id: p.id, type: p.type, label: TYPE_LABEL[p.type], text: p.text, figs: p.figs, options: p.options || null, unit: p.unit || '' });
// 채점: 선택형은 번호, 나머지는 숫자 (단위를 같이 써도 인정, 1/100 단위까지 정확히 같아야 정답)
function check(p, value) {
  if (p.options) return String(value ?? '').trim() !== '' && Number(value) === p.answer;
  const v = String(value ?? '').trim().replace(/,/g, '').replace(/\s/g, '').replace(/(cm²|cm2|㎠|cm|m²|m)$/i, '');
  if (!/^\d*\.?\d+$/.test(v)) return false;
  return Math.round(Number(v) * 1000) === p.answer100 * 10;
}
module.exports = { publicProblem, check, TYPES, TYPE_LABEL, makeProblem, h2s };
