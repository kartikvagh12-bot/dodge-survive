(() => {
  // ── DOM ──────────────────────────────────────────────────────────────────
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const levelNumEl = document.getElementById('level-num');
  const powerupsEl = document.getElementById('powerups');
  const levelToastEl = document.getElementById('level-toast');
  const finalScoreEl = document.getElementById('final-score');
  const finalBestEl = document.getElementById('final-best');
  const unlockBannerEl = document.getElementById('unlock-banner');
  const unlockNameEl = document.getElementById('unlock-name');
  const restartHintEl = document.getElementById('restart-hint');
  const startHintEl = document.getElementById('start-hint');
  const gameoverEl = document.getElementById('gameover');
  const startEl = document.getElementById('start');
  const skinPickerEl = document.getElementById('skin-picker');

  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  startHintEl.textContent = isTouch ? 'Tap to start' : 'Press any key to start';
  restartHintEl.textContent = isTouch ? 'Tap to restart' : 'Press any key to restart';

  // ── Skins ────────────────────────────────────────────────────────────────
  const SKINS = [
    { id: 'cyan',    name: 'Cyan',    color: '#5ee2ff', unlockAt: 0   },
    { id: 'magenta', name: 'Magenta', color: '#ff5ee2', unlockAt: 20  },
    { id: 'gold',    name: 'Gold',    color: '#ffcd5e', unlockAt: 40  },
    { id: 'lime',    name: 'Lime',    color: '#5eff7a', unlockAt: 70  },
    { id: 'crimson', name: 'Crimson', color: '#ff5e5e', unlockAt: 110 },
    { id: 'rainbow', name: 'Rainbow', color: 'rainbow', unlockAt: 160 },
  ];
  let currentSkinId = localStorage.getItem('dodgeSurviveSkin') || 'cyan';

  function isUnlocked(skin) { return best >= skin.unlockAt; }
  function getSkin(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
  function skinColor(t = 0) {
    const s = getSkin(currentSkinId);
    if (s.color === 'rainbow') return `hsl(${(t * 80) % 360}, 90%, 65%)`;
    return s.color;
  }
  function skinColorRGBA(alpha, t = 0) {
    const c = skinColor(t);
    if (c.startsWith('hsl')) return c.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
    // hex → rgba
    const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Power-ups ────────────────────────────────────────────────────────────
  const PWR = {
    SHIELD: {
      id: 'SHIELD',
      label: 'SHIELD',
      color: '#5ee2ff',
      duration: 4.5,
    },
    SLOW: {
      id: 'SLOW',
      label: 'SLOW-MO',
      color: '#b48bff',
      duration: 5.0,
      slowFactor: 0.35,
    },
    SPEED: {
      id: 'SPEED',
      label: 'SPEED',
      color: '#ffcd5e',
      duration: 5.0,
      speedMult: 1.7,
    },
  };
  const PWR_LIST = Object.values(PWR);
  const PWR_RADIUS = 16;
  const ENEMY_COLOR = '#ff4060';
  const ENEMY_GLOW = 'rgba(255, 64, 96, ';

  // ── Canvas sizing ───────────────────────────────────────────────────────
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

  let player, enemies, particles, trail, powerups, activeFx,
      elapsed, spawnTimer, pwrSpawnTimer, score, best,
      shake, flash, level, lastLevelShown;

  best = +(localStorage.getItem('dodgeSurviveBest') || 0);
  bestEl.textContent = 'Best: ' + best;

  function reset() {
    player = { x: W / 2, y: H / 2, r: 12, vx: 0, vy: 0, baseSpeed: 290 };
    enemies = [];
    particles = [];
    trail = [];
    powerups = [];
    activeFx = { SHIELD: 0, SLOW: 0, SPEED: 0 };
    elapsed = 0;
    spawnTimer = 0.5;
    pwrSpawnTimer = 7 + Math.random() * 4;
    score = 0;
    shake = 0;
    flash = 0;
    level = 1;
    lastLevelShown = 1;
    scoreEl.textContent = '0';
    levelNumEl.textContent = '1';
    powerupsEl.innerHTML = '';
  }

  // ── Skin picker UI ──────────────────────────────────────────────────────
  function buildSkinPicker() {
    skinPickerEl.innerHTML = '';
    for (const s of SKINS) {
      const el = document.createElement('div');
      el.className = 'skin-swatch';
      const unlocked = isUnlocked(s);
      if (!unlocked) el.classList.add('locked');
      if (s.id === currentSkinId && unlocked) el.classList.add('selected');

      if (s.color === 'rainbow') {
        el.style.background = 'conic-gradient(from 0deg, #ff5e5e, #ffcd5e, #5eff7a, #5ee2ff, #b48bff, #ff5ee2, #ff5e5e)';
      } else {
        el.style.background = s.color;
        el.style.boxShadow = unlocked ? `0 0 16px ${s.color}55` : 'none';
      }
      if (!unlocked) {
        const lab = document.createElement('div');
        lab.className = 'lock-label';
        lab.textContent = s.unlockAt + 's';
        el.appendChild(lab);
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isUnlocked(s)) return;
        currentSkinId = s.id;
        localStorage.setItem('dodgeSurviveSkin', s.id);
        buildSkinPicker();
      });
      el.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        if (!isUnlocked(s)) return;
        currentSkinId = s.id;
        localStorage.setItem('dodgeSurviveSkin', s.id);
        buildSkinPicker();
      }, { passive: true });
      skinPickerEl.appendChild(el);
    }
  }
  buildSkinPicker();

  // ── Game flow ───────────────────────────────────────────────────────────
  function startGame() {
    reset();
    state = STATE.PLAYING;
    startEl.classList.add('hidden');
    gameoverEl.classList.add('hidden');
    unlockBannerEl.classList.add('hidden');
  }

  function endGame() {
    state = STATE.GAMEOVER;
    shake = 22;
    flash = 0.55;
    // Death burst — colored to match active skin
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 180 + Math.random() * 260;
      particles.push({
        x: player.x, y: player.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1.1, max: 1.1,
        r: 2 + Math.random() * 3.5,
        color: Math.random() < 0.5 ? skinColor(elapsed) : '#ffffff',
      });
    }

    let unlockedNew = null;
    if (score > best) {
      const prevBest = best;
      best = score;
      localStorage.setItem('dodgeSurviveBest', best);
      bestEl.textContent = 'Best: ' + best;
      // Detect any newly unlocked skin
      for (const s of SKINS) {
        if (s.unlockAt > prevBest && s.unlockAt <= best) {
          unlockedNew = s;
        }
      }
      buildSkinPicker(); // refresh lock states
    }

    finalScoreEl.textContent = score;
    finalBestEl.textContent = best;

    if (unlockedNew) {
      unlockNameEl.textContent = unlockedNew.name.toUpperCase();
      unlockBannerEl.classList.remove('hidden');
    } else {
      unlockBannerEl.classList.add('hidden');
    }

    setTimeout(() => gameoverEl.classList.remove('hidden'), 120);
  }

  // ── Input: keyboard ─────────────────────────────────────────────────────
  const keys = Object.create(null);
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (state === STATE.START) { startGame(); return; }
    if (state === STATE.GAMEOVER) startGame();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // ── Input: delta-drag movement (mobile) ─────────────────────────────────
  // Player position is translated by (currentTouch - previousTouch) * sens
  // inside each touchmove event. No target, no direction vector — finger
  // movement is applied as a direct position delta, like dragging an object.
  const touch = { active: false, id: null, prevX: 0, prevY: 0, x: 0, y: 0, fade: 0 };
  const TOUCH_SENS = 1.4;

  function touchStart(e) {
    e.preventDefault();
    if (state === STATE.START) { startGame(); return; }
    if (state === STATE.GAMEOVER) { startGame(); return; }
    if (touch.active) return;
    const t = e.changedTouches[0];
    touch.active = true;
    touch.id = t.identifier;
    touch.prevX = t.clientX;
    touch.prevY = t.clientY;
    touch.x = t.clientX;
    touch.y = t.clientY;
    touch.fade = 1;
  }
  function touchMove(e) {
    if (!touch.active) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.id) continue;
      const dx = t.clientX - touch.prevX;
      const dy = t.clientY - touch.prevY;
      touch.prevX = t.clientX;
      touch.prevY = t.clientY;
      touch.x = t.clientX;
      touch.y = t.clientY;
      touch.fade = 1;
      if (state !== STATE.PLAYING || !player) return;
      const sens = TOUCH_SENS * (activeFx.SPEED > 0 ? PWR.SPEED.speedMult : 1);
      player.x += dx * sens;
      player.y += dy * sens;
      if (player.x < player.r) player.x = player.r;
      if (player.y < player.r) player.y = player.r;
      if (player.x > W - player.r) player.x = W - player.r;
      if (player.y > H - player.r) player.y = H - player.r;
      return;
    }
  }
  function touchEnd(e) {
    if (!touch.active) return;
    for (const t of e.changedTouches) {
      if (t.identifier === touch.id) {
        touch.active = false;
        touch.id = null;
        return;
      }
    }
  }
  canvas.addEventListener('touchstart',  touchStart, { passive: false });
  canvas.addEventListener('touchmove',   touchMove,  { passive: false });
  canvas.addEventListener('touchend',    touchEnd,   { passive: false });
  canvas.addEventListener('touchcancel', touchEnd,   { passive: false });

  // Tap/click on overlays to start/restart (skip when interacting with skin picker)
  function tapHandler(e) {
    if (e.target && e.target.closest('.skin-swatch')) return;
    e.preventDefault();
    if (state === STATE.START) startGame();
    else if (state === STATE.GAMEOVER) startGame();
  }
  startEl.addEventListener('touchstart', tapHandler, { passive: false });
  startEl.addEventListener('mousedown', tapHandler);
  gameoverEl.addEventListener('touchstart', tapHandler, { passive: false });
  gameoverEl.addEventListener('mousedown', tapHandler);
  canvas.addEventListener('mousedown', () => {
    if (state === STATE.GAMEOVER) startGame();
  });

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
    // Smooth time-based speed scaling
    const minSp = 80 + elapsed * 2.4;
    const maxSp = 140 + elapsed * 3.4;
    const speed = minSp + Math.random() * (maxSp - minSp);
    const r = 11 + Math.random() * 6;
    enemies.push({
      x, y, r, speed,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  function spawnPowerup() {
    const type = PWR_LIST[Math.floor(Math.random() * PWR_LIST.length)];
    const margin = 60;
    const x = margin + Math.random() * (W - margin * 2);
    const y = margin + Math.random() * (H - margin * 2);
    powerups.push({
      type, x, y, r: PWR_RADIUS,
      life: 9.0, max: 9.0,
      bob: Math.random() * Math.PI * 2,
    });
  }

  function activatePowerup(type) {
    activeFx[type.id] = type.duration;
    // Burst on pickup
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 180;
      particles.push({
        x: player.x, y: player.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.7, max: 0.7,
        r: 2 + Math.random() * 2.5,
        color: type.color,
      });
    }
    flash = Math.max(flash, 0.18);
  }

  // ── Update ──────────────────────────────────────────────────────────────
  function update(dt) {
    elapsed += dt;
    score = Math.floor(elapsed);
    scoreEl.textContent = score;

    // Level: bump every 10 seconds
    const newLevel = 1 + Math.floor(elapsed / 10);
    if (newLevel !== level) {
      level = newLevel;
      levelNumEl.textContent = level;
    }
    if (level !== lastLevelShown) {
      lastLevelShown = level;
      showLevelToast(level);
    }

    // Keyboard-driven velocity. Touch moves the player directly in the
    // touchmove handler as a pure position delta.
    let mx = 0, my = 0;
    if (keys['w'] || keys['arrowup'])    my -= 1;
    if (keys['s'] || keys['arrowdown'])  my += 1;
    if (keys['a'] || keys['arrowleft'])  mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }

    const speedMult = activeFx.SPEED > 0 ? PWR.SPEED.speedMult : 1;
    const playerSpeed = player.baseSpeed * speedMult;
    const targetVx = mx * playerSpeed;
    const targetVy = my * playerSpeed;
    // Frame-rate-independent smoothing — ~36ms time constant, snappy but no jitter
    const k = 1 - Math.exp(-dt * 28);
    player.vx += (targetVx - player.vx) * k;
    player.vy += (targetVy - player.vy) * k;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.x < player.r) player.x = player.r;
    if (player.y < player.r) player.y = player.r;
    if (player.x > W - player.r) player.x = W - player.r;
    if (player.y > H - player.r) player.y = H - player.r;

    // Player trail — always pushed every frame, independent of input method
    trail.push({ x: player.x, y: player.y });
    if (trail.length > 25) trail.shift();

    // Smooth interval decay — fast at start, gentle asymptote near 0.18s
    spawnTimer -= dt;
    const baseInterval = Math.max(0.18, 1.0 / (1 + elapsed * 0.045));
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = baseInterval * (0.75 + Math.random() * 0.5);
    }

    // Powerup spawning — every 7-13s, but skip if all 3 already active
    pwrSpawnTimer -= dt;
    if (pwrSpawnTimer <= 0) {
      spawnPowerup();
      pwrSpawnTimer = 7 + Math.random() * 6;
    }

    // Slow-mo affects enemies + their particles, not player
    const enemyDt = activeFx.SLOW > 0 ? dt * PWR.SLOW.slowFactor : dt;

    // Move enemies
    const shielded = activeFx.SHIELD > 0;
    for (const e of enemies) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.speed * enemyDt;
      e.y += (dy / d) * e.speed * enemyDt;
      e.pulsePhase += dt * 6;
      // Collision
      if (d < e.r + player.r - 2) {
        if (shielded) {
          // Vaporize the enemy & burst
          enemyDeathBurst(e);
          e._dead = true;
          continue;
        }
        endGame();
        return;
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i]._dead) enemies.splice(i, 1);

    // Powerup pickup
    for (const p of powerups) {
      p.bob += dt * 3;
      p.life -= dt;
      const dx = player.x - p.x, dy = player.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < p.r + player.r) {
        activatePowerup(p.type);
        p._taken = true;
      }
    }
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      if (p._taken || p.life <= 0) powerups.splice(i, 1);
    }

    // Particles (use enemyDt so slow-mo also slows visual debris from enemies)
    for (const p of particles) {
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

    // Decay active power-ups
    for (const k of Object.keys(activeFx)) {
      if (activeFx[k] > 0) activeFx[k] = Math.max(0, activeFx[k] - dt);
    }
    renderPowerupHud();

    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.4);
  }

  function enemyDeathBurst(e) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 200;
      particles.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.6, max: 0.6,
        r: 2 + Math.random() * 2,
        color: ENEMY_COLOR,
      });
    }
  }

  function updateGameover(dt) {
    elapsed += dt;
    for (const p of particles) {
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    // Drain trail on gameover so it fades out naturally
    if (trail.length > 0) trail.shift();
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.4);
  }

  // ── HUD: power-up chips ─────────────────────────────────────────────────
  function renderPowerupHud() {
    const items = [];
    for (const t of PWR_LIST) {
      const remain = activeFx[t.id];
      if (remain > 0) items.push({ t, remain });
    }
    // Diff-update DOM efficiently
    const existingIds = Array.from(powerupsEl.children).map(c => c.dataset.id);
    const wantedIds = items.map(i => i.t.id);
    if (existingIds.join(',') !== wantedIds.join(',')) {
      powerupsEl.innerHTML = '';
      for (const i of items) {
        const chip = document.createElement('div');
        chip.className = 'pwr-chip';
        chip.dataset.id = i.t.id;
        chip.style.color = i.t.color;
        chip.innerHTML = `<span class="dot"></span><span class="lbl">${i.t.label}</span> <span class="t">0.0s</span>`;
        powerupsEl.appendChild(chip);
      }
    }
    // Update timers in place
    let idx = 0;
    for (const i of items) {
      const chip = powerupsEl.children[idx++];
      if (chip) chip.querySelector('.t').textContent = i.remain.toFixed(1) + 's';
    }
  }

  function showLevelToast(n) {
    levelToastEl.classList.remove('hidden');
    levelToastEl.querySelector('.lt-num').textContent = n;
    // Restart CSS animation
    levelToastEl.style.animation = 'none';
    void levelToastEl.offsetWidth;
    levelToastEl.style.animation = '';
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function drawGrid() {
    const step = 60;
    const ox = (player ? -player.x * 0.04 : 0);
    const oy = (player ? -player.y * 0.04 : 0);
    ctx.strokeStyle = 'rgba(94, 226, 255, 0.025)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (ox % step); x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = (oy % step); y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  function drawTrail() {
    for (let i = 0; i < trail.length; i++) {
      const point = trail[i];
      const alpha = i / trail.length;
      const radius = player.r * (alpha * 0.8);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  function drawPowerups() {
    for (const p of powerups) {
      const fade = p.life < 2 ? p.life / 2 : 1;
      const bob = Math.sin(p.bob) * 4;
      const y = p.y + bob;
      ctx.globalAlpha = fade;

      // Outer glow
      const grad = ctx.createRadialGradient(p.x, y, 0, p.x, y, p.r * 2.6);
      grad.addColorStop(0, p.type.color + 'cc');
      grad.addColorStop(1, p.type.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, y, p.r * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = p.type.color;
      ctx.beginPath();
      ctx.arc(p.x, y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Glyph
      ctx.fillStyle = '#0a0a14';
      ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyph = p.type.id === 'SHIELD' ? 'S' : p.type.id === 'SLOW' ? 'T' : '»';
      ctx.fillText(glyph, p.x, y + 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawEnemies() {
    for (const e of enemies) {
      const pulse = 1 + Math.sin(e.pulsePhase) * 0.06;
      // Soft glow
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2);
      grad.addColorStop(0, ENEMY_GLOW + '0.55)');
      grad.addColorStop(1, ENEMY_GLOW + '0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 2 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Solid core
      ctx.fillStyle = ENEMY_COLOR;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    if (state === STATE.GAMEOVER) return;
    const t = elapsed;
    const pulse = 1 + Math.sin(t * 6) * 0.08;
    const col = skinColor(t);
    const colA = (a) => skinColorRGBA(a, t);

    // Glow
    ctx.beginPath();
    const pg = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.r * 2.6);
    pg.addColorStop(0, colA(0.65));
    pg.addColorStop(1, colA(0));
    ctx.fillStyle = pg;
    ctx.arc(player.x, player.y, player.r * 2.6 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.fillStyle = col;
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.arc(player.x - player.r * 0.3, player.y - player.r * 0.3, player.r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Shield ring
    if (activeFx.SHIELD > 0) {
      const ringR = player.r + 8 + Math.sin(t * 8) * 1.5;
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(94, 226, 255, ${0.4 + 0.4 * Math.sin(t * 10)})`;
      ctx.shadowColor = '#5ee2ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(player.x, player.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Speed boost — extra jets
    if (activeFx.SPEED > 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 205, 94, 0.6)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSlowmoTint() {
    if (activeFx.SLOW <= 0) return;
    const a = Math.min(0.18, activeFx.SLOW * 0.05);
    ctx.fillStyle = `rgba(140, 110, 220, ${a})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTouchIndicator() {
    if (touch.fade <= 0) return;
    const a = touch.fade;
    // Small subtle dot where the finger currently is
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * a})`;
    ctx.beginPath();
    ctx.arc(touch.x, touch.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * a})`;
    ctx.beginPath();
    ctx.arc(touch.x, touch.y, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  function render() {
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);

    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    drawSlowmoTint();
    drawTrail();
    drawPowerups();
    drawEnemies();
    drawPlayer();
    drawTouchIndicator();

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

    // Death flash
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

    // Touch indicator fade (independent of game state so it eases out on death)
    if (touch.active) touch.fade = Math.min(1, touch.fade + dt * 10);
    else if (touch.fade > 0) touch.fade = Math.max(0, touch.fade - dt * 4);

    render();
    requestAnimationFrame(loop);
  }

  reset();
  render();
  requestAnimationFrame(loop);
})();
