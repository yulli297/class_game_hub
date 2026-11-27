// =====================================================
//  릴레이 이야기 짓기 서버 (초등 국어 실시간 이어 쓰기)
//  Node.js + Express + Socket.io
//
//  · 선생님이 반 이름(예: 천곡64)으로 '반'을 만들면 그 반만의 방이 열려요. 여러 반이 동시에 써도 섞이지 않아요.
//  · 시작하면 4명씩 랜덤 모둠(남는 인원은 5명 모둠). 한 사람이 한 문장씩, 바로 앞 문장만 보고 이어 써요.
//  · 한 바퀴에 특수 단어 2개 (모둠원이 돌아가며 받고, 3바퀴째는 랜덤). 받은 학생은 그 단어를 꼭 넣어요.
//  · 다 쓰면 교사 화면(TV)에서 모둠 이야기를 한 문장씩 공개해요.
//
//  [우르르 스킵 방지]
//  · 접속이 끊겨도 바로 넘기지 않아요. 그 학생 차례 시간을 끝까지 기다려요.
//  · 차례를 넘기는 타이머는 서버에만 있어요. 학생 화면은 남은 시간을 보여 주기만 해요.
//  · 모든 신호에 차례 번호(turnSeq)를 붙여서, 지나간 차례에 대한 신호는 무시해요.
//  · 모둠원이 모두 끊기면 그 모둠을 멈춰요 (누구든 돌아오면 이어서, 교사 화면 '재개'로도 이어서).
//  · 쓰던 글은 수시로 서버에 임시 저장돼서, 시간이 끝나면 쓰던 데까지 제출돼요.
// =====================================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const WORDS = require('./words');

module.exports = function mount(app, io, testConfig) {

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const TEACHER_PASSWORD = (process.env.TEACHER_PASSWORD || '').trim();

// ===== 설정 (여기 숫자만 바꾸면 규칙이 바뀌어요) =====
const CONFIG = {
  MAX_CLASSES: 60,               // 동시에 열 수 있는 반 수
  CLASS_IDLE_MS: 60 * 60 * 1000, // 아무도 접속하지 않은 채 1시간이 지난 반은 자동으로 닫음
  IDLE_MS: 15 * 60 * 1000,       // 15분 동안 아무것도 누르지 않으면 접속 종료 (게임 중에는 제외)
  MAX_TOKENS: 30,                // 한 반에 동시에 로그인해 둘 수 있는 교사 기기 수
  MAX_STUDENTS: 40,              // 한 반 최대 학생 수
  NAME_MAX: 10,                  // 학생 이름 최대 글자 수
  GROUP_SIZE: 4,                 // 모둠 인원 (남는 학생은 5명 모둠으로)
  WORDS_PER_LAP: 2,              // 한 바퀴에 주는 특수 단어 수
  SENTENCE_MAX: 60,              // 한 문장 최대 글자 수
  TURN_SECS: [20, 30, 45, 60, 90], // 고를 수 있는 차례당 시간 (초)
  DEFAULT_TURN: 30,              // 기본 차례당 시간 (초)
  LAPS: [2, 3],                  // 고를 수 있는 바퀴 수
  TURN_GRACE_MS: 1500,           // 화면 시간이 0이 된 뒤, 마지막 임시 저장을 받으려고 기다리는 시간
  RESUME_MIN_MS: 10000,          // 멈췄다가 다시 이어 갈 때 최소로 주는 시간
  LOBBY_GRACE_MS: 60000,         // 대기실에서 끊긴 학생을 명단에 남겨 두는 시간
  MAX_CUSTOM: 200,               // 직접 입력 단어·첫 문장 최대 개수
  WORD_MAX: 15,                  // 특수 단어 최대 글자 수
  FLAG_MAX: 200,                 // 비속어 기록 최대 개수
};
if (testConfig) Object.assign(CONFIG, testConfig);
const LOOP_MS = (testConfig && testConfig.LOOP_MS) || 30 * 1000;
const NAME_RE = /^[0-9A-Za-z가-힣]{2,12}$/;
const SPW_RE = /^\S{2,20}$/;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/teacher', (req, res) => res.sendFile(path.join(__dirname, 'public', 'teacher.html')));
app.get('/health', (req, res) => res.send('ok'));
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
function cleanStudentName(s) { return String(s || '').normalize('NFC').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.NAME_MAX); }
function studentKey(name) { return cleanStudentName(name).replace(/\s/g, '').toLowerCase(); }
function cleanSentence(s) { return String(s || '').normalize('NFC').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CONFIG.SENTENCE_MAX); }
function squash(s) { return String(s || '').normalize('NFC').replace(/\s+/g, '').toLowerCase(); }
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
// 쉼표·줄바꿈으로 나눈 목록 (같은 단어는 한 번만)
function parseList(text, max) {
  const seen = new Set(), out = [];
  for (const w of String(text || '').split(/[,\n]/)) {
    const v = w.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, max);
    if (v && !seen.has(squash(v))) { seen.add(squash(v)); out.push(v); }
  }
  return out.slice(0, CONFIG.MAX_CUSTOM);
}
function parseLines(text) {
  return String(text || '').split('\n').map(cleanSentence).filter(Boolean).slice(0, CONFIG.MAX_CUSTOM);
}

