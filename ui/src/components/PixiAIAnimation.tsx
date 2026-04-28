import { useEffect, useRef } from "react";
import { Application, Graphics } from "pixi.js";

// ── Visual config ────────────────────────────────────────────────────────────

const NODE_COUNT = 88;
const CONNECT_DIST = 160;
const PULSE_EVERY = 7;   // frames between spawning a new data pulse

const PALETTE = [
  0x00d4ff,  // electric cyan
  0x0088ff,  // pure blue
  0x7c3aed,  // deep violet
  0x40e0d0,  // turquoise
  0x00ff9d,  // neon green
  0xd44dff,  // pink-purple
];

// ── Types ────────────────────────────────────────────────────────────────────

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  alpha: number;
  phase: number;   // for alpha breathing
  speed: number;   // alpha breathing speed
  hub: boolean;    // hubs are larger, brighter anchor points
}

interface Pulse {
  a: number;       // source node index
  b: number;       // target node index
  t: number;       // progress 0→1
  dt: number;      // progress increment per frame
  color: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PixiAIAnimation() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = divRef.current;
    if (!container) return;

    let app: Application | null = null;
    let dead = false;
    let initialized = false;

    (async () => {
      app = new Application();
      await app.init({
        resizeTo: container,
        backgroundAlpha: 0,   // transparent — CSS provides the gradient bg
        antialias: true,
        resolution: Math.min(window.devicePixelRatio ?? 1, 2),
        autoDensity: true,
      });

      if (dead) { app.destroy(true, { children: true, texture: true }); return; }
      initialized = true;
      container.appendChild(app.canvas as HTMLCanvasElement);

      const W = () => app!.screen.width;
      const H = () => app!.screen.height;

      // ── Layers (bottom → top) ───────────────────────────────────────────
      const bgGfx    = new Graphics(); // static hex-dot grid, redrawn on resize
      const connGfx  = new Graphics(); // connections between nodes
      const ringGfx  = new Graphics(); // expanding ring pulses from hubs
      const pulseGfx = new Graphics(); // data packets travelling along edges
      const nodeGfx  = new Graphics(); // the neuron nodes themselves
      const scanGfx  = new Graphics(); // single horizontal scan line

      for (const g of [bgGfx, connGfx, ringGfx, pulseGfx, nodeGfx, scanGfx]) {
        app.stage.addChild(g);
      }

      // ── Nodes ───────────────────────────────────────────────────────────
      const nodes: Node[] = [];

      function buildNodes() {
        nodes.length = 0;
        for (let i = 0; i < NODE_COUNT; i++) {
          const hub = i < 8; // first 8 are hubs
          nodes.push({
            x: Math.random() * W(),
            y: Math.random() * H(),
            vx: (Math.random() - 0.5) * (hub ? 0.15 : 0.35),
            vy: (Math.random() - 0.5) * (hub ? 0.15 : 0.35),
            radius: hub ? Math.random() * 4 + 4 : Math.random() * 2.5 + 1.5,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            alpha: Math.random() * 0.3 + 0.6,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.018 + 0.008,
            hub,
          });
        }
      }
      buildNodes();

      // ── Pulses & rings ───────────────────────────────────────────────────
      const pulses: Pulse[] = [];
      const rings: Ring[]   = [];
      let ringCooldown = 120;

      function spawnPulse() {
        for (let tries = 0; tries < 30; tries++) {
          const a = Math.floor(Math.random() * nodes.length);
          const b = Math.floor(Math.random() * nodes.length);
          if (a === b) continue;
          const dx = nodes[a].x - nodes[b].x;
          const dy = nodes[a].y - nodes[b].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT_DIST) {
            pulses.push({
              a, b, t: 0,
              dt: 2.2 / d,
              color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            });
            return;
          }
        }
      }

      function spawnRing(node: Node) {
        rings.push({
          x: node.x, y: node.y,
          r: node.radius + 2,
          maxR: 70 + Math.random() * 50,
          alpha: 0.7,
          color: node.color,
        });
      }

      // ── Background dot-grid (drawn once, redrawn on resize) ─────────────
      function drawGrid() {
        bgGfx.clear();
        const spacing = 38;
        const cols = Math.ceil(W() / spacing) + 2;
        const rows = Math.ceil(H() / spacing) + 2;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            bgGfx
              .circle(c * spacing, r * spacing, 0.8)
              .fill({ color: 0x1a3a6a, alpha: 0.55 });
          }
        }
      }
      drawGrid();

      // ── Resize ───────────────────────────────────────────────────────────
      let lastW = W(), lastH = H();
      const ro = new ResizeObserver(() => {
        if (Math.abs(W() - lastW) > 4 || Math.abs(H() - lastH) > 4) {
          lastW = W(); lastH = H();
          drawGrid();
        }
      });
      ro.observe(container);

      // ── Main ticker ──────────────────────────────────────────────────────
      let frame = 0;
      let lastPulse = 0;
      let scanY = -60;
      const scanSpeed = 0.6;

      app.ticker.add(() => {
        frame++;
        const w = W(), h = H();

        // ── Move nodes ────────────────────────────────────────────────────
        for (const n of nodes) {
          n.x  += n.vx;
          n.y  += n.vy;
          n.phase += n.speed;
          n.alpha = 0.5 + Math.sin(n.phase) * 0.4;
          if (n.x < -20)   n.x = w + 20;
          if (n.x > w + 20) n.x = -20;
          if (n.y < -20)   n.y = h + 20;
          if (n.y > h + 20) n.y = -20;
        }

        // ── Spawn pulses ──────────────────────────────────────────────────
        if (frame - lastPulse >= PULSE_EVERY) {
          spawnPulse();
          lastPulse = frame;
        }

        // ── Spawn rings ───────────────────────────────────────────────────
        ringCooldown--;
        if (ringCooldown <= 0) {
          const hub = nodes[Math.floor(Math.random() * 8)];
          spawnRing(hub);
          ringCooldown = 90 + Math.random() * 80;
        }

        // ── Draw connections ──────────────────────────────────────────────
        connGfx.clear();
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const ni = nodes[i], nj = nodes[j];
            const dx = ni.x - nj.x, dy = ni.y - nj.y;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d >= CONNECT_DIST) continue;
            const a = (1 - d / CONNECT_DIST) * 0.22;
            connGfx
              .moveTo(ni.x, ni.y)
              .lineTo(nj.x, nj.y)
              .stroke({ width: 0.75, color: ni.color, alpha: a });
          }
        }

        // ── Draw rings ────────────────────────────────────────────────────
        ringGfx.clear();
        for (let r = rings.length - 1; r >= 0; r--) {
          const ring = rings[r];
          ring.r     += 1.4;
          ring.alpha *= 0.972;
          if (ring.alpha < 0.01 || ring.r > ring.maxR) { rings.splice(r, 1); continue; }
          ringGfx
            .circle(ring.x, ring.y, ring.r)
            .stroke({ width: 1, color: ring.color, alpha: ring.alpha });
        }

        // ── Draw pulses ───────────────────────────────────────────────────
        pulseGfx.clear();
        for (let p = pulses.length - 1; p >= 0; p--) {
          const pulse = pulses[p];
          pulse.t += pulse.dt;
          if (pulse.t >= 1) { pulses.splice(p, 1); continue; }

          const na = nodes[pulse.a], nb = nodes[pulse.b];
          const px = na.x + (nb.x - na.x) * pulse.t;
          const py = na.y + (nb.y - na.y) * pulse.t;

          // outer glow
          pulseGfx.circle(px, py, 7).fill({ color: pulse.color, alpha: 0.12 });
          // mid glow
          pulseGfx.circle(px, py, 3.5).fill({ color: pulse.color, alpha: 0.55 });
          // bright core
          pulseGfx.circle(px, py, 1.4).fill({ color: 0xffffff, alpha: 0.9 });
        }

        // ── Draw nodes ────────────────────────────────────────────────────
        nodeGfx.clear();
        for (const n of nodes) {
          const glowR = n.hub ? n.radius * 4.5 : n.radius * 3.5;

          // soft halo
          nodeGfx
            .circle(n.x, n.y, glowR)
            .fill({ color: n.color, alpha: n.alpha * (n.hub ? 0.18 : 0.12) });

          // mid ring (hubs only)
          if (n.hub) {
            nodeGfx
              .circle(n.x, n.y, n.radius + 2)
              .stroke({ width: 0.8, color: n.color, alpha: n.alpha * 0.5 });
          }

          // core
          nodeGfx
            .circle(n.x, n.y, n.radius)
            .fill({ color: n.color, alpha: n.alpha * 0.9 });

          // bright specular centre
          nodeGfx
            .circle(n.x, n.y, n.radius * 0.38)
            .fill({ color: 0xffffff, alpha: n.alpha * 0.7 });
        }

        // ── Draw scan line ────────────────────────────────────────────────
        scanY += scanSpeed;
        if (scanY > h + 60) scanY = -60;

        scanGfx.clear();
        // leading bright edge
        scanGfx
          .moveTo(0, scanY)
          .lineTo(w, scanY)
          .stroke({ width: 1.2, color: 0x00d4ff, alpha: 0.18 });
        // soft glow band above it
        scanGfx
          .rect(0, scanY - 28, w, 28)
          .fill({ color: 0x00aaff, alpha: 0.028 });
      });
    })();

    return () => {
      dead = true;
      // Only destroy after init() has resolved — _cancelResize doesn't exist yet
      // on a partially-initialized Application and will throw otherwise.
      if (initialized && app) app.destroy(true, { children: true, texture: true });
    };
  }, []);

  return (
    <div
      ref={divRef}
      className="absolute inset-0"
      style={{ background: "linear-gradient(135deg, #05091a 0%, #0d1a3a 45%, #050914 100%)" }}
    />
  );
}
