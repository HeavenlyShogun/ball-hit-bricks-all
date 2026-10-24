import { GameEngine, GameTelemetry } from '../types/game';
import { createParticleSystem, hpColor, resolveCircleRect } from '../utils/graphics';
import { Sound } from '../utils/sound';

interface Brick {
  col: number;
  row: number;
  hp: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  attached?: boolean;
}

interface Capsule {
  x: number;
  y: number;
  type: 'MULTI' | 'WIDE';
}

export function initFFTAN(
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
  const CELL_W = 52;
  const CELL_H = 32;
  const PAD_X = (W - COLS * CELL_W) / 2;
  const TOP_Y = 54;
  const PADDLE_Y = H - 52;

  let score = 0;
  let paddleX = W / 2;
  let paddleW = 86;
  let wideTimer = 0;
  let shieldCount = 1; // Bottom energy shield (replenished each wave)
  let waveTimer = 0;

  let balls: Ball[] = [
    { x: W / 2, y: PADDLE_Y - 12, vx: 3.6, vy: -5.4, r: 6, attached: true },
  ];
  let bricks: Brick[] = [];
  let capsules: Capsule[] = [];
  let waveCount = 1;

  function spawnBrickRows(rows: number, baseHp: number) {
    for (const b of bricks) b.row += rows;
    for (let r = 0; r < rows; r++) {
      let rowSpawned = 0;
      for (let c = 0; c < COLS; c++) {
        if (Math.random() < 0.8) {
          bricks.push({
            col: c,
            row: r,
            hp: baseHp + (rows - r),
          });
          rowSpawned++;
        }
      }
      if (rowSpawned === 0) {
        bricks.push({ col: Math.floor(Math.random() * COLS), row: r, hp: baseHp });
      }
    }

    // Safely push any balls located inside the newly spawned top brick zone
    for (const ball of balls) {
      if (!ball.attached && ball.y < TOP_Y + CELL_H * 2) {
        ball.y = TOP_Y + CELL_H * 2 + 8;
        ball.vy = Math.abs(ball.vy);
      }
    }
  }

  spawnBrickRows(4, 2);

  function releaseAttachedBalls() {
    let released = false;
    for (const b of balls) {
      if (b.attached) {
        b.attached = false;
        b.vx = 3.6 * (Math.random() < 0.5 ? 1 : -1);
        b.vy = -5.4;
        released = true;
      }
    }
    if (released) {
      Sound.shoot();
    }
    return released;
  }

  return {
    onPointerDown(x: number) {
      paddleX = Math.max(PAD_X + paddleW / 2, Math.min(W - PAD_X - paddleW / 2, x));
    },
    onPointerMove(x: number) {
      paddleX = Math.max(PAD_X + paddleW / 2, Math.min(W - PAD_X - paddleW / 2, x));
    },
    onPointerUp(x: number) {
      paddleX = Math.max(PAD_X + paddleW / 2, Math.min(W - PAD_X - paddleW / 2, x));
      releaseAttachedBalls();
    },
    onNudge(dir: -1 | 1) {
      paddleX = Math.max(
        PAD_X + paddleW / 2,
        Math.min(W - PAD_X - paddleW / 2, paddleX + dir * 24)
      );
    },
    onActionButton() {
      if (releaseAttachedBalls()) return;
      // Split ball if single active ball in flight
      if (balls.length === 1) {
        const b = balls[0];
        balls.push({ x: b.x, y: b.y, vx: -b.vx, vy: b.vy, r: 6 });
        Sound.powerup();
      }
    },
    update() {
      if (wideTimer > 0) {
        wideTimer--;
        paddleW = 124;
      } else {
        paddleW = 86;
      }

      paddleX = Math.max(PAD_X + paddleW / 2, Math.min(W - PAD_X - paddleW / 2, paddleX));

      const anyInFlight = balls.some(b => !b.attached);
      if (anyInFlight) {
        waveTimer++;
      }

      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];

        if (b.attached) {
          b.x = paddleX;
          b.y = PADDLE_Y - 6 - b.r;
          continue;
        }

        b.x += b.vx;
        b.y += b.vy;

        // Walls
        if (b.x - b.r < PAD_X) {
          b.x = PAD_X + b.r;
          b.vx = Math.abs(b.vx);
          Sound.bounce();
        } else if (b.x + b.r > W - PAD_X) {
          b.x = W - PAD_X - b.r;
          b.vx = -Math.abs(b.vx);
          Sound.bounce();
        }
        if (b.y - b.r < TOP_Y) {
          b.y = TOP_Y + b.r;
          b.vy = Math.abs(b.vy);
          Sound.bounce();
        }

        // Paddle reflection with angular deflection
        if (
          b.vy > 0 &&
          b.y + b.r >= PADDLE_Y - 6 &&
          b.y - b.r <= PADDLE_Y + 8 &&
          b.x >= paddleX - paddleW / 2 - 4 &&
          b.x <= paddleX + paddleW / 2 + 4
        ) {
          const hitOffset = (b.x - paddleX) / (paddleW / 2); // -1 to 1
          const maxBounceAngle = Math.PI * 0.36;
          const bounceAngle = hitOffset * maxBounceAngle;
          const spd = Math.min(8.4, Math.hypot(b.vx, b.vy) * 1.015);
          b.vx = Math.sin(bounceAngle) * spd;
          b.vy = -Math.cos(bounceAngle) * spd;
          b.y = PADDLE_Y - 6 - b.r;
          Sound.hit(190);
          fx.spawnParticles(b.x, PADDLE_Y, '#c084fc', 5, 2.2);
        }

        // Bottom Energy Shield save when last ball drops below PADDLE_Y + 10
        if (b.vy > 0 && b.y >= PADDLE_Y + 10 && balls.length === 1 && shieldCount > 0) {
          shieldCount--;
          b.y = PADDLE_Y - b.r;
          b.vy = -Math.abs(b.vy);
          Sound.powerup();
          fx.spawnParticles(b.x, PADDLE_Y + 10, '#38bdf8', 12, 3.5);
          fx.spawnFloatText(b.x, PADDLE_Y - 18, 'SHIELD SAVED!', '#38bdf8');
          continue;
        }

        // Ball missed
        if (b.y - b.r > H) {
          balls.splice(i, 1);
          continue;
        }

        // Bricks collision
        for (let j = bricks.length - 1; j >= 0; j--) {
          const br = bricks[j];
          const rx = PAD_X + br.col * CELL_W + 2;
          const ry = TOP_Y + br.row * CELL_H + 2;
          const rw = CELL_W - 4;
          const rh = CELL_H - 4;

          if (resolveCircleRect(b, rx, ry, rw, rh)) {
            br.hp -= 1;
            score += 10;
            callbacks.onScoreUpdate(score);
            Sound.hit(br.hp * 20);
            fx.spawnParticles(b.x, b.y, hpColor(br.hp + 1), 4, 2.5);

            if (br.hp <= 0) {
              score += 30;
              callbacks.onScoreUpdate(score);
              if (Math.random() < 0.28) {
                capsules.push({
                  x: rx + rw / 2,
                  y: ry + rh / 2,
                  type: Math.random() < 0.55 ? 'MULTI' : 'WIDE',
                });
              }
              bricks.splice(j, 1);
            }
            break;
          }
        }
      }

      // Falling capsules
      for (let i = capsules.length - 1; i >= 0; i--) {
        const cp = capsules[i];
        cp.y += 2.6;

        if (
          cp.y >= PADDLE_Y - 10 &&
          cp.y <= PADDLE_Y + 12 &&
          Math.abs(cp.x - paddleX) <= paddleW / 2 + 10
        ) {
          Sound.powerup();
          if (cp.type === 'MULTI' && balls.length < 6) {
            releaseAttachedBalls();
            const ref = balls[0] || { x: paddleX, y: PADDLE_Y - 12, vx: 3, vy: -5 };
            balls.push({ x: ref.x, y: ref.y, vx: -ref.vx - 1, vy: -Math.abs(ref.vy), r: 6 });
            balls.push({ x: ref.x, y: ref.y, vx: ref.vx + 1, vy: -Math.abs(ref.vy), r: 6 });
            fx.spawnFloatText(cp.x, cp.y, 'MULTI-BALL!', '#fbbf24');
          } else {
            wideTimer = 440;
            fx.spawnFloatText(cp.x, cp.y, 'WIDE PADDLE!', '#c084fc');
          }
          capsules.splice(i, 1);
          continue;
        }

        if (cp.y > H) capsules.splice(i, 1);
      }

      // Dynamic wave progression: when bricks <= 2 OR 960 frames (16s) elapsed
      if (bricks.length <= 2 || waveTimer >= 960) {
        waveCount++;
        waveTimer = 0;
        shieldCount = 1; // Replenish shield each wave
        spawnBrickRows(1, 2 + waveCount * 2);

        for (const br of bricks) {
          if (TOP_Y + (br.row + 1) * CELL_H >= PADDLE_Y - 18) {
            callbacks.onGameOver(score, '磚塊波次已下壓至反彈板高度！');
            return;
          }
        }
      }

      if (balls.length === 0) {
        callbacks.onGameOver(score, '所有能量球皆已漏接落底！');
        return;
      }
    },
    draw() {
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(PAD_X, TOP_Y, COLS * CELL_W, H - TOP_Y);

      // Bottom Energy Shield line when active
      if (shieldCount > 0) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(PAD_X, PADDLE_Y + 10);
        ctx.lineTo(W - PAD_X, PADDLE_Y + 10);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Bricks
      for (const br of bricks) {
        const rx = PAD_X + br.col * CELL_W + 2;
        const ry = TOP_Y + br.row * CELL_H + 2;
        const rw = CELL_W - 4;
        const rh = CELL_H - 4;
        const col = hpColor(br.hp);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rw, rh);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(br.hp), rx + rw / 2, ry + rh / 2);
      }

      // Capsules
      for (const cp of capsules) {
        ctx.fillStyle = cp.type === 'MULTI' ? '#fbbf24' : '#c084fc';
        ctx.beginPath();
        ctx.roundRect(cp.x - 16, cp.y - 8, 32, 16, 8);
        ctx.fill();

        ctx.fillStyle = '#090d16';
        ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cp.type, cp.x, cp.y);
      }

      // Upward launch indicator when ball is attached
      const hasAttached = balls.some(b => b.attached);
      if (hasAttached) {
        ctx.save();
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(paddleX, PADDLE_Y - 12);
        ctx.lineTo(paddleX, PADDLE_Y - 110);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#e9d5ff';
        ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK / SPACE TO LAUNCH', W / 2, PADDLE_Y + 26);
      }

      // Paddle
      ctx.fillStyle = wideTimer > 0 ? '#e879f9' : '#a855f7';
      ctx.beginPath();
      ctx.roundRect(paddleX - paddleW / 2, PADDLE_Y - 6, paddleW, 12, 6);
      ctx.fill();

      // Balls
      ctx.fillStyle = '#f8fafc';
      for (const b of balls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    getTelemetry(): Partial<GameTelemetry> {
      return {
        score,
        extraLeft: `BALLS: ${balls.length} · WAVE: ${waveCount}${shieldCount > 0 ? ' · 🛡️' : ''}`,
        entitiesCount: bricks.length + balls.length,
        gravityText: '0.00 px/f² (動量反彈板)',
      };
    },
  };
}
