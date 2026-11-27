// 스케치북 그림 그리기·받기 (학생 화면, 교사 화면 공용)
// 좌표는 0~1로 주고받아서 기기마다 화면 크기가 달라도 같은 그림이 나와요.
(function () {
  function Sketch(canvas, socket, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const self = {
      strokes: [], color: '#222222', width: 9, isEraser: false,
      canDraw: opts.canDraw || (() => false),
    };
    let drawing = false, curId = null;

    function lineWidth(st) { return (st.isEraser ? st.width * 2 : st.width) * (canvas.width / 800); }
    function seg(st, a, b) {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = st.isEraser ? '#FFFFFF' : st.color;
      ctx.lineWidth = lineWidth(st);
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width + (a === b ? 0.1 : 0), b.y * canvas.height + (a === b ? 0.1 : 0));
      ctx.stroke();
      ctx.restore();
    }
    function drawStroke(st) {
      const p = st.points;
      if (!p || !p.length) return;
      if (p.length === 1) return seg(st, p[0], p[0]);
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = st.isEraser ? '#FFFFFF' : st.color;
      ctx.lineWidth = lineWidth(st);
      ctx.beginPath();
      ctx.moveTo(p[0].x * canvas.width, p[0].y * canvas.height);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x * canvas.width, p[i].y * canvas.height);
      ctx.stroke();
      ctx.restore();
    }
    function redraw() {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      self.strokes.forEach(drawStroke);
    }
    self.redraw = redraw;
    self.clear = () => { self.strokes = []; drawing = false; curId = null; redraw(); };
    self.snapshot = () => canvas.toDataURL('image/png');

    // 서버에서 받은 그림
    socket.on('draw_start', st => { self.strokes.push(st); drawStroke(st); });
    socket.on('draw_move', ({ id, point }) => {
      const st = self.strokes.find(s => s.id === id);
      if (!st) return;
      const prev = st.points[st.points.length - 1];
      st.points.push(point);
      seg(st, prev, point);
    });
    socket.on('canvas_sync', list => { self.strokes = Array.isArray(list) ? list : []; redraw(); });
    socket.on('canvas_clear', () => self.clear());

    // 내가 화가일 때 그리기
    function pt(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      };
    }
    canvas.addEventListener('pointerdown', e => {
      if (!self.canDraw()) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      drawing = true;
      curId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const p = pt(e);
      const st = { id: curId, color: self.color, width: self.width, isEraser: self.isEraser, points: [p] };
      self.strokes.push(st);
      drawStroke(st);
      socket.emit('draw_start', { id: curId, color: st.color, width: st.width, isEraser: st.isEraser, point: p });
    });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      if (!self.canDraw()) { drawing = false; return; }
      const st = self.strokes.find(s => s.id === curId);
      if (!st) return;
      const p = pt(e), prev = st.points[st.points.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 0.002) return; // 너무 작은 움직임은 생략 (와이파이 부담 줄이기)
      st.points.push(p);
      seg(st, prev, p);
      socket.emit('draw_move', { id: curId, point: p });
    });
    const stop = () => { drawing = false; curId = null; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('lostpointercapture', stop);

    redraw();
    return self;
  }
  window.Sketch = Sketch;

  // 공통 도구
  window.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.REASON = { timeout: '시간 종료', all_correct: '전원 정답!', skipped: '라운드 스킵', drawer_left: '화가 연결 끊김' };
  // 라운드 결과 창
  window.showRoundResult = function (info, snap) {
    const $ = id => document.getElementById(id);
    $('rr-reason').textContent = REASON[info.reason] || '라운드 종료';
    $('rr-word').textContent = info.word;
    $('rr-snapshot').src = snap;
    let msg;
    if (info.reason === 'skipped') msg = '스킵한 라운드는 화가 점수가 없어요.';
    else if (info.reason === 'drawer_left') msg = `화가 ${info.drawerName}의 연결이 끊겨서 다음 라운드로 넘어가요.`;
    else if (info.drawerEarned > 0) msg = `정답자 ${info.correctCount}명! 화가 ${info.drawerName} +${info.drawerEarned}점`;
    else msg = `아무도 못 맞혀서 화가 ${info.drawerName}는 0점이에요.`;
    $('rr-drawer-msg').textContent = msg;
    $('rr-top3').innerHTML = (info.top3 || []).map((s, i) => `<span>${i + 1}위 ${esc(s.name)} (${s.score}점)</span>`).join('');
    $('modal-round-result').classList.remove('hidden');
  };
  window.renderPodium = function (students) {
    const $ = id => document.getElementById(id);
    $('podium-box').innerHTML = students.slice(0, 3).map((s, i) =>
      `<div class="podium-item rank-${i + 1}"><div class="podium-rank">${i + 1}등</div><div class="podium-name">${esc(s.name)}</div><div class="podium-score">${s.score}점</div></div>`).join('');
    $('final-rank-list').innerHTML = students.map((s, i) => `<li><span>${i + 1}등 · ${esc(s.name)}</span><strong>${s.score}점</strong></li>`).join('');
  };
  // 남은 시간 표시
  window.Timer = function (badge) {
    let iv = null;
    return function update(rs, offset) {
      clearInterval(iv);
      const tick = () => {
        if (rs.status !== 'playing' || !rs.roundEndTime) { badge.textContent = rs.timeLimit || ''; badge.classList.remove('urgent'); return; }
        const sec = Math.max(0, Math.ceil((rs.roundEndTime - (Date.now() + offset)) / 1000));
        badge.textContent = sec;
        badge.classList.toggle('urgent', sec <= 10 && sec > 0);
      };
      tick();
      if (rs.status === 'playing') iv = setInterval(tick, 250);
    };
  };
})();
