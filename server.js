// =============================================================
//  던전 카드 모험 (6학년 수학 로그라이크 카드 대전) — 서버
//  · 여러 선생님이 같은 주소를 함께 써요. 선생님마다 반 이름으로 자기 반을 열어요.
//  · 교사 화면은 선생님들끼리 공유하는 교사 접속 비밀번호(TEACHER_PASSWORD)로 들어가요.
//  · 학생은 QR 코드를 찍거나 반을 찾아 학급 비밀번호로 들어와요.
//  실행: npm install → npm start  (기본 주소 http://localhost:3000)
// =============================================================
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const { CONFIG, CARDS, BASE_DECK, CHOICE_POOL, DROUGHT_POOL } = require('./game/cards');
const { Battle, botChoose, shuffle } = require('./game/battle');
const units = require('./game/units');
const { cardArtSVG, cardBackSVG } = require('./game/cardArt');

const PORT = process.env.PORT || 3000;
// 저장소가 공개라서 비밀번호는 코드에 적지 않고 Render 환경변수로만 넣어요
const TEACHER_PASSWORD = (process.env.TEACHER_PASSWORD || '').trim(); // 교사 화면 공통 접속 비밀번호 (선생님들끼리 공유)
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();     // 관리자 비밀번호 (모든 반 보기·닫기, 나만 사용)
const DEBUG_ANSWERS = process.env.DEBUG_ANSWERS === '1'; // 테스트용: 정답을 함께 보냄 (실제 수업에서는 절대 켜지 마세요)

const ROOM = {
  MAX_CLASSES: 60,                 // 동시에 열 수 있는 반 수 (서버 메모리 보호)
  MAX_STUDENTS: 30,                // 한 반 최대 인원
  CLASS_IDLE_MS: 60 * 60 * 1000,   // 아무도 접속하지 않은 채 1시간이 지난 반은 자동으로 닫음
  MAX_TOKENS: 30,                  // 한 반에 동시에 로그인해 둘 수 있는 교사 기기 수
};

if (process.env.FAST_TEST === '1') { CONFIG.REVEAL_SECONDS = 0.2; CONFIG.TURN_SECONDS = 4; } // 자동 테스트용

// 오류 하나 때문에 서버 전체가 꺼지지 않게 (꺼지면 모든 반이 사라짐)
process.on('uncaughtException', e => console.error('[오류]', e));
process.on('unhandledRejection', e => console.error('[오류]', e));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 15000 });
app.set('trust proxy', true); // Render 앞단을 거쳐도 https 주소를 제대로 알아내기 위해

