(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const stageWrapper = document.querySelector('.stage-wrapper');

  const scoreDisplay = document.getElementById('scoreDisplay');
  const highScoreDisplay = document.getElementById('highScoreDisplay');
  const startOverlay = document.getElementById('startOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const finalScoreText = document.getElementById('finalScoreText');
  const recordBadge = document.getElementById('recordBadge');

  const scoreForm = document.getElementById('scoreForm');
  const playerNameInput = document.getElementById('playerName');
  const saveScoreBtn = document.getElementById('saveScoreBtn');
  const saveStatus = document.getElementById('saveStatus');

  const leaderboardList = document.getElementById('leaderboardList');
  const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');
  const soundToggle = document.getElementById('soundToggle');
  const jumpTouchBtn = document.getElementById('jumpTouchBtn');
  const duckTouchBtn = document.getElementById('duckTouchBtn');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_Y = 238;

  // --- Áudio Sintetizado (Web Audio API, zero arquivos externos) ---
  let soundEnabled = true;
  let audioCtx = null;

  function getAudioContext() {
    if (!soundEnabled) return null;
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq, duration, type = 'square', startTimeOffset = 0, gainValue = 0.07) {
    const ac = getAudioContext();
    if (!ac) return;
    const now = ac.currentTime + startTimeOffset;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  const sfx = {
    jump() {
      playTone(520, 0.09, 'square', 0, 0.06);
      playTone(680, 0.08, 'square', 0.05, 0.05);
    },
    scoreMilestone() {
      playTone(880, 0.08, 'square', 0, 0.07);
      playTone(1318.5, 0.18, 'square', 0.08, 0.07);
    },
    crash() {
      playTone(190, 0.14, 'sawtooth', 0, 0.09);
      playTone(125, 0.24, 'sawtooth', 0.1, 0.09);
    },
  };

  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '🔊 Som' : '🔇 Mudo';
  });

  // --- Sprites Pixel Art (escala 2px por bloco) ---
  const DINO_SPRITES = {
    run1: [
      '...........#########..',
      '..........##########..',
      '..........##E#######..',
      '..........##########..',
      '..........##########..',
      '..........#####.......',
      '..........########....',
      '#........######.......',
      '#.......########......',
      '##.....###########....',
      '###...##########..#...',
      '####..##########......',
      '###############.......',
      '.##############.......',
      '..############........',
      '...##########.........',
      '....########..........',
      '.....###..##..........',
      '.....##....##.........',
      '.....##...............',
      '.....###..............',
    ],
    run2: [
      '...........#########..',
      '..........##########..',
      '..........##E#######..',
      '..........##########..',
      '..........##########..',
      '..........#####.......',
      '..........########....',
      '#........######.......',
      '#.......########......',
      '##.....###########....',
      '###...##########..#...',
      '####..##########......',
      '###############.......',
      '.##############.......',
      '..############........',
      '...##########.........',
      '....########..........',
      '.....##...###.........',
      '......##...##.........',
      '...........##.........',
      '...........###........',
    ],
    stand: [
      '...........#########..',
      '..........##########..',
      '..........##E#######..',
      '..........##########..',
      '..........##########..',
      '..........#####.......',
      '..........########....',
      '#........######.......',
      '#.......########......',
      '##.....###########....',
      '###...##########..#...',
      '####..##########......',
      '###############.......',
      '.##############.......',
      '..############........',
      '...##########.........',
      '....########..........',
      '.....##...##..........',
      '.....##...##..........',
      '.....##...##..........',
      '.....###..###.........',
    ],
    crash: [
      '...........#########..',
      '..........##########..',
      '..........#EEE######..',
      '..........#E#E######..',
      '..........#EEE######..',
      '..........#####.......',
      '..........########....',
      '#........######.......',
      '#.......########......',
      '##.....###########....',
      '###...##########..#...',
      '####..##########......',
      '###############.......',
      '.##############.......',
      '..############........',
      '...##########.........',
      '....########..........',
      '.....##...##..........',
      '.....##...##..........',
      '.....##...##..........',
      '.....###..###.........',
    ],
    duck1: [
      '..................#########.',
      '.................##########.',
      '#...............###E#######.',
      '##.............############.',
      '###.........###############.',
      '#####....##################.',
      '.##########################.',
      '..###################.......',
      '...################.##......',
      '.....############...........',
      '......###....##.............',
      '......##......##............',
      '......###...................',
    ],
    duck2: [
      '..................#########.',
      '.................##########.',
      '#...............###E#######.',
      '##.............############.',
      '###.........###############.',
      '#####....##################.',
      '.##########################.',
      '..###################.......',
      '...################.##......',
      '.....############...........',
      '.......##....###............',
      '........##....##............',
      '..............###...........',
    ],
  };

  const PTERO_SPRITES = {
    flapUp: [
      '......##..............',
      '.....###..............',
      '....####..............',
      '...#####..............',
      '..#######.............',
      '.#########............',
      '###########e###.......',
      '....###############...',
      '.......###############',
      '.........##########...',
      '...........######.....',
      '......................',
      '......................',
    ],
    flapDown: [
      '......................',
      '......................',
      '....###...............',
      '..######..............',
      '###########e###.......',
      '....###############...',
      '.......###############',
      '........###########...',
      '........######........',
      '........####..........',
      '........###...........',
      '........##............',
      '......................',
    ],
  };

  function drawSprite(matrix, x, y, pixelSize, fgColor, bgColor) {
    const px = Math.round(x);
    const py = Math.round(y);
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'E' || ch === 'e' ? bgColor : fgColor;
        ctx.fillRect(px + c * pixelSize, py + r * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  // --- Estado do Jogo ---
  const STORAGE_HI_KEY = 'dino_runner_hi_score';
  const STORAGE_NAME_KEY = 'dino_runner_player_name';

  let highScore = Number(localStorage.getItem(STORAGE_HI_KEY)) || 0;
  const savedPlayerName = localStorage.getItem(STORAGE_NAME_KEY) || '';
  if (savedPlayerName) {
    playerNameInput.value = savedPlayerName;
  }

  let state = 'IDLE'; // IDLE | PLAYING | GAMEOVER
  let score = 0;
  let lastMilestone = 0;
  let milestoneFlashTimer = 0;
  let speed = 370; // pixels/seg
  let spawnTimer = 1.1;
  let nightBlend = 0; // 0 = dia, 1 = noite
  let scoreSubmittedThisRound = false;

  const dino = {
    x: 68,
    y: GROUND_Y - 42,
    vy: 0,
    width: 44,
    height: 42,
    isJumping: false,
    isDucking: false,
    animTimer: 0,
    animFrame: 0,
  };

  const groundBumps = [];
  const clouds = [];
  const stars = [];
  let obstacles = [];
  let particles = [];

  function initEnvironment() {
    groundBumps.length = 0;
    for (let x = 0; x < WIDTH + 80; x += 28) {
      groundBumps.push({
        x,
        w: 4 + Math.floor(Math.random() * 12),
        yOffset: Math.random() > 0.5 ? 4 : 8,
      });
    }

    clouds.length = 0;
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: 120 + i * 190 + Math.random() * 60,
        y: 38 + Math.random() * 75,
        speedFactor: 0.16 + Math.random() * 0.1,
        scale: 0.85 + Math.random() * 0.45,
      });
    }

    stars.length = 0;
    for (let i = 0; i < 24; i++) {
      stars.push({
        x: Math.random() * WIDTH,
        y: 20 + Math.random() * 120,
        size: Math.random() > 0.7 ? 3 : 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function formatScore(val) {
    return String(Math.floor(val)).padStart(5, '0');
  }

  function updateScoreHud() {
    if (milestoneFlashTimer > 0 && Math.floor(milestoneFlashTimer * 8) % 2 === 0) {
      scoreDisplay.style.visibility = 'hidden';
    } else {
      scoreDisplay.style.visibility = 'visible';
      if (milestoneFlashTimer <= 0) {
        scoreDisplay.textContent = formatScore(score);
      }
    }
    highScoreDisplay.textContent = formatScore(highScore);
  }

  function spawnParticles(x, y, count, vyMin = -120, vyMax = -30) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 6,
        vx: -speed * 0.35 + (Math.random() - 0.5) * 90,
        vy: vyMin + Math.random() * (vyMax - vyMin),
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
        size: 2 + Math.floor(Math.random() * 3),
      });
    }
  }

  function resetRound() {
    score = 0;
    lastMilestone = 0;
    milestoneFlashTimer = 0;
    speed = 380;
    spawnTimer = 0.95;
    nightBlend = 0;
    scoreSubmittedThisRound = false;
    stageWrapper.classList.remove('night-mode');

    dino.isJumping = false;
    dino.isDucking = false;
    dino.height = 42;
    dino.width = 44;
    dino.y = GROUND_Y - dino.height;
    dino.vy = 0;
    dino.animTimer = 0;
    dino.animFrame = 0;

    obstacles = [];
    particles = [];
    saveStatus.textContent = '';
    saveStatus.classList.remove('error');
    saveScoreBtn.disabled = false;
    updateScoreHud();
  }

  function startGame() {
    getAudioContext();
    resetRound();
    state = 'PLAYING';
    startOverlay.classList.remove('visible');
    gameOverOverlay.classList.remove('visible');
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  function triggerJump() {
    if (state === 'IDLE') {
      startGame();
      return;
    }
    if (state !== 'PLAYING') return;

    if (!dino.isJumping) {
      dino.isJumping = true;
      dino.isDucking = false;
      dino.height = 42;
      dino.width = 44;
      dino.vy = -650;
      sfx.jump();
      spawnParticles(dino.x + 14, GROUND_Y - 2, 7);
    }
  }

  function releaseJumpEarly() {
    if (state === 'PLAYING' && dino.isJumping && dino.vy < -260) {
      dino.vy = -260;
    }
  }

  function setDucking(active) {
    if (state !== 'PLAYING') return;
    if (dino.isJumping) {
      dino.isDucking = active;
      return;
    }
    if (active && !dino.isDucking) {
      dino.isDucking = true;
      dino.width = 54;
      dino.height = 26;
      dino.y = GROUND_Y - dino.height;
    } else if (!active && dino.isDucking) {
      dino.isDucking = false;
      dino.width = 44;
      dino.height = 42;
      dino.y = GROUND_Y - dino.height;
    }
  }

  function spawnObstacle() {
    const allowPtero = score >= 220 && Math.random() < 0.3;

    if (allowPtero) {
      // Três alturas: baixa (pular), média (pular ou abaixar), alta (abaixar ou passar por baixo)
      const altitudes = [GROUND_Y - 34, GROUND_Y - 56, GROUND_Y - 78];
      const y = altitudes[Math.floor(Math.random() * altitudes.length)];
      obstacles.push({
        type: 'ptero',
        x: WIDTH + 30,
        y,
        width: 44,
        height: 26,
        speedBonus: 45 + Math.random() * 35,
        flapTimer: 0,
        flapFrame: 0,
      });
      return;
    }

    // Cactos: pequeno, alto ou grupo (1 a 3 unidades)
    const isTall = score > 80 && Math.random() < 0.48;
    const count = score > 140 && Math.random() < 0.45 ? (Math.random() < 0.4 ? 3 : 2) : 1;
    const unitWidth = isTall ? 20 : 15;
    const height = isTall ? 48 : 34;
    const gap = 4;
    const totalWidth = count * unitWidth + (count - 1) * gap;

    obstacles.push({
      type: 'cactus',
      isTall,
      count,
      unitWidth,
      gap,
      x: WIDTH + 30,
      y: GROUND_Y - height,
      width: totalWidth,
      height,
      speedBonus: 0,
    });
  }

  function getDinoHitbox() {
    if (dino.isDucking && !dino.isJumping) {
      return {
        x: dino.x + 6,
        y: dino.y + 4,
        w: dino.width - 12,
        h: dino.height - 6,
      };
    }
    return {
      x: dino.x + 9,
      y: dino.y + 6,
      w: dino.width - 18,
      h: dino.height - 10,
    };
  }

  function getObstacleHitbox(obs) {
    if (obs.type === 'ptero') {
      return {
        x: obs.x + 6,
        y: obs.y + 5,
        w: obs.width - 12,
        h: obs.height - 10,
      };
    }
    return {
      x: obs.x + 3,
      y: obs.y + 4,
      w: obs.width - 6,
      h: obs.height - 6,
    };
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function handleGameOver() {
    state = 'GAMEOVER';
    sfx.crash();
    spawnParticles(dino.x + 22, dino.y + 18, 16, -180, 60);

    const finalPts = Math.floor(score);
    let isNewRecord = false;
    if (finalPts > highScore) {
      highScore = finalPts;
      localStorage.setItem(STORAGE_HI_KEY, String(highScore));
      isNewRecord = true;
    }

    milestoneFlashTimer = 0;
    updateScoreHud();

    finalScoreText.textContent = `${finalPts} pontos`;
    recordBadge.classList.toggle('hidden', !isNewRecord);
    gameOverOverlay.classList.add('visible');
  }

  function update(dt) {
    // Nuvens sempre se movem suavemente
    for (const c of clouds) {
      const baseSpeed = state === 'PLAYING' ? speed : 60;
      c.x -= baseSpeed * c.speedFactor * dt;
      if (c.x < -90) {
        c.x = WIDTH + 60 + Math.random() * 80;
        c.y = 35 + Math.random() * 80;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    if (state !== 'PLAYING') return;

    // Velocidade e pontuação
    speed = Math.min(860, 380 + score * 0.28);
    score += (speed / 36) * dt;

    const currentHundred = Math.floor(score / 100);
    if (currentHundred > lastMilestone && currentHundred > 0) {
      lastMilestone = currentHundred;
      milestoneFlashTimer = 0.9;
      scoreDisplay.textContent = formatScore(currentHundred * 100);
      sfx.scoreMilestone();
    }

    if (milestoneFlashTimer > 0) {
      milestoneFlashTimer = Math.max(0, milestoneFlashTimer - dt);
    }

    // Ciclo Dia / Noite a cada 700 pontos (dura 250 pontos à noite)
    const cyclePos = score % 950;
    const isNightTarget = cyclePos >= 700 ? 1 : 0;
    nightBlend += (isNightTarget - nightBlend) * Math.min(1, dt * 3);
    stageWrapper.classList.toggle('night-mode', isNightTarget === 1);

    // Física do Dinossauro
    if (dino.isJumping) {
      const gravity = dino.isDucking ? 3600 : 1950;
      dino.vy += gravity * dt;
      dino.y += dino.vy * dt;

      const targetHeight = dino.isDucking ? 26 : 42;
      if (dino.y >= GROUND_Y - targetHeight) {
        dino.isJumping = false;
        dino.vy = 0;
        if (dino.isDucking) {
          dino.width = 54;
          dino.height = 26;
        } else {
          dino.width = 44;
          dino.height = 42;
        }
        dino.y = GROUND_Y - dino.height;
        spawnParticles(dino.x + 16, GROUND_Y - 2, 5, -70, -20);
      }
    }

    dino.animTimer += dt * (speed / 380);
    if (dino.animTimer >= 0.095) {
      dino.animTimer = 0;
      dino.animFrame = 1 - dino.animFrame;
    }

    // Chão
    for (const bump of groundBumps) {
      bump.x -= speed * dt;
      if (bump.x + bump.w < 0) {
        bump.x = WIDTH + Math.random() * 45;
        bump.w = 4 + Math.floor(Math.random() * 14);
      }
    }

    // Obstáculos
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      const minGapTime = Math.max(0.52, 1.08 - (speed - 380) / 1100);
      spawnTimer = minGapTime + Math.random() * 0.65;
    }

    const dinoBox = getDinoHitbox();

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= (speed + obs.speedBonus) * dt;

      if (obs.type === 'ptero') {
        obs.flapTimer += dt;
        if (obs.flapTimer >= 0.16) {
          obs.flapTimer = 0;
          obs.flapFrame = 1 - obs.flapFrame;
        }
      }

      if (rectsOverlap(dinoBox, getObstacleHitbox(obs))) {
        handleGameOver();
        return;
      }

      if (obs.x + obs.width < -40) {
        obstacles.splice(i, 1);
      }
    }

    updateScoreHud();
  }

  // --- Renderização ---
  function lerpColor(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16);
    const b = parseInt(hexB.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
    const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
    const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  function drawCactusUnit(x, y, w, h, isTall, color) {
    const px = Math.round(x);
    const py = Math.round(y);
    const trunkW = isTall ? 8 : 6;
    const trunkX = px + Math.floor((w - trunkW) / 2);

    ctx.fillStyle = color;
    // Tronco central
    ctx.fillRect(trunkX, py + 2, trunkW, h - 2);
    ctx.fillRect(trunkX + 1, py, trunkW - 2, 2);

    // Braço esquerdo
    const leftArmY = py + Math.floor(h * 0.28);
    const armThickness = isTall ? 4 : 3;
    ctx.fillRect(px, leftArmY, trunkX - px, armThickness);
    ctx.fillRect(px, leftArmY - (isTall ? 10 : 7), armThickness, isTall ? 12 : 9);

    // Braço direito
    const rightArmY = py + Math.floor(h * 0.42);
    const rightStart = trunkX + trunkW;
    ctx.fillRect(rightStart, rightArmY, px + w - rightStart, armThickness);
    ctx.fillRect(px + w - armThickness, rightArmY - (isTall ? 12 : 8), armThickness, isTall ? 14 : 10);
  }

  function drawCloud(x, y, scale, color) {
    ctx.fillStyle = color;
    const s = scale;
    ctx.fillRect(Math.round(x), Math.round(y + 8 * s), Math.round(46 * s), Math.round(10 * s));
    ctx.fillRect(Math.round(x + 8 * s), Math.round(y + 3 * s), Math.round(28 * s), Math.round(8 * s));
    ctx.fillRect(Math.round(x + 16 * s), Math.round(y), Math.round(14 * s), Math.round(5 * s));
  }

  function render(nowMs) {
    const bgColor = lerpColor('#f8fafc', '#0f172a', nightBlend);
    const fgColor = lerpColor('#334155', '#e2e8f0', nightBlend);
    const mutedColor = lerpColor('#cbd5e1', '#334155', nightBlend);
    const cactusColor = lerpColor('#15803d', '#34d399', nightBlend);

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Estrelas e lua no modo noturno
    if (nightBlend > 0.05) {
      ctx.save();
      ctx.globalAlpha = nightBlend * 0.85;
      ctx.fillStyle = '#fef08a';
      for (const st of stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(nowMs * 0.004 + st.phase);
        ctx.globalAlpha = nightBlend * twinkle;
        ctx.fillRect(Math.round(st.x), Math.round(st.y), st.size, st.size);
      }

      // Lua crescente
      ctx.globalAlpha = nightBlend;
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(WIDTH - 95, 56, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.arc(WIDTH - 88, 52, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Nuvens
    for (const c of clouds) {
      drawCloud(c.x, c.y, c.scale, mutedColor);
    }

    // Linha do solo + pedrinhas
    ctx.fillStyle = fgColor;
    ctx.fillRect(0, GROUND_Y, WIDTH, 2);
    for (const bump of groundBumps) {
      ctx.fillStyle = mutedColor;
      ctx.fillRect(Math.round(bump.x), GROUND_Y + bump.yOffset, bump.w, 2);
    }

    // Obstáculos
    for (const obs of obstacles) {
      if (obs.type === 'cactus') {
        for (let idx = 0; idx < obs.count; idx++) {
          const unitX = obs.x + idx * (obs.unitWidth + obs.gap);
          drawCactusUnit(unitX, obs.y, obs.unitWidth, obs.height, obs.isTall, cactusColor);
        }
      } else {
        const sprite = obs.flapFrame === 0 ? PTERO_SPRITES.flapUp : PTERO_SPRITES.flapDown;
        drawSprite(sprite, obs.x, obs.y, 2, fgColor, bgColor);
      }
    }

    // Dinossauro
    let dinoMatrix = DINO_SPRITES.stand;
    if (state === 'GAMEOVER') {
      dinoMatrix = DINO_SPRITES.crash;
    } else if (dino.isJumping) {
      dinoMatrix = DINO_SPRITES.stand;
    } else if (dino.isDucking) {
      dinoMatrix = dino.animFrame === 0 ? DINO_SPRITES.duck1 : DINO_SPRITES.duck2;
    } else if (state === 'PLAYING') {
      dinoMatrix = dino.animFrame === 0 ? DINO_SPRITES.run1 : DINO_SPRITES.run2;
    }
    drawSprite(dinoMatrix, dino.x, dino.y, 2, fgColor, bgColor);

    // Partículas de poeira
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = fgColor;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      ctx.restore();
    }
  }

  // --- Loop Principal ---
  let lastFrameTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    update(dt);
    render(now);
    requestAnimationFrame(gameLoop);
  }

  // --- Controles (Teclado, Mouse e Touch) ---
  function isTypingInInput() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  }

  window.addEventListener('keydown', (e) => {
    if (isTypingInInput()) return;

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (state === 'GAMEOVER') {
        startGame();
      } else {
        triggerJump();
      }
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      setDucking(true);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (isTypingInInput()) return;

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      releaseJumpEarly();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      setDucking(false);
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state === 'PLAYING') {
      triggerJump();
    }
  });

  canvas.addEventListener('pointerup', () => {
    releaseJumpEarly();
  });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  jumpTouchBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state === 'GAMEOVER') startGame();
    else triggerJump();
  });
  jumpTouchBtn.addEventListener('pointerup', releaseJumpEarly);

  duckTouchBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setDucking(true);
  });
  duckTouchBtn.addEventListener('pointerup', () => setDucking(false));
  duckTouchBtn.addEventListener('pointerleave', () => setDucking(false));

  // --- Integração com API Node.js (Ranking) ---
  function renderLeaderboard(scores) {
    leaderboardList.innerHTML = '';
    if (!Array.isArray(scores) || scores.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-row';
      empty.textContent = 'Nenhuma pontuação registrada ainda. Seja o primeiro!';
      leaderboardList.appendChild(empty);
      return;
    }

    scores.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = `leaderboard-item ${index < 3 ? `top-${index + 1}` : ''}`.trim();

      const meta = document.createElement('div');
      meta.className = 'player-meta';

      const rankSpan = document.createElement('span');
      rankSpan.className = 'rank-num';
      rankSpan.textContent = `#${index + 1}`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'player-name';
      nameSpan.textContent = entry.name;

      meta.appendChild(rankSpan);
      meta.appendChild(nameSpan);

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'player-score';
      scoreSpan.textContent = formatScore(entry.score);

      li.appendChild(meta);
      li.appendChild(scoreSpan);
      leaderboardList.appendChild(li);
    });
  }

  async function loadLeaderboard() {
    try {
      const res = await fetch('/api/scores');
      if (!res.ok) throw new Error('Falha ao buscar ranking');
      const data = await res.json();
      renderLeaderboard(data.scores || []);
    } catch {
      leaderboardList.innerHTML = '<li class="empty-row">Não foi possível carregar o ranking.</li>';
    }
  }

  scoreForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (scoreSubmittedThisRound) return;

    const finalPts = Math.floor(score);
    const name = playerNameInput.value.trim();

    if (!name) {
      saveStatus.textContent = 'Digite um nome antes de salvar.';
      saveStatus.classList.add('error');
      return;
    }
    if (finalPts <= 0) {
      saveStatus.textContent = 'Faça pelo menos 1 ponto para entrar no ranking!';
      saveStatus.classList.add('error');
      return;
    }

    saveScoreBtn.disabled = true;
    saveStatus.classList.remove('error');
    saveStatus.textContent = 'Salvando...';

    try {
      localStorage.setItem(STORAGE_NAME_KEY, name);
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: finalPts }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar pontuação.');
      }

      scoreSubmittedThisRound = true;
      renderLeaderboard(data.scores || []);
      if (data.saved && data.rank) {
        saveStatus.textContent = `Salvo! Você ficou em #${data.rank} no Top 10!`;
      } else {
        saveStatus.textContent = 'Pontuação enviada (fora do Top 10 atual).';
      }
    } catch (err) {
      saveScoreBtn.disabled = false;
      saveStatus.classList.add('error');
      saveStatus.textContent = err.message || 'Falha ao conectar com o servidor.';
    }
  });

  refreshLeaderboardBtn.addEventListener('click', loadLeaderboard);

  // Inicialização
  initEnvironment();
  updateScoreHud();
  loadLeaderboard();
  requestAnimationFrame(gameLoop);
})();