// ===== 비속어 찾기 =====
// 글자가 아닌 것(숫자·기호)은 빼고, 띄어쓰기는 한 글자짜리 토막 옆에서만 붙여서 비교해요.
//   "시 발", "시1발", "시.발" → 시발 (잡힘) / "다시 발을" → 다시 + 발을 (안 잡힘)
const IS_LETTER = /[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z]/;
function scanBad(text, extra) {
  const chars = [...String(text || '')];
  const tokens = [];
  let cur = [];
  chars.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur.length) tokens.push(cur); cur = []; return; }
    if (IS_LETTER.test(c)) cur.push({ c: c.toLowerCase(), i });
  });
  if (cur.length) tokens.push(cur);
  const seq = [];
  let prevLen = 0;
  for (const t of tokens) {
    if (seq.length && prevLen > 1 && t.length > 1) seq.push({ c: ' ', i: -1 });
    seq.push(...t);
    prevLen = t.length;
  }
  const str = seq.map(x => x.c).join('');
  const protectedPos = new Array(str.length).fill(false);
  for (const ex of WORDS.BAD_EXCEPTIONS) {
    let at = str.indexOf(ex);
    while (at >= 0) { for (let j = at; j < at + ex.length; j++) protectedPos[j] = true; at = str.indexOf(ex, at + 1); }
  }
  const ranges = [];
  for (const bad of WORDS.BAD_WORDS.concat(extra || [])) {
    const b = bad.toLowerCase();
    if (!b) continue;
    let at = str.indexOf(b);
    while (at >= 0) {
      let prot = false;
      for (let j = at; j < at + b.length; j++) if (protectedPos[j]) prot = true;
      if (!prot) {
        const idx = seq.slice(at, at + b.length).map(x => x.i).filter(i => i >= 0);
        if (idx.length) ranges.push([Math.min(...idx), Math.max(...idx)]);
      }
      at = str.indexOf(b, at + 1);
    }
  }
  return { bad: ranges.length > 0, ranges };
}
function maskBad(text, ranges) {
  const chars = [...text];
  for (const [s, e] of ranges) for (let j = s; j <= e; j++) if (!/\s/.test(chars[j])) chars[j] = '○';
  return chars.join('');
}

// ===== 반(학급) =====
const classes = new Map();
const CH = k => 'k:' + k.key;          // 반 전체
const TCH = k => 'k:' + k.key + ':t';  // 반 교사

function createClass(name, pw, spw) {
  const salt = crypto.randomBytes(8).toString('hex');
  const k = {
    id: newToken(), name, key: keyOf(name), salt, hash: hashPw(pw, salt), tokens: new Set(), spw,
    createdAt: Date.now(), lastActive: Date.now(), deleted: false,
    settings: { laps: 2, turnSec: CONFIG.DEFAULT_TURN, firstMode: 'random', firstText: '', wordMode: 'random', wordText: '', extraBad: '' },
    students: new Map(), // sid -> { sid, name, nkey, token, socketId, connected, dropTimer }
    usedFirst: new Set(), // 이 반에서 이미 나온 랜덤 첫 문장 (한 판 더 할 때 겹치지 않게)
    gameSeq: 0, game: null, lastGroups: null,
  };
  k.game = freshGame(k);
  classes.set(k.key, k);
  console.log(`[릴레이 이야기 반 열림] ${name} (지금 열린 반 ${classes.size}개)`);
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
  return { id: ++k.gameSeq, status: 'lobby', groups: [], groupOf: new Map(), revealGi: -1, flagged: [], laps: 0, turnSec: 0, allDoneNotified: false };
}
const isActive = st => st === 'writing' || st === 'reveal';
function connectedStudents(k) { return [...k.students.values()].filter(s => s.connected); }
function findByName(k, nkey) { for (const s of k.students.values()) if (s.nkey === nkey) return s; return null; }
function classNames() { return [...classes.values()].map(k => k.name).sort((a, b) => a.localeCompare(b, 'ko')); }
function sendClassList() { io.to('browse').emit('classList', classNames()); }
function socketsOf(k) {
  const ids = io.adapter.rooms.get(CH(k));
  if (!ids) return [];
  return [...ids].map(id => io.sockets.get(id)).filter(s => s && s.data.kid === k.id);
}
function stale(k, gid) { return k.deleted || k.game.id !== gid; }
function extraBad(k) { return parseList(k.settings.extraBad, 20); }

