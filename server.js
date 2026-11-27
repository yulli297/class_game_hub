// =============================================================
//  수업 게임 모음 서버 (class-game-hub)
//  · 서버 하나에 여러 게임을 주소로 나누어 열어요.
//      주소/          → 게임 고르는 첫 화면
//      주소/card/     → 수학 카드 대전 (6학년 수학)   교사: 주소/card/teacher
//      주소/chosung/  → 초성 퀴즈 (개인전 + 모둠 대항전)        교사: 주소/chosung/teacher
//      주소/catchmind/ → 스케치북 캐치마인드 (그림 퀴즈)          교사: 주소/catchmind/teacher
//  · 게임마다 실시간 연결 통로(Socket.io 네임스페이스)를 따로 써서 서로 섞이지 않아요.
//  · 비밀번호는 Render 환경변수로 넣어요 (두 게임이 같이 씀): TEACHER_PASSWORD, ADMIN_PASSWORD
//    초성 퀴즈 사전 키: STDICT_KEY (표준국어대사전), OPENDICT_KEY (우리말샘, 비상용)
//  실행: npm install → npm start  (기본 주소 http://localhost:3000)
// =============================================================
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const app = express();
app.set('trust proxy', true);   // Render 앞단을 거쳐도 https 주소를 제대로 알아내기 위해
const server = http.createServer(app);
// 접속 끊김 판정: 10초마다 확인, 15초 동안 응답 없으면 끊긴 것으로 봄
const io = new Server(server, { pingInterval: 10000, pingTimeout: 15000 });

// 오류 하나 때문에 서버 전체가 꺼지지 않게 (꺼지면 모든 게임의 반이 사라짐)
process.on('uncaughtException', e => console.error('[오류]', e));
process.on('unhandledRejection', e => console.error('[오류]', e));

const GAMES = [
  { base: '/card', dir: 'card' },
  { base: '/chosung', dir: 'chosung' },
  { base: '/catchmind', dir: 'catchmind' },
];

// 예전 카드게임 주소 이어 주기 (전에는 카드게임이 주소 맨 앞에 있었음 → 인쇄한 QR도 계속 쓸 수 있게)
app.use((req, res, next) => {
  if (req.path === '/' && req.query.c) return res.redirect('/card/' + req.url.slice(1));
  if (req.path === '/teacher' || req.path === '/teacher.html') return res.redirect('/card/teacher');
  // 게임 주소 끝에 / 붙이기 (화면 안의 그림·파일 경로가 맞게)
  const g = GAMES.find(x => req.path === x.base);
  if (g) return res.redirect(g.base + '/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
  next();
});

for (const g of GAMES) {
  const router = express.Router();
  require(`./${g.dir}/app`)(router, io.of(g.base));
  app.use(g.base, router);
}
app.get('/health', (req, res) => res.send('ok'));
app.get('/favicon.ico', (req, res) => res.redirect('/card/img/icon-192.png'));   // 주소창 아이콘
app.use(express.static(path.join(__dirname, 'public')));   // 첫 화면

if (require.main === module) {
  server.listen(PORT, () => console.log(`수업 게임 모음 서버 실행 중: http://localhost:${PORT}  (카드게임 /card, 초성 퀴즈 /chosung, 캐치마인드 /catchmind)`));
}
module.exports = { app, server, io };
