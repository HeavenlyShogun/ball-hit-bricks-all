import { GameEngine, GameTelemetry } from '../types/game';
import { createParticleSystem, hpColor } from '../utils/graphics';
import { Sound } from '../utils/sound';

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Pickup {
  x: number;
  y: number;
  type: 'FIRE_RATE' | 'MULTI_STREAM';
}

export function initEETAN(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  fx: ReturnType<typeof createParticleSystem>,
  callbacks: {
    onScoreUpdate: (score: number) => void;
    onGameOver: (score: number, reason: string) => void;
  }
): GameEngine {
  const COLS = 6;
  const CELL = 60;
  const PAD_X = (W - COLS * CELL) / 2;
  const PLAYER_Y = H - 64;
  const PLAYER_R = 13;

  let playerX = W / 2;
  let targetX = W / 2;
  let score = 0;
  let fireRateLevel = 1;
  let streamCount = 1;
  let burstCooldown = 0;

  let bullets: Bullet[] = [];
  let blocks: Block[] = [];
  let pickups: Pickup[] = [];
  let frame = 0;
  let rowTimer = 0;

  function spawnWave(yOffset: number = 0) {
    const waveNum = 1 + Math.floor(frame / 300);
    const baseHp =
      1 + Math.floor(waveNum * 1.4 + Math.pow(Math.max(0, waveNum - 8), 1.3));

    // Shuffle 6 lanes
    const cols = [0, 1, 2, 3, 4, 5];
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }

    const gapCol = cols[0];
    const softCol = cols[1];

    for (let c = 0; c < COLS; c++) {
      // 100% guaranteed open lane (55% chance to contain SPD or +1 powerup)
      if (c === gapCol) {
        if (Math.random() < 0.55) {
          pickups.push({
            x: PAD_X + c * CELL + CELL / 2,
            y: -CELL / 2 + yOffset,
            type: Math.random() < 0.55 ? 'FIRE_RATE' : 'MULTI_STREAM',
          });
        }
        continue;
      }

      // 100% guaranteed soft breakable lane (45% of baseHp)
      if (c === softCol) {
        blocks.push({
          x: PAD_X + c * CELL + 3,
          y: -CELL + 3 + yOffset,
          w: CELL - 6,
          h: CELL - 6,
          hp: Math.max(1, Math.floor(baseHp * 0.45)),
        });
        continue;
      }

      if (Math.random() < 0.72) {
        const hp = Math.max(1, Math.floor(baseHp * (0.7 + Math.random() * 0.6)));
        blocks.push({
          x: PAD_X + c * CELL + 3,
          y: -CELL + 3 + yOffset,
          w: CELL - 6,
          h: CELL - 6,
          hp,
        });
      }
    }
  }

  spawnWave();

  return {
    onPointerDown(x: number) {
      targetX = Math.max(PAD_X + 18, Math.min(W - PAD_X - 18, x));
    },
    onPointerMove(x: number) {
      targetX = Math.max(PAD_X + 18, Math.min(W - PAD_X - 18, x));
    },
    onPointerUp(x: number) {
      targetX = Math.max(PAD_X + 18, Math.min(W - PAD_X - 18, x));
    },
    onNudge(dir: -1 | 1) {
      targetX = Math.max(PAD_X + 18, Math.min(W - PAD_X - 18, targetX + dir * 30));
    },
    onActionButton() {
      if (burstCooldown > 0) return;
      burstCooldown = 45;
      // Emergency burst spread
      for (let i = -2; i <= 2; i++) {
        bullets.push({
          x: playerX + i * 8,
          y: PLAYER_Y - 14,
          vx: i * 0.7,
          vy: -9.8,
          r: 4.5,
        });
      }
      Sound.shoot();
    },
    update() {
      frame++;
      if (burstCooldown > 0) burstCooldown--;

      const prevPlayerX = playerX;
      playerX += (targetX - playerX) * 0.28;

      // Side-wall blocking: prevent horizontal movement into side of blocks at the same height without dying
      for (const blk of blocks) {
        if (blk.y + blk.h > PLAYER_Y - 11 && blk.y < PLAYER_Y + 12) {
          if (prevPlayerX <= blk.x - PLAYER_R + 2 && playerX + PLAYER_R > blk.x) {
            playerX = blk.x - PLAYER_R;
            targetX = Math.min(targetX, playerX);
          } else if (
            prevPlayerX >= blk.x + blk.w + PLAYER_R - 2 &&
            playerX - PLAYER_R < blk.x + blk.w
          ) {
            playerX = blk.x + blk.w + PLAYER_R;
            targetX = Math.max(targetX, playerX);
          }
        }
      }

      // Continuous auto-firing upward (max fireRateLevel = 6, max streamCount = 5)
      const interval = Math.max(2, 8 - fireRateLevel);
      if (frame % interval === 0) {
        const count = Math.min(5, streamCount);
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * 10;
          bullets.push({
            x: playerX + offset,
            y: PLAYER_Y - 14,
            vx: 0,
            vy: -9.8,
            r: 4,
          });
        }
        if (frame % (interval * 2) === 0) Sound.shoot();
      }

      const scrollSpeed = 1.15 + Math.min(1.4, frame / 1800);
      rowTimer += scrollSpeed;
      if (rowTimer >= CELL) {
        rowTimer -= CELL;
        spawnWave(rowTimer);
      }

      // Update bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (b.y < -10) {
          bullets.splice(i, 1);
          continue;
        }

        for (let j = blocks.length - 1; j >= 0; j--) {
          const blk = blocks[j];
          if (
            b.x + b.r > blk.x &&
            b.x - b.r < blk.x + blk.w &&
            b.y + b.r > blk.y &&
            b.y - b.r < blk.y + blk.h
          ) {
            blk.hp -= 1;
            score += 5;
            callbacks.onScoreUpdate(score);
            fx.spawnParticles(b.x, b.y, '#34d399', 3, 2);

            if (blk.hp <= 0) {
              score += 20;
              callbacks.onScoreUpdate(score);
              Sound.hit(blk.y);
              fx.spawnParticles(blk.x + blk.w / 2, blk.y + blk.h / 2, '#10b981', 10, 3.8);
              blocks.splice(j, 1);
            }

            bullets.splice(i, 1);
            break;
          }
        }
      }

      // Update blocks & check frontal crushing collision
      for (let i = blocks.length - 1; i >= 0; i--) {
        const blk = blocks[i];
        blk.y += scrollSpeed;

        const horizontalOverlap =
          playerX + (PLAYER_R - 3) > blk.x && playerX - (PLAYER_R - 3) < blk.x + blk.w;
        const verticalCrush = blk.y + blk.h >= PLAYER_Y - 11 && blk.y <= PLAYER_Y + 10;

        if (horizontalOverlap && verticalCrush) {
          callbacks.onGameOver(score, '跑酷角色正面撞上了迎面下壓的障礙方塊！');
          return;
        }

        if (blk.y > H + 20) blocks.splice(i, 1);
      }

      // Update pickups
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i];
        pk.y += scrollSpeed;

        if (Math.hypot(playerX - pk.x, PLAYER_Y - pk.y) < 24) {
          Sound.powerup();
          if (pk.type === 'FIRE_RATE') {
            fireRateLevel = Math.min(6, fireRateLevel + 1);
            fx.spawnFloatText(pk.x, pk.y, 'SPD UP!', '#34d399');
          } else {
            streamCount = Math.min(5, streamCount + 1);
            fx.spawnFloatText(pk.x, pk.y, 'STREAM +1!', '#fbbf24');
          }
          pickups.splice(i, 1);
          continue;
        }

        if (pk.y > H + 20) pickups.splice(i, 1);
      }
    },
    draw() {
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, W, H);

      // Lane guides
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= COLS; c++) {
        const lx = PAD_X + c * CELL;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, H);
        ctx.stroke();
      }

      // Blocks
      for (const blk of blocks) {
        const col = hpColor(blk.hp);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(blk.x, blk.y, blk.w, blk.h);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(blk.x, blk.y, blk.w, blk.h);

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 14px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(blk.hp), blk.x + blk.w / 2, blk.y + blk.h / 2);
      }

      // Pickups
      for (const pk of pickups) {
        ctx.strokeStyle = pk.type === 'FIRE_RATE' ? '#34d399' : '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pk.type === 'FIRE_RATE' ? 'SPD' : '+1', pk.x, pk.y);
      }

      // Bullets
      ctx.fillStyle = '#34d399';
      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player Runner Jet
      ctx.save();
      ctx.translate(playerX, PLAYER_Y);
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-14, 12);
      ctx.lineTo(0, 6);
      ctx.lineTo(14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    getTelemetry(): Partial<GameTelemetry> {
      return {
        score,
        extraLeft: `STREAMS: x${streamCount} · SPD: Lv.${fireRateLevel}`,
        entitiesCount: blocks.length + bullets.length,
        gravityText: '捲軸下壓 (Runner 衝刺)',
      };
    },
  };
}
