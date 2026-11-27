// =====================================================
//  스케치북 캐치마인드 서버 (초등 교실용 실시간 그림 퀴즈)
//  Node.js + Express + Socket.io
//
//  · 선생님이 반 이름(예: 천곡64)으로 '반'을 만들면 그 반만의 게임 방이 열려요.
//  · 여러 반이 동시에 써도 서로 섞이지 않아요. (반마다 학생 명단·점수·그림이 따로)
//  · 교사 화면은 공통 접속 비밀번호(TEACHER_PASSWORD)로, 관리자 칸은 ADMIN_PASSWORD로 들어가요.
//  · 학생은 반 목록(또는 QR)에서 반을 고르고 학급 비밀번호 → 이름으로 들어와요.
//    같은 이름으로 다시 들어오면 원래 학생(점수 그대로)으로 이어져요.
// =====================================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const WORD_BANK = require('./words');

// 하나로 합친 서버(../server.js)가 부르는 함수: app = 이 게임 주소(/catchmind) 전용 라우터, io = 이 게임 전용 실시간 통로
module.exports = function mount(app, io, testConfig) {

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim(); // 관리자 비밀번호 (모든 반 보기·닫기). 비우면 관리자 기능 꺼짐
// 교사 화면 공통 접속 비밀번호 (선생님들끼리만 공유). 저장소가 공개라서 코드에 적지 않고 Render 환경변수로만 넣어요
const TEACHER_PASSWORD = (process.env.TEACHER_PASSWORD || '').trim();

// ===== 설정 (여기 숫자만 바꾸면 규칙이 바뀌어요) =====
const CONFIG = {
  MAX_CLASSES: 60,               // 동시에 열 수 있는 반 수 (서버 메모리 보호)
  CLASS_IDLE_MS: 60 * 60 * 1000, // 아무도 접속하지 않은 채 1시간이 지난 반은 자동으로 닫음
  IDLE_MS: 15 * 60 * 1000,       // 15분 동안 아무것도 누르지 않으면 접속 종료 (게임이 진행 중일 때는 제외)
  MAX_TOKENS: 30,                // 한 반에 동시에 로그인해 둘 수 있는 교사 기기 수
  MAX_STUDENTS: 40,              // 한 반 최대 학생 수
  NAME_MAX: 10,                  // 학생 이름 최대 글자 수
  PREP_MS: 3000,                 // 라운드 준비 (화가 발표) 시간
  RESULT_MS: 5000,               // 라운드 결과 보여 주는 시간
  ALL_CORRECT_DELAY_MS: 1200,    // 전원 정답 뒤 라운드를 끝내기까지 잠깐 기다리는 시간
  DRAWER_GRACE_MS: 15000,        // 화가 연결이 끊겼을 때 다시 돌아오기를 기다리는 시간
  WAIT_PLAYERS_MS: 60000,        // 게임 중 학생이 2명 미만이 되면 기다리는 시간 (지나면 게임 종료)
  LOBBY_GRACE_MS: 60000,         // 대기실에서 끊긴 학생을 명단에 남겨 두는 시간
  MIN_TIME: 20, MAX_TIME: 180,   // 라운드 제한 시간 (초)
  MAX_ROUNDS: 30,                // 랜덤 제시어 최대 라운드
  MAX_CUSTOM: 60,                // 직접 입력 제시어 최대 개수
  WORD_MAX: 20,                  // 제시어 최대 글자 수
  DRAWER_SCORE: 400,             // 한 명이라도 맞히면 화가가 받는 점수
  MAX_STROKES: 1500,             // 한 라운드 그림 획 수 제한 (서버 메모리 보호)
  MAX_POINTS: 3000,              // 한 획의 점 개수 제한
};
if (testConfig) Object.assign(CONFIG, testConfig); // 자동 테스트에서만 시간을 줄여 씀
const LOOP_MS = (testConfig && testConfig.LOOP_MS) || 30 * 1000;
const CATEGORIES = Object.keys(WORD_BANK);
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const NAME_RE = /^[0-9A-Za-z가-힣]{2,12}$/; // 반 이름: 띄어쓰기 없이 한글·영문·숫자 2~12자 (예: 천곡64)
const SPW_RE = /^\S{2,20}$/;               // 학급 비밀번호: 2~20자 (보통 숫자 4자리)

app.use(express.static(path.join(__dirname, 'public')));
app.get('/teacher', (req, res) => res.sendFile(path.join(__dirname, 'public', 'teacher.html')));
app.get('/health', (req, res) => res.send('ok'));
// 반 입장용 QR 코드 (찍으면 학생 화면이 그 반을 고른 채로 열려요)
app.get('/qr', async (req, res) => {
  try {
    const name = cleanName(req.query.c).slice(0, 12);
    const url = `${req.protocol}://${req.get('host')}${req.baseUrl}/` + (name ? `?c=${encodeURIComponent(name)}` : '');
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.set('Content-Type', 'image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(svg);
  } catch (e) { res.status(500).end(); }
});

// ===== 공통 도구 =====
function cleanName(s) { return String(s || '').normalize('NFC').replace(/\s/g, ''); }
function keyOf(name) { return cleanName(name).toLowerCase(); }
// 학생 이름: 앞뒤 공백 없애고 가운데 공백은 하나로
function cleanStudentName(s) { return String(s || '').normalize('NFC').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.NAME_MAX); }
function studentKey(name) { return cleanStudentName(name).replace(/\s/g, '').toLowerCase(); }
function normalizeAnswer(s) { return String(s || '').normalize('NFC').replace(/\s+/g, '').toLowerCase(); }
function hashPw(pw, salt) { return crypto.scryptSync(String(pw), salt, 32).toString('hex'); }
function samePw(pw, k) {
  const a = Buffer.from(hashPw(pw, k.salt), 'hex'), b = Buffer.from(k.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newToken() { return crypto.randomBytes(16).toString('hex'); }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp01 = v => Math.min(1, Math.max(0, num(v, 0)));
function cleanPoint(p) { return p && typeof p === 'object' ? { x: clamp01(p.x), y: clamp01(p.y) } : null; }
// 직접 입력 제시어: 쉼표·줄바꿈으로 나눔
function parseCustomWords(text) {
  return String(text || '').split(/[,\n]/).map(w => w.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, CONFIG.WORD_MAX))
    .filter(Boolean).slice(0, CONFIG.MAX_CUSTOM);
}

// ===== 반(학급) =====
const classes = new Map(); // 반 key(소문자 이름) -> 반
const CH = k => 'k:' + k.key;          // 반 전체 (학생 + 교사)
const TCH = k => 'k:' + k.key + ':t';  // 반 교사

function createClass(name, pw, spw) {
  const salt = crypto.randomBytes(8).toString('hex');
  const k = {
    id: newToken(), name, key: keyOf(name), salt, hash: hashPw(pw, salt), tokens: new Set(),
    spw, // 학급 비밀번호 (학생 입장용 · 교사 화면에 보여 줘야 해서 그대로 저장)
    createdAt: Date.now(), lastActive: Date.now(), deleted: false,
    settings: { timeLimit: 60, totalRounds: 10, wordMode: 'random', categories: CATEGORIES.slice(), customText: '' },
    students: new Map(), // 학생 id -> { sid, name, nkey, token, score, socketId, connected, dropTimer }
    drawn: new Set(),    // 이미 화가를 한 학생 (모두 한 번씩 할 때까지 겹치지 않게, 다시 하기를 해도 이어짐)
    gameSeq: 0, game: null,
  };
  k.game = freshGame(k);
  classes.set(k.key, k);
  console.log(`[캐치마인드 반 열림] ${name} (지금 열린 반 ${classes.size}개)`);
  sendClassList();
  return k;
}
function addToken(k) {
  const t = newToken();
  k.tokens.add(t);
  while (k.tokens.size > CONFIG.MAX_TOKENS) k.tokens.delete(k.tokens.values().next().value);
  return t;
}
function freshGame(k) {
  return {
    id: ++k.gameSeq, status: 'lobby', // lobby | starting | playing | round_result | waiting | finished
    round: 0, totalRounds: 0, timeLimit: k.settings.timeLimit, queue: [],
    word: '', drawerSid: null, drawerName: '', strokes: [], correct: new Map(),
    roundEndTime: null, waitUntil: null, endReason: '', lastResult: null, allCorrectPending: false,
    t: { phase: null, round: null, drawer: null, wait: null, allCorrect: null, empty: null },
  };
}
function clearGameTimers(g) {
  for (const key of Object.keys(g.t)) { if (g.t[key]) { clearTimeout(g.t[key]); g.t[key] = null; } }
}
const isActive = st => ['starting', 'playing', 'round_result', 'waiting'].includes(st);
function connectedStudents(k) { return [...k.students.values()].filter(s => s.connected); }
function guessers(k) { return connectedStudents(k).filter(s => s.sid !== k.game.drawerSid); }
function findByName(k, nkey) { for (const s of k.students.values()) if (s.nkey === nkey) return s; return null; }
// 반 이름 목록 (학생 화면의 '반 찾기')
function classNames() { return [...classes.values()].map(k => k.name).sort((a, b) => a.localeCompare(b, 'ko')); }
function sendClassList() { io.to('browse').emit('classList', classNames()); }
// 반에 들어와 있는 소켓들
function socketsOf(k) {
  const ids = io.adapter.rooms.get(CH(k));
  if (!ids) return [];
  return [...ids].map(id => io.sockets.get(id)).filter(s => s && s.data.kid === k.id);
}
// 반이 닫혔거나 게임이 바뀌었으면 예약된 일을 하지 않음
function stale(k, gid) { return k.deleted || k.game.id !== gid; }

// ===== 상태 보내기 =====
function publicStudents(k) {
  return [...k.students.values()]
    .map(s => ({ sid: s.sid, name: s.name, score: s.score, connected: s.connected }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko'));
}
function basePayload(k) {
  const g = k.game;
  return {
    name: k.name, gameId: g.id, status: g.status, round: g.round, totalRounds: g.totalRounds || plannedRounds(k),
    timeLimit: g.status === 'lobby' ? k.settings.timeLimit : g.timeLimit,
    roundEndTime: g.roundEndTime, waitUntil: g.waitUntil, endReason: g.endReason,
    drawerSid: g.drawerSid, drawerName: g.drawerName,
    correctCount: g.correct.size, guesserTotal: ['starting', 'playing', 'round_result'].includes(g.status) ? guessers(k).length : 0,
    students: publicStudents(k), lastResult: g.status === 'round_result' ? g.lastResult : null,
    serverNow: Date.now(),
  };
}
function plannedRounds(k) {
  const st = k.settings;
  return st.wordMode === 'custom' ? parseCustomWords(st.customText).length : st.totalRounds;
}
function teacherInfo(k) { return { name: k.name, spw: k.spw, settings: k.settings, categories: CATEGORIES }; }
function broadcast(k) {
  if (k.deleted) return;
  const base = basePayload(k), g = k.game;
  for (const sk of socketsOf(k)) {
    if (sk.data.role === 'teacher') {
      sk.emit('state', { ...base, role: 'teacher', word: g.word, correctList: [...g.correct.values()].sort((a, b) => a.order - b.order) });
    } else {
      const me = sk.data.sid ? k.students.get(sk.data.sid) : null;
      const isDrawer = !!me && me.sid === g.drawerSid && (g.status === 'starting' || g.status === 'playing');
      sk.emit('state', {
        ...base, role: 'student',
        me: me ? { sid: me.sid, name: me.name, score: me.score } : null,
        isDrawer, word: isDrawer ? g.word : '',
        myCorrect: me ? (g.correct.get(me.sid) || null) : null,
      });
    }
  }
}
function sendCanvas(k, sk) { if (k.game.strokes.length) sk.emit('canvas_sync', k.game.strokes); }

// ===== 게임 진행 =====
function buildQueue(k) {
  const st = k.settings;
  if (st.wordMode === 'custom') return parseCustomWords(st.customText);
  let pool = [];
  for (const c of st.categories) if (WORD_BANK[c]) pool = pool.concat(WORD_BANK[c]);
  if (!pool.length) return [];
  pool = shuffle(pool);
  const q = [];
  for (let i = 0; i < st.totalRounds; i++) q.push(pool[i % pool.length]);
  return q;
}
// 화가 뽑기: 접속한 학생 중 아직 안 한 학생에서 무작위 (모두 했으면 처음부터)
function pickDrawer(k) {
  const list = connectedStudents(k);
  if (!list.length) return null;
  let pool = list.filter(s => !k.drawn.has(s.sid));
  if (!pool.length) { k.drawn.clear(); pool = list; }
  const s = pool[Math.floor(Math.random() * pool.length)];
  k.drawn.add(s.sid);
  return s;
}
function startGame(k) {
  const g = freshGame(k);
  k.game = g;
  g.queue = buildQueue(k);
  g.totalRounds = g.queue.length;
  g.timeLimit = k.settings.timeLimit;
  g.status = 'starting'; // nextRound가 바로 바꿈
  for (const s of k.students.values()) s.score = 0;
  // 대기실에서 끊긴 채 남아 있던 학생은 정리 (다시 들어오면 새로 등록)
  for (const s of [...k.students.values()]) if (!s.connected) removeStudent(k, s);
  nextRound(k);
}
function nextRound(k) {
  const g = k.game;
  clearGameTimers(g);
  g.allCorrectPending = false;
  if (connectedStudents(k).length < 2) return enterWaiting(k);
  if (g.round >= g.totalRounds) return finishGame(k, '');
  g.round++;
  const drawer = pickDrawer(k);
  g.status = 'starting';
  g.waitUntil = null;
  g.drawerSid = drawer.sid; g.drawerName = drawer.name;
  g.word = g.queue[g.round - 1] || '스케치북';
  g.strokes = []; g.correct = new Map(); g.roundEndTime = null; g.lastResult = null;
  io.to(CH(k)).emit('canvas_clear');
  broadcast(k);
  const gid = g.id, round = g.round;
  g.t.phase = setTimeout(() => safe(() => {
    if (stale(k, gid) || g.round !== round || g.status !== 'starting') return;
    g.status = 'playing';
    g.roundEndTime = Date.now() + g.timeLimit * 1000;
    broadcast(k);
    checkNoGuessers(k);
    g.t.round = setTimeout(() => safe(() => {
      if (stale(k, gid) || g.round !== round) return;
      finishRound(k, 'timeout');
    }), g.timeLimit * 1000);
  }), CONFIG.PREP_MS);
}
// 학생이 2명 미만이면 잠깐 기다렸다가, 그래도 안 모이면 게임 종료
function enterWaiting(k) {
  const g = k.game;
  clearGameTimers(g);
  g.status = 'waiting';
  g.drawerSid = null; g.drawerName = ''; g.word = ''; g.roundEndTime = null;
  g.waitUntil = Date.now() + CONFIG.WAIT_PLAYERS_MS;
  broadcast(k);
  const gid = g.id;
  g.t.wait = setTimeout(() => safe(() => {
    if (stale(k, gid) || g.status !== 'waiting') return;
    finishGame(k, '접속한 학생이 2명보다 적어서 게임을 마쳤어요.');
  }), CONFIG.WAIT_PLAYERS_MS);
}
// reason: timeout | all_correct | skipped | drawer_left
function finishRound(k, reason) {
  const g = k.game;
  if (g.status !== 'playing') return;
  clearGameTimers(g);
  g.allCorrectPending = false;
  let drawerEarned = 0;
  if ((reason === 'timeout' || reason === 'all_correct') && g.correct.size >= 1) {
    const d = k.students.get(g.drawerSid);
    if (d) { d.score += CONFIG.DRAWER_SCORE; drawerEarned = CONFIG.DRAWER_SCORE; }
  }
  g.status = 'round_result';
  g.roundEndTime = null;
  g.lastResult = {
    round: g.round, reason, word: g.word, drawerName: g.drawerName, drawerEarned,
    correctCount: g.correct.size, top3: publicStudents(k).slice(0, 3),
  };
  broadcast(k);
  const gid = g.id;
  g.t.phase = setTimeout(() => safe(() => { if (!stale(k, gid) && g.status === 'round_result') nextRound(k); }), CONFIG.RESULT_MS);
}
function finishGame(k, reason) {
  const g = k.game;
  clearGameTimers(g);
  g.status = 'finished';
  g.word = ''; g.drawerSid = null; g.drawerName = ''; g.roundEndTime = null; g.waitUntil = null;
  g.endReason = reason || '';
  broadcast(k);
}
// 화가가 바뀌어야 할 때 (강퇴·연결 끊김): 준비 중이면 다른 학생으로 다시 뽑고, 그리는 중이면 라운드 종료
function drawerGone(k) {
  const g = k.game;
  if (g.status === 'starting') { clearGameTimers(g); g.round--; nextRound(k); }
  else if (g.status === 'playing') finishRound(k, 'drawer_left');
}
// 지금 라운드에 있는 학생(접속 중, 화가 제외)이 모두 맞혔는지 확인
function checkAllCorrect(k) {
  const g = k.game;
  if (g.status !== 'playing' || g.allCorrectPending) return;
  const list = guessers(k);
  if (!list.length || !list.every(s => g.correct.has(s.sid))) return;
  g.allCorrectPending = true;
  const gid = g.id, round = g.round;
  g.t.allCorrect = setTimeout(() => safe(() => {
    if (stale(k, gid) || g.round !== round || g.status !== 'playing') return;
    // 기다리는 사이에 새로 들어온 학생이 있으면 다시 확인
    g.allCorrectPending = false;
    const now = guessers(k);
    if (now.length && now.every(s => g.correct.has(s.sid))) finishRound(k, 'all_correct');
  }), CONFIG.ALL_CORRECT_DELAY_MS);
}
// 학생이 들어오거나 나갈 때마다: 기다리던 게임 다시 시작, 전원 정답 다시 확인
function membersChanged(k) {
  const g = k.game;
  if (g.status === 'waiting' && connectedStudents(k).length >= 2) return nextRound(k);
  checkAllCorrect(k);
  checkNoGuessers(k);
}
// 그리는 중에 맞힐 친구가 아무도 없으면 15초 기다렸다가 라운드를 끝냄 (돌아오면 취소)
function checkNoGuessers(k) {
  const g = k.game;
  if (g.status === 'playing' && !guessers(k).length) {
    if (!g.t.empty) {
      const gid = g.id, round = g.round;
      g.t.empty = setTimeout(() => safe(() => {
        g.t.empty = null;
        if (stale(k, gid) || g.round !== round || g.status !== 'playing' || guessers(k).length) return;
        finishRound(k, 'timeout');
      }), CONFIG.DRAWER_GRACE_MS);
    }
  } else if (g.t.empty) { clearTimeout(g.t.empty); g.t.empty = null; }
}
function removeStudent(k, s) {
  clearTimeout(s.dropTimer);
  k.students.delete(s.sid);
  k.drawn.delete(s.sid);
}

function closeClass(k, reason) {
  if (k.deleted) return;
  k.deleted = true;
  clearGameTimers(k.game);
  for (const s of k.students.values()) clearTimeout(s.dropTimer);
  io.to(CH(k)).emit('classClosed', reason);
  socketsOf(k).forEach(detach);
  classes.delete(k.key);
  sendClassList();
  console.log(`[캐치마인드 반 닫힘] ${k.name} · ${reason} (남은 반 ${classes.size}개)`);
}
// 소켓을 반에서 빼냄
function detach(socket) {
  for (const r of [...socket.rooms]) if (r.startsWith('k:')) socket.leave(r);
  socket.data.key = null; socket.data.kid = null; socket.data.role = null; socket.data.sid = null;
}
function safe(fn) { try { fn(); } catch (e) { console.error('[캐치마인드 오류]', e); } }

// 아무도 접속하지 않은 채 오래된 반 정리 (5분마다 확인)
setInterval(() => safe(() => {
  const now = Date.now();
  for (const k of [...classes.values()]) {
    const room = io.adapter.rooms.get(CH(k));
    if ((!room || room.size === 0) && now - k.lastActive > CONFIG.CLASS_IDLE_MS) closeClass(k, '오래 사용하지 않아 반이 자동으로 닫혔어요.');
  }
}), 5 * 60 * 1000).unref();

// 15분 동안 아무것도 누르지 않은 기기는 접속을 완전히 끊음 (서버 아끼기)
// 게임이 진행 중인 반은 쓰고 있는 것으로 봄 (교사 화면을 띄워 놓고 구경만 해도 끊기지 않게)
setInterval(() => safe(() => {
  const now = Date.now();
  for (const sk of io.sockets.values()) {
    const k = sk.data.key ? classes.get(sk.data.key) : null;
    if (k && k.id === sk.data.kid && isActive(k.game.status)) { sk.data.lastInput = now; continue; }
    if (now - (sk.data.lastInput || now) < CONFIG.IDLE_MS) continue;
    sk.emit('idleOff');
    sk.disconnect(true);
  }
}), LOOP_MS).unref();

// ===== 소켓 이벤트 =====
io.on('connection', (socket) => {
  socket.data.lastInput = Date.now();
  // 처리 중 오류가 나도 서버가 꺼지지 않게 감싸기 + 무엇이든 하면 '사용 중'으로 기록
  const on = (ev, fn) => socket.on(ev, (...args) => {
    if (ev !== 'disconnect') socket.data.lastInput = Date.now();
    try {
      const p = fn(...args);
      if (p && typeof p.catch === 'function') p.catch(e => console.error(`[캐치마인드 오류] ${ev}`, e));
    } catch (e) { console.error(`[캐치마인드 오류] ${ev}`, e); }
  });
  const cbOf = cb => (typeof cb === 'function' ? cb : () => {});
  const obj = d => (d && typeof d === 'object' ? d : {});
  // 지금 들어와 있는 반 (닫혔거나 같은 이름으로 새로 만든 반이면 null)
  const K = () => {
    const k = socket.data.key ? classes.get(socket.data.key) : null;
    if (!k || k.id !== socket.data.kid) return null;
    k.lastActive = Date.now();
    return k;
  };
  const T = () => { const k = K(); return k && socket.data.role === 'teacher' ? k : null; };
  // 학생으로 들어와 있으면 [반, 학생]
  const ME = () => {
    const k = K();
    if (!k || socket.data.role !== 'student') return [null, null];
    const s = k.students.get(socket.data.sid);
    return s && s.socketId === socket.id ? [k, s] : [null, null];
  };
  // 비밀번호를 연달아 틀리면 잠깐 막기 (1분에 8번까지)
  const tooMany = () => {
    const now = Date.now();
    if (!socket.data.failAt || now - socket.data.failAt > 60000) { socket.data.failAt = now; socket.data.fails = 0; }
    return socket.data.fails >= 8;
  };
  const failed = () => { socket.data.fails = (socket.data.fails || 0) + 1; };
  // 학생이 이 기기에서 빠질 때 (반 나가기·이름 바꾸기): 대기실이면 명단에서 지우고, 게임 중이면 점수를 남김
  const releaseStudent = (k) => {
    const s = k && socket.data.sid ? k.students.get(socket.data.sid) : null;
    if (s && s.socketId === socket.id) {
      if (k.game.status === 'lobby') removeStudent(k, s);
      else {
        s.connected = false; s.socketId = null;
        if (s.sid === k.game.drawerSid) drawerGone(k);
      }
      membersChanged(k);
    }
    socket.data.sid = null;
  };
  const leaveCurrent = () => {
    const k = K();
    if (k && socket.data.role === 'student') { releaseStudent(k); detach(socket); broadcast(k); }
    else detach(socket);
  };

  socket.emit('serverInfo', { gateReady: !!TEACHER_PASSWORD, adminEnabled: !!ADMIN_PASSWORD });

  on('activity', () => {}); // 화면을 누르고 있다는 신호 (lastInput은 on()에서 기록)

  // ---------- 학생: 반 찾기 / 학급 비밀번호 / 이름 ----------
  on('browse', (cb) => { socket.join('browse'); cbOf(cb)(classNames()); });

  on('joinClass', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const k = classes.get(keyOf(data.name));
    if (!k) return cb({ ok: false, noClass: true, msg: '그런 반이 없어요. 선생님이 반을 열었는지 확인해 주세요.' });
    if (socket.data.kid !== k.id) {
      if (tooMany()) return cb({ ok: false, msg: '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.' });
      if (String(data.pw || '').trim() !== k.spw) { failed(); return cb({ ok: false, badPw: true, msg: '학급 비밀번호가 맞지 않아요.' }); }
      leaveCurrent(); socket.data.key = k.key; socket.data.kid = k.id; socket.join(CH(k));
    }
    socket.leave('browse');
    k.lastActive = Date.now();
    cb({ ok: true, name: k.name });
    broadcast(k);
  });

  on('leaveClass', () => leaveCurrent());

  on('studentLogin', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const k = K();
    if (!k) return cb({ ok: false, needClass: true, msg: '반에 먼저 들어와 주세요.' });
    if (socket.data.role === 'teacher') return cb({ ok: false, msg: '교사 화면에서는 입장할 수 없어요.' });
    const name = cleanStudentName(data.name);
    const nkey = studentKey(name);
    const token = String(data.token || '').slice(0, 64);
    if (!nkey) return cb({ ok: false, msg: '이름을 입력해 주세요.' });
    let s = findByName(k, nkey);
    // 같은 이름이 지금 다른 기기에서 접속 중이면 막음 (같은 기기면 이어서 접속)
    if (s && s.connected && s.socketId !== socket.id && s.token !== token) {
      return cb({ ok: false, msg: '이미 같은 이름으로 접속 중인 친구가 있어요. 성까지 넣어 보세요.' });
    }
    if (!s && k.students.size >= CONFIG.MAX_STUDENTS) return cb({ ok: false, msg: '이 반에 들어온 학생이 너무 많아요.' });
    // 이 기기가 다른 이름으로 들어와 있었으면 먼저 정리
    if (socket.data.role === 'student' && socket.data.sid && (!s || s.sid !== socket.data.sid)) releaseStudent(k);
    const isNew = !s;
    if (isNew) {
      s = { sid: newToken().slice(0, 12), name, nkey, token, score: 0, socketId: null, connected: false, dropTimer: null };
      k.students.set(s.sid, s);
    }
    clearTimeout(s.dropTimer); s.dropTimer = null;
    // 같은 학생이 다른 소켓으로 붙어 있었으면(새로고침·다른 탭) 예전 연결은 끊음
    const oldId = s.socketId;
    s.token = token; s.socketId = socket.id; s.connected = true;
    socket.data.role = 'student'; socket.data.sid = s.sid;
    if (oldId && oldId !== socket.id) {
      const old = io.sockets.get(oldId);
      if (old) { old.emit('replaced', '다른 화면에서 같은 이름으로 들어와서 이 화면은 연결을 끊었어요.'); detach(old); old.disconnect(true); }
    }
    // 화가가 돌아왔으면 기다리던 타이머 취소
    if (s.sid === k.game.drawerSid && k.game.t.drawer) { clearTimeout(k.game.t.drawer); k.game.t.drawer = null; }
    cb({ ok: true, name: s.name, resumed: !isNew });
    membersChanged(k);
    broadcast(k);
    sendCanvas(k, socket);
  });

  on('studentLogout', () => {
    const k = K();
    if (!k || socket.data.role !== 'student') return;
    releaseStudent(k);
    socket.data.role = null;
    broadcast(k);
  });

  // ---------- 그리기 (화가만) ----------
  const drawerOK = () => {
    const [k, s] = ME();
    return k && k.game.status === 'playing' && s.sid === k.game.drawerSid ? k : null;
  };
  on('draw_start', (d) => {
    const k = drawerOK(); d = obj(d);
    if (!k) return;
    const g = k.game;
    const pt = cleanPoint(d.point);
    if (!pt || g.strokes.length >= CONFIG.MAX_STROKES) return;
    const stroke = {
      id: String(d.id || '').slice(0, 40) || newToken().slice(0, 8),
      color: COLOR_RE.test(String(d.color)) ? d.color : '#222222',
      width: Math.min(40, Math.max(1, num(d.width, 9))),
      isEraser: !!d.isEraser, points: [pt],
    };
    g.strokes.push(stroke);
    socket.to(CH(k)).emit('draw_start', stroke);
  });
  on('draw_move', (d) => {
    const k = drawerOK(); d = obj(d);
    if (!k) return;
    const stroke = k.game.strokes.find(s => s.id === d.id);
    const pt = cleanPoint(d.point);
    if (!stroke || !pt || stroke.points.length >= CONFIG.MAX_POINTS) return;
    stroke.points.push(pt);
    socket.to(CH(k)).emit('draw_move', { id: stroke.id, point: pt });
  });
  on('draw_undo', () => {
    const k = drawerOK();
    if (!k || !k.game.strokes.length) return;
    k.game.strokes.pop();
    io.to(CH(k)).emit('canvas_sync', k.game.strokes);
  });
  on('draw_clear', () => {
    const k = drawerOK();
    if (!k) return;
    k.game.strokes = [];
    io.to(CH(k)).emit('canvas_clear');
  });

  // ---------- 정답 (화가 빼고) ----------
  on('submit_answer', (text, cb) => {
    cb = cbOf(cb);
    const [k, s] = ME();
    if (!k || k.game.status !== 'playing') return cb({ ok: false, msg: '지금은 정답을 낼 수 없어요.' });
    const g = k.game;
    if (s.sid === g.drawerSid) return cb({ ok: false, msg: '화가는 정답을 낼 수 없어요.' });
    if (g.correct.has(s.sid)) return cb({ ok: false, msg: '이미 맞혔어요.' });
    const answer = normalizeAnswer(String(text || '').slice(0, 40));
    if (!answer) return cb({ ok: false, empty: true });
    if (answer !== normalizeAnswer(g.word)) return cb({ ok: true, correct: false });
    const remain = Math.max(0, (g.roundEndTime || Date.now()) - Date.now());
    const earned = Math.min(500, Math.max(100, Math.round(100 + 400 * remain / (g.timeLimit * 1000))));
    s.score += earned;
    g.correct.set(s.sid, { sid: s.sid, name: s.name, earned, order: g.correct.size + 1 });
    cb({ ok: true, correct: true, earned });
    broadcast(k);
    checkAllCorrect(k);
  });

  // ---------- 교사: 공통 접속 비밀번호 / 반 만들기 / 들어가기 ----------
  const gateErr = (gate) => {
    if (!TEACHER_PASSWORD) return '서버에 교사 접속 비밀번호가 설정되지 않았어요. Render 환경변수 TEACHER_PASSWORD를 넣어 주세요.';
    if (tooMany()) return '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.';
    if (String(gate || '').trim() !== TEACHER_PASSWORD) { failed(); return '접속 비밀번호가 맞지 않아요.'; }
    return '';
  };
  on('teacherGate', (data, cb) => {
    cb = cbOf(cb);
    const err = gateErr(obj(data).gate);
    cb(err ? { ok: false, msg: err } : { ok: true });
  });

  on('createClass', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const gErr = gateErr(data.gate);
    if (gErr) return cb({ ok: false, gate: true, msg: gErr });
    const name = cleanName(data.name);
    const pw = String(data.pw || '');
    const spw = String(data.spw || '').trim();
    if (!NAME_RE.test(name)) return cb({ ok: false, msg: '반 이름은 띄어쓰기 없이 한글·영문·숫자 2~12자로 써 주세요. (예: 천곡64)' });
    if (!SPW_RE.test(spw)) return cb({ ok: false, msg: '학급 비밀번호는 띄어쓰기 없이 2~20자로 정해 주세요. (예: 숫자 4자리)' });
    if (pw.length < 4 || pw.length > 20) return cb({ ok: false, msg: '학급 관리 비밀번호(교사용)는 4~20자로 정해 주세요.' });
    if (classes.has(keyOf(name))) return cb({ ok: false, msg: '이미 열려 있는 반 이름이에요. 우리 반이면 「우리 반 들어가기」로 들어가고, 아니면 다른 이름을 써 주세요.' });
    if (classes.size >= CONFIG.MAX_CLASSES) return cb({ ok: false, msg: '지금 열린 반이 너무 많아요. 잠시 뒤에 다시 해 주세요.' });
    const k = createClass(name, pw, spw);
    cb({ ok: true, name: k.name, token: addToken(k) });
  });

  on('teacherLogin', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const gErr = gateErr(data.gate);
    if (gErr) return cb({ ok: false, gate: true, msg: gErr });
    const k = classes.get(keyOf(data.name));
    if (!k) return cb({ ok: false, msg: '그런 반이 없어요. 서버가 다시 켜지면 반이 사라질 수 있어요. 「새 반 만들기」로 다시 만들어 주세요.' });
    if (tooMany()) return cb({ ok: false, msg: '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.' });
    if (!samePw(String(data.pw || ''), k)) { failed(); return cb({ ok: false, msg: '학급 관리 비밀번호가 맞지 않아요.' }); }
    cb({ ok: true, name: k.name, token: addToken(k) });
  });

  on('teacherJoin', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const k = classes.get(keyOf(data.name));
    const token = String(data.token || '');
    if (!k || !k.tokens.has(token)) return cb({ ok: false, msg: k ? '다시 로그인해 주세요.' : '반이 닫혔거나 서버가 다시 켜져서 반이 없어요. 반을 다시 만들어 주세요.' });
    if (socket.data.kid !== k.id || socket.data.role !== 'teacher') {
      leaveCurrent();
      socket.data.key = k.key; socket.data.kid = k.id; socket.data.role = 'teacher';
      socket.join(CH(k)); socket.join(TCH(k));
    }
    socket.leave('browse');
    k.lastActive = Date.now();
    cb({ ok: true, name: k.name });
    socket.emit('teacherInfo', teacherInfo(k));
    broadcast(k);
    sendCanvas(k, socket);
  });

  on('teacherLogout', (data) => {
    const k = T();
    if (k && obj(data).token) k.tokens.delete(String(data.token));
    leaveCurrent();
  });

  on('closeClass', (cb) => {
    cb = cbOf(cb);
    const k = T();
    if (!k) return cb({ ok: false });
    closeClass(k, '선생님이 반을 닫았어요.');
    cb({ ok: true });
  });

  // 학급 비밀번호 바꾸기 (이미 들어와 있는 학생은 그대로, 새로 들어오는 학생부터 적용)
  on('setStudentPw', (spw, cb) => {
    cb = cbOf(cb);
    const k = T();
    if (!k) return cb({ ok: false, msg: '반에 다시 들어와 주세요.' });
    spw = String(spw || '').trim();
    if (!SPW_RE.test(spw)) return cb({ ok: false, msg: '학급 비밀번호는 띄어쓰기 없이 2~20자로 정해 주세요.' });
    k.spw = spw;
    io.to(TCH(k)).emit('teacherInfo', teacherInfo(k));
    cb({ ok: true });
  });

  // ---------- 교사: 게임 설정 (대기실·게임 끝 화면에서만) ----------
  on('saveSettings', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const k = T();
    if (!k) return cb({ ok: false, msg: '반에 다시 들어와 주세요.' });
    if (isActive(k.game.status)) return cb({ ok: false, msg: '게임 중에는 설정을 바꿀 수 없어요.' });
    const st = k.settings;
    const t = parseInt(data.timeLimit, 10);
    if (Number.isInteger(t)) st.timeLimit = Math.min(CONFIG.MAX_TIME, Math.max(CONFIG.MIN_TIME, t));
    const r = parseInt(data.totalRounds, 10);
    if (Number.isInteger(r)) st.totalRounds = Math.min(CONFIG.MAX_ROUNDS, Math.max(1, r));
    if (data.wordMode === 'random' || data.wordMode === 'custom') st.wordMode = data.wordMode;
    if (Array.isArray(data.categories)) st.categories = CATEGORIES.filter(c => data.categories.includes(c));
    if (typeof data.customText === 'string') st.customText = data.customText.slice(0, 2000);
    socket.to(TCH(k)).emit('teacherInfo', teacherInfo(k));
    cb({ ok: true, rounds: plannedRounds(k) });
    broadcast(k);
  });

  on('startGame', (cb) => {
    cb = cbOf(cb);
    const k = T();
    if (!k) return cb({ ok: false, msg: '반에 다시 들어와 주세요.' });
    if (isActive(k.game.status)) return cb({ ok: false, msg: '이미 게임이 진행 중이에요.' });
    const st = k.settings;
    if (st.wordMode === 'custom' && !parseCustomWords(st.customText).length) return cb({ ok: false, msg: '직접 입력할 제시어를 1개 이상 써 주세요.' });
    if (st.wordMode === 'random' && !st.categories.length) return cb({ ok: false, msg: '랜덤 제시어 주제를 1개 이상 골라 주세요.' });
    if (connectedStudents(k).length < 2) return cb({ ok: false, msg: '학생이 2명 이상 들어와야 시작할 수 있어요.' });
    cb({ ok: true });
    startGame(k);
  });

  on('skipRound', () => {
    const k = T();
    if (k && k.game.status === 'playing') finishRound(k, 'skipped');
  });

  on('teacherClear', () => {
    const k = T();
    if (!k || k.game.status !== 'playing') return;
    k.game.strokes = [];
    io.to(CH(k)).emit('canvas_clear');
    io.to(CH(k)).emit('toast', '선생님이 그림을 모두 지웠어요.');
  });

  on('endGame', () => {
    const k = T();
    if (k && isActive(k.game.status)) finishGame(k, '선생님이 게임을 끝냈어요.');
  });

  // 대기실로 (새 게임 준비): 점수는 다음 게임을 시작할 때 0점이 돼요
  on('toLobby', () => {
    const k = T();
    if (!k) return;
    clearGameTimers(k.game);
    k.game = freshGame(k);
    for (const s of [...k.students.values()]) if (!s.connected) removeStudent(k, s);
    io.to(CH(k)).emit('canvas_clear');
    broadcast(k);
  });

  on('kick', (sid) => {
    const k = T();
    if (!k) return;
    const s = k.students.get(String(sid || ''));
    if (!s) return;
    const wasDrawer = s.sid === k.game.drawerSid;
    const sk = s.socketId && io.sockets.get(s.socketId);
    removeStudent(k, s);
    if (sk) { sk.emit('kicked', '선생님이 이 반에서 내보냈어요.'); sk.data.sid = null; sk.data.role = null; }
    if (wasDrawer) drawerGone(k);
    membersChanged(k);
    broadcast(k);
  });

  // ---------- 관리자 (모든 반 보기·닫기) ----------
  const adminOk = (pw) => {
    if (!ADMIN_PASSWORD) return '관리자 비밀번호가 설정되지 않았어요. Render 환경변수 ADMIN_PASSWORD를 넣어 주세요.';
    if (tooMany()) return '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.';
    if (String(pw || '') !== ADMIN_PASSWORD) { failed(); return '관리자 비밀번호가 맞지 않아요.'; }
    return '';
  };
  on('adminList', (data, cb) => {
    cb = cbOf(cb);
    const err = adminOk(obj(data).pw);
    if (err) return cb({ ok: false, msg: err });
    const now = Date.now();
    const list = [...classes.values()].map(k => ({
      name: k.name, status: k.game.status,
      students: connectedStudents(k).length,
      teachers: socketsOf(k).filter(s => s.data.role === 'teacher').length,
      idleMin: Math.floor((now - k.lastActive) / 60000), ageMin: Math.floor((now - k.createdAt) / 60000),
    })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    cb({ ok: true, list, max: CONFIG.MAX_CLASSES });
  });
  on('adminClose', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const err = adminOk(data.pw);
    if (err) return cb({ ok: false, msg: err });
    const k = classes.get(keyOf(data.name));
    if (!k) return cb({ ok: false, msg: '이미 닫힌 반이에요.' });
    closeClass(k, '관리자가 반을 닫았어요.');
    cb({ ok: true });
  });

  // ---------- 접속 끊김 ----------
  on('disconnect', () => {
    const k = socket.data.key ? classes.get(socket.data.key) : null;
    if (!k || k.id !== socket.data.kid || socket.data.role !== 'student') return;
    const s = k.students.get(socket.data.sid);
    if (!s || s.socketId !== socket.id) return;
    s.connected = false; s.socketId = null;
    const g = k.game;
    if (g.status === 'lobby') {
      // 바로 지우지 않고 60초 기다림 (와이파이가 잠깐 끊긴 학생이 명단에서 사라지지 않게)
      s.dropTimer = setTimeout(() => safe(() => {
        if (!k.deleted && k.students.get(s.sid) === s && !s.connected && k.game.status === 'lobby') { removeStudent(k, s); broadcast(k); }
      }), CONFIG.LOBBY_GRACE_MS);
    } else if (s.sid === g.drawerSid && (g.status === 'starting' || g.status === 'playing')) {
      // 화가가 끊기면 15초 기다렸다가 안 돌아오면 다음 라운드로
      io.to(TCH(k)).emit('toast', `화가 ${s.name}의 연결이 끊겼어요. 15초 안에 돌아오지 않으면 다음 라운드로 넘어가요.`);
      const gid = g.id, round = g.round;
      clearTimeout(g.t.drawer);
      g.t.drawer = setTimeout(() => safe(() => {
        g.t.drawer = null;
        if (stale(k, gid) || g.round !== round || s.connected || g.drawerSid !== s.sid) return;
        drawerGone(k);
      }), CONFIG.DRAWER_GRACE_MS);
    }
    membersChanged(k);
    broadcast(k);
  });
});

  return { classes };
};
