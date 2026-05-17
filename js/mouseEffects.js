import { MOUSE_FX_ENABLED, MOUSE_FX_RIPPLE_CAP } from "./config.js";
import { game } from "./state.js";

/**
 * @typedef {{ x: number, y: number, r: number, a: number, w: number }} MouseRipple
 */

/**
 * Additive ripple + lagged glow under the pointer (2D canvas overlay).
 *
 * @param {HTMLCanvasElement} gameCanvas `#game` — used to detect pointer lock.
 */
export function initMouseEffects(gameCanvas) {
  if (!MOUSE_FX_ENABLED) return;
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const overlay = document.createElement("canvas");
  overlay.id = "mouse-fx-canvas";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);

  const ctx = overlay.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  let bufW = 0;
  let bufH = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    bufW = Math.max(1, Math.floor(window.innerWidth * dpr));
    bufH = Math.max(1, Math.floor(window.innerHeight * dpr));
    overlay.width = bufW;
    overlay.height = bufH;
    overlay.style.width = `${window.innerWidth}px`;
    overlay.style.height = `${window.innerHeight}px`;
  }
  resize();
  window.addEventListener("resize", resize);

  let accX = window.innerWidth * 0.5;
  let accY = window.innerHeight * 0.5;
  const glow = { x: accX, y: accY };
  /** @type {MouseRipple[]} */
  const ripples = [];
  let lastRippleMs = 0;

  function isLocked() {
    return document.pointerLockElement === gameCanvas;
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @param {number} velocity
   */
  function tryRipple(cx, cy, velocity) {
    const t = performance.now();
    if (t - lastRippleMs < 22 && velocity < 5) return;
    lastRippleMs = t;
    const heat = Math.min(1, velocity / 72);
    ripples.push({
      x: cx,
      y: cy,
      r: 6 + heat * 14,
      a: 0.18 + heat * 0.38,
      w: 1.4 + heat * 2.2,
    });
    while (ripples.length > MOUSE_FX_RIPPLE_CAP) ripples.shift();
  }

  /** @param {MouseEvent} e */
  function onMouseMove(e) {
    if (!game.paused) return;
    if (isLocked()) {
      accX = Math.max(
        0,
        Math.min(window.innerWidth, accX + e.movementX),
      );
      accY = Math.max(
        0,
        Math.min(window.innerHeight, accY + e.movementY),
      );
      const v = Math.hypot(e.movementX, e.movementY);
      if (v > 0.35) tryRipple(accX, accY, v);
    } else {
      accX = e.clientX;
      accY = e.clientY;
      const v = Math.hypot(e.movementX, e.movementY);
      if (v > 0.15) tryRipple(accX, accY, Math.max(v, 1.5));
    }
  }

  function onPointerLockChange() {
    if (isLocked()) {
      accX = window.innerWidth * 0.5;
      accY = window.innerHeight * 0.5;
      glow.x = accX;
      glow.y = accY;
    }
  }

  /** @param {MouseEvent} e */
  function onMouseDown(e) {
    if (!game.paused) return;
    if (e.button !== 0) return;
    const t = /** @type {HTMLElement | null} */ (e.target);
    if (t?.closest?.("input,textarea,select,button,a,label")) return;
    const x = isLocked() ? accX : e.clientX;
    const y = isLocked() ? accY : e.clientY;
    for (let k = 0; k < 3; k++) {
      ripples.push({
        x,
        y,
        r: 10 + k * 8,
        a: 0.32 - k * 0.07,
        w: 2.4 - k * 0.35,
      });
    }
    while (ripples.length > MOUSE_FX_RIPPLE_CAP) ripples.shift();
  }

  document.addEventListener("mousemove", onMouseMove, { passive: true });
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("pointerlockchange", onPointerLockChange);

  function frame() {
    requestAnimationFrame(frame);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufW, bufH);
    if (!game.paused) {
      ripples.length = 0;
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    glow.x += (accX - glow.x) * 0.11;
    glow.y += (accY - glow.y) * 0.11;

    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(
      glow.x,
      glow.y,
      2,
      glow.x,
      glow.y,
      110,
    );
    g.addColorStop(0, "rgba(255, 220, 160, 0.11)");
    g.addColorStop(0.45, "rgba(255, 150, 70, 0.04)");
    g.addColorStop(1, "rgba(255, 100, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.r += 3.4 + r.a * 2;
      r.a *= 0.965;
      if (r.a < 0.02 || r.r > 220) {
        ripples.splice(i, 1);
        continue;
      }
      const gch = Math.min(255, 140 + r.a * 130);
      const bch = Math.min(255, 55 + r.a * 140);
      ctx.strokeStyle = `rgba(255, ${gch}, ${bch}, ${r.a * 0.92})`;
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  requestAnimationFrame(frame);
}
