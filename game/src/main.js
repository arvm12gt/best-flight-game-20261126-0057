// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: title, play, paused, crashed, landed.
// ?shot=cover|ring|approach|cockpit (with &seed=N, ignored — the world is one fixed valley)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, STEP } from './config.js';
import { createFlight, EVENT_CRASH, EVENT_FUEL_EMPTY, EVENT_FUEL_LOW, EVENT_LANDED, EVENT_LEG, EVENT_RING, stepFlight } from './flight.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_LIGHT, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LANDED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const BEST_KEY_NAME = BEST_KEY;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY_NAME) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY_NAME, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name);
  const f = scene.flight;
  let painted = 0;
  function paint() {
    renderer.draw(f, SCREEN_PLAY, scene.mode, 0, 0, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let f = createFlight();
  let screen = SCREEN_TITLE;
  let mode = 'chase';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let message = null;
  let messageUntil = 0;

  function announce(text) {
    status.textContent = text;
  }

  function setCamera() {
    const fx = Math.sin(f.heading);
    const fz = Math.cos(f.heading);
    const tx = f.x - fx * 44;
    const ty = f.y + 7;
    const tz = f.z - fz * 44;
    if (f.camX === undefined) {
      f.camX = tx;
      f.camY = ty;
      f.camZ = tz;
    } else {
      f.camX += (tx - f.camX) * 0.12;
      f.camY += (ty - f.camY) * 0.12;
      f.camZ += (tz - f.camZ) * 0.12;
    }
  }

  function showMessage(text, seconds) {
    message = text;
    messageUntil = performance.now() + seconds * 1000;
  }

  function startGame() {
    f = createFlight();
    setCamera();
    accumulator = 0;
    screen = SCREEN_PLAY;
    message = null;
    audio.unlock();
    announce('Flying. Thread the rings, then land on Kestrel Field.');
  }

  function endGame(landed) {
    screen = landed ? SCREEN_LANDED : SCREEN_OVER;
    if (f.score > best) {
      best = f.score;
      saveBest(best);
    }
    announce(landed ? `Landed. Score ${f.score}. Best ${best}.` : `Crashed. Score ${f.score}. Best ${best}.`);
  }

  function step() {
    const ctl = input.controls();
    const events = stepFlight(f, ctl, STEP);
    if (events & EVENT_RING) {
      audio.ring();
      showMessage(`RING ${f.ringsHit} / 8 — +100`, 1.6);
      announce(`Ring ${f.ringsHit} of 8.`);
    }
    if (events & EVENT_LEG) showMessage('LEG COMPLETE', 1.8);
    if (events & EVENT_FUEL_LOW) showMessage('LOW FUEL', 2.5);
    if (events & EVENT_FUEL_EMPTY) showMessage('FUEL EMPTY — GLIDING', 2.5);
    if (events & EVENT_LANDED) {
      audio.land();
      endGame(true);
    } else if (events & EVENT_CRASH) {
      audio.crash();
      endGame(false);
    }
    audio.ambience(f.throttle, f.speed);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CAMERA && screen === SCREEN_PLAY) {
      mode = mode === 'chase' ? 'cockpit' : 'chase';
      announce(mode === 'cockpit' ? 'Cockpit view.' : 'Chase view.');
    }
    if (actions & ACTION_LIGHT && screen === SCREEN_PLAY) {
      f.searchlight = !f.searchlight;
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) startGame();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_LANDED)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    setCamera();
    // On the title screen the world holds still and the camera drifts, so the
    // briefing sits over a living valley rather than a frozen frame.
    const look =
      screen === SCREEN_TITLE
        ? { yaw: Math.sin(now / 3500) * 0.18, pitch: Math.sin(now / 5200) * 0.04 }
        : input.look(1 / 60);
    if (message && now > messageUntil) message = null;
    renderer.draw(f, screen, mode, look.yaw, look.pitch, message);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  setCamera();
  announce('Dusk Rescue. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