// ===== 모둠 짜기 =====
// 4명씩, 남는 학생은 앞 모둠부터 한 명씩 더해서 5명 모둠으로 (3명 모둠은 만들지 않음)
function makeGroups(sids) {
  const list = shuffle(sids);
  const n = list.length;
  const count = Math.max(1, Math.floor(n / CONFIG.GROUP_SIZE));
  const groups = Array.from({ length: count }, () => []);
  list.forEach((sid, i) => groups[i % count].push(sid));
  return groups;
}
// 한 판 더: 지난 모둠 그대로 + 나간 학생 빼기 + 새로 온 학생은 인원이 적은 모둠에
function reuseGroups(k) {
  const live = new Set(connectedStudents(k).map(s => s.sid));
  let groups = (k.lastGroups || []).map(g => g.filter(sid => k.students.has(sid)));
  const placed = new Set(groups.flat());
  for (const sid of live) {
    if (placed.has(sid)) continue;
    if (!groups.length) groups.push([]);
    groups.sort((a, b) => a.length - b.length)[0].push(sid);
  }
  groups = groups.filter(g => g.length);
  // 1명만 남은 모둠은 다른 모둠으로 합치기
  for (;;) {
    const lone = groups.findIndex(g => g.length < 2);
    if (lone < 0 || groups.length < 2) break;
    const [sid] = groups.splice(lone, 1)[0];
    groups.sort((a, b) => a.length - b.length)[0].push(sid);
  }
  return groups;
}
// 특수 단어를 받을 자리: 바퀴마다 2명. 모두 한 번씩 받을 때까지 순서대로, 그다음부터는 랜덤
//   4명: 1바퀴 1·2번, 2바퀴 3·4번, 3바퀴 랜덤 2명 / 5명: 1바퀴 1·2번, 2바퀴 3·4번, 3바퀴 5번 + 랜덤 1명
function wordTurns(n, laps) {
  const per = Math.min(CONFIG.WORDS_PER_LAP, n);
  const turns = [];
  let p = 0;
  for (let lap = 0; lap < laps; lap++) {
    const pos = [];
    while (pos.length < per && p < n) pos.push(p++);
    const rest = shuffle([...Array(n).keys()].filter(x => !pos.includes(x)));
    while (pos.length < per) pos.push(rest.shift());
    for (const x of pos.sort((a, b) => a - b)) turns.push(lap * n + x);
  }
  return turns;
}
function pickWords(k, count) {
  const custom = k.settings.wordMode === 'custom' ? parseList(k.settings.wordText, CONFIG.WORD_MAX) : [];
  const pool = custom.length ? custom : WORDS.SPECIAL_WORDS;
  const out = [];
  let bag = shuffle(pool);
  while (out.length < count) { if (!bag.length) bag = shuffle(pool); out.push(bag.shift()); }
  return out;
}
function pickFirsts(k, count) {
  if (k.settings.firstMode === 'custom') {
    const lines = parseLines(k.settings.firstText);
    if (lines.length) return Array.from({ length: count }, (_, i) => lines[i % lines.length]);
  }
  let pool = WORDS.FIRST_SENTENCES.filter(s => !k.usedFirst.has(s));
  if (pool.length < count) { k.usedFirst.clear(); pool = WORDS.FIRST_SENTENCES.slice(); }
  const out = shuffle(pool).slice(0, count);
  while (out.length < count) out.push(WORDS.FIRST_SENTENCES[out.length % WORDS.FIRST_SENTENCES.length]);
  out.forEach(s => k.usedFirst.add(s));
  return out;
}

