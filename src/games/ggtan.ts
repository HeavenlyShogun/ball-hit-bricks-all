import { GameEngine, GameTelemetry } from '../types/game';
import { createParticleSystem, hpColor } from '../utils/graphics';
import { Sound } from '../utils/sound';

interface RingNode {
  baseAngle: number;
  hp: number;
  size: number;
}

interface Ring {
  radius: number;
  angle: number;
  speed: number;
  nodes: RingNode[];
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  bounces: number;
  hitShield: boolean;
}

export function initGGTAN(
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
  const CY = 225;
  const LAUNCH_X = W / 2;
  const LAUNCH_Y = H - 54;
  const COOLDOWN_FRAMES = 16;

  let stage = 1;
  let score = 0;
  let combo = 0;
  let shieldIntegrity = 100;
  let aimAngle = -Math.PI / 2;
  let coreHp = 10;
  let fireCooldown = 0;

  let rings: Ring[] = [];
  let shots: Shot[] = [];

  function buildStage(st: number) {
    shots = [];
    coreHp = 8 + st * 4;
    shieldIntegrity = Math.min(100, shieldIntegrity + 28);
    rings = [];

    const ringConfigs = [
      { radius: 76, count: 8, speed: 0.022 * (st % 2 === 0 ? -1 : 1), gapEvery: 3 },
      { radius: 124, count: 12, speed: -0.016 * (st % 2 === 0 ? -1 : 1), gapEvery: 4 },
    ];

    if (st >= 3) {
      ringConfigs.push({
        radius: 164,
        count: 15,
        speed: 0.012 * (st % 2 === 0 ? -1 : 1),
        gapEvery: 3,
      });
    }

    for (const rc of ringConfigs) {
      const nodes: RingNode[] = [];
      for (let i = 0; i < rc.count; i++) {
        if (i % rc.gapEvery === 0) continue; // Rhythm opening gap
        nodes.push({
          baseAngle: (i / rc.count) * Math.PI * 2,
          hp: 2 + st * 2,
          size: 14,
        });
      }
      rings.push({
        radius: rc.radius,
        angle: 0,
        speed: rc.speed * (1 + st * 0.08),
        nodes,
      });
    }
  }

  buildStage(stage);

  function checkGapAlignment(): boolean {
    const dx = Math.cos(aimAngle);
    const dy = Math.sin(aimAngle);

    const toCoreX = CX - LAUNCH_X;
    const toCoreY = CY - LAUNCH_Y;
    const proj = toCoreX * dx + toCoreY * dy;
    if (proj <= 0) return false;
    const perpCoreDist = Math.hypot(toCoreX - proj * dx, toCoreY - proj * dy);
    if (perpCoreDist > 26) return false;

    for (const rg of rings) {
      for (const nd of rg.nodes) {
        const a = rg.angle + nd.baseAngle;
        const nx = CX + Math.cos(a) * rg.radius;
        const ny = CY + Math.sin(a) * rg.radius;
        const vx = nx - LAUNCH_X;
        const vy = ny - LAUNCH_Y;
        const p = vx * dx + vy * dy;
        if (p > 0 && p < proj) {
          const perp = Math.hypot(vx - p * dx, vy - p * dy);
          if (perp < nd.size + 6.5) {
            return false;
          }
        }
      }
    }
    return true;
  }

  function firePulse() {
    if (fireCooldown > 0 || shots.length >= 2) return;
    fireCooldown = COOLDOWN_FRAMES;
    shieldIntegrity = Math.max(0, shieldIntegrity - 1.2);
    const spd = 9.8;
    shots.push({
      x: LAUNCH_X,
      y: LAUNCH_Y,
      vx: Math.cos(aimAngle) * spd,
      vy: Math.sin(aimAngle) * spd,
      r: 5.5,
      bounces: 1,
      hitShield: false,
    });
    Sound.shoot();
  }

  return {
    onPointerDown(x: number, y: number) {
      if (y < LAUNCH_Y - 20) {
        const ang = Math.atan2(y - LAUNCH_Y, x - LAUNCH_X);
        aimAngle = Math.max(-Math.PI + 0.32, Math.min(-0.32, ang));
      }
    },
    onPointerMove(x: number, y: number) {
      if (y < LAUNCH_Y - 20) {
        const ang = Math.atan2(y - LAUNCH_Y, x - LAUNCH_X);
        aimAngle = Math.max(-Math.PI + 0.32, Math.min(-0.32, ang));
      }
    },
    onPointerUp() {
      firePulse();
    },
    onNudge(dir: -1 | 1) {
      aimAngle = Math.max(-Math.PI + 0.32, Math.min(-0.32, aimAngle + dir * 0.04));
    },
    onActionButton() {
      firePulse();
    },
    update() {
      if (fireCooldown > 0) fireCooldown--;

      shieldIntegrity -= 0.045;
      if (shieldIntegrity <= 0) {
        callbacks.onGameOver(
          score,
          '節奏能量耗盡！抓準旋轉縫隙直接擊中核心可觸發連擊並補充大量能量。'
        );
        return;
      }

      // Rotate geometric rings
      for (const rg of rings) {
        rg.angle += rg.speed;
      }

      // Update shots
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.x += s.vx;
        s.y += s.vy;

        if (s.x < 12 || s.x > W - 12) s.vx = -s.vx;
        if (s.y < 12 || s.y > H + 10) {
          shots.splice(i, 1);
          continue;
        }

        // Direct Core Hit
        if (Math.hypot(s.x - CX, s.y - CY) < 26 + s.r) {
          if (!s.hitShield) {
            combo++;
            const dmg = 2 + Math.min(3, Math.floor(combo / 2));
            const pts = 50 * combo;
            coreHp -= dmg;
            score += pts;
            shieldIntegrity = Math.min(100, shieldIntegrity + 9);
            Sound.coreHit(combo);
            fx.spawnParticles(CX, CY, '#fbbf24', 15, 4.5);
            fx.spawnFloatText(CX, CY - 28, `PERFECT GAP x${combo}!`, '#fbbf24');
          } else {
            coreHp -= 1;
            score += 20;
            Sound.coreHit(1);
            fx.spawnParticles(CX, CY, '#f472b6', 10, 3.8);
            fx.spawnFloatText(CX, CY - 28, 'CORE HIT +20', '#f472b6');
          }

          callbacks.onScoreUpdate(score);
          shots.splice(i, 1);

          if (coreHp <= 0) {
            stage++;
            score += 200;
            callbacks.onScoreUpdate(score);
            fx.spawnFloatText(CX, CY, `STAGE ${stage}!`, '#fbbf24');
            buildStage(stage);
            break;
          }
          continue;
        }

        // Check rotating geometric shield blocks
        let hitNode = false;
        for (const rg of rings) {
          for (let j = rg.nodes.length - 1; j >= 0; j--) {
            const nd = rg.nodes[j];
            const a = rg.angle + nd.baseAngle;
            const nx = CX + Math.cos(a) * rg.radius;
            const ny = CY + Math.sin(a) * rg.radius;

            if (Math.hypot(s.x - nx, s.y - ny) < nd.size + s.r) {
              nd.hp -= 1;
              s.hitShield = true;
              combo = 0;
              shieldIntegrity = Math.max(0, shieldIntegrity - 3.8);
              score += 10;
              callbacks.onScoreUpdate(score);
              Sound.hit(nd.hp * 25);
              fx.spawnParticles(nx, ny, hpColor(nd.hp + 1), 6, 3);
              fx.spawnFloatText(nx, ny - 14, 'SHIELD HIT! -4%', '#f43f5e');

              if (nd.hp <= 0) {
                rg.nodes.splice(j, 1);
              }

              if (s.bounces > 0) {
                s.bounces--;
                const normAng = Math.atan2(s.y - ny, s.x - nx);
                const spd = Math.hypot(s.vx, s.vy);
                s.vx = Math.cos(normAng) * spd;
                s.vy = Math.sin(normAng) * spd;
              } else {
                shots.splice(i, 1);
              }
              hitNode = true;
              break;
            }
          }
          if (hitNode) break;
        }
      }
    },
    draw() {
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, W, H);

      // Top Rhythm Energy Bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 18, W - 80, 6);
      ctx.fillStyle = shieldIntegrity > 30 ? '#f472b6' : '#ef4444';
      ctx.fillRect(40, 18, ((W - 80) * Math.max(0, shieldIntegrity)) / 100, 6);

      // Aiming Guide Line (highlights gold when rotating gaps align!)
      const isAligned = checkGapAlignment();
      ctx.strokeStyle = isAligned ? '#fbbf24' : 'rgba(244, 114, 182, 0.35)';
      ctx.lineWidth = isAligned ? 2.5 : 1.5;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(LAUNCH_X, LAUNCH_Y);
      ctx.lineTo(LAUNCH_X + Math.cos(aimAngle) * 320, LAUNCH_Y + Math.sin(aimAngle) * 320);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotating Geometric Rings & Polygon Nodes
      for (const rg of rings) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(CX, CY, rg.radius, 0, Math.PI * 2);
        ctx.stroke();

        for (const nd of rg.nodes) {
          const a = rg.angle + nd.baseAngle;
          const nx = CX + Math.cos(a) * rg.radius;
          const ny = CY + Math.sin(a) * rg.radius;

          ctx.save();
          ctx.translate(nx, ny);
          ctx.rotate(a + Math.PI / 4);
          const col = hpColor(nd.hp);

          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fillRect(-nd.size, -nd.size, nd.size * 2, nd.size * 2);
          ctx.strokeStyle = col;
          ctx.lineWidth = 2.2;
          ctx.strokeRect(-nd.size, -nd.size, nd.size * 2, nd.size * 2);
          ctx.restore();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(nd.hp), nx, ny);
        }
      }

      // Center Core Hexagon
      ctx.save();
      ctx.translate(CX, CY);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const rx = Math.cos(a) * 26;
        const ry = Math.sin(a) * 26;
        if (k === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fillStyle = isAligned ? 'rgba(251, 191, 36, 0.25)' : 'rgba(244, 114, 182, 0.2)';
      ctx.fill();
      ctx.strokeStyle = isAligned ? '#fbbf24' : '#f472b6';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(coreHp), 0, 0);
      ctx.restore();

      // Shots
      for (const s of shots) {
        ctx.fillStyle = s.hitShield ? '#f472b6' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pulse Emitter & Cooldown Ring
      ctx.fillStyle = fireCooldown > 0 ? '#64748b' : isAligned ? '#fbbf24' : '#f472b6';
      ctx.beginPath();
      ctx.arc(LAUNCH_X, LAUNCH_Y, 9, 0, Math.PI * 2);
      ctx.fill();

      if (fireCooldown > 0) {
        const ratio = 1 - fireCooldown / COOLDOWN_FRAMES;
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(LAUNCH_X, LAUNCH_Y, 13, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = isAligned ? '#fbbf24' : '#fbcfe8';
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        isAligned ? '★ GAP ALIGNED — SHOOT NOW! ★' : 'CLICK / SPACE TO SHOOT GAP',
        LAUNCH_X,
        LAUNCH_Y + 18
      );
    },
    getTelemetry(): Partial<GameTelemetry> {
      const totalNodes = rings.reduce((acc, r) => acc + r.nodes.length, 0);
      return {
        score,
        extraLeft: `STAGE ${stage} · COMBO x${combo} · EN: ${Math.ceil(shieldIntegrity)}%`,
        entitiesCount: totalNodes + shots.length,
        gravityText: '極座標旋轉 (ω ≠ 0)',
      };
    },
  };
}
