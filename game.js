/*
 * Country Flow minigame: keep the Canto's drainage tube clear.
 * Opened by clicking the cowboy hat. Personalized from the current
 * experiment (operator's first name, experiment name, markers).
 */
(function () {
  var CF = window.CF;
  var $ = function (id) { return document.getElementById(id); };
  var W = 320, H = 180;
  var CACTI = [[84, 44], [262, 128], [40, 150], [120, 90], [150, 20], [300, 60], [20, 90], [70, 20], [240, 160], [290, 150], [170, 150], [110, 160]];
  var GENERIC = [
    "Keep it up! We just ran our third sample and we're hitting 10,000 events super fast!",
    'Compensation looks clean. The PE spillover into PerCP-Cy5.5 is under 4%!',
    'Someone forgot to turn the FSC threshold back down. Classic.',
    'The sheath tank is full and the waste tank is empty. Living the dream.',
    'FMO controls say the gates are honest. Nice.',
    'Events per second just hit 8,000. Please do not let it clog now.',
    'Tubes 9 through 12 are on ice. Cowboy, buy us five more minutes!',
    'PI is doing its job: 92% live. Those cells were handled with love.',
    'Doublet discrimination on FSC-H vs FSC-A looks textbook.',
    'Hey, your boots are leaving footprints in the laser alignment. Just kidding. Keep shooting.'
  ];

  var ctx = null;          // personalization, refreshed each time the game opens
  var mode = null;         // title | intro | zoom | level | play | over
  var step = 0, paused = false;
  var g = null, keys = {}, loop = null, zoomTimer = null;
  var canvas = $('g-canvas');
  var sprite = new Image();
  sprite.onload = function () { if (mode) draw(); };
  sprite.src = 'assets/cowboy-sprite.png';

  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };

  function introLines() {
    return [
      'One day, in the Li lab...',
      'We were running a flow experiment, when all of a sudden the fluid drainage stopped vacuuming.',
      ctx.experiment
        ? 'The scientists were afraid that ' + ctx.experiment + ' would be ruined...'
        : 'The scientists were afraid that their experiment would be ruined...'
    ];
  }
  function levelLines() {
    return [
      { who: 'sci', text: ctx.firstName ? 'Hey there, ' + ctx.firstName + ', microscopic cowboy!' : 'Hey there, microscopic cowboy!' },
      { who: 'sci', text: "You're our last hope... we need you to keep the drainage tube clear from everything clogging it!" },
      { who: 'cow', text: "I'll do my best, innate immune exhaustion researchers..." }
    ];
  }

  // Lab chatter: personal lines first when we have something to personalize with.
  function chatterPool() {
    var lines = [];
    var n = ctx.firstName, x = ctx.experiment, ms = ctx.markers;
    if (x) {
      lines.push(x + ' tubes are looking pretty good!');
      lines.push('Halfway through the ' + x + ' tubes. Do not let it clog now!');
      lines.push('Saving the ' + x + ' compensation matrix... done. Phew.');
    }
    if (ms.length) {
      var m1 = pick(ms);
      lines.push(m1 + ' is getting really high compared to the control... woah...');
      lines.push('Those ' + pick(ms) + '+ cells are separating beautifully from the negatives.');
      if (ms.length > 1) {
        var others = ms.filter(function (m) { return m !== m1; });
        lines.push(m1 + ' vs ' + pick(others) + ' looks like a figure for the paper!');
      }
      var onPanel = ctx.placed.filter(function (p) { return p.panel; });
      if (onPanel.length) {
        var p = pick(onPanel);
        lines.push('Panel ' + p.panel + ' just finished. ' + p.marker + ' ' + p.fluor + ' is crisp!');
      }
    }
    if (n) {
      lines.push('Keep it up, ' + n + '! We just hit 10,000 events super fast!');
      lines.push(n + ', the PI gate says 94% live. Nice hands at the bench.');
      lines.push('Hang in there, ' + n + '. Only a few tubes left!');
    }
    return { personal: lines, generic: GENERIC };
  }
  function nextChatter() {
    var pool = chatterPool();
    var usePersonal = pool.personal.length && Math.random() < 0.65;
    var line = pick(usePersonal ? pool.personal : pool.generic);
    if (line === g.lastLine) line = pick(pool.generic);
    g.lastLine = line;
    return line;
  }

  /* ---------- screens ---------- */
  function show(id, on) { $(id).hidden = !on; }
  function render() {
    show('g-title', mode === 'title');
    show('g-intro', mode === 'intro' || mode === 'zoom');
    show('g-level', mode === 'level' || mode === 'play' || mode === 'over');
    show('g-talk', mode === 'level');
    show('g-controls', mode === 'play');
    show('g-over', mode === 'over');
    show('g-paused', mode === 'play' && paused);
    $('g-pause').textContent = paused ? 'RESUME' : 'PAUSE';
    if (mode === 'intro' || mode === 'zoom') {
      var lines = introLines();
      $('g-intro-text').textContent = lines[Math.min(step, lines.length - 1)];
      var building = step === 0;
      $('g-scene-img').src = building ? 'assets/building.png' : 'assets/canto.png';
      $('g-scene-img').alt = building ? 'Pixel art of the Li lab building on a sunny day' : 'Pixel art of the lab bench with the BD FACSCanto II';
      $('g-scene-img').className = mode === 'zoom' ? 'zooming' : '';
      $('g-fade').className = 'g-fade' + (mode === 'zoom' ? ' fading' : '');
      $('g-intro-next').disabled = mode === 'zoom';
    }
    if (mode === 'level') {
      var l = levelLines()[Math.min(step, 2)];
      $('g-talk-text').textContent = l.text;
      $('g-who-img').src = l.who === 'sci' ? 'assets/scientist.png' : 'assets/cowboy-portrait.png';
      $('g-who-name').textContent = l.who === 'sci' ? 'LI LAB SCIENTIST' : 'MICROSCOPIC COWBOY';
      var who = document.querySelector('#g-talk .who');
      who.classList.remove('pop'); void who.offsetWidth; who.classList.add('pop');
    }
    if (mode === 'over') {
      $('g-over-text').textContent = 'The tube clogged and the run was lost... but you held it for ' + Math.floor(g.t) + 's and scored ' + g.score + '. The Li lab salutes you' + (ctx.firstName ? ', ' + ctx.firstName : '') + ', microscopic cowboy.';
    }
    hud();
    if (mode === 'level' || mode === 'play' || mode === 'over') draw();
  }

  function setMode(m) {
    mode = m;
    if (m !== 'play') stopLoop();
    render();
    if (m === 'play') { paused = false; render(); canvas.focus(); startLoop(); }
  }

  /* ---------- game state ---------- */
  function newGame() {
    g = {
      cx: 60, cy: 110, fx: 1, fy: 0, bullets: [], bugs: [], film: [], boss: null, pickups: [], puffs: [],
      t: 0, score: 0, hp: 100, spawn: 3, bossT: 35, pickT: 14, chatT: 10, chatUntil: 0, chat: '', lastLine: '',
      last: null, cool: 0, slow: 0, auto: 0, moving: false, gallop: 0, flash: 0
    };
    keys = {};
  }

  function startLoop() {
    if (loop) return;
    var tick = function (now) {
      if (mode !== 'play' || paused) { loop = null; return; }
      var dt = g.last ? Math.min(0.05, (now - g.last) / 1000) : 0.016;
      g.last = now;
      update(dt);
      draw();
      hud();
      if (g.hp <= 0) { g.hp = 0; loop = null; setMode('over'); return; }
      loop = requestAnimationFrame(tick);
    };
    loop = requestAnimationFrame(tick);
  }
  function stopLoop() { if (loop) cancelAnimationFrame(loop); loop = null; }

  function setPaused(p) {
    if (mode !== 'play' || paused === p) return;
    paused = p;
    keys = {};
    if (p) stopLoop(); else { g.last = null; startLoop(); canvas.focus(); }
    render();
  }

  var lastHud = '';
  function hud() {
    if (!g) return;
    var hp = Math.max(0, Math.round(g.hp));
    var power = g.slow > 0 ? 'SLOW-MO ' + Math.ceil(g.slow) + 's' : (g.auto > 0 ? 'AUTO-FIRE ' + Math.ceil(g.auto) + 's' : '');
    var chat = mode === 'play' && g.t < g.chatUntil ? g.chat : '';
    var sig = [g.score, Math.floor(g.t), hp, power, chat].join('|');
    if (sig === lastHud) return;
    lastHud = sig;
    $('g-score').textContent = 'SCORE ' + g.score;
    $('g-time').textContent = 'TIME ' + Math.floor(g.t) + 's';
    $('g-power').textContent = power;
    $('g-hp').textContent = hp + '%';
    $('g-hp-meter').setAttribute('aria-valuenow', String(hp));
    var f = $('g-hp-fill');
    f.style.width = hp + '%';
    f.style.background = hp >= 60 ? '#7FD1C7' : (hp >= 30 ? '#F2B233' : '#FF6B6B');
    var c = $('g-chatter');
    if (chat) {
      if (c.textContent !== chat) { c.textContent = chat; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
      c.hidden = false;
    } else c.hidden = true;
  }

  var riverX = function (y) { return 200 + Math.sin(y / 38) * 14; };

  function fire() {
    if (!g || mode !== 'play' || paused || g.cool > 0) return;
    g.cool = 0.18;
    g.bullets.push({ x: g.cx + 12, y: g.cy + 10, vx: g.fx * 170, vy: g.fy * 170 });
  }

  function boom() {
    g.score += g.bugs.length * 10 + g.film.length * 5;
    g.bugs = []; g.film = [];
    if (g.boss) { g.boss.hp -= 6; if (g.boss.hp <= 0) { g.boss = null; g.score += 100; } }
    g.flash = 0.35;
  }

  function update(dt) {
    var k = keys;
    g.t += dt; g.cool -= dt;
    g.slow = Math.max(0, g.slow - dt); g.auto = Math.max(0, g.auto - dt); g.flash = Math.max(0, g.flash - dt);
    var ts = g.slow > 0 ? 0.35 : 1;
    var dx = (k.right ? 1 : 0) - (k.left ? 1 : 0), dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    g.moving = !!(dx || dy);
    if (g.moving) {
      g.fx = dx; g.fy = dy; if (dx && dy) { g.fx = dx * 0.7; g.fy = dy * 0.7; }
      g.gallop += dt * 9;
      if (Math.random() < dt * 12) g.puffs.push({ x: g.cx + (g.fx < 0 ? 22 : 2), y: g.cy + 24, life: 0.4 });
    } else g.gallop = 0;
    g.cx = Math.max(0, Math.min(W - 24, g.cx + dx * 72 * dt));
    g.cy = Math.max(14, Math.min(H - 26, g.cy + dy * 72 * dt));
    if (k.shoot || g.auto > 0) fire();
    g.puffs.forEach(function (p) { p.life -= dt; });
    g.puffs = g.puffs.filter(function (p) { return p.life > 0; });

    g.spawn -= dt * ts;
    if (g.spawn <= 0) {
      g.spawn = Math.max(1.3, 3.2 - g.t * 0.025);
      var side = Math.random() < 0.5 ? -1 : 1;
      var ty = 10 + Math.random() * (H - 20);
      g.bugs.push({ x: side < 0 ? -8 : W + 8, y: ty, ty: ty, speed: 14 + Math.random() * 10 + g.t * 0.15, wob: Math.random() * 6.28 });
    }
    g.bugs.forEach(function (b) {
      var rx = riverX(b.y);
      b.x += (rx > b.x ? 1 : -1) * b.speed * dt * ts;
      b.y = b.ty + Math.sin(g.t * 4 + b.wob) * 3;
      if (Math.abs(b.x - rx) < 3) { b.dead = true; g.film.push({ x: rx + (Math.random() * 10 - 5), y: b.y, age: 0 }); }
    });

    g.bossT -= dt;
    if (g.bossT <= 0 && !g.boss) {
      g.bossT = 45;
      g.boss = { x: riverX(0), y: -16, hp: 12, max: 12, parked: false, wob: 0 };
      g.chat = 'Uh oh... crystallized debris is coming down the tube!';
      g.chatUntil = g.t + 4;
      g.chatT = Math.max(g.chatT, 8);
    }
    if (g.boss) {
      var bs = g.boss;
      bs.wob += dt;
      if (!bs.parked) { bs.y += 16 * dt * ts; bs.x = riverX(bs.y); if (bs.y >= 80) bs.parked = true; }
      else g.hp -= 4 * dt * ts;
    }

    g.pickT -= dt;
    if (g.pickT <= 0) {
      g.pickT = 16 + Math.random() * 8;
      g.pickups.push({ x: 20 + Math.random() * 140, y: 20 + Math.random() * (H - 40), kind: pick(['slow', 'auto', 'boom']), life: 12 });
    }
    g.pickups.forEach(function (p) {
      p.life -= dt;
      if (Math.abs(p.x - (g.cx + 12)) < 14 && Math.abs(p.y - (g.cy + 12)) < 16) {
        p.life = 0;
        if (p.kind === 'slow') g.slow = 7;
        else if (p.kind === 'auto') g.auto = 8;
        else boom();
      }
    });
    g.pickups = g.pickups.filter(function (p) { return p.life > 0; });

    g.bullets.forEach(function (p) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -4 || p.x > W + 4 || p.y < -4 || p.y > H + 4) { p.dead = true; return; }
      for (var i = 0; i < g.bugs.length; i++) {
        var b = g.bugs[i];
        if (!b.dead && Math.abs(b.x - p.x) < 6 && Math.abs(b.y - p.y) < 6) { b.dead = true; p.dead = true; g.score += 10; return; }
      }
      for (var j = 0; j < g.film.length; j++) {
        var f = g.film[j];
        if (!f.dead && Math.abs(f.x - p.x) < 7 && Math.abs(f.y - p.y) < 6) { f.dead = true; p.dead = true; g.score += 5; return; }
      }
      if (g.boss && Math.abs(g.boss.x - p.x) < 14 && Math.abs(g.boss.y - p.y) < 12) {
        p.dead = true; g.boss.hp -= 1;
        if (g.boss.hp <= 0) { g.boss = null; g.score += 100; }
      }
    });
    g.bugs = g.bugs.filter(function (b) { return !b.dead; });
    g.bullets = g.bullets.filter(function (p) { return !p.dead; });
    g.film = g.film.filter(function (f) { return !f.dead; });
    g.film.forEach(function (f) { f.age += dt; });

    g.hp -= g.film.length * 0.45 * dt;
    if (!g.film.length && !g.boss) g.hp = Math.min(100, g.hp + 1.5 * dt);

    g.chatT -= dt;
    if (g.chatT <= 0) {
      g.chatT = 15 + Math.random() * 6;
      g.chat = nextChatter();
      g.chatUntil = g.t + 5;
    }
  }

  function draw() {
    var x = canvas.getContext('2d');
    var t = g ? g.t : 0, i;
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#C9A86A'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#B8955A';
    for (i = 0; i < 6; i++) x.fillRect(0, 20 + i * 30, W, 2);
    x.fillStyle = '#A5824C';
    for (i = 0; i < 40; i++) x.fillRect((i * 53) % W, (i * 37) % H, 3, 1);
    // machine rails top and bottom
    x.fillStyle = '#6E7580'; x.fillRect(0, 0, W, 6); x.fillRect(0, H - 6, W, 6);
    x.fillStyle = '#4C525C';
    for (i = 0; i < W; i += 16) { x.fillRect(i, 0, 8, 6); x.fillRect(i + 8, H - 6, 8, 6); }
    // circuit traces in the sand
    x.fillStyle = '#8C7A4E';
    x.fillRect(30, 60, 2, 50); x.fillRect(30, 60, 30, 2); x.fillRect(58, 60, 2, 20); x.fillRect(110, 130, 40, 2); x.fillRect(148, 100, 2, 32); x.fillRect(270, 40, 2, 40); x.fillRect(240, 80, 32, 2);
    CACTI.forEach(function (cc, n) {
      var cx = cc[0], cy = cc[1], tall = 14 + (n % 3) * 4;
      x.fillStyle = '#2F6B3F'; x.fillRect(cx + 1, cy + 1, 4, tall);
      x.fillStyle = '#3A7D4E'; x.fillRect(cx, cy, 4, tall);
      x.fillRect(cx - 4, cy + 5, 4, 5); x.fillRect(cx - 4, cy + 5, 2, 2);
      x.fillRect(cx + 4, cy + 3, 4, 5); x.fillRect(cx + 6, cy + 1, 2, 4);
      x.fillStyle = '#A9D65A'; x.fillRect(cx + 1, cy + 2, 1, 1); x.fillRect(cx + 2, cy + 7, 1, 1);
      if (n % 4 === 0) { x.fillStyle = '#E36C8F'; x.fillRect(cx + 1, cy - 2, 2, 2); }
    });
    // a little readout box with two status LEDs
    x.fillStyle = '#5A6170'; x.fillRect(120, 30, 20, 12);
    x.fillStyle = '#F2B233'; x.fillRect(124, 34, 3, 3); x.fillStyle = '#C2412D'; x.fillRect(130, 34, 3, 3);
    // the drainage tube river
    for (var y = 0; y < H; y += 2) {
      var rx = riverX(y);
      x.fillStyle = '#2E5F6E'; x.fillRect(rx - 14, y, 28, 2);
      x.fillStyle = g && g.hp < 35 ? '#6B7E3A' : '#3F8FA3'; x.fillRect(rx - 11, y, 22, 2);
      if (((y + Math.floor(t * 30)) % 24) < 4) { x.fillStyle = '#7FD1C7'; x.fillRect(rx - 4, y, 8, 2); }
    }
    if (g) {
      g.film.forEach(function (f) {
        x.fillStyle = f.age > 3 ? '#4E7D1F' : '#7DB33A'; x.fillRect(f.x - 5, f.y - 3, 10, 6);
        x.fillStyle = '#A9D65A'; x.fillRect(f.x - 3, f.y - 2, 3, 2);
      });
      g.bugs.forEach(function (b) {
        x.fillStyle = '#7DB33A'; x.fillRect(b.x - 4, b.y - 3, 8, 6);
        x.fillStyle = '#A9D65A'; x.fillRect(b.x - 2, b.y - 2, 2, 2);
        x.fillStyle = '#4E7D1F'; x.fillRect(b.x - 7, b.y, 3, 1); x.fillRect(b.x + 4, b.y - 1, 3, 1);
      });
      if (g.boss) {
        var bs = g.boss, bw = Math.sin(bs.wob * 3) * 1.5;
        x.fillStyle = '#1F2E3A'; x.fillRect(bs.x - 15, bs.y - 11, 30, 24);
        x.fillStyle = '#9FD3E8'; x.fillRect(bs.x - 13, bs.y - 9, 26, 20);
        x.fillStyle = '#E4F6FC'; x.fillRect(bs.x - 9, bs.y - 7 + bw, 6, 8); x.fillRect(bs.x + 2, bs.y - 3 - bw, 7, 10); x.fillRect(bs.x - 4, bs.y + 4, 5, 5);
        x.fillStyle = '#6AA9C4'; x.fillRect(bs.x - 13, bs.y + 7, 26, 4); x.fillRect(bs.x - 3, bs.y - 9, 2, 6);
        x.fillStyle = '#1F2E3A'; x.fillRect(bs.x - 6, bs.y - 1, 2, 2); x.fillRect(bs.x + 4, bs.y - 1, 2, 2);
        x.fillStyle = '#000000'; x.fillRect(bs.x - 15, bs.y - 17, 30, 4);
        x.fillStyle = '#FF6B6B'; x.fillRect(bs.x - 14, bs.y - 16, Math.max(0, 28 * bs.hp / bs.max), 2);
      }
      g.pickups.forEach(function (p) {
        if (p.life < 3 && Math.floor(t * 8) % 2 === 0) return;
        x.fillStyle = '#000000'; x.fillRect(p.x - 6, p.y - 6, 12, 12);
        if (p.kind === 'slow') { x.fillStyle = '#7FD1C7'; x.fillRect(p.x - 5, p.y - 5, 10, 10); x.fillStyle = '#1A1420'; x.fillRect(p.x - 1, p.y - 4, 2, 5); x.fillRect(p.x - 1, p.y, 4, 2); }
        else if (p.kind === 'auto') { x.fillStyle = '#F2B233'; x.fillRect(p.x - 5, p.y - 5, 10, 10); x.fillStyle = '#1A1420'; x.fillRect(p.x - 3, p.y - 1, 6, 2); x.fillRect(p.x - 1, p.y - 3, 2, 6); }
        else { x.fillStyle = '#FF6B6B'; x.fillRect(p.x - 5, p.y - 5, 10, 10); x.fillStyle = '#FFE08A'; x.fillRect(p.x - 2, p.y - 2, 4, 4); x.fillStyle = '#1A1420'; x.fillRect(p.x - 1, p.y - 5, 2, 2); }
      });
      x.fillStyle = '#F2B233';
      g.bullets.forEach(function (p) { x.fillRect(p.x - 1, p.y - 1, 3, 3); });
      x.fillStyle = '#E5D3A8';
      g.puffs.forEach(function (p) { var s = p.life > 0.2 ? 3 : 2; x.fillRect(p.x, p.y - s, s, s); });
    }
    var cx = g ? g.cx : 60, cy = g ? g.cy : 110;
    var frame = g && g.moving ? Math.floor(g.gallop) % 4 : 0;
    var bob = [0, -2, 0, -1][frame], tilt = [0, -0.07, 0, 0.07][frame];
    if (sprite.complete && sprite.naturalWidth) {
      x.save();
      x.translate(cx + 12, cy + 13 + bob);
      x.rotate(tilt);
      if (g && g.fx < 0) x.scale(-1, 1);
      x.drawImage(sprite, -12, -13, 24, 25);
      x.restore();
    } else {
      x.fillStyle = '#8A4A2A'; x.fillRect(cx + 6, cy + bob, 12, 4);
      x.fillStyle = '#2F5BD3'; x.fillRect(cx + 8, cy + 6 + bob, 8, 12);
    }
    if (g && g.flash > 0) { x.fillStyle = 'rgba(255, 224, 138, ' + (g.flash * 2) + ')'; x.fillRect(0, 0, W, H); }
    if (g && g.slow > 0) { x.fillStyle = 'rgba(127, 209, 199, 0.12)'; x.fillRect(0, 0, W, H); }
  }

  /* ---------- input ---------- */
  var KEYMAP = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', ' ': 'shoot' };
  canvas.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'p' || k === 'escape') { e.preventDefault(); e.stopPropagation(); setPaused(!paused); return; }
    var name = KEYMAP[k];
    if (!name) return;
    e.preventDefault();
    keys[name] = true;
    if (name === 'shoot') fire();
  });
  canvas.addEventListener('keyup', function (e) {
    var name = KEYMAP[e.key.toLowerCase()];
    if (name) { e.preventDefault(); keys[name] = false; }
  });
  canvas.addEventListener('blur', function () { keys = {}; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) setPaused(true); });
  $('game').addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mode !== 'play') close();
  });

  document.querySelectorAll('#game .pad').forEach(function (b) {
    var dir = b.dataset.dir;
    var on = function (e) { if (e.cancelable) e.preventDefault(); keys[dir] = true; };
    var off = function () { keys[dir] = false; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  });
  $('g-shoot').addEventListener('click', function () { fire(); canvas.focus(); });
  $('g-pause').addEventListener('click', function () { setPaused(!paused); });
  $('g-resume').addEventListener('click', function () { setPaused(false); });

  $('g-start').addEventListener('click', function () { newGame(); step = 0; setMode('intro'); $('g-intro-next').focus(); });
  $('g-intro-next').addEventListener('click', function () {
    if (mode !== 'intro') return;
    var last = introLines().length - 1;
    if (step === 0) {
      setMode('zoom');
      zoomTimer = setTimeout(function () { step = 1; setMode('intro'); $('g-intro-next').focus(); }, 1400);
    } else if (step < last) { step++; render(); }
    else {
      setMode('zoom');
      zoomTimer = setTimeout(function () { step = 0; setMode('level'); $('g-talk-next').focus(); }, 1400);
    }
  });
  $('g-talk-next').addEventListener('click', function () {
    if (step < 2) { step++; render(); }
    else { newGame(); setMode('play'); }
  });
  $('g-retry').addEventListener('click', function () { newGame(); lastHud = ''; setMode('play'); });
  $('g-back').addEventListener('click', close);
  $('g-close').addEventListener('click', close);

  var opener = null;
  function close() {
    clearTimeout(zoomTimer);
    stopLoop();
    keys = {};
    mode = null; paused = false;
    $('game').hidden = true;
    document.body.style.overflow = '';
    if (opener) opener.focus();
  }

  CF.game = {
    open: function (getContext) {
      ctx = getContext();
      opener = document.activeElement;
      newGame();
      lastHud = '';
      step = 0;
      $('game').hidden = false;
      document.body.style.overflow = 'hidden';
      setMode('title');
      $('g-start').focus();
    }
  };
})();
