import { GameEngine, GameTelemetry } from '../types/game';
import { createParticleSystem, hpColor, resolveCircleRect } from '../utils/graphics';
import { Sound } from '../utils/sound';

interface Brick {
  col: number;
  y: number;
  hp: number;
}

interface Item {
  col: number;
  y: number;
  type: 'PLUS_BALL';
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  floorBounces: number;
}

export function initDDTAN(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  fx: ReturnType<typeof createParticleSystem>,
  callbacks: {
    onScoreUpdate: (score: number) => void;
    onGameOver: (score: number, reason: string) => void;
  }
): GameEngine {
  const COLS = 7;
  const CELL = 52;
  const PAD_X = (W - COLS * CELL) / 2;
  const LAUNCH_X = W / 2;
  const LAUNCH_Y = 58;
  const DANGER_Y = 130;
  const FLOOR_Y = H - 22;
  const GRAVITY = 0.22;

  let turn = 1;
  let totalBalls = 3;
  let bonusBalls = 0;
  let state: 'AIMING' | 'FIRING' = 'AIMING';
  let launchVx = 3.2;
  let launchVy = 1.8;

  let balls: Ball[] = [];
  let bricks: Brick[] = [];
  let items: Item[] = [];

  let fireQueue = 0;
  let fireCooldown = 0;
  let speedMult = 1;

  function spawnBottomRow(rowY: number, hpBase: number) {
    const cols = [0, 1, 2, 3, 4, 5, 6];
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }

    // 100% guarantee 1 PLUS_BALL per row
    items.push({ col: cols[0], y: rowY, type: 'PLUS_BALL' });

    // Spawn 2 ~ 4 bricks
    const brickCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= brickCount; i++) {
      const c = cols[i];
      bricks.push({
        col: c,
        y: rowY,
        hp: hpBase + Math.floor(Math.random() * 2),
      });
    }
  }

  spawnBottomRow(H - 90, 2);
  spawnBottomRow(H - 90 - CELL, 1);

  function updateAimFromPoint(px: number, py: number) {
    const dx = px - LAUNCH_X;
    const dy = py - LAUNCH_Y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = Math.min(8.5, Math.max(3.5, dist / 28));
    launchVx = (dx / dist) * speed;
    launchVy = (dy / dist) * speed;
  }

  function startFire() {
    if (state !== 'AIMING') return;
    fireQueue = totalBalls;
    fireCooldown = 0;
    state = 'FIRING';
    Sound.shoot();
  }

  function endTurn() {
    balls = [];
    totalBalls += bonusBalls;
    bonusBalls = 0;
    turn++;
    speedMult = 1;
    callbacks.onScoreUpdate(turn);

    // Bricks & items rise up 1 row
    for (const b of bricks) b.y -= CELL;
    for (const it of items) it.y -= CELL;

    // Filter out expired items above DANGER_Y
    items = items.filter(it => it.y > DANGER_Y);

    for (const b of bricks) {
      if (b.y <= DANGER_Y) {
        callbacks.onGameOver(turn, '重力磚塊已向上推升至頂部警戒線！');
        return;
      }
    }

    spawnBottomRow(H - 90, Math.max(1, Math.floor(turn * 1.5)));
    state = 'AIMING';
  }

  return {
    hasSpeedToggle: true,
    hasRecall: true,
    toggleSpeed() {
      speedMult = speedMult === 1 ? 2 : speedMult === 2 ? 3 : 1;
    },
    recallBalls() {
      if (state === 'FIRING') {
        fireQueue = 0;
        endTurn();
      }
    },
    onPointerDown(x: number, y: number) {
      if (state === 'AIMING') updateAimFromPoint(x, y);
    },
    onPointerMove(x: number, y: number) {
      if (state === 'AIMING') updateAimFromPoint(x, y);
    },
    onPointerUp(x: number, y: number) {
      if (state === 'AIMING') {
        updateAimFromPoint(x, y);
        startFire();
      }
    },
    onNudge(dir: -1 | 1) {
      if (state === 'AIMING') {
        launchVx = Math.max(-7.5, Math.min(7.5, launchVx + dir * 0.35));
      }
    },
    onActionButton() {
      if (state === 'AIMING') startFire();
    },
    update() {
      const steps = state === 'FIRING' ? speedMult * 2 : 1;
      for (let s = 0; s < steps; s++) {
        if (state !== 'FIRING') break;

        if (fireQueue > 0) {
          if (fireCooldown <= 0) {
            balls.push({
              x: LAUNCH_X,
              y: LAUNCH_Y,
              vx: launchVx,
              vy: launchVy,
              r: 6,
              floorBounces: 1,
            });
            fireQueue--;
            fireCooldown = 6;
          } else {
            fireCooldown--;
          }
        }

        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          b.vy += GRAVITY;
          b.x += b.vx;
          b.y += b.vy;

          if (b.x - b.r < PAD_X) {
            b.x = PAD_X + b.r;
            b.vx = Math.abs(b.vx) * 0.92;
            Sound.bounce();
          } else if (b.x + b.r > W - PAD_X) {
            b.x = W - PAD_X - b.r;
            b.vx = -Math.abs(b.vx) * 0.92;
            Sound.bounce();
          }
          if (b.y - b.r < 20) {
            b.y = 20 + b.r;
            b.vy = Math.abs(b.vy) * 0.85;
            Sound.bounce();
          }

          // Single elastic floor bounce at FLOOR_Y = H - 22
          if (b.y + b.r >= FLOOR_Y && b.vy > 0 && b.floorBounces > 0) {
            b.y = FLOOR_Y - b.r;
            b.floorBounces--;
            b.vy = -Math.max(5.4, Math.abs(b.vy) * 0.82);
            Sound.bounce();
            fx.spawnParticles(b.x, FLOOR_Y, '#f59e0b', 4, 2);
          }

          // Bottom exit on second drop
          if (b.y - b.r > H) {
            balls.splice(i, 1);
            continue;
          }

          // Bricks collision with restitution
          for (let j = bricks.length - 1; j >= 0; j--) {
            const br = bricks[j];
            const rx = PAD_X + br.col * CELL + 3;
            const ry = br.y + 3;
            const rw = CELL - 6;
            const rh = CELL - 6;

            if (resolveCircleRect(b, rx, ry, rw, rh)) {
              b.vy *= 0.86; // gravity bounce damping
              if (Math.abs(b.vx) < 0.4) b.vx += (Math.random() - 0.5) * 1.5;
              br.hp -= 1;
              Sound.hit(br.hp * 14);
              fx.spawnParticles(b.x, b.y, hpColor(br.hp + 1), 4, 2.5);

              if (br.hp <= 0) {
                fx.spawnParticles(rx + rw / 2, ry + rh / 2, '#fbbf24', 12, 4);
                bricks.splice(j, 1);
              }
              break;
            }
          }

          // Items collision
          for (let j = items.length - 1; j >= 0; j--) {
            const it = items[j];
            const ix = PAD_X + it.col * CELL + CELL / 2;
            const iy = it.y + CELL / 2;

            if (Math.hypot(b.x - ix, b.y - iy) < b.r + 14) {
              bonusBalls++;
              Sound.powerup();
              fx.spawnFloatText(ix, iy, '+1 GRAVITY BALL', '#fbbf24');
              items.splice(j, 1);
            }
          }
        }

        if (fireQueue === 0 && balls.length === 0) {
          endTurn();
          break;
        }
      }
    },
    draw() {
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, W, H);

      // Danger line at top
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD_X, DANGER_Y);
      ctx.lineTo(W - PAD_X, DANGER_Y);
      ctx.stroke();

      // Amber elastic buffer line at FLOOR_Y = H - 22
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.beginPath();
      ctx.moveTo(PAD_X, FLOOR_Y);
      ctx.lineTo(W - PAD_X, FLOOR_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Parabolic trajectory preview (synced with left/right wall clamping)
      if (state === 'AIMING') {
        let sx = LAUNCH_X;
        let sy = LAUNCH_Y;
        let svx = launchVx;
        let svy = launchVy;
        ctx.fillStyle = '#fbbf24';

        for (let step = 0; step < 36; step++) {
          svy += GRAVITY;
          sx += svx;
          sy += svy;
          if (sx < PAD_X + 6) {
            sx = PAD_X + 6;
            svx = Math.abs(svx) * 0.92;
          } else if (sx > W - PAD_X - 6) {
            sx = W - PAD_X - 6;
            svx = -Math.abs(svx) * 0.92;
          }
          if (sy < 26) {
            sy = 26;
            svy = Math.abs(svy) * 0.85;
          }
          if (step % 2 === 0) {
            ctx.globalAlpha = Math.max(0.15, 1 - step / 38);
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // Bricks
      for (const br of bricks) {
        const rx = PAD_X + br.col * CELL + 3;
        const ry = br.y + 3;
        const rw = CELL - 6;
        const rh = CELL - 6;
        const col = hpColor(br.hp);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx, ry, rw, rh);

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 14px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(br.hp), rx + rw / 2, ry + rh / 2);
      }

      // Items
      for (const it of items) {
        const ix = PAD_X + it.col * CELL + CELL / 2;
        const iy = it.y + CELL / 2;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ix, iy, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+1', ix, iy);
      }

      // Launcher avatar
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(LAUNCH_X, LAUNCH_Y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`g=0.22 · x${totalBalls}`, LAUNCH_X, LAUNCH_Y - 16);

      // Balls
      for (const b of balls) {
        ctx.fillStyle = b.floorBounces > 0 ? '#fef08a' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    getTelemetry(): Partial<GameTelemetry> {
      return {
        score: turn,
        extraLeft: `GRAVITY BALLS: ${totalBalls}${bonusBalls ? ` (+${bonusBalls})` : ''} · ${speedMult}X`,
        entitiesCount: bricks.length + balls.length,
        gravityText: '+0.22 px/f² (垂直拋物線重力)',
      };
    },
  };
}
