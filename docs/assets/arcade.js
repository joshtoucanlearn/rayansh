// Snake and Frogger lifted from OS_Joe (ArcadeGames.tsx), as plain JS.
const VECTORS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const KEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };

function machine(container, { width, height, label, help }) {
  const root = document.createElement('div');
  root.className = 'arcade-machine';
  root.innerHTML = `
    <div class="arcade-readout"><span data-score></span><strong data-status>PRESS START</strong></div>
    <canvas width="${width}" height="${height}" aria-label="${label}"></canvas>
    <div class="arcade-controls">
      <button type="button" class="game-button" data-start>START GAME</button>
      <div class="arcade-dpad" aria-label="Game controls">
        <button type="button" class="dpad-up" data-move="up" aria-label="Move up">▲</button>
        <button type="button" class="dpad-left" data-move="left" aria-label="Move left">◀</button>
        <button type="button" class="dpad-down" data-move="down" aria-label="Move down">▼</button>
        <button type="button" class="dpad-right" data-move="right" aria-label="Move right">▶</button>
      </div>
    </div>
    <p>${help}</p>`;
  container.append(root);
  return {
    root,
    canvas: root.querySelector('canvas'),
    score: root.querySelector('[data-score]'),
    status: root.querySelector('[data-status]'),
    start: root.querySelector('[data-start]'),
    onMove(handler) {
      root.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => handler(button.dataset.move)));
      const key = event => {
        const direction = KEYS[event.key];
        if (!direction || event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        handler(direction);
      };
      addEventListener('keydown', key);
      return () => removeEventListener('keydown', key);
    },
  };
}

export function mountSnake(container) {
  const ui = machine(container, { width: 360, height: 360, label: 'Playable Snake game', help: 'Arrow keys, WASD or the buttons.' });
  const context = ui.canvas.getContext('2d');
  let snake, food, direction, nextDirection, score = 0, timer = 0;
  const reset = () => { snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]; food = { x: 13, y: 9 }; direction = nextDirection = 'right'; };
  reset();
  const setScore = value => { score = value; ui.score.textContent = `SCORE ${String(score).padStart(4, '0')}`; };
  setScore(0);
  function draw() {
    const cell = ui.canvas.width / 18;
    context.fillStyle = '#020811';
    context.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
    context.strokeStyle = 'rgba(16,199,181,.08)';
    context.lineWidth = 1;
    for (let line = 0; line <= 18; line++) {
      context.beginPath(); context.moveTo(line * cell, 0); context.lineTo(line * cell, ui.canvas.height); context.stroke();
      context.beginPath(); context.moveTo(0, line * cell); context.lineTo(ui.canvas.width, line * cell); context.stroke();
    }
    context.fillStyle = '#f4bf4f';
    context.fillRect(food.x * cell + 4, food.y * cell + 4, cell - 8, cell - 8);
    snake.forEach((part, index) => {
      context.fillStyle = index === 0 ? '#25f2db' : '#10c7b5';
      context.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
    });
  }
  function step() {
    direction = nextDirection;
    const vector = VECTORS[direction];
    const next = { x: snake[0].x + vector.x, y: snake[0].y + vector.y };
    const hitWall = next.x < 0 || next.x >= 18 || next.y < 0 || next.y >= 18;
    if (hitWall || snake.some(part => part.x === next.x && part.y === next.y)) {
      clearInterval(timer); timer = 0;
      ui.status.textContent = 'GAME OVER';
      ui.start.textContent = 'START GAME';
      return;
    }
    snake.unshift(next);
    if (next.x === food.x && next.y === food.y) {
      setScore(score + 10);
      let candidate;
      do candidate = { x: Math.floor(Math.random() * 18), y: Math.floor(Math.random() * 18) };
      while (snake.some(part => part.x === candidate.x && part.y === candidate.y));
      food = candidate;
    } else snake.pop();
    draw();
  }
  ui.start.addEventListener('click', () => {
    reset(); setScore(0);
    ui.status.textContent = 'RUNNING';
    ui.start.textContent = 'RESTART';
    clearInterval(timer);
    timer = setInterval(step, 120);
    draw();
  });
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const unbind = ui.onMove(requested => { if (requested !== opposite[direction]) nextDirection = requested; });
  draw();
  return () => { clearInterval(timer); unbind(); };
}