// ===== 게임 진행 =====
function startWriting(k, regroup) {
  const old = k.game;
  for (const gr of old.groups) clearTimeout(gr.timer);
  for (const s of [...k.students.values()]) if (!s.connected && k.game.status === 'lobby') removeStudent(k, s);
  const lists = regroup || !k.lastGroups ? makeGroups(connectedStudents(k).map(s => s.sid)) : reuseGroups(k);
  const g = freshGame(k);
  k.game = g;
  g.status = 'writing';
  g.laps = k.settings.laps;
  g.turnSec = k.settings.turnSec;
  const firsts = pickFirsts(k, lists.length);
  g.groups = lists.map((members, gi) => {
    const order = shuffle(members);
    const turns = order.length * g.laps;
    const wt = wordTurns(order.length, g.laps);
    const words = pickWords(k, wt.length);
    const wordAt = {};
    wt.forEach((t, i) => { wordAt[t] = words[i]; });
    order.forEach(sid => g.groupOf.set(sid, gi));
    return {
      gi, name: `${gi + 1}모둠`, order, turns, wordAt, first: firsts[gi],
      idx: 0, turnSeq: 0, writerSid: null, turnEnd: null, draft: '',
      paused: null, pausedRemain: 0, done: false, timer: null,
      sentences: [], shown: 0, revealedAll: false,
    };
  });
  k.lastGroups = lists;
  for (const gr of g.groups) startTurn(k, gr);
  broadcast(k);
}
function setTurnTimer(k, gr, ms) {
  clearTimeout(gr.timer);
  gr.turnEnd = Date.now() + ms;
  const gid = k.game.id, seq = gr.turnSeq;
  gr.timer = setTimeout(() => safe(() => {
    if (stale(k, gid) || gr.turnSeq !== seq || gr.paused || gr.done) return;
    commitTurn(k, gr, null);
  }), ms + CONFIG.TURN_GRACE_MS);
}
// 다음 차례 시작 (강퇴된 학생 차례만 건너뜀. 접속이 끊긴 학생은 건너뛰지 않고 시간을 다 줌)
function startTurn(k, gr) {
  clearTimeout(gr.timer); gr.timer = null;
  while (gr.idx < gr.turns && !k.students.has(gr.order[gr.idx % gr.order.length])) gr.idx++;
  gr.draft = '';
  if (gr.idx >= gr.turns) {
    gr.done = true; gr.writerSid = null; gr.turnEnd = null; gr.paused = null;
    checkAllDone(k);
    return;
  }
  gr.writerSid = gr.order[gr.idx % gr.order.length];
  gr.turnSeq++;
  gr.paused = null;
  if (!groupOnline(k, gr)) { gr.paused = 'empty'; gr.pausedRemain = k.game.turnSec * 1000; gr.turnEnd = null; return; }
  setTurnTimer(k, gr, k.game.turnSec * 1000);
}
// 문장 확정. text가 null이면 시간이 끝난 것 (임시 저장해 둔 글로 제출)
function commitTurn(k, gr, text) {
  if (gr.done || !gr.writerSid) return;
  clearTimeout(gr.timer); gr.timer = null;
  const s = k.students.get(gr.writerSid);
  let t = cleanSentence(text == null ? gr.draft : text);
  let masked = false;
  if (t) {
    const r = scanBad(t, extraBad(k));
    if (r.bad) { addFlag(k, gr, s, t); t = maskBad(t, r.ranges); masked = true; }
  }
  const empty = !t;
  const word = gr.wordAt[gr.idx] || '';
  gr.sentences.push({
    sid: gr.writerSid, name: s ? s.name : '(나간 학생)', text: empty ? '(…)' : t,
    word, wordOk: !!word && !empty && squash(t).includes(squash(word)), masked, empty, hidden: false,
  });
  gr.idx++;
  startTurn(k, gr);
  broadcastGroup(k, gr);
}
function addFlag(k, gr, s, text) {
  const f = k.game.flagged;
  f.push({ group: gr.name, name: s ? s.name : '', text, at: Date.now() });
  if (f.length > CONFIG.FLAG_MAX) f.shift();
}
function groupOnline(k, gr) { return gr.order.some(sid => { const s = k.students.get(sid); return s && s.connected; }); }
function pauseGroup(gr, reason) {
  if (gr.done || gr.paused) return;
  clearTimeout(gr.timer); gr.timer = null;
  gr.pausedRemain = Math.max(0, (gr.turnEnd || Date.now()) - Date.now());
  gr.paused = reason; gr.turnEnd = null;
}
function resumeGroup(k, gr) {
  if (gr.done || !gr.paused) return;
  gr.paused = null;
  setTurnTimer(k, gr, Math.max(gr.pausedRemain, CONFIG.RESUME_MIN_MS));
}
// 접속한 사람이 바뀔 때마다: 모둠원이 모두 끊긴 모둠은 멈추고, 누가 돌아오면 이어서
function checkPresence(k) {
  const g = k.game;
  if (g.status !== 'writing') return;
  for (const gr of g.groups) {
    if (gr.done) continue;
    const online = groupOnline(k, gr);
    if (!online && !gr.paused) { pauseGroup(gr, 'empty'); broadcastGroup(k, gr); }
    else if (online && gr.paused === 'empty') { resumeGroup(k, gr); broadcastGroup(k, gr); }
  }
}
function checkAllDone(k) {
  const g = k.game;
  if (g.status !== 'writing' || g.allDoneNotified || !g.groups.every(gr => gr.done)) return;
  g.allDoneNotified = true;
  io.to(TCH(k)).emit('toast', '모든 모둠이 이야기를 다 썼어요! 「공개 시작」을 눌러 주세요.');
}
function startReveal(k) {
  const g = k.game;
  for (const gr of g.groups) { clearTimeout(gr.timer); gr.timer = null; gr.done = true; gr.writerSid = null; gr.turnEnd = null; gr.paused = null; }
  g.status = 'reveal';
  g.revealGi = g.groups.length ? 0 : -1;
  broadcast(k);
}
function toLobby(k) {
  for (const gr of k.game.groups) clearTimeout(gr.timer);
  k.game = freshGame(k);
  for (const s of [...k.students.values()]) if (!s.connected) removeStudent(k, s);
  broadcast(k);
}
function removeStudent(k, s) {
  clearTimeout(s.dropTimer);
  k.students.delete(s.sid);
}
function closeClass(k, reason) {
  if (k.deleted) return;
  k.deleted = true;
  for (const gr of k.game.groups) clearTimeout(gr.timer);
  for (const s of k.students.values()) clearTimeout(s.dropTimer);
  io.to(CH(k)).emit('classClosed', reason);
  socketsOf(k).forEach(detach);
  classes.delete(k.key);
  sendClassList();
  console.log(`[릴레이 이야기 반 닫힘] ${k.name} · ${reason} (남은 반 ${classes.size}개)`);
}
function detach(socket) {
  for (const r of [...socket.rooms]) if (r.startsWith('k:')) socket.leave(r);
  socket.data.key = null; socket.data.kid = null; socket.data.role = null; socket.data.sid = null;
}
function safe(fn) { try { fn(); } catch (e) { console.error('[릴레이 이야기 오류]', e); } }

