(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const finalScoreEl = document.getElementById('final-score');
  const finalBestEl = document.getElementById('final-best');
  const restartHintEl = document.getElementById('restart-hint');
  const startHintEl = document.getElementById('start-hint');
  const gameoverEl = document.getElementById('gameover');
  const startEl = document.getElementById('start');
  const joystickEl = document.getElementById('joystick');
  const knobEl = document.getElementById('joystick-knob');

  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  startHintEl.textContent = isTouch ? 'Tap to start' : 'Press any key to start';
  restartHintEl.textContent = isTouch ? 'Tap to restart' : 'Press any key to restart';

  // ── Canvas sizing (DPR-aware) ─────────────────────────────────────────────
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();

  // ── State ────────────────────────────────────────────────────────────────
  const STATE = { START: 0, PLAYING: 1, GAMEOVER: 2 };
  let state = STATE.START;

  let player, enemies, particles, elapsed, spawnTimer, score, best, shake, flash;

  best = +(localStorage.getItem('dodgeSurviveBest') || 0);
  bestEl.textContent = 'Best: ' + best;

  function reset() {
    player = { x: W / 2, y: H / 2, r: 12, vx: 0, vy: 0, speed: 290 };
    enemies = [];
    particles = [];
    elapsed = 0;
    spawnTimer = 0.4;
    score = 0;
    shake = 0;
    flash = 0;
    scoreEl.textContent = '0';
  }

  function startGame() {
    reset();
    state = STATE.PLAYING;
    startEl.classList.add('hidden');
    gameoverEl.classList.add('hidden');
  }

  function endGame() {
    state = STATE.GAMEOVER;
    shake = 18;
    flash = 0.5;
    // Player death burst
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 220;
      particles.push({
        x: player.x, y: player.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1.0, max: 1.0,
        r: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#5ee2ff' : '#ffffff',
      });
    }
    if (score > best) {
      best = score;
      localStorage.setItem('dodgeSurviveBest', best);
      bestEl.textContent = 'Best: ' + best;
    }
    finalScoreEl.textContent = score;
    finalBestEl.textContent = best;
    setTimeout(() => gameoverEl.classList.remove('hidden'), 500);
  }

  // ── Input: keyboard ──────────────────────────────────────────────────────
  const keys = Object.create(null);
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (state === STATE.START) { startGame(); return; }
    if (state === STATE.GAMEOVER) {
      // tiny debounce so death key doesn't auto-restart
      if (elapsed > 0.6) startGame();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // ── Input: joystick (mobile) ─────────────────────────────────────────────
  const joy = { active: false, id: null, dx: 0, dy: 0 };
  const JOY_MAX = 50;

  function joyStart(e) {
    if (joy.active) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    joy.active = true;
    joy.id = e.changedTouches ? t.identifier : 'mouse';
    joy.cx = (joystickEl.getBoundingClientRect().left + joystickEl.getBoundingClientRect().right) / 2;
    joy.cy = (joystickEl.getBoundingClientRect().top + joystickEl.getBoundingClientRect().bottom) / 2;
    joyMove(e);
  }
  function joyMove(e) {
    if (!joy.active) return;
    let t;
    if (e.changedTouches) {
      for (const tt of e.changedTouches) if (tt.identifier === joy.id) { t = tt; break; }
      if (!t) return;
    } else { t = e; }
    let dx = t.clientX - joy.cx;
    let dy = t.clientY - joy.cy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_MAX) { dx = (dx / d) * JOY_MAX; dy = (dy / d) * JOY_MAX; }
    joy.dx = dx / JOY_MAX;
    joy.dy = dy / JOY_MAX;
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function joyEnd(e) {
    if (!joy.active) return;
    if (e.changedTouches) {
      let found = false;
      for (const tt of e.changedTouches) if (tt.identifier === joy.id) { found = true; break; }
      if (!found) return;
    }
    joy.active = false;
    joy.id = null;
    joy.dx = 0; joy.dy = 0;
    knobEl.style.transform = 'translate(0px, 0px)';
  }

  joystickEl.addEventListener('touchstart', (e) => { e.preventDefault(); joyStart(e); }, { passive: false });
  joystickEl.addEventListener('touchmove', (e) => { e.preventDefault(); joyMove(e); }, { passive: false });
  joystickEl.addEventListener('touchend', (e) => { e.preventDefault(); joyEnd(e); }, { passive: false });
  joystickEl.addEventListener('touchcancel', (e) => { e.preventDefault(); joyEnd(e); }, { passive: false });

  // Tap-to-start / restart for touch devices
  function tapHandler(e) {
    e.preventDefault();
    if (state === STATE.START) { startGame(); }
    else if (state === STATE.GAMEOVER && elapsed > 0.6) { startGame(); }
  }
  startEl.addEventListener('touchstart', tapHandler, { passive: false });
  startEl.addEventListener('mousedown', tapHandler);
  gameoverEl.addEventListener('touchstart', tapHandler, { passive: false });
  gameoverEl.addEventListener('mousedown', tapHandler);

  // Block page-level scroll/zoom gestures
  document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── Spawning ────────────────────────────────────────────────────────────
  function spawnEnemy() {
    const margin = 30;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * W; y = -margin; }
    else if (side === 1) { x = W + margin; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = H + margin; }
    else { x = -margin; y = Math.random() * H; }
    // Speed scales with elapsed time
    const minSp = 80 + Math.min(elapsed * 1.6, 90);
    const maxSp = 130 + Math.min(elapsed * 2.4, 140);
    const speed = minSp + Math.random() * (maxSp - minSp);
    const r = 11 + Math.random() * 7;
    enemies.push({ x, y, r, speed, hue: 350 + (Math.random() - 0.5) * 30 });
  }

  // ── Update ──────────────────────────────────────────────────────────────
  function update(dt) {
    elapsed += dt;
    score = Math.floor(elapsed);
    scoreEl.textContent = score;

    // Player movement: combine keys + joystick
    let mx = 0, my = 0;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (joy.active) { mx += joy.dx; my += joy.dy; }
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }

    player.vx = mx * player.speed;
    player.vy = my * player.speed;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.x < player.r) player.x = player.r;
    if (player.y < player.r) player.y = player.r;
    if (player.x > W - player.r) player.x = W - player.r;
    if (player.y > H - player.r) player.y = H - player.r;

    // Spawning — interval shrinks with time
    spawnTimer -= dt;
    const interval = Math.max(0.22, 1.1 - elapsed * 0.012);
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = interval;
    }

    // Move enemies toward player
    for (const e of enemies) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
      // Collision
      if (d < e.r + player.r - 2) {
        endGame();
        return;
      }
    }

    // Particles
    for (const p of particles) {
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.4);
  }

  function updateGameover(dt) {
    elapsed += dt;
    for (const p of particles) {
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.4);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function drawGrid() {
    const step = 60;
    const ox = (player ? -player.x * 0.04 : 0);
    const oy = (player ? -player.y * 0.04 : 0);
    ctx.strokeStyle = 'rgba(94, 226, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (ox % step); x < W; x += step) {
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (let y = (oy % step); y < H; y += step) {
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
  }

  function render() {
    // Apply shake offset
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);

    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    drawGrid();

    // Enemies
    for (const e of enemies) {
      ctx.beginPath();
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2);
      grad.addColorStop(0, `hsl(${e.hue}, 90%, 60%)`);
      grad.addColorStop(1, `hsla(${e.hue}, 90%, 30%, 0)`);
      ctx.fillStyle = grad;
      ctx.arc(e.x, e.y, e.r * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = `hsl(${e.hue}, 90%, 55%)`;
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.3, e.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    if (state !== STATE.GAMEOVER) {
      const pulse = 1 + Math.sin(elapsed * 6) * 0.08;
      ctx.beginPath();
      const pg = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.r * 2.4);
      pg.addColorStop(0, 'rgba(94, 226, 255, 0.7)');
      pg.addColorStop(1, 'rgba(94, 226, 255, 0)');
      ctx.fillStyle = pg;
      ctx.arc(player.x, player.y, player.r * 2.4 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = '#5ee2ff';
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.arc(player.x - player.r * 0.3, player.y - player.r * 0.3, player.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Flash
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 64, 96, ${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── Loop ────────────────────────────────────────────────────────────────
  let lastT = 0;
  function loop(t) {
    if (!lastT) lastT = t;
    let dt = (t - lastT) / 1000;
    if (dt > 0.05) dt = 0.05;
    lastT = t;

    if (state === STATE.PLAYING) update(dt);
    else if (state === STATE.GAMEOVER) updateGameover(dt);

    render();
    requestAnimationFrame(loop);
  }

  reset();
  // Render once before start so the canvas isn't blank
  render();
  requestAnimationFrame(loop);
})();