// Five roads, each busier and faster than the last. Lane: [row, speed, car length, cars].
// Negative speed drives left. Level 1 is gentle; level 5 is tough but leaves gaps.
const LEVELS = [
  [[14, .028, 2, 1], [11, -.032, 3, 1], [8, .030, 2, 1], [5, -.026, 2, 1]],
  [[15, .036, 2, 1], [13, -.040, 3, 1], [10, .044, 2, 2], [7, -.038, 2, 1], [4, .042, 3, 1]],
  [[15, .046, 2, 2], [13, -.050, 3, 1], [11, .054, 2, 2], [8, -.048, 2, 2], [6, .052, 3, 1], [4, -.058, 2, 2]],
  [[16, .052, 2, 2], [14, -.058, 3, 2], [12, .062, 2, 2], [10, -.056, 2, 2], [8, .066, 3, 1], [6, -.060, 2, 2], [4, .064, 2, 2]],
  [[16, .060, 2, 2], [15, -.066, 3, 2], [13, .072, 2, 2], [12, -.064, 2, 3], [10, .078, 3, 2], [8, -.070, 2, 2], [6, .074, 2, 3], [4, -.082, 3, 2]],
];
const CAR_COLOURS = ['#ff3153', '#f4bf4f', '#8d75ff', '#ff7d4d', '#5db7ff', '#ff6fd8', '#aef1ff', '#c4f347'];
const CONFETTI = ['#25f2db', '#f4bf4f', '#ff7d4d', '#8d75ff', '#aeea6d', '#ff6fd8', '#eef7f8'];

