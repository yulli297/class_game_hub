// 학생 화면·교사 화면이 같이 쓰는 도구
(function () {
  window.$ = id => document.getElementById(id);
  window.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.squash = s => String(s || '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
  window.showView = id => document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === id));
  window.toast = (msg, ms) => {
    const el = $('toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), ms || 3200);
  };
  // 남은 초 (서버 시계 기준). turnEnd가 없으면 null
  window.secLeft = (turnEnd, offset) => (turnEnd ? Math.max(0, Math.ceil((turnEnd - (Date.now() + offset)) / 1000)) : null);
  // 원형 타이머 그리기: el 안에 <svg>를 한 번만 만들고 비율만 바꿈
  window.ring = (el, sec, total) => {
    if (!el._r) {
      el.innerHTML = '<svg viewBox="0 0 44 44"><circle class="ring-bg" cx="22" cy="22" r="19"/><circle class="ring-fg" cx="22" cy="22" r="19"/></svg><span class="ring-num"></span>';
      el._r = el.querySelector('.ring-fg'); el._n = el.querySelector('.ring-num');
    }
    const C = 2 * Math.PI * 19;
    const ratio = sec == null ? 1 : Math.max(0, Math.min(1, sec / Math.max(1, total)));
    el._r.style.strokeDasharray = C;
    el._r.style.strokeDashoffset = C * (1 - ratio);
    el._n.textContent = sec == null ? '–' : sec;
    el.classList.toggle('urgent', sec != null && sec <= 5);
  };
  // 그림 아이콘: <i class="ic" data-ic="book"></i> 처럼 쓰면 자동으로 채워져요
  const B = '#2563d9';
  window.ICONS = {
    book: `<svg viewBox="0 0 48 40"><path d="M24 8C18 3 9 3 3 5v29c6-2 15-2 21 3 6-5 15-5 21-3V5c-6-2-15-2-21 3z" fill="#e8f0ff" stroke="${B}" stroke-width="3" stroke-linejoin="round"/><path d="M24 8v29" stroke="${B}" stroke-width="3"/><path d="M9 13h9M9 19h9M9 25h9M30 13h9M30 19h9M30 25h9" stroke="#7aa5ec" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    glass: `<svg viewBox="0 0 64 90"><rect x="6" y="3" width="52" height="10" rx="5" fill="${B}"/><rect x="6" y="77" width="52" height="10" rx="5" fill="${B}"/><path d="M13 13c0 18 17 22 17 32S13 59 13 77h38c0-18-17-22-17-32s17-14 17-32z" fill="#eef4ff" stroke="${B}" stroke-width="3" stroke-linejoin="round"/><path d="M21 27h22c-3 7-11 10-11 15 0-5-8-8-11-15z" fill="#f6c453"/><path d="M19 75c2-9 13-11 13-18 0 7 11 9 13 18z" fill="#f6c453"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 11.2 20.6 3.4c.8-.3 1.5.4 1.2 1.2l-7.8 18.1c-.3.8-1.5.8-1.8-.1l-2.1-6.6-6.6-2.1c-.9-.3-.9-1.5-.1-1.8zM10.4 14l1.5 4.6L18.3 5.7 5.4 12.1z"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/></svg>`,
    users: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="3.4"/><circle cx="5" cy="9.5" r="2.5"/><circle cx="19" cy="9.5" r="2.5"/><path d="M5.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6zM0 18.5c0-2.7 2-4.5 4.6-4.5 1 0 1.8.2 2.5.6-1.4 1.1-2.4 2.6-2.7 3.9zM24 18.5c0-2.7-2-4.5-4.6-4.5-1 0-1.8.2-2.5.6 1.4 1.1 2.4 2.6 2.7 3.9z"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>`,
    file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M6 2.5h8l5 5v14H6z"/><path d="M14 2.5v5h5M9 12h7M9 15.5h7M9 19h5" stroke-linecap="round"/></svg>`,
    down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M6.5 10 12 15.5 17.5 10M4 20h16"/></svg>`,
  };
  window.fillIcons = (root) => (root || document).querySelectorAll('[data-ic]').forEach(el => { if (!el._ic) { el.innerHTML = ICONS[el.dataset.ic] || ''; el._ic = 1; } });
  document.addEventListener('DOMContentLoaded', () => fillIcons());
  // 종이 조각 (완성 축하)
  window.confetti = (box) => {
    const colors = ['#ffd84d', '#ff8a8a', '#7aa5ec', '#8bd3a8', '#c79bf2'];
    box.innerHTML = Array.from({ length: 14 }, (_, i) =>
      `<i style="left:${4 + Math.random() * 92}%;top:${3 + Math.random() * 30}%;background:${colors[i % 5]};transform:rotate(${Math.random() * 120 - 60}deg);animation-delay:${Math.random() * .5}s"></i>`).join('');
  };
  // 문장 속 특수 단어에 형광펜 (띄어쓰기가 달라도 찾아요)
  window.markWord = (text, word) => {
    if (!word) return esc(text);
    const chars = [...text], target = squash(word);
    for (let s = 0; s < chars.length; s++) {
      if (/\s/.test(chars[s])) continue;
      let acc = '', e = s;
      for (; e < chars.length && acc.length < target.length; e++) if (!/\s/.test(chars[e])) acc += chars[e].toLowerCase();
      if (acc === target) {
        return esc(chars.slice(0, s).join('')) + '<mark>' + esc(chars.slice(s, e).join('')) + '</mark>' + esc(chars.slice(e).join(''));
      }
    }
    return esc(text);
  };
})();
