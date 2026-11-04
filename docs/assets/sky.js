// Pixel sky lifted from OS_Joe (galaxy.tsx, ripples.ts, sky-image-warp.ts),
// pixel preset only. Pointer trails warp the art; clicks/taps send ripples.
const RIPPLE_SPEED = 0.32, RIPPLE_TAIL = 0.08, MAX_RIPPLES = 64;
const INK = [0.23, 1, 0.78];
const SKY_URL = new URL('./loading-pixel-sky.png', import.meta.url).href;

const vertexSource = `#version 300 es
in vec2 position;
void main(){ gl_Position=vec4(position,0.0,1.0); }`;

const fragmentSource = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform sampler2D pixel_sky;
uniform vec2 pixel_size;
uniform vec4 brush[12];
uniform vec2 swash[12];
uniform vec3 ink;
uniform vec3 ripples[${MAX_RIPPLES}];
uniform int rippleCount;
out vec4 outputColour;
void main(){
 vec2 grid=resolution;
 vec2 pixel=vec2(floor(gl_FragCoord.x),floor(resolution.y-gl_FragCoord.y));
 vec2 uv=(pixel+.5)/grid;
 float brushLight=0.0;
 vec2 warp=vec2(0.0);
 for(int i=0;i<12;i++){
  vec2 delta=(uv-brush[i].xy)*vec2(grid.x/grid.y,1.0);
  float age=brush[i].z;
  float life=max(0.0,1.0-age/1.5)*brush[i].w;
  vec2 direction=normalize(swash[i]+vec2(.0001,0.0));
  float along=dot(delta,direction);
  float across=dot(delta,vec2(-direction.y,direction.x));
  float halo=exp(-(along*along*55.0+across*across*340.0))*life;
  brushLight+=halo*.22;
  warp-=direction*halo*min(length(swash[i])*2.5,.09);
 }
 float ring=0.0;
 vec2 rippleWarp=vec2(0.0);
 for(int i=0;i<${MAX_RIPPLES};i++){
  if(i>=rippleCount){break;}
  vec2 delta=(uv-ripples[i].xy)*vec2(grid.x/grid.y,1.0);
  float age=ripples[i].z;
  vec2 farEdge=max(ripples[i].xy,vec2(1.0)-ripples[i].xy)*vec2(grid.x/grid.y,1.0);
  float reach=length(farEdge);
  float radius=age*${RIPPLE_SPEED.toFixed(2)};
  float fade=1.0-smoothstep(reach,reach+${RIPPLE_TAIL.toFixed(2)},radius);
  float wave=exp(-pow((length(delta)-radius)*60.0,2.0))*fade;
  ring+=wave;
  rippleWarp+=normalize(delta+vec2(.0001))*wave*.025;
 }
 vec2 displacement=clamp(warp,vec2(-.10),vec2(.10))+clamp(rippleWarp,vec2(-.06),vec2(.06));
 vec2 sample_uv=clamp(uv+displacement/vec2(grid.x/grid.y,1.0),0.0,1.0);
 float cover_scale=max(grid.x/pixel_size.x,grid.y/pixel_size.y);
 vec2 visible=grid/(pixel_size*cover_scale);
 sample_uv=(sample_uv-.5)*visible+.5;
 vec3 original=texture(pixel_sky,sample_uv).rgb;
 float brightness=max(original.r,max(original.g,original.b));
 vec3 painted=floor((ink*(.15+brightness*.85)+original*.55)*32.0+.5)/32.0;
 outputColour=vec4(mix(original,painted,clamp(brushLight+ring*.38,0.0,.8)),1.0);
}`;

function rippleReach(r, aspect) {
  return Math.hypot(Math.max(r.x, 1 - r.x) * aspect, Math.max(r.y, 1 - r.y));
}
function rippleOpacity(r, now, aspect) {
  const radius = (now - r.born) * RIPPLE_SPEED;
  const fade = Math.max(0, Math.min(1, (radius - rippleReach(r, aspect)) / RIPPLE_TAIL));
  return 1 - fade * fade * (3 - 2 * fade);
}

// Software warp for when WebGL2 is unavailable.
function warpSkyImage(source, output, width, height, waves, brushes, ink) {
  if (!waves.length && !brushes.length) { output.set(source); return; }
  const aspect = width / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + .5) / width, v = (y + .5) / height;
      let waveX = 0, waveY = 0, brushX = 0, brushY = 0, glow = 0;
      for (const wave of waves) {
        const dx = (u - wave.x) * aspect, dy = v - wave.y;
        const difference = (Math.hypot(dx, dy) - wave.radius) * 60;
        if (Math.abs(difference) > 4) continue;
        const strength = Math.exp(-difference * difference) * wave.opacity;
        const length = Math.hypot(dx + .0001, dy + .0001);
        waveX += (dx + .0001) / length * strength * .025;
        waveY += (dy + .0001) / length * strength * .025;
        glow += strength * .38;
      }
      for (const b of brushes) {
        const dx = (u - b.x) * aspect, dy = v - b.y;
        const length = Math.hypot(b.dx + .0001, b.dy);
        const dirX = (b.dx + .0001) / length, dirY = b.dy / length;
        const along = dx * dirX + dy * dirY, across = -dx * dirY + dy * dirX;
        const halo = Math.exp(-(along * along * 55 + across * across * 340)) * b.life;
        const strength = halo * Math.min(Math.hypot(b.dx, b.dy) * 2.5, .09);
        brushX -= dirX * strength; brushY -= dirY * strength;
        glow += halo * .22;
      }
      const warpX = Math.max(-.10, Math.min(.10, brushX)) + Math.max(-.06, Math.min(.06, waveX));
      const warpY = Math.max(-.10, Math.min(.10, brushY)) + Math.max(-.06, Math.min(.06, waveY));
      const sx = Math.max(0, Math.min(width - 1, Math.floor((u + warpX / aspect) * width)));
      const sy = Math.max(0, Math.min(height - 1, Math.floor((v + warpY) * height)));
      const from = (sy * width + sx) * 4, to = (y * width + x) * 4;
      const strength = Math.min(.8, glow);
      const brightness = Math.max(source[from], source[from + 1], source[from + 2]) / 255;
      for (let c = 0; c < 3; c++) {
        const original = source[from + c] / 255;
        const painted = Math.round((ink[c] * (.15 + brightness * .85) + original * .55) * 32) / 32;
        output[to + c] = (original * (1 - strength) + painted * strength) * 255;
      }
      output[to + 3] = 255;
    }
  }
}

let api = { ripple() {} };
export function skyRipple(x, y) { api.ripple(x, y); }

export function initSky() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sky';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.style.setProperty('--sky-image', `url("${SKY_URL}")`);
  const canvas = document.createElement('canvas');
  canvas.className = 'sky-canvas';
  const shade = document.createElement('div');
  shade.className = 'sky-shade';
  backdrop.append(canvas, shade);
  document.body.prepend(backdrop);

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' });
  const image = new Image();
  const loc = {};
  let usable = false, loaded = false, program = null;
  let fallback = null, ctx = null, sourcePixels = null, outputPixels = null;
  const fallbackSource = document.createElement('canvas');
  const fallbackContext = fallbackSource.getContext('2d', { willReadFrequently: true });
  let ripples = [], dots = [], aspect = 1, elapsed = 0, last = 0, frame = 0, lastInput = 0, previous = null;
  const rippleValues = new Float32Array(MAX_RIPPLES * 3);

  function ensureFallback() {
    if (fallback) return;
    fallback = document.createElement('canvas');
    fallback.className = 'sky-canvas';
    canvas.after(fallback);
    ctx = fallback.getContext('2d');
    sizeFallback();
  }
  function sizeFallback() {
    if (!fallback) return;
    fallback.width = Math.min(canvas.width, 320);
    fallback.height = Math.max(1, Math.round(canvas.height * fallback.width / canvas.width));
    if (!loaded || !fallbackContext) return;
    fallbackSource.width = fallback.width; fallbackSource.height = fallback.height;
    fallbackContext.imageSmoothingEnabled = false;
    const scale = Math.max(fallback.width / image.naturalWidth, fallback.height / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    fallbackContext.drawImage(image, (fallback.width - w) / 2, (fallback.height - h) / 2, w, h);
    sourcePixels = fallbackContext.getImageData(0, 0, fallback.width, fallback.height);
    outputPixels = fallbackContext.createImageData(fallback.width, fallback.height);
  }

  if (gl) {
    try {
      program = gl.createProgram();
      for (const [kind, code] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
        const shader = gl.createShader(kind);
        gl.shaderSource(shader, code); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('compile');
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('link');
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      for (const [p, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST]])
        gl.texParameteri(gl.TEXTURE_2D, p, v);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([11, 19, 30, 255]));
      gl.uniform1i(gl.getUniformLocation(program, 'pixel_sky'), 0);
      for (const name of ['resolution', 'pixel_size', 'brush[0]', 'swash[0]', 'ink', 'ripples[0]', 'rippleCount'])
        loc[name] = gl.getUniformLocation(program, name);
      usable = true;
    } catch { usable = false; }
  }
  if (!usable) ensureFallback();

  image.onload = () => {
    loaded = true;
    if (usable) {
      gl.activeTexture(gl.TEXTURE0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    sizeFallback();
    draw();
  };
  image.src = SKY_URL;

  function draw() {
    if (document.hidden) return;
    const webgl = usable && loaded;
    backdrop.dataset.renderer = webgl ? 'webgl' : loaded ? '2d' : 'loading';
    canvas.style.opacity = webgl ? '1' : '0';
    if (webgl) {
      if (fallback) fallback.style.opacity = '0';
      const values = new Float32Array(48), swashes = new Float32Array(24);
      dots.slice(-12).forEach((p, i) => { values.set([p.x, p.y, elapsed - p.born, 1], i * 4); swashes.set([p.dx, p.dy], i * 2); });
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(loc.resolution, canvas.width, canvas.height);
      gl.uniform2f(loc.pixel_size, image.naturalWidth || 1, image.naturalHeight || 1);
      gl.uniform4fv(loc['brush[0]'], values);
      gl.uniform2fv(loc['swash[0]'], swashes);
      gl.uniform3fv(loc.ink, INK);
      ripples.forEach((r, i) => rippleValues.set([r.x, r.y, elapsed - r.born], i * 3));
      gl.uniform3fv(loc['ripples[0]'], rippleValues);
      gl.uniform1i(loc.rippleCount, ripples.length);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (fallback && ctx && sourcePixels) {
      fallback.style.opacity = '1';
      warpSkyImage(sourcePixels.data, outputPixels.data, fallback.width, fallback.height,
        ripples.map(r => ({ x: r.x, y: r.y, radius: (elapsed - r.born) * RIPPLE_SPEED, opacity: rippleOpacity(r, elapsed, aspect) })),
        dots.map(p => ({ ...p, life: Math.max(0, 1 - (elapsed - p.born) / 1.5) })), INK);
      ctx.putImageData(outputPixels, 0, 0);
    }
  }
  const expire = () => { ripples = ripples.filter(r => (elapsed - r.born) * RIPPLE_SPEED < rippleReach(r, aspect) + RIPPLE_TAIL); };
  function tick(now) {
    frame = 0;
    if (document.hidden) return;
    if (!last) last = now;
    if (now - last >= 1000 / 30) {
      elapsed += Math.min((now - last) / 1000, 0.08);
      last = now;
      dots = dots.filter(p => elapsed - p.born < 1.5);
      expire();
      draw();
    }
    if (dots.length || ripples.length) frame = requestAnimationFrame(tick);
  }
  function wake() {
    draw();
    if (!frame && !document.hidden && (dots.length || ripples.length)) { last = 0; frame = requestAnimationFrame(tick); }
  }
  function resize() {
    const scale = Math.max(4, innerWidth / 560);
    canvas.width = Math.max(1, Math.floor(innerWidth / scale));
    canvas.height = Math.max(1, Math.floor(innerHeight / scale));
    aspect = canvas.width / canvas.height;
    sizeFallback();
    draw();
  }
  function addRipple(x, y) {
    expire();
    if (ripples.length < MAX_RIPPLES) ripples.push({ x, y, born: elapsed });
  }
  function point(event) {
    const now = performance.now();
    if (event.type === 'pointermove' && now - lastInput < 24) return;
    lastInput = now;
    const x = event.clientX / innerWidth, y = event.clientY / innerHeight;
    const follows = previous && now - previous.time < 180 && event.type !== 'pointerdown';
    dots.push({ x, y, dx: follows ? (x - previous.x) * innerWidth / innerHeight : 0.025, dy: follows ? y - previous.y : 0, born: elapsed });
    previous = { x, y, time: now };
    dots = dots.slice(-12);
    if (event.type === 'pointerdown') addRipple(x, y);
    if (!frame) wake();
  }

  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', wake);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); usable = false; ensureFallback(); resize(); });
  if (!calm) {
    addEventListener('pointermove', point, { passive: true });
    addEventListener('pointerdown', point, { passive: true });
    api = { ripple(x, y) { addRipple(x, y); if (!frame) wake(); } };
  }
}
