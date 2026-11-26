// Keyboard and mouse: arrows steer, W/S throttle, C camera, L searchlight, P pause,
// Space confirms, R restarts. Mouse drag looks around (the view eases back on its own).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_CAMERA = 8;
export const ACTION_LIGHT = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lookYaw = 0;
  let lookPitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function keyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyR') actions |= ACTION_RESTART;
    if (e.code === 'KeyC') actions |= ACTION_CAMERA;
    if (e.code === 'KeyL') actions |= ACTION_LIGHT;
  }

  function keyUp(e) {
    keys.delete(e.code);
  }

  function mouseDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function mouseMove(e) {
    if (!dragging) return;
    lookYaw -= (e.clientX - lastX) * 0.004;
    lookPitch -= (e.clientY - lastY) * 0.003;
    lookPitch = Math.max(-0.5, Math.min(0.5, lookPitch));
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function mouseUp() {
    dragging = false;
  }

  function click() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('mousemove', mouseMove);
  window.addEventListener('mouseup', mouseUp);
  canvas.addEventListener('click', click);

  return {
    /** Pitch/roll/throttle the pilot is asking for this frame, -1..1 each. */
    controls() {
      const pitch = (keys.has('ArrowUp') ? 1 : 0) + (keys.has('ArrowDown') ? -1 : 0);
      const roll = (keys.has('ArrowRight') ? 1 : 0) + (keys.has('ArrowLeft') ? -1 : 0);
      const throttle = (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
      return { pitch, roll, throttle, brake: keys.has('KeyB') };
    },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    /** Look offsets ease back to centre when the mouse is released. */
    look(dt) {
      if (!dragging) {
        lookYaw *= Math.max(0, 1 - 2.2 * dt);
        lookPitch *= Math.max(0, 1 - 2.2 * dt);
      }
      return { yaw: lookYaw, pitch: lookPitch };
    },
  };
}