// ===== 상태 보내기 =====
function rosterOf(k) {
  return [...k.students.values()].map(s => ({ sid: s.sid, name: s.name, connected: s.connected }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
function memberList(k, gr) {
  return gr.order.map(sid => { const s = k.students.get(sid); return { sid, name: s ? s.name : '(나감)', connected: !!(s && s.connected), gone: !s }; });
}
function groupSummary(k, gr) {
  const w = gr.writerSid ? k.students.get(gr.writerSid) : null;
  return {
    gi: gr.gi, name: gr.name, idx: gr.idx, turns: gr.turns, done: gr.done, paused: gr.paused, turnSeq: gr.turnSeq,
    turnEnd: gr.turnEnd, pausedRemain: gr.paused ? gr.pausedRemain : 0,
    writerSid: gr.writerSid, writerName: w ? w.name : '', writerConnected: !!(w && w.connected),
    members: memberList(k, gr),
  };
}
function basePayload(k) {
  const g = k.game;
  return { name: k.name, gameId: g.id, status: g.status, laps: g.laps || k.settings.laps, turnSec: g.turnSec || k.settings.turnSec, maxLen: CONFIG.SENTENCE_MAX, serverNow: Date.now() };
}
function teacherPayload(k) {
  const g = k.game;
  return {
    ...basePayload(k), role: 'teacher', students: rosterOf(k),
    groups: g.groups.map(gr => ({ ...groupSummary(k, gr), first: gr.first, sentences: gr.sentences, shown: gr.shown, revealedAll: gr.revealedAll })),
    revealGi: g.revealGi, flagged: g.flagged,
    spectators: connectedStudents(k).filter(s => !g.groupOf.has(s.sid)).map(s => s.name),
  };
}
function studentPayload(k, sid) {
  const g = k.game, s = sid ? k.students.get(sid) : null;
  const p = { ...basePayload(k), role: 'student', me: s ? { sid: s.sid, name: s.name } : null };
  if (g.status === 'lobby') p.students = rosterOf(k);
  if (!s || g.status !== 'writing') return p;
  const gi = g.groupOf.get(s.sid);
  if (gi == null) { p.spectator = true; return p; }
  const gr = g.groups[gi];
  p.group = groupSummary(k, gr);
  p.myTurn = gr.writerSid === s.sid && !gr.done;
  if (p.myTurn) {
    p.prev = gr.idx === 0 ? gr.first : (gr.sentences[gr.sentences.length - 1] || {}).text || gr.first;
    p.prevIsFirst = gr.idx === 0;
    p.word = gr.wordAt[gr.idx] || '';
    p.draft = gr.draft;
  }
  return p;
}
function emitTo(k, sk) {
  if (sk.data.role === 'teacher') sk.emit('state', teacherPayload(k));
  else sk.emit('state', studentPayload(k, sk.data.sid));
}
function broadcast(k) {
  if (k.deleted) return;
  const tp = teacherPayload(k);
  for (const sk of socketsOf(k)) {
    if (sk.data.role === 'teacher') sk.emit('state', tp);
    else sk.emit('state', studentPayload(k, sk.data.sid));
  }
}
// 한 모둠에만 (차례가 바뀔 때): 그 모둠 학생 + 교사
function broadcastGroup(k, gr) {
  if (k.deleted) return;
  const tp = teacherPayload(k);
  io.to(TCH(k)).emit('state', tp);
  for (const sid of gr.order) {
    const s = k.students.get(sid);
    const sk = s && s.socketId && io.sockets.get(s.socketId);
    if (sk) sk.emit('state', studentPayload(k, sid));
  }
}
function broadcastTeachers(k) { if (!k.deleted) io.to(TCH(k)).emit('state', teacherPayload(k)); }
function teacherInfo(k) { return { name: k.name, spw: k.spw, settings: k.settings, turnSecs: CONFIG.TURN_SECS, laps: CONFIG.LAPS, firstCount: WORDS.FIRST_SENTENCES.length, wordCount: WORDS.SPECIAL_WORDS.length }; }

// 오래 안 쓴 반 정리 (5분마다)
setInterval(() => safe(() => {
  const now = Date.now();
  for (const k of [...classes.values()]) {
    const room = io.adapter.rooms.get(CH(k));
    if ((!room || room.size === 0) && now - k.lastActive > CONFIG.CLASS_IDLE_MS) closeClass(k, '오래 사용하지 않아 반이 자동으로 닫혔어요.');
  }
}), 5 * 60 * 1000).unref();
// 15분 동안 아무것도 누르지 않은 기기는 접속 종료 (게임 중인 반은 제외)
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
  const on = (ev, fn) => socket.on(ev, (...args) => {
    if (ev !== 'disconnect' && ev !== 'draft') socket.data.lastInput = Date.now();
    try {
      const p = fn(...args);
      if (p && typeof p.catch === 'function') p.catch(e => console.error(`[릴레이 이야기 오류] ${ev}`, e));
    } catch (e) { console.error(`[릴레이 이야기 오류] ${ev}`, e); }
  });
  const cbOf = cb => (typeof cb === 'function' ? cb : () => {});
  const obj = d => (d && typeof d === 'object' ? d : {});
  const K = () => {
    const k = socket.data.key ? classes.get(socket.data.key) : null;
    if (!k || k.id !== socket.data.kid) return null;
    k.lastActive = Date.now();
    return k;
  };
  const T = () => { const k = K(); return k && socket.data.role === 'teacher' ? k : null; };
  const ME = () => {
    const k = K();
    if (!k || socket.data.role !== 'student') return [null, null];
    const s = k.students.get(socket.data.sid);
    return s && s.socketId === socket.id ? [k, s] : [null, null];
  };
  const tooMany = () => {
    const now = Date.now();
    if (!socket.data.failAt || now - socket.data.failAt > 60000) { socket.data.failAt = now; socket.data.fails = 0; }
    return socket.data.fails >= 8;
  };
  const failed = () => { socket.data.fails = (socket.data.fails || 0) + 1; };
  // 이 기기에서 학생이 빠질 때: 대기실이면 명단에서 지우고, 게임 중이면 자리를 남겨 둠 (끊긴 것으로)
  const releaseStudent = (k) => {
    const s = k && socket.data.sid ? k.students.get(socket.data.sid) : null;
    if (s && s.socketId === socket.id) {
      if (k.game.status === 'lobby') removeStudent(k, s);
      else { s.connected = false; s.socketId = null; }
      checkPresence(k);
    }
    socket.data.sid = null;
  };
  const leaveCurrent = () => {
    const k = K();
    if (k && socket.data.role === 'student') { releaseStudent(k); detach(socket); broadcast(k); }
    else detach(socket);
  };

  socket.emit('serverInfo', { gateReady: !!TEACHER_PASSWORD, adminEnabled: !!ADMIN_PASSWORD });
  on('activity', () => {});

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
    emitTo(k, socket);
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
    if (s && s.connected && s.socketId !== socket.id && s.token !== token) {
      return cb({ ok: false, msg: '이미 같은 이름으로 접속 중인 친구가 있어요. 성까지 넣어 보세요.' });
    }
    if (!s && k.students.size >= CONFIG.MAX_STUDENTS) return cb({ ok: false, msg: '이 반에 들어온 학생이 너무 많아요.' });
    if (socket.data.role === 'student' && socket.data.sid && (!s || s.sid !== socket.data.sid)) releaseStudent(k);
    const isNew = !s;
    if (isNew) {
      s = { sid: newToken().slice(0, 12), name, nkey, token, socketId: null, connected: false, dropTimer: null };
      k.students.set(s.sid, s);
    }
    clearTimeout(s.dropTimer); s.dropTimer = null;
    const oldId = s.socketId;
    s.token = token; s.socketId = socket.id; s.connected = true;
    socket.data.role = 'student'; socket.data.sid = s.sid;
    if (oldId && oldId !== socket.id) {
      const old = io.sockets.get(oldId);
      if (old) { old.emit('replaced', '다른 화면에서 같은 이름으로 들어와서 이 화면은 연결을 끊었어요.'); detach(old); old.disconnect(true); }
    }
    cb({ ok: true, name: s.name, resumed: !isNew });
    checkPresence(k);
    const gi = k.game.groupOf.get(s.sid);
    if (k.game.status === 'writing' && gi != null) broadcastGroup(k, k.game.groups[gi]);
    else if (k.game.status === 'lobby') broadcast(k);
    else { emitTo(k, socket); broadcastTeachers(k); }
  });

  on('studentLogout', () => {
    const k = K();
    if (!k || socket.data.role !== 'student') return;
    releaseStudent(k);
    socket.data.role = null;
    broadcast(k);
  });

  // ---------- 쓰기 (차례인 학생만, 차례 번호가 맞을 때만) ----------
  const myTurn = (seq) => {
    const [k, s] = ME();
    if (!k || k.game.status !== 'writing') return [null, null];
    const gi = k.game.groupOf.get(s.sid);
    const gr = gi == null ? null : k.game.groups[gi];
    if (!gr || gr.done || gr.writerSid !== s.sid || gr.turnSeq !== seq) return [null, null];
    return [k, gr];
  };
  // 쓰던 글 임시 저장 (응답 없음, 아무에게도 보내지 않음)
  on('draft', (d) => {
    d = obj(d);
    const [k, gr] = myTurn(d.seq);
    if (!k) return;
    gr.draft = String(d.text || '').slice(0, CONFIG.SENTENCE_MAX + 10);
  });
  on('submitSentence', (d, cb) => {
    cb = cbOf(cb); d = obj(d);
    const [k, gr] = myTurn(d.seq);
    if (!k) return cb({ ok: false, stale: true, msg: '이미 차례가 넘어갔어요.' });
    const text = cleanSentence(d.text);
    if (!text) return cb({ ok: false, msg: '문장을 써 주세요.' });
    gr.draft = String(d.text || '').slice(0, CONFIG.SENTENCE_MAX + 10);
    const r = scanBad(text, extraBad(k));
    if (r.bad) {
      addFlag(k, gr, k.students.get(gr.writerSid), text);
      broadcastTeachers(k);
      return cb({ ok: false, bad: true, msg: '바른 말로 고쳐 써요.' });
    }
    cb({ ok: true });
    commitTurn(k, gr, text);
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
    emitTo(k, socket);
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

  // ---------- 교사: 설정 (쓰는 중에는 못 바꿈) ----------
  on('saveSettings', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const k = T();
    if (!k) return cb({ ok: false, msg: '반에 다시 들어와 주세요.' });
    if (k.game.status === 'writing') return cb({ ok: false, msg: '이야기를 쓰는 중에는 설정을 바꿀 수 없어요.' });
    const st = k.settings;
    const laps = parseInt(data.laps, 10);
    if (CONFIG.LAPS.includes(laps)) st.laps = laps;
    const sec = parseInt(data.turnSec, 10);
    if (CONFIG.TURN_SECS.includes(sec)) st.turnSec = sec;
    if (data.firstMode === 'random' || data.firstMode === 'custom') st.firstMode = data.firstMode;
    if (data.wordMode === 'random' || data.wordMode === 'custom') st.wordMode = data.wordMode;
    if (typeof data.firstText === 'string') st.firstText = data.firstText.slice(0, 3000);
    if (typeof data.wordText === 'string') st.wordText = data.wordText.slice(0, 3000);
    if (typeof data.extraBad === 'string') st.extraBad = data.extraBad.slice(0, 1000);
    socket.to(TCH(k)).emit('teacherInfo', teacherInfo(k));
    cb({ ok: true, firsts: parseLines(st.firstText).length, words: parseList(st.wordText, CONFIG.WORD_MAX).length });
  });

  // 시작 (regroup: true면 모둠을 새로 짬, false면 지난 모둠 그대로 한 판 더)
  on('startGame', (data, cb) => {
    cb = cbOf(cb); data = obj(data);
    const k = T();
    if (!k) return cb({ ok: false, msg: '반에 다시 들어와 주세요.' });
    if (k.game.status === 'writing') return cb({ ok: false, msg: '이미 이야기를 쓰는 중이에요.' });
    const st = k.settings;
    if (st.firstMode === 'custom' && !parseLines(st.firstText).length) return cb({ ok: false, msg: '첫 문장을 1개 이상 써 주세요.' });
    if (st.wordMode === 'custom' && !parseList(st.wordText, CONFIG.WORD_MAX).length) return cb({ ok: false, msg: '특수 단어를 1개 이상 써 주세요.' });
    if (connectedStudents(k).length < 2) return cb({ ok: false, msg: '학생이 2명 이상 들어와야 시작할 수 있어요.' });
    cb({ ok: true });
    startWriting(k, data.regroup !== false);
  });

  // 일시정지 / 재개 (gi를 주면 그 모둠만, 없으면 모든 모둠)
  const groupsOf = (k, gi) => (Number.isInteger(gi) ? k.game.groups.filter(g => g.gi === gi) : k.game.groups);
  on('pauseGroups', (gi) => {
    const k = T();
    if (!k || k.game.status !== 'writing') return;
    for (const gr of groupsOf(k, gi)) pauseGroup(gr, 'teacher');
    broadcast(k);
  });
  on('resumeGroups', (gi) => {
    const k = T();
    if (!k || k.game.status !== 'writing') return;
    for (const gr of groupsOf(k, gi)) resumeGroup(k, gr);
    broadcast(k);
  });
  // 강제로 다음 차례 (그때까지 쓴 글로 제출). 차례 번호를 확인해서 두 번 넘어가지 않게
  on('forceNext', (data) => {
    data = obj(data);
    const k = T();
    if (!k || k.game.status !== 'writing') return;
    const gr = k.game.groups.find(g => g.gi === data.gi);
    if (!gr || gr.done || gr.turnSeq !== data.seq) return;
    commitTurn(k, gr, null);
  });
  on('startReveal', (cb) => {
    cb = cbOf(cb);
    const k = T();
    if (!k || k.game.status !== 'writing') return cb({ ok: false });
    cb({ ok: true });
    startReveal(k);
  });
  // ---------- 교사: 공개 (TV 화면) ----------
  on('revealPick', (gi) => {
    const k = T();
    if (!k || k.game.status !== 'reveal' || !k.game.groups[gi]) return;
    k.game.revealGi = gi;
    broadcastTeachers(k);
  });
  on('revealStep', (dir) => {
    const k = T();
    if (!k || k.game.status !== 'reveal') return;
    const gr = k.game.groups[k.game.revealGi];
    if (!gr) return;
    gr.shown = Math.max(0, Math.min(gr.sentences.length, gr.shown + (dir < 0 ? -1 : 1)));
    if (gr.shown >= gr.sentences.length) gr.revealedAll = true;
    broadcastTeachers(k);
  });
  on('revealAll', () => {
    const k = T();
    if (!k || k.game.status !== 'reveal') return;
    const gr = k.game.groups[k.game.revealGi];
    if (!gr) return;
    gr.shown = gr.sentences.length; gr.revealedAll = true;
    broadcastTeachers(k);
  });
  on('toggleHide', (data) => {
    data = obj(data);
    const k = T();
    if (!k || !isActive(k.game.status)) return;
    const gr = k.game.groups[data.gi];
    const sen = gr && gr.sentences[data.si];
    if (!sen) return;
    sen.hidden = !sen.hidden;
    broadcastTeachers(k);
  });
  on('toLobby', () => { const k = T(); if (k) toLobby(k); });

  on('kick', (sid) => {
    const k = T();
    if (!k) return;
    const s = k.students.get(String(sid || ''));
    if (!s) return;
    const sk = s.socketId && io.sockets.get(s.socketId);
    removeStudent(k, s);
    if (sk) { sk.emit('kicked', '선생님이 이 반에서 내보냈어요.'); sk.data.sid = null; sk.data.role = null; }
    const gi = k.game.groupOf.get(s.sid);
    const gr = gi == null ? null : k.game.groups[gi];
    // 쓰는 중이던 학생이면 그 차례를 문장 없이 넘김
    if (k.game.status === 'writing' && gr && gr.writerSid === s.sid && !gr.done) { gr.idx++; startTurn(k, gr); }
    checkPresence(k);
    broadcast(k);
  });

  // ---------- 관리자 ----------
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
      name: k.name, status: k.game.status, students: connectedStudents(k).length,
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

  // ---------- 접속 끊김: 바로 넘기지 않음 ----------
  on('disconnect', () => {
    const k = socket.data.key ? classes.get(socket.data.key) : null;
    if (!k || k.id !== socket.data.kid || socket.data.role !== 'student') return;
    const s = k.students.get(socket.data.sid);
    if (!s || s.socketId !== socket.id) return;
    s.connected = false; s.socketId = null;
    if (k.game.status === 'lobby') {
      s.dropTimer = setTimeout(() => safe(() => {
        if (!k.deleted && k.students.get(s.sid) === s && !s.connected && k.game.status === 'lobby') { removeStudent(k, s); broadcast(k); }
      }), CONFIG.LOBBY_GRACE_MS);
      broadcast(k);
      return;
    }
    checkPresence(k);
    const gi = k.game.groupOf.get(s.sid);
    if (k.game.status === 'writing' && gi != null) broadcastGroup(k, k.game.groups[gi]);
    else broadcastTeachers(k);
  });
});

  return { classes, scanBad, maskBad, wordTurns, makeGroups };
};
