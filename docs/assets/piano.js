// The Toucan Learn hero piano (hero-piano.js + hero-keyboard.js), standalone.
// Same FM voice, same keys and computer-key map; the sky ripples as you play.
import { songs } from './songs.js';
import { skyRipple } from './sky.js';

const MAX_VOICES = 8, FLOOR = 0.0001, PEAK = 0.22, ATTACK = 0.012, RELEASE = 0.25;
const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEY_NOTES = new Map([
  ['z', 'C3'], ['s', 'C#3'], ['x', 'D3'], ['d', 'D#3'], ['c', 'E3'], ['v', 'F3'], ['g', 'F#3'], ['b', 'G3'],
  ['h', 'G#3'], ['n', 'A3'], ['j', 'A#3'], ['m', 'B3'], [',', 'C4'], ['l', 'C#4'], ['.', 'D4'], [';', 'D#4'], ['/', 'E4'],
  ['q', 'F4'], ['2', 'F#4'], ['w', 'G4'], ['3', 'G#4'], ['e', 'A4'], ['4', 'A#4'], ['r', 'B4'], ['t', 'C5'],
  ['6', 'C#5'], ['y', 'D5'], ['7', 'D#5'], ['u', 'E5'], ['i', 'F5'], ['9', 'F#5'], ['o', 'G5'], ['0', 'G#5'],
  ['p', 'A5'], ['-', 'A#5'], ['[', 'B5'], [']', 'C6'],
]);
const midi = note => (Number(note.at(-1)) + 1) * 12 + PITCHES.indexOf(note.slice(0, -1));

let audio = null, master = null;
const voices = [], tails = new Set();

function frequencyFor(note) {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(note);
  return 440 * 2 ** (((Number(octave) + 1) * 12 + SEMITONES[letter] + (sharp ? 1 : 0) - 69) / 12);
}

function soundNote(frequency) {
  const now = audio.currentTime;
  const decay = 1.6 * (440 / frequency) ** 0.15;
  const end = now + ATTACK + decay;
  const carrier = audio.createOscillator(), modulator = audio.createOscillator();
  const tine = audio.createOscillator(), shimmer = audio.createOscillator();
  const modulation = audio.createGain(), bark = audio.createGain(), filter = audio.createBiquadFilter();
  const envelope = audio.createGain(), tremolo = audio.createGain(), tremoloDepth = audio.createGain();
  const panner = audio.createStereoPanner(), panDepth = audio.createGain();
  const oscillators = [carrier, modulator, tine, shimmer];
  const nodes = [...oscillators, modulation, bark, filter, envelope, tremolo, tremoloDepth, panner, panDepth];
  const warmth = Math.min(1, (330 / frequency) ** 0.6);
  oscillators.forEach(o => { o.type = 'sine'; });
  carrier.frequency.setValueAtTime(frequency, now);
  modulator.frequency.setValueAtTime(frequency, now);
  modulation.gain.setValueAtTime(frequency * 1.3 * warmth, now);
  modulation.gain.exponentialRampToValueAtTime(frequency * 0.12 * warmth, now + 0.35);
  modulator.connect(modulation); modulation.connect(carrier.frequency);
  tine.frequency.setValueAtTime(frequency * 7, now);
  bark.gain.setValueAtTime(frequency * 0.04 * warmth, now);
  bark.gain.exponentialRampToValueAtTime(frequency * 0.0001, now + 0.04);
  tine.connect(bark); bark.connect(carrier.frequency);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(2000, Math.max(1100, frequency * 3)), now);
  filter.Q.setValueAtTime(0.4, now);
  envelope.gain.setValueAtTime(FLOOR, now);
  envelope.gain.linearRampToValueAtTime(PEAK, now + ATTACK);
  envelope.gain.exponentialRampToValueAtTime(FLOOR, end);
  shimmer.frequency.setValueAtTime(4.5, now);
  tremolo.gain.setValueAtTime(0.94, now);
  tremoloDepth.gain.setValueAtTime(0.05, now);
  panner.pan.setValueAtTime(0, now);
  panDepth.gain.setValueAtTime(0.12, now);
  shimmer.connect(tremoloDepth); tremoloDepth.connect(tremolo.gain);
  shimmer.connect(panDepth); panDepth.connect(panner.pan);
  carrier.connect(filter); filter.connect(envelope); envelope.connect(tremolo); tremolo.connect(panner); panner.connect(master);
  const voice = {
    finish() {
      const index = voices.indexOf(voice);
      if (index !== -1) voices.splice(index, 1);
      tails.delete(voice);
      carrier.onended = null;
      nodes.forEach(node => node.disconnect());
    },
    release() {
      const at = audio.currentTime, elapsed = Math.max(0, at - now);
      const level = elapsed < ATTACK ? FLOOR + (PEAK - FLOOR) * elapsed / ATTACK : PEAK * (FLOOR / PEAK) ** Math.min(1, (elapsed - ATTACK) / decay);
      envelope.gain.cancelScheduledValues(at);
      envelope.gain.setValueAtTime(Math.max(FLOOR, level), at);
      envelope.gain.exponentialRampToValueAtTime(FLOOR, at + RELEASE);
      oscillators.forEach(o => o.stop(at + RELEASE));
      tails.add(voice);
    },
  };
  if (voices.length === MAX_VOICES) {
    if (tails.size === MAX_VOICES) tails.values().next().value.finish();
    voices.shift().release();
  }
  voices.push(voice);
  carrier.onended = () => voice.finish();
  oscillators.forEach(o => { o.start(now); o.stop(end + 0.02); });
}