// ---------- 그림: custom 폴더에 같은 이름의 파일이 있으면 그것을 사용 ----------
const CUSTOM = path.join(__dirname, 'public', 'img', 'custom');
const findCustom = (dir, name) => {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']) {
    const f = path.join(dir, `${name}.${ext}`); if (fs.existsSync(f)) return f;
  }
  return null;
};
app.get('/img/card/:id', (req, res) => {
  const id = req.params.id.replace(/[^a-z0-9_]/gi, '');
  const custom = findCustom(path.join(CUSTOM, 'cards'), id);
  res.set('Cache-Control', 'public, max-age=3600');
  if (custom) return res.sendFile(custom);
  const svg = cardArtSVG(id); if (!svg) return res.status(404).end();
  res.type('image/svg+xml').send(svg);
});
// 배경: maze1~4 (1~3 문제 풀이, 4 대기열), board(대결판). custom 폴더에 같은 이름이 있으면 그것을 사용
for (const name of ['maze1', 'maze2', 'maze3', 'maze4', 'board']) {
  app.get(`/img/${name}`, (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(findCustom(CUSTOM, name) || path.join(__dirname, 'public', 'img', `${name}.jpg`));
  });
}
app.get('/img/cardback', (req, res) => {
  const custom = findCustom(CUSTOM, 'cardback');
  if (custom) return res.sendFile(custom);
  res.type('image/svg+xml').send(cardBackSVG());
});
app.get('/health', (req, res) => res.send('ok'));
app.get('/teacher', (req, res) => res.sendFile(path.join(__dirname, 'public', 'teacher.html')));
// 반 입장용 QR 코드 (찍으면 학생 화면이 그 반을 고른 채로 열려요)
app.get('/qr', async (req, res) => {
  try {
    const name = cleanName(req.query.c).slice(0, 12);
    const url = `${req.protocol}://${req.get('host')}/` + (name ? `?c=${encodeURIComponent(name)}` : '');
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.set('Content-Type', 'image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(svg);
  } catch (e) { res.status(500).end(); }
});
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 반 (서버 메모리에만 저장) ----------
// 반 이름: 띄어쓰기 없이 한글·영문·숫자 2~12자 (예: 천곡64)
const NAME_RE = /^[0-9A-Za-z가-힣]{2,12}$/;
const SPW_RE = /^\S{2,20}$/; // 학급 비밀번호 (보통 숫자 4자리)
const classes = new Map();   // key(소문자 이름) -> 반
const battles = new Map();   // id -> { id, key, battle, nums: [numA, numB|null], timer, botTimer, remainingUntil, phase }
let battleSeq = 0;

function cleanName(s) { return String(s || '').normalize('NFC').replace(/\s/g, ''); }
function keyOf(name) { return cleanName(name).toLowerCase(); }
const newToken = () => crypto.randomBytes(16).toString('hex');
function hashPw(pw, salt) { return crypto.scryptSync(String(pw), salt, 32).toString('hex'); }
function samePw(pw, cls) {
  const a = Buffer.from(hashPw(pw, cls.salt), 'hex'), b = Buffer.from(cls.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const SCH = cls => 'c:' + cls.key;  // 반 학생 채널
const TCH = cls => 't:' + cls.key;  // 반 교사 채널

function newStudent(num) {
  return { num, socketId: null, token: null, stage: 'lobby', deck: BASE_DECK.slice(), problem: null, offer: null,
    wrongStreak: 0, feedback: null, drought: false, typeBag: [], bagKey: '', wins: 0, losses: 0, draws: 0,
    battleId: null, lastOpp: null, lastResult: null, round: 1 };
}
function createClass({ name, pw, spw, size, mode, unitIds }) {
  const salt = crypto.randomBytes(8).toString('hex');
  const cls = { id: newToken(), key: keyOf(name), code: name, salt, hash: hashPw(pw, salt), tokens: new Set(), spw,
    size, mode: mode === 'game' ? 'game' : 'quiz', units: unitIds, students: {}, matches: [],
    createdAt: Date.now(), lastActive: Date.now(), deleted: false };
  for (let n = 1; n <= size; n++) cls.students[n] = newStudent(n);
  classes.set(cls.key, cls);
  console.log(`[반 열림] ${name} · ${size}명 · ${unitNames(cls).join(', ')} (지금 열린 반 ${classes.size}개)`);
  sendClassList();
  return cls;
}
function addToken(cls) {
  const t = newToken(); cls.tokens.add(t);
  while (cls.tokens.size > ROOM.MAX_TOKENS) cls.tokens.delete(cls.tokens.values().next().value);
  return t;
}
const unitNames = cls => cls.units.map(id => units.BY_ID[id].name);
// 학생 화면의 '반 찾기' 목록 (반 이름만 보여 줌)
const classNames = () => [...classes.values()].map(c => c.code).sort((a, b) => a.localeCompare(b, 'ko'));
const sendClassList = () => io.to('browse').emit('classList', classNames());

function closeClass(cls, reason) {
  if (cls.deleted) return;
  cls.deleted = true;
  for (const rec of [...battles.values()]) if (rec.key === cls.key) { clearTimeout(rec.timer); clearTimeout(rec.botTimer); battles.delete(rec.id); }
  io.to(SCH(cls)).to(TCH(cls)).emit('classClosed', reason);
  for (const s of io.sockets.sockets.values()) if (s.data.kid === cls.id) { s.leave(SCH(cls)); s.leave(TCH(cls)); s.data.key = null; s.data.kid = null; s.data.num = null; s.data.teacher = false; }
  classes.delete(cls.key);
  sendClassList();
  console.log(`[반 닫힘] ${cls.code} · ${reason} (남은 반 ${classes.size}개)`);
}
// 아무도 접속하지 않은 채 오래된 반 정리 (5분마다 확인)
setInterval(() => {
  const now = Date.now();
  for (const cls of [...classes.values()]) {
    const n = (io.sockets.adapter.rooms.get(SCH(cls))?.size || 0) + (io.sockets.adapter.rooms.get(TCH(cls))?.size || 0);
    if (n === 0 && now - cls.lastActive > ROOM.CLASS_IDLE_MS) closeClass(cls, '오래 사용하지 않아 반이 자동으로 닫혔어요.');
  }
}, 5 * 60 * 1000).unref();

// 다음 단계로: 덱이 다 차면 대결 준비, 아니면 (문제 모드) 문제 / (게임 모드) 바로 카드 선택
function nextStep(cls, stu) {
  stu.problem = null; stu.feedback = null;
  if (stu.deck.length >= CONFIG.DECK_SIZE) { stu.stage = 'ready'; return; }
  if (cls.mode === 'game') { stu.offer = makeOffer(stu); stu.stage = 'offer'; }
  else { stu.stage = 'problem'; newProblem(cls, stu); }
}

const socketOf = stu => stu.socketId && io.sockets.sockets.get(stu.socketId);

function makeOffer(stu) {
  const pool = CHOICE_POOL.filter(id => !(CARDS[id].unique && stu.deck.includes(id)));
  return shuffle(pool.slice()).slice(0, 3);
}
let problemSeq = 0;
function newProblem(cls, stu) { stu.problem = units.nextProblem(stu, cls.units); stu.problem.id = ++problemSeq; stu.feedback = null; }

function studentView(cls, stu) {
  const v = { code: cls.code, mode: cls.mode, units: unitNames(cls), num: stu.num, stage: stu.stage, deck: stu.deck, deckSize: CONFIG.DECK_SIZE,
    feedback: stu.feedback, wrongStreak: stu.wrongStreak, drought: stu.drought, round: stu.round,
    record: { wins: stu.wins, losses: stu.losses, draws: stu.draws } };
  if (stu.stage === 'problem' && stu.problem) {
    v.problem = units.publicProblem(stu.problem);
    if (DEBUG_ANSWERS) v.problem.answer = stu.problem.answer;
  }
  if (stu.stage === 'offer') v.offer = stu.offer;
  if (stu.stage === 'queue') v.queue = queueInfo(cls);
  if (stu.stage === 'battle' && stu.battleId && battles.has(stu.battleId)) {
    const b = battles.get(stu.battleId);
    v.battle = b.battle.view('S' + stu.num);
    v.battle.remainingMs = Math.max(0, b.remainingUntil - Date.now());
    v.battle.phase = b.phase;
    if (b.phase === 'reveal' && b.battle.lastReveal) {
      const me = b.battle.lastReveal.find(r => r.id === 'S' + stu.num), op = b.battle.lastReveal.find(r => r.id !== 'S' + stu.num);
      v.battle.reveal = { me, op };
    }
  }
  if (stu.stage === 'result') v.result = stu.lastResult;
  if (stu.stage === 'inherit') v.acquired = stu.deck.slice(BASE_DECK.length);
  return v;
}
function push(cls, stu) { const s = socketOf(stu); if (s) s.emit('state', studentView(cls, stu)); }
function pushAll(cls) { for (const stu of Object.values(cls.students)) if (stu.stage === 'queue') push(cls, stu); }

// ---------- 매칭: 접속한 학생이 모두 대기열에 들어오면 무작위로 짝 짓기 ----------
function queueInfo(cls) {
  const online = Object.values(cls.students).filter(s => s.socketId);
  return { waiting: online.filter(s => s.stage === 'queue').length, online: online.length };
}
function tryMatch(cls, force = false) {
  const online = Object.values(cls.students).filter(s => s.socketId);
  const queued = online.filter(s => s.stage === 'queue');
  if (!queued.length) return;
  if (!force && queued.length < online.length) { pushAll(cls); return; }
  // 직전 상대와 다시 만나지 않도록 여러 번 섞어서 가장 좋은 조합 선택
  let best = null, bestRepeat = Infinity;
  for (let t = 0; t < 40; t++) {
    const order = shuffle(queued.slice()); let rep = 0;
    for (let i = 0; i + 1 < order.length; i += 2) if (order[i].lastOpp === order[i + 1].num || order[i + 1].lastOpp === order[i].num) rep++;
    if (rep < bestRepeat) { bestRepeat = rep; best = order; } if (rep === 0) break;
  }
  for (let i = 0; i < best.length; i += 2) startBattle(cls, best[i], best[i + 1] || null);
  teacherPush(cls);
}
function botDeck() {
  const deck = BASE_DECK.slice();
  while (deck.length < CONFIG.DECK_SIZE) {
    const offer = shuffle(CHOICE_POOL.filter(id => !(CARDS[id].unique && deck.includes(id)))).slice(0, 3);
    deck.push(offer[Math.floor(Math.random() * 3)]);
  }
  return deck;
}

// ---------- 대결 진행 ----------
function startBattle(cls, a, b) {
  const id = 'B' + (++battleSeq);
  const sideA = { id: 'S' + a.num, name: `${a.num}번`, deck: a.deck };
  const sideB = b ? { id: 'S' + b.num, name: `${b.num}번`, deck: b.deck } : { id: 'BOT', name: '연습 로봇', deck: botDeck(), isBot: true };
  const rec = { id, key: cls.key, battle: new Battle(sideA, sideB), nums: [a.num, b ? b.num : null], timer: null, botTimer: null, remainingUntil: 0, phase: 'choose' };
  battles.set(id, rec);
  for (const s of [a, b]) if (s) { s.stage = 'battle'; s.battleId = id; }
  beginTurn(rec);
}
const clsOf = rec => { const c = classes.get(rec.key); return c && !c.deleted ? c : null; };
function humans(rec) { const cls = clsOf(rec); return cls ? rec.nums.filter(n => n).map(n => cls.students[n]) : []; }
function pushBattle(rec) { const cls = clsOf(rec); if (!cls) return; for (const s of humans(rec)) push(cls, s); }

function beginTurn(rec) {
  if (!battles.has(rec.id)) return;
  const B = rec.battle;
  B.startTurn();
  rec.phase = 'choose';
  if (B.turn > 150) { // 안전장치: 너무 길어지면 HP로 판정
    const [x, y] = B.sides; B.over = true; B.winner = x.hp === y.hp ? 'draw' : (x.hp > y.hp ? x.id : y.id);
    return endBattle(rec);
  }
  rec.remainingUntil = Date.now() + CONFIG.TURN_SECONDS * 1000;
  clearTimeout(rec.timer); clearTimeout(rec.botTimer);
  rec.timer = setTimeout(() => { B.timeoutAll(); finishTurn(rec); }, CONFIG.TURN_SECONDS * 1000 + 300);
  const bot = B.sides.find(s => s.isBot);
  if (bot && bot.choice === undefined) rec.botTimer = setTimeout(() => { B.choose(bot.id, botChoose(B, bot.id)); if (B.bothChosen()) finishTurn(rec); else pushBattle(rec); }, 1200 + Math.random() * 2500);
  // 둘 다 낼 카드가 없으면 잠깐 보여 주고 바로 진행
  if (B.bothChosen()) { clearTimeout(rec.timer); rec.timer = setTimeout(() => finishTurn(rec), 1500); }
  pushBattle(rec);
}
function finishTurn(rec) {
  if (rec.phase !== 'choose' || !battles.has(rec.id)) return;
  clearTimeout(rec.timer); clearTimeout(rec.botTimer);
  rec.battle.resolve();
  rec.phase = 'reveal';
  rec.remainingUntil = Date.now() + CONFIG.REVEAL_SECONDS * 1000;
  pushBattle(rec);
  rec.timer = setTimeout(() => { if (rec.battle.over) endBattle(rec); else beginTurn(rec); }, CONFIG.REVEAL_SECONDS * 1000);
}
function endBattle(rec, forfeitNum = null) {
  clearTimeout(rec.timer); clearTimeout(rec.botTimer);
  const B = rec.battle, cls = clsOf(rec);
  battles.delete(rec.id);
  if (!cls) return;
  let winner = B.winner;
  if (forfeitNum) { const other = B.sides.find(s => s.id !== 'S' + forfeitNum); winner = other.id; }
  const [x, y] = B.sides;
  cls.matches.unshift({ time: Date.now(), a: x.name, b: y.name, winner: winner === 'draw' ? '무승부' : B.side(winner).name, turns: B.turn, hp: `${Math.max(0, x.hp)} : ${Math.max(0, y.hp)}` });
  cls.matches = cls.matches.slice(0, 200);
  for (const stu of humans(rec)) {
    if (stu.battleId !== rec.id) continue;
    const myId = 'S' + stu.num, op = B.other(myId);
    const result = winner === 'draw' ? 'draw' : (winner === myId ? 'win' : 'lose');
    if (result === 'win') stu.wins++; else if (result === 'lose') stu.losses++; else stu.draws++;
    stu.lastOpp = op.isBot ? null : Number(op.id.slice(1));
    stu.lastResult = { result, opponent: op.name, turns: B.turn, myHp: Math.max(0, B.side(myId).hp), opHp: Math.max(0, op.hp), forfeit: !!forfeitNum };
    stu.stage = 'result'; stu.battleId = null;
    push(cls, stu);
  }
  teacherPush(cls);
}

// ---------- 소켓 ----------
io.on('connection', socket => {
  // 처리 중 오류가 나도 서버가 꺼지지 않게 감싸기
  const on = (ev, fn) => socket.on(ev, (...args) => { try { fn(...args); } catch (e) { console.error(`[오류] ${ev}`, e); } });
  const cbOf = cb => (typeof cb === 'function' ? cb : () => {});
  // 지금 들어와 있는 반 (닫혔거나 같은 이름으로 새로 만든 반이면 null)
  const K = () => {
    const cls = socket.data.key ? classes.get(socket.data.key) : null;
    if (!cls || cls.id !== socket.data.kid) return null;
    cls.lastActive = Date.now();
    return cls;
  };
  const ctx = () => { const cls = K(); const stu = cls && socket.data.num ? cls.students[socket.data.num] : null;
    return stu && stu.socketId === socket.id ? { cls, stu } : null; };
  // 비밀번호를 연달아 틀리면 잠깐 막기 (1분에 8번까지)
  const tooMany = () => {
    const now = Date.now();
    if (!socket.data.failAt || now - socket.data.failAt > 60000) { socket.data.failAt = now; socket.data.fails = 0; }
    return socket.data.fails >= 8;
  };
  const failed = () => { socket.data.fails = (socket.data.fails || 0) + 1; };
  // 지금 반에서 나가기 (학생이면 번호도 비움)
  const leaveCurrent = () => {
    const cls = K();
    if (cls && socket.data.num) {
      const stu = cls.students[socket.data.num];
      if (stu && stu.socketId === socket.id) { stu.socketId = null; teacherPush(cls); tryMatch(cls); }
    }
    for (const r of [...socket.rooms]) if (r.startsWith('c:') || r.startsWith('t:')) socket.leave(r);
    socket.data.key = null; socket.data.kid = null; socket.data.num = null; socket.data.teacher = false;
  };

  socket.emit('catalog', { cards: CARDS, config: CONFIG, base: BASE_DECK, choice: CHOICE_POOL });

  // ---------- 학생: 반 찾기 → 학급 비밀번호 → 번호 ----------
  on('browse', cb => { socket.join('browse'); cbOf(cb)(classNames()); });

  on('joinClass', (data, cb) => {
    cb = cbOf(cb);
    const cls = classes.get(keyOf(data && data.name));
    if (!cls) return cb({ ok: false, noClass: true, msg: '그런 반이 없어요. 선생님이 반을 열었는지 확인해 주세요.' });
    if (socket.data.kid !== cls.id || socket.data.teacher) {
      if (tooMany()) return cb({ ok: false, msg: '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.' });
      if (String((data && data.pw) || '').trim() !== cls.spw) { failed(); return cb({ ok: false, badPw: true, msg: '학급 비밀번호가 맞지 않아요.' }); }
      leaveCurrent(); socket.data.key = cls.key; socket.data.kid = cls.id; socket.join(SCH(cls));
    }
    socket.leave('browse');
    cls.lastActive = Date.now();
    cb({ ok: true, name: cls.code });
  });
  on('leaveClass', () => leaveCurrent());

  on('numbers', cb => {
    cb = cbOf(cb);
    const cls = K(); if (!cls || socket.data.teacher) return cb(null);
    cb({ name: cls.code, list: Object.values(cls.students).map(s => ({ num: s.num, online: !!s.socketId && s.socketId !== socket.id, cards: s.deck.length })) });
  });
  on('join', (data, cb) => {
    cb = cbOf(cb);
    const cls = K(); if (!cls || socket.data.teacher) return cb({ ok: false, needClass: true, msg: '반에 먼저 들어와 주세요.' });
    const num = parseInt(data && data.num, 10), token = String((data && data.token) || '').slice(0, 64);
    const stu = cls.students[num];
    if (!stu) return cb({ ok: false, msg: '번호를 찾을 수 없어요.' });
    const old = stu.socketId && stu.socketId !== socket.id ? io.sockets.sockets.get(stu.socketId) : null;
    // 다른 기기가 이 번호로 들어와 있으면 막음 (같은 기기에서 새로고침한 경우는 이어서 들어감)
    if (old && stu.token && stu.token !== token) return cb({ ok: false, msg: '이미 다른 기기에서 접속 중인 번호예요. 내 번호가 맞는지 확인해 주세요.' });
    if (old) { old.data.num = null; old.emit('kicked', '다른 화면에서 같은 번호로 들어왔어요.'); }
    // 같은 기기에서 다른 번호로 바꿔 들어오면 예전 번호는 비움
    if (socket.data.num && socket.data.num !== num) { const prev = cls.students[socket.data.num]; if (prev && prev.socketId === socket.id) prev.socketId = null; }
    stu.socketId = socket.id; stu.token = token; socket.data.num = num;
    cb({ ok: true }); push(cls, stu); teacherPush(cls);
    if (stu.stage === 'queue') tryMatch(cls); else pushAll(cls);
  });
  on('leaveNum', () => { const c = ctx(); if (!c) return; c.stu.socketId = null; socket.data.num = null; teacherPush(c.cls); tryMatch(c.cls); });

  on('start', () => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'lobby') return push(cls, stu);
    nextStep(cls, stu);
    push(cls, stu); teacherPush(cls);
  });
  on('answer', ({ value } = {}) => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'problem' || !stu.problem) return;
    if (units.check(stu.problem, value)) {
      stu.wrongStreak = 0; stu.offer = makeOffer(stu); stu.stage = 'offer'; stu.feedback = null;
    } else {
      stu.wrongStreak++;
      if (stu.wrongStreak >= CONFIG.DROUGHT_WRONG) {
        // 가뭄 덱: 남은 빈칸만 가뭄 카드로 채움
        while (stu.deck.length < CONFIG.DECK_SIZE) stu.deck.push(DROUGHT_POOL[Math.floor(Math.random() * DROUGHT_POOL.length)]);
        stu.drought = true; stu.stage = 'ready'; stu.problem = null;
      } else stu.feedback = { wrong: true, at: Date.now() };
    }
    push(cls, stu); teacherPush(cls);
  });
  on('pick', ({ index } = {}) => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'offer' || !stu.offer || !stu.offer[index]) return;
    stu.deck.push(stu.offer[index]); stu.offer = null;
    nextStep(cls, stu);
    push(cls, stu); teacherPush(cls);
  });
  on('queue', () => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'ready') return;
    stu.stage = 'queue'; push(cls, stu); teacherPush(cls); tryMatch(cls);
  });
  on('leaveQueue', () => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'queue') return; stu.stage = 'ready'; push(cls, stu); pushAll(cls); teacherPush(cls);
  });
  on('choose', ({ index } = {}) => { const c = ctx(); if (!c) return; const { stu } = c;
    const rec = stu.battleId && battles.get(stu.battleId); if (!rec || rec.phase !== 'choose') return;
    if (rec.battle.choose('S' + stu.num, index === null ? null : Number(index))) {
      if (rec.battle.bothChosen()) finishTurn(rec); else pushBattle(rec);
    }
  });
  on('toInherit', () => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'result') return; stu.stage = 'inherit'; push(cls, stu);
  });
  on('keep', ({ indices } = {}) => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'inherit') return;
    const acquired = stu.deck.slice(BASE_DECK.length);
    const uniq = [...new Set((indices || []).map(Number))].filter(i => i >= 0 && i < acquired.length);
    if (uniq.length !== Math.min(CONFIG.KEEP_COUNT, acquired.length)) return;
    stu.deck = BASE_DECK.concat(uniq.map(i => acquired[i]));
    stu.round++; stu.drought = false; stu.wrongStreak = 0; nextStep(cls, stu);
    push(cls, stu); teacherPush(cls);
  });
  on('disconnect', () => {
    const cls = K(); if (!cls || !socket.data.num) return;
    const stu = cls.students[socket.data.num];
    if (stu && stu.socketId === socket.id) stu.socketId = null;
    teacherPush(cls); tryMatch(cls);
  });

  // ---------- 교사: 공통 접속 비밀번호 / 반 만들기 / 들어가기 ----------
  const gateErr = gate => {
    if (!TEACHER_PASSWORD) return '서버에 교사 접속 비밀번호가 설정되지 않았어요. Render 환경변수 TEACHER_PASSWORD를 넣어 주세요.';
    if (tooMany()) return '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.';
    if (String(gate || '').trim() !== TEACHER_PASSWORD) { failed(); return '접속 비밀번호가 맞지 않아요.'; }
    return '';
  };
  on('teacherGate', (data, cb) => { cb = cbOf(cb); const err = gateErr(data && data.gate);
    cb(err ? { ok: false, msg: err } : { ok: true, units: units.unitList(), adminEnabled: !!ADMIN_PASSWORD, maxStudents: ROOM.MAX_STUDENTS }); });

  on('createClass', (data, cb) => {
    cb = cbOf(cb); data = data || {};
    const gErr = gateErr(data.gate); if (gErr) return cb({ ok: false, gate: true, msg: gErr });
    const name = cleanName(data.name), pw = String(data.pw || ''), spw = String(data.spw || '').trim();
    const size = parseInt(data.size, 10), unitIds = units.validUnits(data.units);
    if (!NAME_RE.test(name)) return cb({ ok: false, msg: '반 이름은 띄어쓰기 없이 한글·영문·숫자 2~12자로 써 주세요. (예: 천곡64)' });
    if (!SPW_RE.test(spw)) return cb({ ok: false, msg: '학급 비밀번호는 띄어쓰기 없이 2~20자로 정해 주세요. (예: 숫자 4자리)' });
    if (pw.length < 4 || pw.length > 20) return cb({ ok: false, msg: '학급 관리 비밀번호(교사용)는 4~20자로 정해 주세요.' });
    if (!(size >= 1 && size <= ROOM.MAX_STUDENTS)) return cb({ ok: false, msg: `학생 수는 1~${ROOM.MAX_STUDENTS}명으로 정해 주세요.` });
    if (!unitIds.length) return cb({ ok: false, msg: '문제로 낼 단원을 하나 이상 골라 주세요.' });
    if (classes.has(keyOf(name))) return cb({ ok: false, msg: '이미 열려 있는 반 이름이에요. 우리 반이면 「우리 반 들어가기」로 들어가고, 아니면 다른 이름을 써 주세요.' });
    if (classes.size >= ROOM.MAX_CLASSES) return cb({ ok: false, msg: '지금 열린 반이 너무 많아요. 잠시 뒤에 다시 해 주세요.' });
    const cls = createClass({ name, pw, spw, size, mode: data.mode, unitIds });
    cb({ ok: true, name: cls.code, token: addToken(cls) });
  });
  on('teacherLogin', (data, cb) => {
    cb = cbOf(cb); data = data || {};
    const gErr = gateErr(data.gate); if (gErr) return cb({ ok: false, gate: true, msg: gErr });
    const cls = classes.get(keyOf(data.name));
    if (!cls) return cb({ ok: false, msg: '그런 반이 없어요. 서버가 다시 켜지면 반이 사라질 수 있어요. 「새 반 만들기」로 다시 만들어 주세요.' });
    if (!samePw(String(data.pw || ''), cls)) { failed(); return cb({ ok: false, msg: '학급 관리 비밀번호가 맞지 않아요.' }); }
    cb({ ok: true, name: cls.code, token: addToken(cls) });
  });
  on('teacherJoin', (data, cb) => {
    cb = cbOf(cb); data = data || {};
    const cls = classes.get(keyOf(data.name)), token = String(data.token || '');
    if (!cls || !cls.tokens.has(token)) return cb({ ok: false, msg: cls ? '다시 로그인해 주세요.' : '반이 닫혔거나 서버가 다시 켜져서 반이 없어요. 반을 다시 만들어 주세요.' });
    if (socket.data.kid !== cls.id || !socket.data.teacher) {
      leaveCurrent();
      socket.data.key = cls.key; socket.data.kid = cls.id; socket.data.teacher = true; socket.join(TCH(cls));
    }
    socket.leave('browse');
    cls.lastActive = Date.now();
    cb({ ok: true, name: cls.code, units: units.unitList() });
    socket.emit('tState', teacherState(cls));
  });
  on('teacherLogout', data => { const cls = K(); if (cls && socket.data.teacher && data && data.token) cls.tokens.delete(String(data.token)); leaveCurrent(); });

  // 교사로 들어와 있는 반에서만 쓰는 기능
  const T = fn => (data, cb) => { cb = cbOf(cb); const cls = K();
    if (!cls || !socket.data.teacher) return cb({ ok: false, msg: '반에 다시 들어와 주세요.' }); fn(cls, data || {}, cb); };
  on('tClose', T((cls, _, cb) => { closeClass(cls, '선생님이 반을 닫았어요.'); cb({ ok: true }); }));
  on('tResetStudent', T((cls, { num }, cb) => {
    const stu = cls.students[num]; if (!stu) return cb({ ok: false });
    resetStudent(cls, stu); cb({ ok: true }); teacherPush(cls);
  }));
  on('tResetClass', T((cls, _, cb) => {
    for (const stu of Object.values(cls.students)) resetStudent(cls, stu);
    cls.matches = []; cb({ ok: true }); teacherPush(cls);
  }));
  // 반 모드 바꾸기: 문제 풀이 중인 학생은 바로 카드 선택으로(게임 모드), 카드 선택 중인 학생은 고른 뒤 문제로(문제 모드)
  on('tSetMode', T((cls, { mode }, cb) => {
    cls.mode = mode === 'game' ? 'game' : 'quiz';
    for (const stu of Object.values(cls.students)) {
      if (cls.mode === 'game' && stu.stage === 'problem') { stu.wrongStreak = 0; nextStep(cls, stu); }
      push(cls, stu);
    }
    cb({ ok: true }); teacherPush(cls);
  }));
  // 단원 바꾸기: 지금 풀고 있는 문제도 새 단원 문제로 바뀜 (모은 카드와 기록은 그대로)
  on('tSetUnits', T((cls, { units: ids }, cb) => {
    const list = units.validUnits(ids);
    if (!list.length) return cb({ ok: false, msg: '단원을 하나 이상 골라 주세요.' });
    cls.units = list;
    for (const stu of Object.values(cls.students)) {
      stu.typeBag = []; stu.bagKey = '';
      if (stu.stage === 'problem') { stu.wrongStreak = 0; newProblem(cls, stu); }
      push(cls, stu);
    }
    cb({ ok: true }); teacherPush(cls);
  }));
  on('tSetSpw', T((cls, { spw }, cb) => {
    spw = String(spw || '').trim();
    if (!SPW_RE.test(spw)) return cb({ ok: false, msg: '학급 비밀번호는 띄어쓰기 없이 2~20자로 정해 주세요.' });
    cls.spw = spw; cb({ ok: true }); teacherPush(cls);
  }));
  on('tForceMatch', T((cls, _, cb) => { tryMatch(cls, true); cb({ ok: true }); }));

  // ---------- 관리자 (모든 반 보기·닫기) ----------
  const adminErr = pw => {
    if (!ADMIN_PASSWORD) return '관리자 비밀번호가 설정되지 않았어요. Render 환경변수 ADMIN_PASSWORD를 넣어 주세요.';
    if (tooMany()) return '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.';
    if (String(pw || '') !== ADMIN_PASSWORD) { failed(); return '관리자 비밀번호가 맞지 않아요.'; }
    return '';
  };
  on('adminList', (data, cb) => {
    cb = cbOf(cb); const err = adminErr(data && data.pw); if (err) return cb({ ok: false, msg: err });
    const now = Date.now();
    cb({ ok: true, max: ROOM.MAX_CLASSES, list: [...classes.values()].map(c => ({
      name: c.code, size: c.size, mode: c.mode === 'game' ? '게임' : '문제', units: unitNames(c).join(', '),
      online: Object.values(c.students).filter(s => s.socketId).length,
      teachers: io.sockets.adapter.rooms.get(TCH(c))?.size || 0,
      ageMin: Math.floor((now - c.createdAt) / 60000), idleMin: Math.floor((now - c.lastActive) / 60000),
    })).sort((a, b) => a.name.localeCompare(b.name, 'ko')) });
  });
  on('adminClose', (data, cb) => {
    cb = cbOf(cb); const err = adminErr(data && data.pw); if (err) return cb({ ok: false, msg: err });
    const cls = classes.get(keyOf(data && data.name));
    if (!cls) return cb({ ok: false, msg: '이미 닫힌 반이에요.' });
    closeClass(cls, '관리자가 반을 닫았어요.'); cb({ ok: true });
  });
});

