// The painter: sky, sun and storm front, the valley mesh, river, town and runway lights,
// the rescue rings, the aircraft, the instruments and the HUD — all in plain canvas 2D.
// A tiny perspective projector (camera basis + focal length) turns world points into pixels.
import { LEGS, PALETTE, RINGS, WORLD } from './config.js';
import { groundHeight, onRunway, riverX, runwayLights, townLights } from './terrain.js';
import { fbm } from './random.js';
import { headingDeg } from './flight.js';

const HFOV = (78 * Math.PI) / 180;
const TOWN = townLights();
const RUNWAY_LIGHTS = runwayLights();
const SUN_AZ = (330 * Math.PI) / 180; // low sun, ahead-left of the valley run
const SUN_EL = (7 * Math.PI) / 180;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexRgb(hex) {
  if (hex.startsWith('rgb')) return hex.match(/\d+/g).map(Number);
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mix(c1, c2, t) {
  const a = hexRgb(c1);
  const b = hexRgb(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_LANDED = 4;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // --- camera ---------------------------------------------------------------
  function cameraBasis(f, mode, lookYaw, lookPitch) {
    const yaw = f.heading + lookYaw;
    const pitch = (mode === 'cockpit' ? f.pitch : f.pitch * 0.5) + lookPitch;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const forward = { x: sy * cp, y: sp, z: cy * cp };
    const right = { x: cy, y: 0, z: -sy };
    const up = { x: -sy * sp, y: cp, z: -cy * sp };
    let pos;
    if (mode === 'cockpit') {
      pos = { x: f.x + forward.x * 2.5, y: f.y + 1.4, z: f.z + forward.z * 2.5 };
    } else {
      // Chase: behind and above, eased by the caller through f.camX/Y/Z.
      pos = { x: f.camX, y: f.camY, z: f.camZ };
    }
    const focal = (w / 2) / Math.tan(HFOV / 2);
    return { pos, forward, right, up, focal };
  }

  function project(cam, p) {
    const dx = p.x - cam.pos.x;
    const dy = p.y - cam.pos.y;
    const dz = p.z - cam.pos.z;
    const cx = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
    const cy = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
    const cz = dx * cam.forward.x + dy * cam.forward.y + dz * cam.forward.z;
    if (cz < 2) return null;
    return {
      x: w / 2 + (cx * cam.focal) / cz,
      y: h * 0.52 - (cy * cam.focal) / cz,
      d: cz,
      scale: cam.focal / cz,
    };
  }

  // --- sky ------------------------------------------------------------------
  function drawSky(cam, f) {
    const horizonY = h * 0.52 - Math.tan(-cam.forward.y) * cam.focal * 0.9;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.42, PALETTE.skyMid);
    g.addColorStop(0.62, PALETTE.skyLow);
    g.addColorStop(0.75, PALETTE.horizon);
    g.addColorStop(1, '#2a1a2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Stars, high up only.
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i += 1) {
      const sx = ((i * 373) % 1280) / 1280 * w;
      const sy = ((i * 911) % 170) / 170 * (h * 0.28);
      ctx.globalAlpha = 0.25 + ((i * 37) % 10) / 30;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    // The low sun, west-northwest, with a warm halo.
    const sunDir = {
      x: Math.sin(SUN_AZ) * Math.cos(SUN_EL),
      y: Math.sin(SUN_EL),
      z: Math.cos(SUN_AZ) * Math.cos(SUN_EL),
    };
    const sp = project(cam, {
      x: cam.pos.x + sunDir.x * 3000,
      y: cam.pos.y + sunDir.y * 3000,
      z: cam.pos.z + sunDir.z * 3000,
    });
    if (sp) {
      const halo = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 150);
      halo.addColorStop(0, 'rgba(255, 210, 122, 0.85)');
      halo.addColorStop(0.35, 'rgba(247, 169, 75, 0.35)');
      halo.addColorStop(1, 'rgba(247, 169, 75, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(sp.x - 150, sp.y - 150, 300, 300);
      ctx.fillStyle = PALETTE.sunCore;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // Storm front on the far eastern horizon: a dark bank the run is racing.
    const stormDir = { x: Math.sin(0.6), y: 0, z: Math.cos(0.6) };
    const st = project(cam, {
      x: cam.pos.x + stormDir.x * 2800,
      y: cam.pos.y + 150,
      z: cam.pos.z + stormDir.z * 2800,
    });
    if (st) {
      // A wide, low bank hugging the horizon, soft at the edges, not a floating disc.
      ctx.fillStyle = 'rgba(46, 36, 68, 0.5)';
      ctx.beginPath();
      ctx.ellipse(st.x, st.y + 18, 620, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(70, 52, 92, 0.3)';
      ctx.beginPath();
      ctx.ellipse(st.x - 160, st.y + 2, 380, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return horizonY;
  }

  // --- terrain --------------------------------------------------------------
  // Smooth variation from fractal noise, never a sine: a sine bands the whole valley.
  function terrainColor(x, z, y, d) {
    const n = fbm(x * 0.004 + 3, z * 0.004, 31);
    let base;
    if (y < 14) base = mix(PALETTE.valleyFloor, PALETTE.valleyLit, n);
    else if (y < 130) base = mix(PALETTE.rock, PALETTE.rockLit, n);
    else base = mix('#7d5c44', '#9a7a5e', n);
    // Slope shading over a wide baseline, so single quads do not flicker light and dark.
    const slope = (groundHeight(x + 90, z) - groundHeight(x - 90, z)) / 180;
    const shade = clamp(0.86 + slope * 0.9, 0.7, 1.08);
    const rgb = base.match(/\d+/g).map(Number);
    // Haze toward a dusky mauve, never a bright orange that would bleach the ridges.
    const hazed = mix(
      `rgb(${Math.round(rgb[0] * shade)},${Math.round(rgb[1] * shade)},${Math.round(rgb[2] * shade)})`,
      '#8a6a72',
      clamp(d / 2600, 0, 1) * 0.45,
    );
    return hazed;
  }

  function drawTerrain(cam) {
    const ROWS = 46;
    const COLS = 30;
    const STEP_M = 62;
    const grid = [];
    for (let r = 0; r <= ROWS; r += 1) {
      const d = 12 + r * STEP_M;
      const row = [];
      for (let c = 0; c <= COLS; c += 1) {
        const lat = (c - COLS / 2) * STEP_M;
        const wx = cam.pos.x + cam.forward.x * d + cam.right.x * lat;
        const wz = cam.pos.z + cam.forward.z * d + cam.right.z * lat;
        const wy = groundHeight(wx, wz);
        const p = project(cam, { x: wx, y: wy, z: wz });
        row.push({ p, x: wx, z: wz, y: wy, d });
      }
      grid.push(row);
    }
    // Far rows first: painter's order along the view direction.
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      for (let c = 0; c < COLS; c += 1) {
        const a = grid[r][c];
        const b = grid[r][c + 1];
        const cc = grid[r + 1][c];
        const dd = grid[r + 1][c + 1];
        if (!a.p || !b.p || !cc.p || !dd.p) continue;
        const mx = (a.x + dd.x) / 2;
        const mz = (a.z + dd.z) / 2;
        const my = (a.y + dd.y) / 2;
        let fill;
        if (Math.abs(mx - riverX(mz)) < 11 && my < 9) {
          fill = mix(PALETTE.river, PALETTE.riverGlint, 0.2 + 0.15 * fbm(mx * 0.02, mz * 0.02, 7));
        } else {
          fill = terrainColor(mx, mz, my, (a.d + dd.d) / 2);
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(a.p.x, a.p.y);
        ctx.lineTo(b.p.x, b.p.y);
        ctx.lineTo(dd.p.x, dd.p.y);
        ctx.lineTo(cc.p.x, cc.p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawRiver(cam) {
    // A clean ribbon along the valley floor, drawn after the mesh so it never hides
    // inside a quad: the river is the pilot's visual anchor down the valley.
    const z0 = Math.max(cam.pos.z - 100, -2200);
    const z1 = cam.pos.z + 2200;
    for (let z = z0; z < z1; z += 60) {
      const rx = riverX(z);
      const rx2 = riverX(z + 60);
      const gy = (x, zz) => Math.min(groundHeight(x, zz), 9);
      const quad = [
        { x: rx - 9, y: gy(rx - 9, z) + 0.6, z },
        { x: rx + 9, y: gy(rx + 9, z) + 0.6, z },
        { x: rx2 + 9, y: gy(rx2 + 9, z + 60) + 0.6, z: z + 60 },
        { x: rx2 - 9, y: gy(rx2 - 9, z + 60) + 0.6, z: z + 60 },
      ].map((p) => project(cam, p));
      if (quad.some((p) => !p)) continue;
      const glint = 0.18 + 0.14 * fbm(z * 0.01, 3, 7);
      ctx.fillStyle = mix(PALETTE.river, PALETTE.riverGlint, glint);
      ctx.beginPath();
      ctx.moveTo(quad[0].x, quad[0].y);
      quad.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRunway(cam) {
    // Drawn in slices along its length, so the strip still shows when its near end is
    // behind the camera (the plane is over the runway on final approach).
    const halfL = WORLD.runwayLength / 2;
    const halfW = WORLD.runwayWidth / 2;
    const SLICE = 40;
    for (let z = WORLD.runwayZ - halfL; z < WORLD.runwayZ + halfL; z += SLICE) {
      const z2 = Math.min(z + SLICE, WORLD.runwayZ + halfL);
      const corners = [
        { x: -halfW, y: WORLD.runwayY, z },
        { x: halfW, y: WORLD.runwayY, z },
        { x: halfW, y: WORLD.runwayY, z: z2 },
        { x: -halfW, y: WORLD.runwayY, z: z2 },
      ].map((p) => project(cam, p));
      if (corners.some((p) => !p)) continue;
      ctx.fillStyle = PALETTE.runway;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
    }
    // Centreline dashes as true quads: a bounding box would paint a wall when a dash
    // runs diagonally across the screen in perspective.
    ctx.fillStyle = '#e8e4d8';
    for (let z = WORLD.runwayZ - halfL + 30; z < WORLD.runwayZ + halfL - 20; z += 60) {
      const quad = [
        { x: -1.5, y: WORLD.runwayY + 0.4, z },
        { x: 1.5, y: WORLD.runwayY + 0.4, z },
        { x: 1.5, y: WORLD.runwayY + 0.4, z: z + 22 },
        { x: -1.5, y: WORLD.runwayY + 0.4, z: z + 22 },
      ].map((p) => project(cam, p));
      if (quad.some((p) => !p || p.d < 25)) continue;
      ctx.beginPath();
      ctx.moveTo(quad[0].x, quad[0].y);
      quad.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawLights(cam, list, isRunway) {
    for (const l of list) {
      const dx = l.x - cam.pos.x;
      const dz = l.z - cam.pos.z;
      if (dx * dx + dz * dz > 2600 * 2600) continue;
      const p = project(cam, { x: l.x, y: l.y, z: l.z });
      if (!p) continue;
      const s = (l.s || 1) * clamp(260 / p.d, 0.5, 2.4);
      const color = l.color || PALETTE.townLight;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7 * s);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255, 196, 107, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6dd';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, 1.4 * s), 0, Math.PI * 2);
      ctx.fill();
      if (isRunway) continue;
    }
  }

  function drawRings(cam, f) {
    for (let i = 0; i < RINGS.length; i += 1) {
      const ring = RINGS[i];
      if (i < f.ringsHit) continue;
      const dx = ring.x - cam.pos.x;
      const dz = ring.z - cam.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 2400) continue;
      const c = project(cam, ring);
      if (!c) continue;
      const rr = (ring.r * cam.focal) / Math.max(20, c.d);
      const isNext = i === f.ringsHit;
      ctx.lineWidth = Math.max(2, rr * 0.09);
      ctx.strokeStyle = isNext ? PALETTE.ring : 'rgba(255, 179, 71, 0.45)';
      ctx.globalAlpha = isNext ? 0.95 : 0.6;
      ctx.beginPath();
      ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, rr * 0.035);
      ctx.strokeStyle = PALETTE.ringCore;
      ctx.beginPath();
      ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      if (isNext) {
        ctx.fillStyle = PALETTE.hudText;
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${i + 1} / ${RINGS.length}`, c.x, c.y - rr - 12);
      }
    }
  }

  // --- aircraft -------------------------------------------------------------
  function drawAircraft(cam, f) {
    const p = project(cam, { x: f.x, y: f.y, z: f.z });
    if (!p) return;
    const span = 11 * p.scale; // wingspan on screen
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(f.roll * 0.9);
    const s = (span / 220) * 1.3;
    ctx.scale(s, s);
    // Wings: high wing, sunset rim on the left edge.
    ctx.fillStyle = '#d8c49a';
    ctx.beginPath();
    ctx.moveTo(-118, 6);
    ctx.lineTo(-30, -8);
    ctx.lineTo(30, -8);
    ctx.lineTo(118, 6);
    ctx.lineTo(112, 16);
    ctx.lineTo(0, 8);
    ctx.lineTo(-112, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a5a34';
    ctx.beginPath();
    ctx.moveTo(-118, 6);
    ctx.lineTo(-112, 16);
    ctx.lineTo(-30, 8);
    ctx.lineTo(-30, -8);
    ctx.closePath();
    ctx.fill();
    // Tailplane and fin.
    ctx.fillStyle = '#c9a06a';
    ctx.beginPath();
    ctx.moveTo(-52, -58);
    ctx.lineTo(52, -58);
    ctx.lineTo(44, -46);
    ctx.lineTo(-44, -46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b98a52';
    ctx.beginPath();
    ctx.moveTo(-8, -58);
    ctx.lineTo(0, -96);
    ctx.lineTo(10, -58);
    ctx.closePath();
    ctx.fill();
    // Fuselage: warm dusk paint, dark belly.
    const body = ctx.createLinearGradient(-16, -96, 16, 70);
    body.addColorStop(0, '#e8b96a');
    body.addColorStop(0.55, '#c97e42');
    body.addColorStop(1, '#5e3a26');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-13, -62);
    ctx.quadraticCurveTo(-20, 0, -12, 66);
    ctx.quadraticCurveTo(0, 76, 12, 66);
    ctx.quadraticCurveTo(20, 0, 13, -62);
    ctx.quadraticCurveTo(0, -72, -13, -62);
    ctx.fill();
    // Cabin windows, lit.
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.ellipse(0, -18, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nav lights.
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(-118, 11, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5aff8a';
    ctx.beginPath();
    ctx.arc(118, 11, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -96, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Searchlight cone when the pilot asks for it.
    if (f.searchlight) {
      const nose = project(cam, { x: f.x, y: f.y - 1, z: f.z + 10 });
      const far = project(cam, {
        x: f.x + Math.sin(f.heading) * 260,
        y: f.y - 14,
        z: f.z + Math.cos(f.heading) * 260,
      });
      if (nose && far) {
        const g = ctx.createLinearGradient(nose.x, nose.y, far.x, far.y);
        g.addColorStop(0, 'rgba(255, 240, 190, 0.28)');
        g.addColorStop(1, 'rgba(255, 240, 190, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(nose.x, nose.y);
        ctx.lineTo(far.x - 34, far.y);
        ctx.lineTo(far.x + 34, far.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // --- cockpit + instruments --------------------------------------------------
  function drawCockpitPanel(f) {
    const panelH = 118;
    const g = ctx.createLinearGradient(0, h - panelH, 0, h);
    g.addColorStop(0, '#1d2130');
    g.addColorStop(1, '#0c0e16');
    ctx.fillStyle = g;
    ctx.fillRect(0, h - panelH, w, panelH);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, h - panelH, w, 2);
    const cx = w / 2;
    const cy = h - panelH / 2 + 4;
    // Artificial horizon.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-f.roll);
    ctx.translate(0, clamp(f.pitch * 90, -40, 40));
    ctx.fillStyle = '#3a5a8a';
    ctx.fillRect(-46, -46, 92, 46);
    ctx.fillStyle = '#7a4a28';
    ctx.fillRect(-46, 0, 92, 46);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-46, -1.5, 92, 3);
    ctx.restore();
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.stroke();

    // Digital readouts, lit amber.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`${Math.round(f.y * 3.28)}`, cx - 190, cy - 2);
    ctx.fillText(`${Math.round(f.speed * 1.94)}`, cx + 190, cy - 2);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText('ALT FT', cx - 190, cy + 18);
    ctx.fillText('KNOTS', cx + 190, cy + 18);
    // Heading lives on the compass tape and the HUD: the panel keeps alt, speed, fuel, score.
    // Fuel bar, left of the altimeter.
    const fw = 120;
    const fx = cx - 470;
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(fx, cy - 8, fw, 12);
    ctx.fillStyle = f.fuel < 20 ? PALETTE.gaugeRed : f.fuel < 45 ? PALETTE.gaugeAmber : PALETTE.gaugeGreen;
    ctx.fillRect(fx, cy - 8, fw * clamp(f.fuel / 100, 0, 1), 12);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(fx, cy - 8, fw, 12);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', fx, cy - 16);
    // Score.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`${f.score}`, cx + 330 + 110, cy - 2);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText('SCORE', cx + 330 + 110, cy + 18);
    // Canopy frame: thin slivers at the screen edges, never a floating bracket.
    ctx.strokeStyle = 'rgba(16, 18, 28, 0.75)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(-52, h * 0.42, 130, -0.55, 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w + 52, h * 0.42, 130, Math.PI - 0.85, Math.PI + 0.55);
    ctx.stroke();
  }

  function drawCompassTape(f) {
    const deg = headingDeg(f);
    const y = 30;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 12, 18, 0.55)';
    ctx.fillRect(w / 2 - 190, y - 16, 380, 30);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let off = -60; off <= 60; off += 15) {
      let d = Math.round(deg + off);
      d = ((d % 360) + 360) % 360;
      const x = w / 2 + off * 3;
      ctx.fillText(off % 30 === 0 ? `${String(d).padStart(3, '0')}°` : '·', x, y + 5);
    }
    ctx.fillStyle = PALETTE.gaugeAmber;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, y - 16);
    ctx.lineTo(w / 2 + 6, y - 16);
    ctx.lineTo(w / 2, y - 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- HUD ------------------------------------------------------------------
  function drawHud(f, screen, message) {
    // Soft dark pills behind the text blocks so the HUD reads against sun or snow.
    ctx.fillStyle = 'rgba(10, 12, 18, 0.45)';
    ctx.fillRect(10, 8, 430, 52);
    ctx.fillRect(w - 190, 8, 180, 112);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 16px system-ui, sans-serif';
    const leg = LEGS[Math.min(f.leg, LEGS.length - 1)];
    ctx.fillText(`DUSK RESCUE · ${leg.name}`, 18, 28);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText(`RINGS ${f.ringsHit}/${RINGS.length}   SCORE ${f.score}   TIME ${Math.floor(f.time / 60)}:${String(Math.floor(f.time % 60)).padStart(2, '0')}`, 18, 50);
    drawCompassTape(f);
    // Altitude / speed / heading block, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`ALT ${Math.round(f.y * 3.28)} FT`, w - 18, 28);
    ctx.fillText(`SPD ${Math.round(f.speed * 1.94)} KT`, w - 18, 52);
    ctx.fillText(`HDG ${String(Math.round(headingDeg(f))).padStart(3, '0')}°`, w - 18, 76);
    // Fuel bar, top right under the block.
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(w - 168, 88, 150, 9);
    ctx.fillStyle = f.fuel < 20 ? PALETTE.gaugeRed : PALETTE.gaugeGreen;
    ctx.fillRect(w - 168, 88, 150 * clamp(f.fuel / 100, 0, 1), 9);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('FUEL', w - 18, 112);
    if (f.fuel < 20 && screen === SCREEN_PLAY) {
      ctx.fillStyle = PALETTE.gaugeRed;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('LOW FUEL — KESTREL FIELD AHEAD', w - 18, 134);
    }
    if (message) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(10, 12, 18, 0.6)';
      const tw = ctx.measureText(message).width;
      ctx.fillRect(w / 2 - tw / 2 - 16, h * 0.3 - 30, tw + 32, 40);
      ctx.fillStyle = PALETTE.hudText;
      ctx.fillText(message, w / 2, h * 0.3);
    }
  }

  function drawTitle(f) {
    ctx.fillStyle = 'rgba(10, 12, 20, 0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('DUSK RESCUE', w / 2, h * 0.3);
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.horizon;
    ctx.fillText('a bush-plane rescue run down Kestrel Valley', w / 2, h * 0.3 + 34);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText('Thread all 8 rings, then land on Kestrel Field before the fuel runs out.', w / 2, h * 0.3 + 72);
    ctx.fillText('Arrows steer · W / S throttle · C camera · L searchlight · P pause', w / 2, h * 0.3 + 100);
    ctx.fillStyle = PALETTE.gaugeAmber;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press SPACE or click to fly', w / 2, h * 0.3 + 142);
  }

  function drawEnd(f, screen) {
    ctx.fillStyle = 'rgba(10, 12, 20, 0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 44px system-ui, sans-serif';
    if (screen === SCREEN_LANDED) {
      ctx.fillText('RESCUE COMPLETE', w / 2, h * 0.36);
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(`All 8 rings · landed at Kestrel Field · score ${f.score}`, w / 2, h * 0.36 + 36);
    } else {
      ctx.fillText('DOWN IN THE VALLEY', w / 2, h * 0.36);
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(`${f.crashReason}  Rings ${f.ringsHit}/${RINGS.length} · score ${f.score}`, w / 2, h * 0.36 + 36);
    }
    ctx.fillStyle = PALETTE.gaugeAmber;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press R or click to fly again', w / 2, h * 0.36 + 84);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 12, 20, 0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('PAUSED', w / 2, h * 0.42);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('P to resume · R to restart', w / 2, h * 0.42 + 34);
  }

  // --- main draw --------------------------------------------------------------
  function draw(f, screen, mode, lookYaw, lookPitch, message) {
    const cam = cameraBasis(f, mode, lookYaw, lookPitch);
    drawSky(cam, f);
    drawTerrain(cam);
    drawRiver(cam);
    drawRunway(cam);
    drawLights(cam, TOWN, false);
    drawLights(cam, RUNWAY_LIGHTS, true);
    drawRings(cam, f);
    if (mode === 'cockpit') drawCockpitPanel(f);
    else drawAircraft(cam, f);
    if (screen === SCREEN_TITLE) {
      drawHud(f, screen, null);
      drawTitle(f);
    } else if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(f, screen, message);
      if (screen === SCREEN_PAUSED) drawPaused();
    } else {
      drawHud(f, screen, null);
      drawEnd(f, screen);
    }
  }

  return { draw, resize };
}