function playNote(note) {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) return false;
  try {
    if (!audio) {
      audio = new AudioContext();
      master = audio.createGain();
      const compressor = audio.createDynamicsCompressor();
      master.gain.setValueAtTime(0.24, audio.currentTime);
      compressor.threshold.setValueAtTime(-18, audio.currentTime);
      compressor.knee.setValueAtTime(18, audio.currentTime);
      compressor.ratio.setValueAtTime(6, audio.currentTime);
      compressor.attack.setValueAtTime(0.003, audio.currentTime);
      compressor.release.setValueAtTime(0.2, audio.currentTime);
      master.connect(compressor);
      compressor.connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    if (audio.state === 'closed') return false;
    soundNote(frequencyFor(note));
    return true;
  } catch { return false; }
}

export function mountPiano(container) {
  const song = songs[Math.floor(Math.random() * songs.length)];
  let nextNote = 0;
  const root = document.createElement('div');
  root.className = 'piano-machine';
  root.innerHTML = '<p class="piano-hint">Play with your keyboard: bottom rows for low notes, top rows for high notes.</p><div class="piano-scroll"><div class="piano-keys" role="group" aria-label="Piano keyboard"></div></div>';
  container.append(root);
  const keys = root.querySelector('.piano-keys');
  const scroll = root.querySelector('.piano-scroll');
  const byNote = new Map(), names = new Map();
  let white = 0;
  for (let m = midi('C3'); m <= midi('C6'); m++) {
    const pitch = PITCHES[m % 12], note = pitch + (Math.floor(m / 12) - 1);
    const black = pitch.includes('#');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `piano-key piano-key--${black ? 'black' : 'white'}`;
    button.dataset.note = note;
    const label = black ? `${pitch[0]} sharp ${note.at(-1)}` : note;
    button.setAttribute('aria-label', label);
    if (black) button.style.left = `calc(100% * ${white} / 22)`;
    else white++;
    names.set(button, label);
    byNote.set(note, button);
    keys.append(button);
  }
  for (const [key, note] of KEY_NOTES) byNote.get(note).dataset.key = key.toUpperCase();

  let highlighted;
  function keepInView() {
    if (!highlighted) return;
    const k = highlighted.getBoundingClientRect(), v = scroll.getBoundingClientRect();
    if (k.left < v.left + 12 || k.right > v.right - 12) scroll.scrollTo({ left: scroll.scrollLeft + (k.left + k.right - v.left - v.right) / 2, behavior: 'instant' });
  }
  function highlight() {
    if (highlighted) { highlighted.classList.remove('is-next'); highlighted.setAttribute('aria-label', names.get(highlighted)); }
    highlighted = byNote.get(song.notes[nextNote]);
    if (highlighted) { highlighted.classList.add('is-next'); highlighted.setAttribute('aria-label', `${names.get(highlighted)}, next note`); }
    keepInView();
  }
  const timers = new Map(), pointers = new Map(), held = new Set();
  function press(button) {
    if (!button) return;
    const note = button.dataset.note;
    if (playNote(note) && note === song.notes[nextNote]) { nextNote = (nextNote + 1) % song.notes.length; highlight(); }
    button.classList.add('is-pressed');
    clearTimeout(timers.get(button));
    timers.set(button, setTimeout(() => { button.classList.remove('is-pressed'); timers.delete(button); }, 150));
    const box = button.getBoundingClientRect();
    skyRipple((box.left + box.width / 2) / innerWidth, (box.top + box.height / 2) / innerHeight);
  }
  const keyFrom = element => { const key = element?.closest?.('[data-note]'); return key && keys.contains(key) ? key : null; };
  keys.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    const key = keyFrom(event.target);
    if (!key) return;
    event.preventDefault();
    key.focus({ preventScroll: true });
    keys.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, key);
    press(key);
  });
  keys.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    const key = keyFrom(document.elementFromPoint(event.clientX, event.clientY));
    if (key && key !== pointers.get(event.pointerId)) press(key);
    pointers.set(event.pointerId, key);
  });
  const release = event => pointers.delete(event.pointerId);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) keys.addEventListener(type, release);
  keys.addEventListener('click', event => { if (event.detail === 0) press(keyFrom(event.target)); });
  const keydown = event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const key = event.key.toLowerCase();
    const note = KEY_NOTES.get(key);
    if (!note) return;
    event.preventDefault();
    if (event.repeat || held.has(key)) return;
    held.add(key);
    press(byNote.get(note));
  };
  const keyup = event => held.delete(event.key.toLowerCase());
  const clear = () => { held.clear(); pointers.clear(); };
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);
  addEventListener('blur', clear);
  const observer = new ResizeObserver(keepInView);
  observer.observe(scroll);
  highlight();
  return () => {
    removeEventListener('keydown', keydown);
    removeEventListener('keyup', keyup);
    removeEventListener('blur', clear);
    observer.disconnect();
    timers.forEach(clearTimeout);
  };
}
