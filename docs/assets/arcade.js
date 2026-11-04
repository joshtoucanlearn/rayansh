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

export function mountFrogger(container) {
  const ui = machine(container, { width: 360, height: 400, label: 'Playable Frogger game', help: 'Arrow keys, WASD or the buttons. Reach the green zone.' });
  const context = ui.canvas.getContext('2d');
  const cars = [
    { x: 1, y: 15, speed: .035, length: 2, colour: '#ff3153' },
    { x: 11, y: 13, speed: -.052, length: 3, colour: '#f4bf4f' },
    { x: 5, y: 10, speed: .066, length: 2, colour: '#8d75ff' },
    { x: 14, y: 7, speed: -.043, length: 2, colour: '#ff7d4d' },
    { x: 2, y: 4, speed: .058, length: 3, colour: '#5db7ff' },
  ];
  let frog = { x: 8, y: 18 }, lives = 3, score = 0, running = false, animation = 0, lastTime = 0;
  const readout = () => { ui.score.textContent = `SCORE ${String(score).padStart(4, '0')} · LIVES ${lives}`; };
  readout();
  function draw() {
    const cell = ui.canvas.width / 18;
    context.fillStyle = '#06111f';
    context.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
    context.fillStyle = '#0a513f';
    context.fillRect(0, 0, ui.canvas.width, cell * 2);
    context.fillRect(0, cell * 17, ui.canvas.width, cell * 3);
    context.fillStyle = 'rgba(238,247,248,.16)';
    [4, 7, 10, 13, 15].forEach(row => { for (let x = 0; x < 18; x += 2) context.fillRect(x * cell, row * cell - 1, cell, 2); });
    cars.forEach(car => {
      context.fillStyle = car.colour;
      context.fillRect(car.x * cell, car.y * cell + 3, car.length * cell, cell - 6);
      context.fillStyle = '#020811';
      context.fillRect((car.x + .35) * cell, car.y * cell + 6, cell * .45, cell * .35);
    });
    context.fillStyle = '#aeea6d';
    context.fillRect(frog.x * cell + 2, frog.y * cell + 2, cell - 4, cell - 4);
    context.fillStyle = '#020811';
    context.fillRect(frog.x * cell + 5, frog.y * cell + 5, 3, 3);
    context.fillRect(frog.x * cell + cell - 8, frog.y * cell + 5, 3, 3);
  }
  function animate(time) {
    animation = 0;
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
    if (running) animation = requestAnimationFrame(animate);
  }
  ui.start.addEventListener('click', () => {
    frog = { x: 8, y: 18 }; lives = 3; score = 0; readout();
    ui.status.textContent = 'CROSS THE ROAD';
    ui.start.textContent = 'RESTART';
    running = true;
    if (!animation) animation = requestAnimationFrame(animate);
    draw();
  });
  const unbind = ui.onMove(requested => {
    if (!running) return;
    const vector = VECTORS[requested];
    frog = { x: Math.max(0, Math.min(17, frog.x + vector.x)), y: Math.max(0, Math.min(19, frog.y + vector.y)) };
    if (frog.y <= 1) { score += 100; readout(); ui.status.textContent = 'HOME! +100'; frog = { x: 8, y: 18 }; }
    draw();
  });
  draw();
  return () => { running = false; cancelAnimationFrame(animation); unbind(); };
}
