// =============================================================
//  6학년 수학 단원 목록
//  - file이 있는 단원만 선생님이 고를 수 있어요. (file: null 이면 '준비 중'으로 보여요)
//  - 새 단원을 만들면 이 폴더에 파일을 넣고 file 칸에 파일 이름만 적으면 돼요.
//  - 단원 파일은 { TYPES, makeProblem, publicProblem, check } 를 내보내야 해요.
// =============================================================
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const UNITS = [
  { id: 'g6s1u1', sem: 1, no: 1, name: '분수의 나눗셈',            file: 'g6s1u1-fraction-division.js' },
  { id: 'g6s1u2', sem: 1, no: 2, name: '각기둥과 각뿔',            file: 'g6s1u2-prism-pyramid.js' },
  { id: 'g6s1u3', sem: 1, no: 3, name: '소수의 나눗셈',            file: 'g6s1u3-decimal-division.js' },
  { id: 'g6s1u4', sem: 1, no: 4, name: '비와 비율',                file: 'g6s1u4-ratio.js' },
  { id: 'g6s1u5', sem: 1, no: 5, name: '여러 가지 그래프',         file: 'g6s1u5-graphs.js' },
  { id: 'g6s1u6', sem: 1, no: 6, name: '직육면체의 부피와 겉넓이', file: 'g6s1u6-volume-surface.js' },
  { id: 'g6s2u1', sem: 2, no: 1, name: '분수의 나눗셈',            file: 'g6s2u1-fraction-division.js' },
  { id: 'g6s2u2', sem: 2, no: 2, name: '소수의 나눗셈',            file: 'g6s2u2-decimal-division.js' },
  { id: 'g6s2u3', sem: 2, no: 3, name: '공간과 입체',              file: 'g6s2u3-space-solid.js' },
  { id: 'g6s2u4', sem: 2, no: 4, name: '비례식과 비례배분',        file: 'g6s2u4-proportion.js' },
  { id: 'g6s2u5', sem: 2, no: 5, name: '원의 넓이',                file: 'g6s2u5-circle-area.js' },
  { id: 'g6s2u6', sem: 2, no: 6, name: '원기둥, 원뿔, 구',         file: 'g6s2u6-cylinder-cone-sphere.js' },
];
const MOD = {};
for (const u of UNITS) {
  u.ready = !!u.file;
  u.label = `${u.sem}학기 ${u.no}단원 ${u.name}`;
  if (u.file) MOD[u.id] = require('./' + u.file);
}
const BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]));
const DUP = new Set(UNITS.map(u => u.name).filter((n, i, a) => a.indexOf(n) !== i));   // 분수의 나눗셈, 소수의 나눗셈

// 고를 수 있는 단원만 남김 (모르는 값, 준비 중인 단원은 빠짐)
const validUnits = ids => { const set = new Set((Array.isArray(ids) ? ids : []).map(String)); return UNITS.filter(u => u.ready && set.has(u.id)).map(u => u.id); };
// (단원 순서는 항상 교과서 순서로 맞춤)

// 학생마다 [단원, 유형] 주머니를 섞어서 차례로 꺼냄 → 고른 단원의 모든 유형이 골고루 나옴
function nextProblem(stu, unitIds) {
  const ids = validUnits(unitIds);
  if (!ids.length) return null;
  const key = ids.join(',');
  if (stu.bagKey !== key || !stu.typeBag || !stu.typeBag.length) {
    stu.bagKey = key;
    stu.typeBag = shuffle(ids.flatMap(id => MOD[id].TYPES.map(t => [id, t])));
  }
  const [id, type] = stu.typeBag.pop();
  const p = MOD[id].makeProblem(type);
  p.chapter = id;
  return p;
}
// 학생에게 보낼 때는 정답을 뺌 (각 단원 파일의 publicProblem 사용)
function publicProblem(p) {
  const v = MOD[p.chapter].publicProblem(p), u = BY_ID[p.chapter];
  v.chapter = DUP.has(u.name) ? `${u.name}(${u.sem}학기)` : u.name;   // 1·2학기에 같은 이름 단원이 있으면 학기를 붙임
  return v;
}
const check = (p, value) => (p.options && String(value ?? '').trim() === '' ? false : MOD[p.chapter].check(p, value));   // 선택형에 빈 답은 오답
// 화면에 보여 줄 단원 목록
const unitList = () => UNITS.map(u => ({ id: u.id, sem: u.sem, no: u.no, name: u.name, label: u.label, ready: u.ready }));

module.exports = { UNITS, BY_ID, unitList, validUnits, nextProblem, publicProblem, check };