export function mountFrogger(container) {
  const ui = machine(container, { width: 360, height: 400, label: 'Playable Frogger game', help: 'Arrow keys, WASD or the buttons. Reach the green zone.' });
  const context = ui.canvas.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let level = 0, cars = [], frog = { x: 8, y: 18 }, lives = 3, score = 0;
  let running = false, celebrating = false, animation = 0, lastTime = 0, party = [], partyStart = 0;

  function buildRoad() {
    cars = [];
    LEVELS[level].forEach(([y, speed, length, count], lane) => {
      const span = 19 + length;
      for (let i = 0; i < count; i++) {
        cars.push({ y, speed, length, x: ((lane * 5 + i * span / count) % span) - length, colour: CAR_COLOURS[(lane + level) % CAR_COLOURS.length] });
      }
    });
    Object.assign(ui.canvas.dataset, { level: level + 1, cars: cars.length, lanes: LEVELS[level].length,
      speed: Math.max(...cars.map(car => Math.abs(car.speed))).toFixed(3) });
  }
  const readout = () => { ui.score.textContent = `LEVEL ${level + 1}/5 · SCORE ${String(score).padStart(4, '0')} · LIVES ${lives}`; };

  function drawFrog(x, y, size) {
    context.fillStyle = '#aeea6d';
    context.fillRect(x + size * .1, y + size * .1, size * .8, size * .8);
    context.fillStyle = '#020811';
    const eye = Math.max(3, Math.round(size / 7));
    context.fillRect(x + size * .2, y + size * .2, eye, eye);
    context.fillRect(x + size * .8 - eye, y + size * .2, eye, eye);
  }
  function draw() {
    const cell = ui.canvas.width / 18;
    context.fillStyle = '#06111f';
    context.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
    context.fillStyle = '#0a513f';
    context.fillRect(0, 0, ui.canvas.width, cell * 2);
    context.fillRect(0, cell * 17, ui.canvas.width, cell * 3);
    const rows = LEVELS[level].map(lane => lane[0]);
    context.fillStyle = '#0d1a2b';
    rows.forEach(row => context.fillRect(0, row * cell, ui.canvas.width, cell));
    context.fillStyle = 'rgba(238,247,248,.16)';
    rows.forEach(row => { for (let x = 0; x < 18; x += 2) context.fillRect(x * cell, row * cell - 1, cell, 2); });
    cars.forEach(car => {
      context.fillStyle = car.colour;
      context.fillRect(car.x * cell, car.y * cell + 3, car.length * cell, cell - 6);
      context.fillStyle = '#020811';
      const windscreen = car.speed > 0 ? car.x + car.length - .8 : car.x + .35;
      context.fillRect(windscreen * cell, car.y * cell + 6, cell * .45, cell * .35);
    });
    drawFrog(frog.x * cell, frog.y * cell, cell);
    context.fillStyle = '#eef7f8';
    context.font = "16px 'FLM1 Pixel', monospace";
    context.textBaseline = 'middle';
    context.fillText(`LEVEL ${level + 1}`, 8, cell);
  }
  function drawParty(time) {
    const { width, height } = ui.canvas;
    const t = (time - partyStart) / 1000;
    context.fillStyle = '#06111f';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#0a513f';
    context.fillRect(0, height * .72, width, height * .28);
    party.forEach(bit => {
      const y = (bit.y + t * bit.fall * 60) % (height + 20) - 10;
      const x = bit.x + Math.sin(t * bit.wobble + bit.phase) * 8;
      context.fillStyle = bit.colour;
      if (bit.sparkle) {
        const on = Math.sin(t * 6 + bit.phase) > 0;
        if (on) { context.fillRect(x - 1, y - 5, 2, 10); context.fillRect(x - 5, y - 1, 10, 2); }
      } else context.fillRect(Math.round(x), Math.round(y), bit.size, bit.size);
    });
    const size = 72;
    const hop = calm ? 0 : Math.abs(Math.sin(t * 4.2)) * 70;
    const squash = calm ? 0 : Math.max(0, 1 - Math.abs(Math.sin(t * 4.2)) * 6) * 8;
    const x = width / 2 - size / 2, y = height * .72 - size - hop;
    context.fillStyle = 'rgba(2,8,17,.35)';
    context.fillRect(width / 2 - 30 + hop / 6, height * .72 - 4, 60 - hop / 3, 6);
    context.save();
    context.translate(0, squash);
    drawFrog(x - squash / 2, y, size);
    context.fillStyle = '#aeea6d';
    const arm = Math.sin(t * 8.4) > 0 ? -18 : -8;
    context.fillRect(x - 8, y + 20 + arm, 10, 22);
    context.fillRect(x + size - 2, y + 20 + arm, 10, 22);
    context.fillStyle = '#020811';
    context.fillRect(x + size * .35, y + size * .58, size * .3, 6);
    context.restore();
    context.fillStyle = '#f4bf4f';
    context.font = "28px 'FLM1 Pixel', monospace";
    context.textAlign = 'center';
    context.fillText('YOU DID IT!', width / 2, height * .16);
    context.textAlign = 'start';
  }
  function celebrate() {
    running = false;
    celebrating = true;
    ui.canvas.dataset.celebrating = 'true';
    ui.status.textContent = 'ALL 5 LEVELS!';
    ui.start.textContent = 'PLAY AGAIN';
    party = Array.from({ length: 70 }, (_, i) => ({ x: Math.random() * ui.canvas.width, y: Math.random() * ui.canvas.height,
      fall: .4 + Math.random() * .9, wobble: 1 + Math.random() * 3, phase: Math.random() * 6, size: 4 + Math.floor(Math.random() * 4),
      colour: CONFETTI[i % CONFETTI.length], sparkle: i % 7 === 0 }));
    partyStart = performance.now();
    drawParty(partyStart);
    if (!calm && !animation) animation = requestAnimationFrame(loop);
  }
  function crossed() {
    score += 100;
    if (level === LEVELS.length - 1) { readout(); celebrate(); return; }
    level += 1;
    lives = 3;
    frog = { x: 8, y: 18 };
    buildRoad();
    readout();
    ui.status.textContent = `LEVEL ${level + 1}!`;
    draw();
  }
  function loop(time) {
    animation = 0;
    if (celebrating) {
      drawParty(time);
      animation = requestAnimationFrame(loop);
      return;
    }
    if (!running) return;
    if (time - lastTime > 22) {
      lastTime = time;
      cars.forEach(car => {
        car.x += car.speed;
        if (car.speed > 0 && car.x > 19) car.x = -car.length;
        if (car.speed < 0 && car.x < -car.length) car.x = 19;
      });
      if (cars.some(car => frog.y === car.y && frog.x + .75 > car.x && frog.x < car.x + car.length)) {
        lives -= 1; readout();
        frog = { x: 8, y: 18 };
        if (lives <= 0) { running = false; ui.status.textContent = 'GAME OVER'; ui.start.textContent = 'START GAME'; }
        else ui.status.textContent = 'SPLAT! KEEP GOING';
      }
      draw();
    }
    if (running) animation = requestAnimationFrame(loop);
  }
  function start() {
    celebrating = false;
    delete ui.canvas.dataset.celebrating;
    cancelAnimationFrame(animation); animation = 0;
    level = 0; lives = 3; score = 0; frog = { x: 8, y: 18 };
    buildRoad(); readout();
    ui.status.textContent = 'CROSS THE ROAD';
    ui.start.textContent = 'RESTART';
    running = true;
    animation = requestAnimationFrame(loop);
    draw();
  }
  ui.start.addEventListener('click', start);
  const unbind = ui.onMove(requested => {
    if (!running) return;
    const vector = VECTORS[requested];
    frog = { x: Math.max(0, Math.min(17, frog.x + vector.x)), y: Math.max(0, Math.min(19, frog.y + vector.y)) };
    if (frog.y <= 1) crossed();
    else draw();
  });
  buildRoad(); readout(); draw();
  document.fonts?.ready.then(() => { if (!running && !celebrating) draw(); });
  return () => { running = false; celebrating = false; cancelAnimationFrame(animation); unbind(); };
}
