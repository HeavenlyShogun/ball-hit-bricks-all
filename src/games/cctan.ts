import { GameEngine, GameTelemetry } from '../types/game';
import { createParticleSystem, hpColor, resolveCircleRect } from '../utils/graphics';
import { Sound } from '../utils/sound';

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  bounces: number;
}

interface Enemy {
  x: number;
  y: number;
  theta: number;
  dist: number;
  speed: number;
  hp: number;
  size: number;
}

interface Powerup {
  x: number;
  y: number;
  r: number;
  life: number;
}

export function initCCTAN(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  fx: ReturnType<typeof createParticleSystem>,
  callbacks: {
    onScoreUpdate: (score: number) => void;
    onGameOver: (score: number, reason: string) => void;
  }
): GameEngine {
  const CX = W / 2;
  const CY = H / 2;
  const CORE_R = 24;
  const OVERDRIVE_MAX_CD = 720; // 12 seconds at 60Hz

  let score = 0;
  let angle = -Math.PI / 2;
  let bullets: Bullet[] = [];
  let enemies: Enemy[] = [];
  let powerups: Powerup[] = [];
  let fireTimer = 0;
  let spawnTimer = 0;
  let frameCount = 0;
  let multiShotTimer = 0;
  let overdriveCooldown = 0;

  function spawnEnemy() {
    const theta = Math.random() * Math.PI * 2;
    const dist = 275;
    const wave = 1 + Math.floor(frameCount / 420);
    const hp = Math.max(
      1,
      Math.floor(1 + Math.pow(wave, 0.95) * (0.6 + Math.random() * 0.6))
    );
    const size = 28;

    enemies.push({
      x: CX + Math.cos(theta) * dist,
      y: CY + Math.sin(theta) * dist,
      theta,
      dist,
      speed: 0.28 + Math.min(0.46, wave * 0.03),
      hp,
      size,
    });

    if (Math.random() < 0.18 && powerups.length < 3) {
      const pTheta = Math.random() * Math.PI * 2;
      const pDist = 110 + Math.random() * 90;
      powerups.push({
        x: CX + Math.cos(pTheta) * pDist,
        y: CY + Math.sin(pTheta) * pDist,
        r: 12,
        life: 540,
      });
    }
  }

  // Initial wave
  for (let i = 0; i < 4; i++) spawnEnemy();

  return {
    onPointerDown(x: number, y: number) {
      angle = Math.atan2(y - CY, x - CX);
    },
    onPointerMove(x: number, y: number) {
      angle = Math.atan2(y - CY, x - CX);
    },
    onPointerUp(x: number, y: number) {
      angle = Math.atan2(y - CY, x - CX);
    },
    onNudge(dir: -1 | 1) {
      angle += dir * 0.12;
    },
    onActionButton() {
      if (overdriveCooldown === 0) {
        multiShotTimer = Math.max(multiShotTimer, 180);
        overdriveCooldown = OVERDRIVE_MAX_CD;
        Sound.powerup();
        fx.spawnFloatText(CX, CY - 34, 'TACTICAL 3-WAY!', '#fbbf24');
      }
    },
    update() {
      frameCount++;
      if (multiShotTimer > 0) multiShotTimer--;
      if (overdriveCooldown > 0) overdriveCooldown--;

      // Continuous radial auto fire (6 frames base, 4 frames during overdrive)
      fireTimer--;
      if (fireTimer <= 0) {
        const spd = 7.5;
        const spreads = multiShotTimer > 0 ? [-0.2, 0, 0.2] : [0];
        for (const sp of spreads) {
          const a = angle + sp;
          bullets.push({
            x: CX + Math.cos(a) * (CORE_R + 6),
            y: CY + Math.sin(a) * (CORE_R + 6),
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            r: 5,
            bounces: 6,
          });
        }
        fireTimer = multiShotTimer > 0 ? 4 : 6;
        if (frameCount % 3 === 0) Sound.shoot();
      }

      // Spawning enemies
      spawnTimer--;
      if (spawnTimer <= 0) {
        spawnEnemy();
        spawnTimer = Math.max(28, 75 - Math.floor(frameCount / 220) * 4);
      }

      // Update bullets (no outer walls - disappear only when leaving screen bounds)
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
          bullets.splice(i, 1);
          continue;
        }

        // Powerup pick (activates 300 frames of 3-Way spread regardless of cooldown)
        for (let p = powerups.length - 1; p >= 0; p--) {
          const pw = powerups[p];
          if (Math.hypot(b.x - pw.x, b.y - pw.y) < b.r + pw.r) {
            multiShotTimer = 300;
            Sound.powerup();
            fx.spawnFloatText(pw.x, pw.y, '3-WAY OVERDRIVE!', '#fbbf24');
            powerups.splice(p, 1);
            break;
          }
        }

        // Hit enemies with 6-bounce chain ricochet
        for (let j = enemies.length - 1; j >= 0; j--) {
          const en = enemies[j];
          const rx = en.x - en.size / 2;
          const ry = en.y - en.size / 2;

          if (resolveCircleRect(b, rx, ry, en.size, en.size)) {
            en.hp -= 1;
            en.dist = Math.min(265, en.dist + 1.2); // balanced knockback
            score += 10;
            callbacks.onScoreUpdate(score);
            Sound.hit(en.hp * 16);
            fx.spawnParticles(b.x, b.y, hpColor(en.hp + 1), 4, 2.5);

            if (en.hp <= 0) {
              score += 25;
              callbacks.onScoreUpdate(score);
              fx.spawnParticles(en.x, en.y, '#f43f5e', 12, 4);
              enemies.splice(j, 1);
            }

            b.bounces--;
            if (b.bounces <= 0) {
              bullets.splice(i, 1);
            }
            break;
          }
        }
      }

      // Update enemies moving toward core
      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        en.dist -= en.speed;
        en.x = CX + Math.cos(en.theta) * en.dist;
        en.y = CY + Math.sin(en.theta) * en.dist;

        if (en.dist - en.size / 2 <= CORE_R) {
          callbacks.onGameOver(score, '外圍方塊已突破防線觸碰中央砲台核心！');
          return;
        }
      }

      // Powerups lifetime
      for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].life--;
        if (powerups[i].life <= 0) powerups.splice(i, 1);
      }
    },
    draw() {
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, W, H);

      // Radar rings
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = 1;
      [75, 140, 210].forEach(r => {
        ctx.beginPath();
        ctx.arc(CX, CY, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Aiming sight
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(angle) * 270, CY + Math.sin(angle) * 270);
      ctx.stroke();
      ctx.setLineDash([]);

      // Powerups
      for (const pw of powerups) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pw.x, pw.y, pw.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('3X', pw.x, pw.y);
      }

      // Enemies
      for (const en of enemies) {
        const rx = en.x - en.size / 2;
        const ry = en.y - en.size / 2;
        const col = hpColor(en.hp);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(rx, ry, en.size, en.size);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx, ry, en.size, en.size);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(en.hp), en.x, en.y);
      }

      // Bullets
      ctx.fillStyle = multiShotTimer > 0 ? '#fbbf24' : '#f43f5e';
      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central turret
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(angle);

      // Cannon barrel
      ctx.fillStyle = multiShotTimer > 0 ? '#fbbf24' : '#f43f5e';
      ctx.fillRect(6, -5, CORE_R + 8, 10);

      // Core circle
      ctx.beginPath();
      ctx.arc(0, 0, CORE_R, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = multiShotTimer > 0 ? '#fbbf24' : '#f43f5e';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Cooldown arc on core
      if (overdriveCooldown > 0) {
        const ratio = 1 - overdriveCooldown / OVERDRIVE_MAX_CD;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, CORE_R + 5, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Tactical Overdrive skill status at bottom
      ctx.fillStyle = overdriveCooldown === 0 ? '#fbbf24' : '#64748b';
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        overdriveCooldown === 0
          ? '⚡ 3-WAY OVERDRIVE READY (SPACE / ACTION)'
          : `OVERDRIVE CD: ${(overdriveCooldown / 60).toFixed(1)}s`,
        W / 2,
        H - 14
      );
    },
    getTelemetry(): Partial<GameTelemetry> {
      const statusText =
        multiShotTimer > 0
          ? `🔥 3-WAY: ${(multiShotTimer / 60).toFixed(1)}s`
          : overdriveCooldown > 0
          ? `3-WAY CD: ${(overdriveCooldown / 60).toFixed(1)}s`
          : '⚡ 3-WAY: READY';
      return {
        score,
        extraLeft: statusText,
        entitiesCount: enemies.length + bullets.length,
        gravityText: '0.00 px/f² (無外牆放射)',
      };
    },
  };
}