function resetStudent(cls, stu) {
  if (stu.battleId && battles.has(stu.battleId)) endBattle(battles.get(stu.battleId), stu.num); // 대결 중이면 상대 승리
  const sid = stu.socketId, token = stu.token; Object.assign(stu, newStudent(stu.num)); stu.socketId = sid; stu.token = token;
  push(cls, stu);
}

// ---------- 교사 화면용 상태 (그 반을 보고 있는 선생님에게만 보냄) ----------
const STAGE_LABEL = { lobby: '대기', problem: '문제 풀이', offer: '카드 선택', ready: '덱 완성', queue: '대결 대기', battle: '대결 중', result: '결과 확인', inherit: '카드 계승' };
function teacherState(cls) {
  return { code: cls.code, size: cls.size, mode: cls.mode, units: cls.units, spw: cls.spw, queue: queueInfo(cls), deckSize: CONFIG.DECK_SIZE,
    students: Object.values(cls.students).map(s => {
      let hp = null;
      if (s.battleId && battles.has(s.battleId)) { const b = battles.get(s.battleId).battle; const me = b.side('S' + s.num), op = b.other('S' + s.num); hp = `${me.hp} vs ${op.hp} (${op.name})`; }
      return { num: s.num, online: !!s.socketId, stage: STAGE_LABEL[s.stage], cards: s.deck.length, round: s.round, wrong: s.wrongStreak, drought: s.drought, wins: s.wins, losses: s.losses, draws: s.draws, battle: hp };
    }), matches: cls.matches.slice(0, 50) };
}
const tTimers = new Map();
function teacherPush(cls) {
  if (!cls || cls.deleted || tTimers.has(cls.key)) return;
  tTimers.set(cls.key, setTimeout(() => {
    tTimers.delete(cls.key);
    if (!cls.deleted && io.sockets.adapter.rooms.get(TCH(cls))?.size) io.to(TCH(cls)).emit('tState', teacherState(cls));
  }, 400));
}
// 대결 중인 반은 3초마다 HP 현황을 새로 보냄
setInterval(() => { const keys = new Set([...battles.values()].map(b => b.key)); for (const k of keys) teacherPush(classes.get(k)); }, 3000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`카드 대전 서버 실행 중: http://localhost:${PORT}  (교사 화면: /teacher)`));
}
module.exports = { app, server, io, classes };
