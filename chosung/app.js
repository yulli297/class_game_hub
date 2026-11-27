// =====================================================
//  초성 퀴즈 서버 — 개인전 + 모둠 대항전 통합판
//  Node.js + Express + Socket.io
//
//  · 선생님이 반 이름(예: 천곡64)과 비밀번호로 '반'을 만들면 그 반만의 게임 방이 열려요.
//  · 여러 반이 동시에 써도 서로 섞이지 않아요. (반마다 학생 명단·게임·초성이 따로)
//  · 반마다 개인전(학생 1인 1기기, 방 자동 배정) / 모둠 대항전(모둠당 1기기, 한 방)을 고를 수 있어요.
//  · 정답 인정 범위: 전체 단어 / 고유어만 / 한자어만 (표준국어대사전 기준)
// =====================================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

// 하나로 합친 서버(../server.js)가 부르는 함수: app = 이 게임 주소(/chosung) 전용 라우터, io = 이 게임 전용 실시간 통로
module.exports = function mount(app, io) {


const STDICT_KEY = (process.env.STDICT_KEY || '').trim();         // 표준국어대사전 키 (메인)
const OPENDICT_KEY = (process.env.OPENDICT_KEY || '').trim();     // 우리말샘 키 (비상용, 전체 단어 모드에서만)
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim(); // 관리자 비밀번호 (모든 반 보기·닫기). 비우면 관리자 기능 꺼짐
// 교사 화면 공통 접속 비밀번호 (선생님들끼리만 공유). 저장소가 공개라서 코드에 적지 않고 Render 환경변수로만 넣어요
const TEACHER_PASSWORD = (process.env.TEACHER_PASSWORD || '').trim();

// ===== 공통 설정 =====
const CONFIG = {
  TOTAL_ROUNDS: 5,          // 전체 라운드 수
  LOSS_LIMIT: 2,            // 라운드 탈락 몇 번이면 패배
  COUNTDOWN: 5,             // 게임 시작 카운트다운 (초)
  DICT_TIMEOUT_MS: 6000,    // 사전 응답 기다리는 최대 시간 (한 번 물어볼 때)
  DEF_MAX: 80,              // 뜻 최대 글자 수
  LOBBY_GRACE_MS: 60000,    // 대기실에서 잠깐 끊긴 학생을 명단에 남겨 두는 시간
  MAX_CLASSES: 60,          // 동시에 열 수 있는 반 수 (서버 메모리 보호)
  CLASS_IDLE_MS: 60 * 60 * 1000, // 아무도 접속하지 않은 채 1시간이 지난 반은 자동으로 닫음
  CACHE_MAX: 20000,         // 사전 결과 기억 개수
  MAX_TOKENS: 30,           // 한 반에 동시에 로그인해 둘 수 있는 교사 기기 수
};
// ===== 게임 종류별 규칙 (여기 숫자만 바꾸면 규칙이 바뀌어요) =====
const RULES = {
  solo: { label: '개인전',      maxNum: 30, turnMs: 10000, laps: 4, popupMs: 3000, roomCount: 6, minResume: 1500 },
  team: { label: '모둠 대항전', maxNum: 6,  turnMs: 15000, laps: 6, popupMs: 3500, roomCount: 1, minResume: 2000 },
};
// 정답 인정 범위 (표준국어대사전 type2 값)
const WORD_TYPES = {
  all:     { label: '전체 단어', type2: '' },
  native:  { label: '고유어',    type2: 'native' },
  chinese: { label: '한자어',    type2: 'chinese' },
};
const BLOCK_TYPES = ['방언', '북한어', '옛말', '지역어']; // 인정하지 않는 단어 종류


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

// ===== 한글 처리 =====
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
// ㄱ+ㅅ을 이어 치면 ㄳ이 되는 문제 해결용
const SPLIT = { 'ㄳ':'ㄱㅅ','ㄵ':'ㄴㅈ','ㄶ':'ㄴㅎ','ㄺ':'ㄹㄱ','ㄻ':'ㄹㅁ','ㄼ':'ㄹㅂ','ㄽ':'ㄹㅅ','ㄾ':'ㄹㅌ','ㄿ':'ㄹㅍ','ㅀ':'ㄹㅎ','ㅄ':'ㅂㅅ' };
function normalizeChosung(s) {
  return String(s || '').replace(/\s/g, '').split('').map(c => SPLIT[c] || c).join('');
}
function isValidChosung(s) {
  return s.length >= 1 && s.length <= 6 && s.split('').every(c => CHO.includes(c));
}
function choOf(ch) {
  const c = ch.charCodeAt(0) - 0xAC00;
  if (c < 0 || c > 11171) return null;
  return CHO[Math.floor(c / 588)];
}
function localCheck(word, cho) {
  if (!word) return '단어를 입력해주세요.';
  for (const ch of word) if (choOf(ch) === null) return '완성된 한글 글자로만 써주세요.';
  if (word.length !== cho.length) return `${cho.length}글자 단어를 써주세요.`;
  for (let i = 0; i < word.length; i++) if (choOf(word[i]) !== cho[i]) return '초성이 맞지 않아요.';
  return '';
}

// ===== 사전 확인 =====
const STDICT_BASE = 'https://stdict.korean.go.kr/api/search.do';
const OPENDICT_BASE = 'https://opendict.korean.go.kr/api/search';
function toArr(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }
function cleanWord(w) { return String(w || '').replace(/[-^\s]/g, ''); }
function cleanDef(s) {
  let d = String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (d.length > CONFIG.DEF_MAX) d = d.slice(0, CONFIG.DEF_MAX) + '…';
  return d;
}
// 응답 본문을 끝까지 받을 때까지 제한시간을 유지 (중간에 멈춰도 6초 뒤에는 반드시 끝남)
async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CONFIG.DICT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.text()).trim();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('응답 시간 초과');
    throw e;
  } finally { clearTimeout(t); }
}
// 결과: {status:'ok', def} 또는 {status:'notfound'}. 연결 문제면 에러를 던짐
async function queryDict(base, key, word, type2) {
  let url = `${base}?key=${encodeURIComponent(key)}&q=${encodeURIComponent(word)}&req_type=json&advanced=y&method=exact&num=30`;
  if (type2) url += `&type2=${type2}`;
  const text = await fetchText(url);
  if (!text) return { status: 'notfound' };
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('응답 형식 오류'); }
  if (!data || typeof data !== 'object') throw new Error('응답 형식 오류');
  if (data.error) throw new Error('API 오류 ' + JSON.stringify(data.error));
  const items = toArr(data.channel && data.channel.item);
  for (const it of items) {
    if (cleanWord(it.word) !== word) continue;
    for (const s of toArr(it.sense)) {
      if (BLOCK_TYPES.includes(String(s.type || '').trim())) continue;
      return { status: 'ok', def: cleanDef(s.definition) };
    }
  }
  return { status: 'notfound' };
}
function dictList() {
  // 표준국어대사전이 메인(판정+뜻), 우리말샘은 표준이 먹통일 때만 사용
  const list = [];
  if (STDICT_KEY) list.push({ name: '표준국어대사전', base: STDICT_BASE, key: STDICT_KEY });
  if (OPENDICT_KEY) list.push({ name: '우리말샘', base: OPENDICT_BASE, key: OPENDICT_KEY });
  return list;
}
// 전체 단어: 표준국어대사전 → (먹통일 때만) 우리말샘 → 한 번 더 표준국어대사전
// 표준이 정상 응답했는데 단어가 없으면 그대로 '없는 단어' 처리 (우리말샘으로 넘어가지 않음)
async function lookupAll(word) {
  const list = dictList();
  const tries = list.length ? list.concat(list[0]) : [];
  for (const d of tries) {
    try { const r = await queryDict(d.base, d.key, word, ''); r.source = d.name; return r; }
    catch (e) { console.log(`[사전] ${d.name} 연결 실패 ("${word}"):`, e.message); }
  }
  return { status: 'down' };
}
// 고유어/한자어: 표준국어대사전에서 종류를 걸러서 확인 (두 번 시도해도 안 되면 down)
async function lookupTyped(word, wt) {
  if (!STDICT_KEY) return { status: 'down' };
  for (let i = 0; i < 2; i++) {
    try {
      const r = await queryDict(STDICT_BASE, STDICT_KEY, word, WORD_TYPES[wt].type2);
      if (r.status === 'ok') { r.source = '표준국어대사전'; return r; }
      // 종류가 안 맞는 건지, 사전에 아예 없는 건지 구분해서 안내하기 위해 한 번 더 물어봄
      let reason = 'none';
      try { reason = (await queryDict(STDICT_BASE, STDICT_KEY, word, '')).status === 'ok' ? 'mismatch' : 'none'; } catch (e) { /* 안내만 못 구분 */ }
      return { status: 'notfound', reason, source: '표준국어대사전' };
    } catch (e) { console.log(`[사전] 연결 실패 ("${word}", ${WORD_TYPES[wt].label}, ${i + 1}번째):`, e.message); }
  }
  return { status: 'down' };
}
// 한 번 확인한 단어는 기억해 두고 다시 묻지 않음 (모든 반이 함께 씀 → 사전 호출 수가 줄어듦)
const wordCache = new Map();  // `${범위}:${단어}` -> 결과
const inflight = new Map();   // 지금 확인 중인 단어 -> 같은 확인 결과를 함께 기다림
async function checkWord(word, wt) {
  const key = wt + ':' + word;
  if (wordCache.has(key)) return { ...wordCache.get(key), cached: true };
  if (!inflight.has(key)) {
    const p = (wt === 'all' ? lookupAll(word) : lookupTyped(word, wt)).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  const r = await inflight.get(key);
  if (r.status !== 'down' && !wordCache.has(key)) {
    if (wordCache.size >= CONFIG.CACHE_MAX) wordCache.delete(wordCache.keys().next().value);
    wordCache.set(key, r);
  }
  return r;
}

// ===== 반(학급) =====
// 반 이름: 띄어쓰기 없이 한글·영문·숫자 2~12자 (예: 천곡64)
const NAME_RE = /^[0-9A-Za-z가-힣]{2,12}$/;
const classes = new Map(); // 반 key(소문자 이름) -> 반
function cleanName(s) { return String(s || '').normalize('NFC').replace(/\s/g, ''); }
function keyOf(name) { return cleanName(name).toLowerCase(); }
function hashPw(pw, salt) { return crypto.scryptSync(String(pw), salt, 32).toString('hex'); }
function samePw(pw, k) {
  const a = Buffer.from(hashPw(pw, k.salt), 'hex'), b = Buffer.from(k.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newToken() { return crypto.randomBytes(16).toString('hex'); }

function createClass(name, pw, spw) {
  const salt = crypto.randomBytes(8).toString('hex');
  const k = {
    id: newToken(), name, key: keyOf(name), salt, hash: hashPw(pw, salt), tokens: new Set(),
    spw, // 학급 비밀번호 (학생 입장용 · 교사 화면에 보여 줘야 해서 그대로 저장)
    createdAt: Date.now(), lastActive: Date.now(), deleted: false,
    type: 'solo', wordType: 'all',
    members: new Map(), // 번호 -> { num, token, socketId, connected, dropTimer }
    chosungList: Array(CONFIG.TOTAL_ROUNDS).fill(''),
    countdownTimer: null, gameSeq: 0, dictFails: 0, game: null,
  };
  k.game = freshGame(k);
  classes.set(k.key, k);
  console.log(`[반 열림] ${name} (지금 열린 반 ${classes.size}개)`);
  sendClassList();
  return k;
}
function addToken(k) {
  const t = newToken();
  k.tokens.add(t);
  while (k.tokens.size > CONFIG.MAX_TOKENS) k.tokens.delete(k.tokens.values().next().value);
  return t;
}
const R = k => RULES[k.type];
const CH = k => 'k:' + k.key;              // 반 전체 (학생 + 교사)
const TCH = k => 'k:' + k.key + ':t';      // 반 교사
const RCH = (k, id) => 'k:' + k.key + ':r' + id; // 반 안의 게임 방
const unit = (k, n) => k.type === 'team' ? `${n}모둠` : `${n}번`;

// ===== 게임 상태 (반마다 따로) =====
function freshGame(k) {
  return { id: ++k.gameSeq, phase: 'lobby', round: 0, chosung: '', rooms: [], stats: {}, countdown: 0, endReason: '' };
}
function newRoom(id, members) {
  return {
    id, members, order: [], pos: -1, lap: 1, used: [], words: [],
    status: 'idle', current: null, typing: '', remaining: 0, deadline: 0,
    checking: false, popup: null, lastLoser: null, waiting: false, _turnTimer: null, _popupTimer: null,
  };
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// 대기실 명단: 접속 중 + 잠깐 끊겨서 다시 들어오기를 기다리는 학생(모둠)
function lobbyNums(k) { return [...k.members.values()].map(s => s.num).sort((a, b) => a - b); }
function awayNums(k) { return [...k.members.values()].filter(s => !s.connected).map(s => s.num).sort((a, b) => a - b); }
function isConnected(k, num) { const s = k.members.get(num); return !!(s && s.connected); }
function aliveOf(k, room) { return room.members.filter(n => !k.game.stats[n].defeated); }
function roomOf(k, num) { const st = k.game.stats[num]; return st ? k.game.rooms[st.room - 1] : null; }
function clearRoomTimers(room) {
  clearTimeout(room._turnTimer); clearTimeout(room._popupTimer);
  room._turnTimer = null; room._popupTimer = null;
}
function clearAllTimers(k) {
  if (k.countdownTimer) { clearInterval(k.countdownTimer); k.countdownTimer = null; }
  k.game.rooms.forEach(clearRoomTimers);
}
// 순위: 생존 > 라운드 탈락이 적은 순 > 맞힌 단어가 많은 순
function ranking(k) {
  const st = k.game.stats;
  return Object.keys(st).map(Number).sort((a, b) =>
    (st[a].defeated - st[b].defeated) || (st[a].losses - st[b].losses) || (st[b].correct - st[a].correct) || (a - b));
}

function snapshot(k) {
  const g = k.game, now = Date.now(), rule = R(k);
  return {
    name: k.name, type: k.type, typeLabel: rule.label, wordType: k.wordType, wordLabel: WORD_TYPES[k.wordType].label,
    phase: g.phase, round: g.round, totalRounds: CONFIG.TOTAL_ROUNDS, laps: rule.laps,
    lossLimit: CONFIG.LOSS_LIMIT, maxNum: rule.maxNum,
    chosung: (g.phase === 'playing' || g.phase === 'roundEnd') ? g.chosung : '',
    countdown: g.countdown, endReason: g.endReason, dictFails: k.dictFails,
    online: lobbyNums(k), away: awayNums(k),
    rooms: g.rooms.map(r => ({
      id: r.id, members: r.members, order: r.order, status: r.status, current: r.current,
      typing: r.typing, checking: r.checking, words: r.words, lap: r.lap, popup: r.popup,
      lastLoser: r.lastLoser, waiting: r.waiting,
      remaining: (r.status === 'live' && r.current != null && !r.checking && !r.popup)
        ? Math.max(0, r.deadline - now) : r.remaining,
    })),
    stats: g.stats,
    ranking: g.phase === 'gameOver' ? ranking(k) : [],
  };
}
function broadcast(k) { if (!k.deleted) io.to(CH(k)).emit('state', snapshot(k)); }
function teacherInfo(k) {
  return { name: k.name, spw: k.spw, chosungList: k.chosungList, maxNum: R(k).maxNum, totalRounds: CONFIG.TOTAL_ROUNDS };
}
function serverInfo() {
  return { keys: { stdict: !!STDICT_KEY, opendict: !!OPENDICT_KEY }, gateReady: !!TEACHER_PASSWORD, adminEnabled: !!ADMIN_PASSWORD };
}
// 학생 화면의 '반 찾기' 목록 (반 이름만 보여 줌)
function classNames() { return [...classes.values()].map(k => k.name).sort((a, b) => a.localeCompare(b, 'ko')); }
function sendClassList() { io.to('browse').emit('classList', classNames()); }
// 학급 비밀번호: 2~20자 (보통 숫자 4자리)
const SPW_RE = /^\S{2,20}$/;
// 반이 닫히거나 게임이 바뀌었으면 예약된 일을 하지 않음
function stale(k, gid) { return k.deleted || k.game.id !== gid; }

// ===== 라운드 / 차례 진행 =====
function startRound(k, n) {
  const g = k.game;
  g.round = n;
  g.chosung = k.chosungList[n - 1];
  g.phase = 'playing';
  for (const room of g.rooms) {
    clearRoomTimers(room);
    room.used = []; room.words = []; room.typing = ''; room.popup = null;
    room.checking = false; room.current = null; room.lastLoser = null; room.waiting = false;
    if (room.status === 'finished') continue;
    const alive = aliveOf(k, room);
    if (alive.length <= 1) { room.status = 'finished'; continue; }
    room.order = shuffle(alive.slice());
    room.pos = -1; room.lap = 1; room.status = 'live';
    advance(k, room);
  }
  checkAllDone(k);
}
// 다음 학생(모둠)으로 (접속 끊긴 쪽은 건너뜀)
function advance(k, room) {
  clearRoomTimers(room);
  room.typing = ''; room.popup = null; room.checking = false; room.current = null;
  // 방 전체가 끊겨 있으면 바퀴를 돌리지 않고 누군가 다시 들어올 때까지 기다림
  if (!room.order.some(n => isConnected(k, n))) { room.waiting = true; return; }
  room.waiting = false;
  while (true) {
    room.pos++;
    if (room.pos >= room.order.length) {
      room.pos = 0; room.lap++;
      if (room.lap > R(k).laps) { room.lap = R(k).laps; return endRoomRound(k, room, null); }
    }
    const num = room.order[room.pos];
    if (isConnected(k, num)) return startTurn(k, room, num);
  }
}
function startTurn(k, room, num) {
  room.current = num; room.typing = ''; room.checking = false; room.popup = null;
  room.remaining = R(k).turnMs;
  runTimer(k, room);
}
function runTimer(k, room) {
  clearTimeout(room._turnTimer);
  room.deadline = Date.now() + room.remaining;
  const gid = k.game.id;
  room._turnTimer = setTimeout(() => {
    try {
      if (stale(k, gid) || room.status !== 'live' || room.checking || room.popup || room.current == null) return;
      if (!isConnected(k, room.current)) {
        // 차례 중에 연결이 끊긴 쪽은 탈락시키지 않고 다음으로
        console.log(`[연결 끊김] ${k.name} ${room.id}번 방 ${unit(k, room.current)} 차례 건너뜀`);
        advance(k, room);
      } else {
        console.log(`[시간초과] ${k.name} ${room.id}번 방 ${room.lap}바퀴 ${unit(k, room.current)} 라운드 탈락`);
        endRoomRound(k, room, room.current); // 시간 초과 = 라운드 탈락
      }
      broadcast(k);
    } catch (e) { console.error('[오류] 차례 시간', e); }
  }, room.remaining);
}
function pauseTimer(room) {
  clearTimeout(room._turnTimer); room._turnTimer = null;
  room.remaining = Math.max(0, room.deadline - Date.now());
  room.checking = true;
}
function resumeTimer(k, room) {
  room.checking = false;
  room.remaining = Math.max(R(k).minResume, room.remaining); // 다시 쓸 시간 최소한은 보장
  runTimer(k, room);
}
function endRoomRound(k, room, loser) {
  clearRoomTimers(room);
  room.current = null; room.typing = ''; room.checking = false; room.popup = null; room.waiting = false;
  room.lastLoser = loser;
  if (loser != null) {
    const st = k.game.stats[loser];
    st.losses++;
    if (st.losses >= CONFIG.LOSS_LIMIT) st.defeated = true;
  }
  room.status = aliveOf(k, room).length <= 1 ? 'finished' : 'done';
  checkAllDone(k);
}
function checkAllDone(k) {
  const g = k.game;
  if (g.phase !== 'playing') return;
  if (g.rooms.some(r => r.status === 'live')) return;
  if (g.round >= CONFIG.TOTAL_ROUNDS || g.rooms.every(r => r.status === 'finished')) endGame(k, '');
  else g.phase = 'roundEnd';
}
function endGame(k, reason) {
  clearAllTimers(k);
  k.game.rooms.forEach(r => {
    if (r.status === 'live') r.status = 'done';
    r.current = null; r.typing = ''; r.checking = false; r.popup = null; r.waiting = false;
  });
  k.game.phase = 'gameOver';
  k.game.endReason = reason || '';
}

// 반에 들어와 있는 소켓들
function socketsOf(k) { return [...io.sockets.values()].filter(s => s.data.kid === k.id); }
// 소켓을 반에서 빼냄 (반 전체·교사·게임 방 채널에서 모두 나감)
function detach(socket) {
  for (const r of [...socket.rooms]) if (r.startsWith('k:')) socket.leave(r);
  socket.data.key = null; socket.data.kid = null; socket.data.role = null; socket.data.num = null;
}
// 학생 명단 비우기 (게임 종류를 바꿀 때)
function clearMembers(k) {
  for (const s of k.members.values()) clearTimeout(s.dropTimer);
  k.members.clear();
}
function closeClass(k, reason) {
  if (k.deleted) return;
  k.deleted = true;
  clearAllTimers(k);
  clearMembers(k);
  io.to(CH(k)).emit('classClosed', reason);
  socketsOf(k).forEach(detach);
  classes.delete(k.key);
  sendClassList();
  console.log(`[반 닫힘] ${k.name} · ${reason} (남은 반 ${classes.size}개)`);
}
// 아무도 접속하지 않은 채 오래된 반 정리 (5분마다 확인)
setInterval(() => {
  const now = Date.now();
  for (const k of [...classes.values()]) {
    const room = io.adapter.rooms.get(CH(k));
    if ((!room || room.size === 0) && now - k.lastActive > CONFIG.CLASS_IDLE_MS) closeClass(k, '오래 사용하지 않아 반이 자동으로 닫혔어요.');
  }
}, 5 * 60 * 1000).unref();

// ===== 소켓 이벤트 =====
io.on('connection', (socket) => {
  // 처리 중 오류가 나도 서버가 꺼지지 않게 감싸기
  const on = (ev, fn) => socket.on(ev, (...args) => {
    try {
      const p = fn(...args);
      if (p && typeof p.catch === 'function') p.catch(e => console.error(`[오류] ${ev}`, e));
    } catch (e) { console.error(`[오류] ${ev}`, e); }
  });
  const cbOf = cb => (typeof cb === 'function' ? cb : () => {});
  // 지금 들어와 있는 반 (닫혔거나 같은 이름으로 새로 만든 반이면 null)
  const K = () => {
    const k = socket.data.key ? classes.get(socket.data.key) : null;
    if (!k || k.id !== socket.data.kid) return null;
    k.lastActive = Date.now();
    return k;
  };
  // 교사로 들어와 있는 반
  const T = () => { const k = K(); return k && socket.data.role === 'teacher' ? k : null; };
  // 비밀번호를 연달아 틀리면 잠깐 막기 (1분에 8번까지)
  const tooMany = () => {
    const now = Date.now();
    if (!socket.data.failAt || now - socket.data.failAt > 60000) { socket.data.failAt = now; socket.data.fails = 0; }
    return socket.data.fails >= 8;
  };
  const failed = () => { socket.data.fails = (socket.data.fails || 0) + 1; };
  // 대기실에 있던 학생이 반을 나가면 명단에서 바로 지움
  const leaveCurrent = () => {
    const k = K();
    if (k && socket.data.role === 'student' && socket.data.num) {
      const s = k.members.get(socket.data.num);
      if (s && s.socketId === socket.id) {
        if (k.game.phase === 'lobby') { clearTimeout(s.dropTimer); k.members.delete(s.num); }
        else { s.connected = false; s.socketId = null; }
      }
      detach(socket);
      broadcast(k);
    } else detach(socket);
  };

  socket.emit('serverInfo', serverInfo());

  // ---------- 학생 ----------
  // 반 찾기 화면을 보는 동안 반 목록을 받아요
  on('browse', (cb) => {
    socket.join('browse');
    cbOf(cb)(classNames());
  });

  on('joinClass', (data, cb) => {
    cb = cbOf(cb);
    const k = classes.get(keyOf(data && data.name));
    if (!k) return cb({ ok: false, noClass: true, msg: '그런 반이 없어요. 선생님이 반을 열었는지 확인해 주세요.' });
    if (socket.data.kid !== k.id) {
      if (tooMany()) return cb({ ok: false, msg: '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.' });
      if (String((data && data.pw) || '').trim() !== k.spw) { failed(); return cb({ ok: false, badPw: true, msg: '학급 비밀번호가 맞지 않아요.' }); }
      leaveCurrent(); socket.data.key = k.key; socket.data.kid = k.id; socket.join(CH(k));
    }
    socket.leave('browse');
    k.lastActive = Date.now();
    cb({ ok: true, name: k.name });
    socket.emit('state', snapshot(k));
  });

  on('leaveClass', () => leaveCurrent());

  on('studentLogin', (data, cb) => {
    cb = cbOf(cb);
    const k = K();
    if (!k) return cb({ ok: false, needClass: true, msg: '반에 먼저 들어와 주세요.' });
    if (socket.data.role === 'teacher') return cb({ ok: false, msg: '교사 화면에서는 입장할 수 없어요.' });
    const num = parseInt(data && data.num, 10);
    const token = String((data && data.token) || '').slice(0, 64);
    const max = R(k).maxNum;
    if (!Number.isInteger(num) || num < 1 || num > max) {
      return cb({ ok: false, msg: k.type === 'team' ? `1~${max} 사이의 모둠 번호를 입력해주세요.` : `1~${max} 사이의 번호를 입력해주세요.` });
    }
    let s = k.members.get(num);
    if (s && s.connected && s.token !== token) {
      return cb({ ok: false, msg: k.type === 'team' ? '이미 접속 중인 모둠이에요. 우리 모둠 번호가 맞는지 확인해주세요.' : '이미 접속 중인 번호예요. 내 번호가 맞는지 확인해주세요.' });
    }
    // 게임 중에 처음 들어온 번호는 명단에만 올리고 다음 게임부터 참여
    if (!s) { s = { num }; k.members.set(num, s); }
    // 같은 기기에서 다른 번호로 바꿔 들어오면 예전 번호는 정리
    if (socket.data.role === 'student' && socket.data.num && socket.data.num !== num) {
      const old = k.members.get(socket.data.num);
      if (old && old.socketId === socket.id) {
        if (k.game.phase === 'lobby') { clearTimeout(old.dropTimer); k.members.delete(old.num); }
        else { old.connected = false; old.socketId = null; }
      }
      for (const r of [...socket.rooms]) if (r.startsWith(CH(k) + ':r')) socket.leave(r);
    }
    clearTimeout(s.dropTimer); s.dropTimer = null;
    const oldId = s.connected ? s.socketId : null;
    s.token = token; s.socketId = socket.id; s.connected = true;
    socket.data.role = 'student'; socket.data.num = num;
    if (oldId && oldId !== socket.id) {
      const old = io.sockets.get(oldId);
      if (old) old.disconnect(true);
    }
    const room = roomOf(k, num);
    if (room) {
      socket.join(RCH(k, room.id));
      // 방 전체가 끊겨 멈춰 있었다면 다시 진행
      if (k.game.phase === 'playing' && room.status === 'live' && room.waiting) advance(k, room);
    }
    cb({ ok: true, num });
    broadcast(k);
  });

  on('studentLogout', () => {
    const k = K();
    const num = socket.data.num;
    if (!k || socket.data.role !== 'student' || !num || k.game.phase !== 'lobby') return;
    const s = k.members.get(num);
    if (s && s.socketId === socket.id) { clearTimeout(s.dropTimer); k.members.delete(num); }
    socket.data.role = null; socket.data.num = null;
    broadcast(k);
  });

  on('typing', (text) => {
    const k = K();
    if (!k || socket.data.role !== 'student') return;
    const num = socket.data.num;
    const room = roomOf(k, num);
    if (!room || k.game.phase !== 'playing' || room.status !== 'live' || room.current !== num || room.checking || room.popup) return;
    room.typing = String(text || '').slice(0, 20);
    // 같은 방 친구들과 선생님에게만 보냄
    io.to(RCH(k, room.id)).to(TCH(k)).emit('typing', { room: room.id, text: room.typing });
  });

  on('submitWord', async (raw, cb) => {
    cb = cbOf(cb);
    const k = K();
    if (!k || socket.data.role !== 'student') return cb({ ok: false, msg: '' });
    const num = socket.data.num;
    const room = roomOf(k, num);
    const word = String(raw || '').replace(/\s/g, '').slice(0, 20);
    const g = k.game;
    if (!room || g.phase !== 'playing' || room.status !== 'live' || room.current !== num || room.checking || room.popup) {
      return cb({ ok: false, msg: '' });
    }
    const wt = k.wordType, wl = WORD_TYPES[wt].label;
    const tag = `[제출] ${k.name} ${room.id}번 방 ${room.lap}바퀴 ${unit(k, num)} "${word}" (${wl})`;
    const err = localCheck(word, g.chosung);
    if (err) { console.log(`${tag} → ${err}`); return cb({ ok: false, msg: err }); }
    if (room.used.includes(word)) { console.log(`${tag} → 이미 제출된 단어`); return cb({ ok: false, msg: '이미 제출된 정답입니다.' }); }

    pauseTimer(room); // 사전 확인하는 동안 시간 멈춤
    broadcast(k);
    const gid = g.id, round = g.round;
    const t0 = Date.now();
    const r = await checkWord(word, wt);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${tag} → ${r.status === 'ok' ? '정답' : r.status === 'notfound' ? (r.reason === 'mismatch' ? `${wl} 아님` : '사전에 없음') : '사전 연결 실패'} (${r.cached ? '기억해 둔 결과' : (r.source || '-')}, ${sec}초)`);
    if (stale(k, gid) || k.game.round !== round || room.status !== 'live' || room.current !== num) {
      return cb({ ok: false, msg: '' });
    }

    if (r.status === 'down' || r.status === 'notfound') {
      // 사전 연결 실패: 게임을 끝내지 않고, 멈춘 시간 그대로 다시 제출하게 함
      let msg;
      if (r.status === 'down') { k.dictFails++; msg = '사전 연결이 잠깐 느려요. 같은 단어를 다시 제출해 주세요.'; }
      else if (r.reason === 'mismatch') msg = `'${word}'은(는) ${wl}가 아니에요. ${wl} 단어를 써보세요!`;
      else msg = '사전에 없는 단어예요. 다시 써보세요!';
      cb({ ok: false, msg });
      if (!isConnected(k, num)) advance(k, room); else resumeTimer(k, room);
      return broadcast(k);
    }
    // 정답!
    room.used.push(word);
    room.words.push({ word, num });
    g.stats[num].correct++;
    room.typing = '';
    room.popup = { word, def: r.def, num };
    cb({ ok: true });
    broadcast(k);
    room._popupTimer = setTimeout(() => {
      try {
        if (stale(k, gid) || room.status !== 'live') return;
        advance(k, room);
        broadcast(k);
      } catch (e) { console.error('[오류] 팝업', e); }
    }, R(k).popupMs);
  });

  // ---------- 교사: 공통 접속 비밀번호 / 반 만들기 / 들어가기 ----------
  // 틀리면 사유를 돌려주고, 맞으면 '' (교사 화면에 들어올 때·반을 만들거나 들어갈 때마다 확인)
  const gateErr = (gate) => {
    if (!TEACHER_PASSWORD) return '서버에 교사 접속 비밀번호가 설정되지 않았어요. Render 환경변수 TEACHER_PASSWORD를 넣어 주세요.';
    if (tooMany()) return '너무 많이 시도했어요. 1분 뒤에 다시 해 주세요.';
    if (String(gate || '').trim() !== TEACHER_PASSWORD) { failed(); return '접속 비밀번호가 맞지 않아요.'; }
    return '';
  };
  on('teacherGate', (data, cb) => {
    cb = cbOf(cb);
    const err = gateErr(data && data.gate);
    cb(err ? { ok: false, msg: err } : { ok: true });
  });

  on('createClass', (data, cb) => {
    cb = cbOf(cb);
    const gErr = gateErr(data && data.gate);
    if (gErr) return cb({ ok: false, gate: true, msg: gErr });
    const name = cleanName(data && data.name);
    const pw = String((data && data.pw) || '');
    const spw = String((data && data.spw) || '').trim();
    if (!NAME_RE.test(name)) return cb({ ok: false, msg: '반 이름은 띄어쓰기 없이 한글·영문·숫자 2~12자로 써 주세요. (예: 천곡64)' });
    if (pw.length < 4 || pw.length > 20) return cb({ ok: false, msg: '학급 관리 비밀번호(교사용)는 4~20자로 정해 주세요.' });
    if (!SPW_RE.test(spw)) return cb({ ok: false, msg: '학급 비밀번호는 띄어쓰기 없이 2~20자로 정해 주세요. (예: 숫자 4자리)' });
    if (classes.has(keyOf(name))) return cb({ ok: false, msg: '이미 열려 있는 반 이름이에요. 우리 반이면 「우리 반 들어가기」로 들어가고, 아니면 다른 이름을 써 주세요.' });
    if (classes.size >= CONFIG.MAX_CLASSES) return cb({ ok: false, msg: '지금 열린 반이 너무 많아요. 잠시 뒤에 다시 해 주세요.' });
    const k = createClass(name, pw, spw);
    cb({ ok: true, name: k.name, token: addToken(k) });
  });

  on('teacherLogin', (data, cb) => {
    cb = cbOf(cb);
    const gErr = gateErr(data && data.gate);
    if (gErr) return cb({ ok: false, gate: true, msg: gErr });
    const k = classes.get(keyOf(data && data.name));
    if (!k) return cb({ ok: false, msg: '그런 반이 없어요. 서버가 다시 켜지면 반이 사라질 수 있어요. 「새 반 만들기」로 다시 만들어 주세요.' });
    if (!samePw(String((data && data.pw) || ''), k)) { failed(); return cb({ ok: false, msg: '학급 관리 비밀번호가 맞지 않아요.' }); }
    cb({ ok: true, name: k.name, token: addToken(k) });
  });

  on('teacherJoin', (data, cb) => {
    cb = cbOf(cb);
    const k = classes.get(keyOf(data && data.name));
    const token = String((data && data.token) || '');
    if (!k || !k.tokens.has(token)) return cb({ ok: false, msg: k ? '다시 로그인해 주세요.' : '반이 닫혔거나 서버가 다시 켜져서 반이 없어요. 반을 다시 만들어 주세요.' });
    if (socket.data.kid !== k.id || socket.data.role !== 'teacher') {
      leaveCurrent();
      socket.data.key = k.key; socket.data.kid = k.id; socket.data.role = 'teacher';
      socket.join(CH(k)); socket.join(TCH(k));
    }
    k.lastActive = Date.now();
    cb({ ok: true, name: k.name });
    socket.emit('teacherInfo', teacherInfo(k));
    socket.emit('state', snapshot(k));
  });

  on('teacherLogout', (data) => {
    const k = T();
    if (k && data && data.token) k.tokens.delete(String(data.token));
    leaveCurrent();
  });

  on('closeClass', (cb) => {
    cb = cbOf(cb);
    const k = T();
    if (!k) return cb({ ok: false });
    closeClass(k, '선생님이 반을 닫았어요.');
    cb({ ok: true });
  });

  // ---------- 교사: 게임 설정 ----------
  on('saveChosung', (list) => {
    const k = T();
    if (!k || k.game.phase !== 'lobby' || !Array.isArray(list)) return;
    k.chosungList = list.slice(0, CONFIG.TOTAL_ROUNDS).map(normalizeChosung).map(s => s.slice(0, 8));
    while (k.chosungList.length < CONFIG.TOTAL_ROUNDS) k.chosungList.push('');
    socket.to(TCH(k)).emit('teacherInfo', teacherInfo(k));
  });

  // 개인전 ↔ 모둠 대항전 (대기실에서만). 번호 체계가 달라서 학생들은 다시 입장해야 함
  on('setType', (type) => {
    const k = T();
    if (!k || k.game.phase !== 'lobby' || !RULES[type] || type === k.type) return;
    k.type = type;
    clearMembers(k);
    k.game = freshGame(k);
    for (const s of socketsOf(k)) {
      if (s.data.role !== 'student') continue;
      s.data.role = null; s.data.num = null;
      s.emit('relogin', `선생님이 「${RULES[type].label}」으로 바꿨어요. 다시 입장해 주세요.`);
    }
    io.to(TCH(k)).emit('teacherInfo', teacherInfo(k));
    broadcast(k);
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

  on('setWordType', (wt) => {
    const k = T();
    if (!k || k.game.phase !== 'lobby' || !WORD_TYPES[wt]) return;
    k.wordType = wt;
    broadcast(k);
  });

  on('startGame', (list, cb) => {
    cb = cbOf(cb);
    const k = T();
    if (!k) return cb({ ok: false, msg: '반에 다시 들어와 주세요.' });
    if (k.game.phase !== 'lobby') return cb({ ok: false, msg: '이미 게임이 진행 중이에요.' });
    const norm = (Array.isArray(list) ? list : []).slice(0, CONFIG.TOTAL_ROUNDS).map(normalizeChosung);
    if (norm.length < CONFIG.TOTAL_ROUNDS || !norm.every(isValidChosung)) {
      return cb({ ok: false, msg: `초성 ${CONFIG.TOTAL_ROUNDS}개를 모두 자음으로만 입력해주세요.` });
    }
    if (k.wordType === 'all' ? !dictList().length : !STDICT_KEY) {
      return cb({ ok: false, msg: k.wordType === 'all'
        ? '사전 키가 설정되지 않았어요. Render 환경변수 STDICT_KEY를 확인해주세요.'
        : `${WORD_TYPES[k.wordType].label} 판정은 표준국어대사전 키가 필요해요. Render 환경변수 STDICT_KEY를 확인해주세요.` });
    }
    // 시작 순간 잠깐 끊겨 있던 학생도 넣음 (다시 연결되면 바로 참여)
    const nums = lobbyNums(k);
    const who = k.type === 'team' ? '모둠이 2개' : '학생이 2명';
    if (nums.length < 2) return cb({ ok: false, msg: `${who} 이상 접속해야 시작할 수 있어요.` });

    k.chosungList = norm;
    k.dictFails = 0;
    const g = k.game;
    shuffle(nums);
    const roomCount = Math.max(1, Math.min(R(k).roomCount, Math.floor(nums.length / 2)));
    const base = Math.floor(nums.length / roomCount), extra = nums.length % roomCount;
    let idx = 0;
    g.rooms = []; g.stats = {};
    for (let i = 0; i < roomCount; i++) {
      const size = base + (i < extra ? 1 : 0);
      const members = nums.slice(idx, idx + size).sort((a, b) => a - b);
      idx += size;
      g.rooms.push(newRoom(i + 1, members));
      members.forEach(n => {
        g.stats[n] = { room: i + 1, losses: 0, correct: 0, defeated: false };
        const s = k.members.get(n);
        clearTimeout(s.dropTimer); s.dropTimer = null; // 게임에 들어간 학생은 명단에서 지우지 않음
        const sk = s.socketId && io.sockets.get(s.socketId);
        if (sk) sk.join(RCH(k, i + 1));
      });
    }
    g.phase = 'assigning';
    g.countdown = CONFIG.COUNTDOWN;
    cb({ ok: true });
    broadcast(k);
    const gid = g.id;
    k.countdownTimer = setInterval(() => {
      try {
        if (stale(k, gid)) { clearInterval(k.countdownTimer); k.countdownTimer = null; return; }
        g.countdown--;
        if (g.countdown <= 0) {
          clearInterval(k.countdownTimer); k.countdownTimer = null;
          startRound(k, 1);
        }
        broadcast(k);
      } catch (e) { console.error('[오류] 카운트다운', e); }
    }, 1000);
  });

  on('nextRound', () => {
    const k = T();
    if (!k || k.game.phase !== 'roundEnd') return;
    startRound(k, k.game.round + 1);
    broadcast(k);
  });

  on('forceEnd', () => {
    const k = T();
    if (!k || k.game.phase === 'lobby' || k.game.phase === 'gameOver') return;
    endGame(k, '선생님이 게임을 끝냈어요.');
    broadcast(k);
  });

  on('resetGame', () => {
    const k = T();
    if (!k) return;
    clearAllTimers(k);
    io.in(CH(k)).socketsLeave(k.game.rooms.map(r => RCH(k, r.id)));
    k.game = freshGame(k);
    for (const [num, s] of k.members) if (!s.connected) { clearTimeout(s.dropTimer); k.members.delete(num); }
    io.to(TCH(k)).emit('teacherInfo', teacherInfo(k));
    broadcast(k);
  });

  on('testDict', async (cb) => {
    cb = cbOf(cb);
    if (!T()) return cb(['반에 다시 들어와 주세요.']);
    const out = [];
    if (!STDICT_KEY) out.push('표준국어대사전(메인): 키가 설정되지 않았어요 (STDICT_KEY)');
    if (!OPENDICT_KEY) out.push('우리말샘(비상용): 키가 설정되지 않았어요 (OPENDICT_KEY) — 없어도 게임은 돼요');
    for (const d of dictList()) {
      try {
        const t0 = Date.now();
        const r = await queryDict(d.base, d.key, '학교', '');
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        out.push(r.status === 'ok'
          ? `✅ ${d.name}: 연결 성공! ${sec}초 ("학교" → ${r.def.slice(0, 30)}…)`
          : `❌ ${d.name}: 연결은 됐지만 "학교"를 찾지 못했어요. 키를 다시 확인해주세요.`);
      } catch (e) { out.push(`❌ ${d.name}: 연결 실패 (${e.message})`); }
    }
    if (STDICT_KEY) {
      // [단어, 범위, 정답이어야 하는지]
      const cases = [['하늘', 'native', true], ['학교', 'chinese', true], ['학교', 'native', false], ['하늘', 'chinese', false]];
      for (const [w, wt, expect] of cases) {
        try {
          const r = await queryDict(STDICT_BASE, STDICT_KEY, w, WORD_TYPES[wt].type2);
          const ok = (r.status === 'ok') === expect;
          out.push(`${ok ? '✅' : '❌'} ${WORD_TYPES[wt].label} 판정: "${w}" → ${r.status === 'ok' ? '정답 인정' : '정답 아님'}`);
        } catch (e) { out.push(`❌ ${WORD_TYPES[wt].label} 판정: "${w}" → 연결 실패 (${e.message})`); }
      }
    }
    cb(out);
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
    const err = adminOk(data && data.pw);
    if (err) return cb({ ok: false, msg: err });
    const now = Date.now();
    const list = [...classes.values()].map(k => {
      const ss = socketsOf(k);
      return {
        name: k.name, type: R(k).label, word: WORD_TYPES[k.wordType].label, phase: k.game.phase,
        students: [...k.members.values()].filter(s => s.connected).length,
        teachers: ss.filter(s => s.data.role === 'teacher').length,
        idleMin: Math.floor((now - k.lastActive) / 60000), ageMin: Math.floor((now - k.createdAt) / 60000),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    cb({ ok: true, list, max: CONFIG.MAX_CLASSES });
  });
  on('adminClose', (data, cb) => {
    cb = cbOf(cb);
    const err = adminOk(data && data.pw);
    if (err) return cb({ ok: false, msg: err });
    const k = classes.get(keyOf(data && data.name));
    if (!k) return cb({ ok: false, msg: '이미 닫힌 반이에요.' });
    closeClass(k, '관리자가 반을 닫았어요.');
    cb({ ok: true });
  });

  // ---------- 접속 끊김 ----------
  on('disconnect', () => {
    const k = socket.data.key ? classes.get(socket.data.key) : null;
    if (!k || k.id !== socket.data.kid || socket.data.role !== 'student') return;
    const num = socket.data.num;
    const s = k.members.get(num);
    if (!s || s.socketId !== socket.id) return;
    s.connected = false; s.socketId = null;
    if (k.game.phase === 'lobby') {
      // 바로 지우지 않고 60초 기다림 (와이파이가 잠깐 끊긴 학생이 명단에서 사라지지 않게)
      clearTimeout(s.dropTimer);
      s.dropTimer = setTimeout(() => {
        const cur = k.members.get(num);
        if (!k.deleted && cur === s && !s.connected && k.game.phase === 'lobby') { k.members.delete(num); broadcast(k); }
      }, CONFIG.LOBBY_GRACE_MS);
    }
    // 자기 차례에 끊겨도 바로 넘기지 않음: 제한시간 안에 다시 연결되면 이어서 답할 수 있고,
    // 끝까지 안 돌아오면 시간이 다 됐을 때 탈락 없이 다음으로 넘어감
    broadcast(k);
  });
});

  return { classes };
};
