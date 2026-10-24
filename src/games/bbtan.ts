import { GameEngine, GameTelemetry } from '../types/game';
import { createParticleSystem, hpColor, resolveCircleRect } from '../utils/graphics';
import { Sound } from '../utils/sound';

interface Brick {
  col: number;
  row: number;
  hp: number;
  maxHp: number;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Item {
  col: number;
  row: number;
  type: 'PLUS_BALL' | 'LASER_H' | 'LASER_V';
  triggered?: boolean;
  hitBalls?: Set<number>;
}

interface LaserBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

export function initBBTAN(
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
  const CELL = 54;
  const PAD_X = (W - COLS * CELL) / 2;
  const TOP_Y = 56;
  const FLOOR_Y = H - 56;
  const MIN_ANGLE = -Math.PI + 0.16;
  const MAX_ANGLE = -0.16;

  let turn = 1;
  let totalBalls = 2; // Start with 2 balls
  let bonusBallsNextTurn = 0;
  let nextBallId = 1;
  let launchX = W / 2;
  let nextLaunchX: number | null = null;
  let state: 'AIMING' | 'FIRING' = 'AIMING';
  let aimAngle = -Math.PI / 2;
  let isDragging = false;
  let isCancelZone = false;

  let balls: Ball[] = [];
  let bricks: Brick[] = [];
  let items: Item[] = [];
  let laserBeams: LaserBeam[] = [];

  let fireQueue = 0;
  let fireCooldown = 0;
  let fireAngle = -Math.PI / 2;
  let speedMult = 1;

  function spawnRow(rowIdx: number, hpBase: number) {
    // Shuffle columns
    const cols = [0, 1, 2, 3, 4, 5, 6];
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }

    // 100% guaranteed 1 PLUS_BALL (+1) item per row
    items.push({ col: cols[0], row: rowIdx, type: 'PLUS_BALL' });

    // Spawn 2 ~ 4 bricks
    const brickCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= brickCount; i++) {
      const c = cols[i];
      const isElite = hpBase >= 5 && Math.random() < 0.15;
      const hp = isElite ? Math.ceil(hpBase * 1.5) : hpBase;
      bricks.push({ col: c, row: rowIdx, hp, maxHp: hp });
    }

    // 25% chance to spawn a LASER_H or LASER_V in an empty slot
    if (Math.random() < 0.25 && brickCount + 1 < cols.length) {
      const laserCol = cols[brickCount + 1];
      items.push({
        col: laserCol,
        row: rowIdx,
        type: Math.random() < 0.5 ? 'LASER_H' : 'LASER_V',
        triggered: false,
        hitBalls: new Set<number>(),
      });
    }
  }

  // Only spawn row 1 at game start (gives full 7 rows of buffer space)
  spawnRow(1, 1);

  function clampAim(angle: number): number {
    return Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle));
  }

  function updateAimFromPoint(x: number, y: number) {
    const startY = FLOOR_Y - 6;
    if (y >= FLOOR_Y - 8) {
      isCancelZone = true;
      return;
    }
    isCancelZone = false;
    const rawAng = Math.atan2(y - startY, x - launchX);
    aimAngle = clampAim(rawAng);
  }

  function startFiring(angle: number) {
    if (state !== 'AIMING') return;
    fireAngle = clampAim(angle);
    fireQueue = totalBalls;
    fireCooldown = 0;
    nextLaunchX = null;
    isDragging = false;
    isCancelZone = false;
    state = 'FIRING';
    Sound.shoot();
  }

  function endTurn() {
    balls = [];
    if (nextLaunchX !== null) {
      launchX = Math.max(PAD_X + 16, Math.min(W - PAD_X - 16, nextLaunchX));
    }
    totalBalls += bonusBallsNextTurn;
    bonusBallsNextTurn = 0;
    turn++;
    speedMult = 1;
    callbacks.onScoreUpdate(turn);

    // Filter out laser items that were triggered during this turn
    items = items.filter(it => !it.triggered);

    // Move existing bricks down 1 row; reinforce +1 HP every 3 turns
    for (const b of bricks) {
      b.row += 1;
      if (turn % 3 === 0) {
        b.hp += 1;
      }
    }
    for (const it of items) {
      it.row += 1;
      if (it.hitBalls) it.hitBalls.clear();
    }

    items = items.filter(it => TOP_Y + (it.row + 1) * CELL < FLOOR_Y - 10);

    for (const b of bricks) {
      if (TOP_Y + (b.row + 1) * CELL >= FLOOR_Y - 6) {
        callbacks.onGameOver(turn, '方塊已推升到底部防線！');
        return;
      }
    }

    spawnRow(1, turn);
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
      if (state === 'AIMING') {
        isDragging = true;
        updateAimFromPoint(x, y);
      }
    },
    onPointerMove(x: number, y: number) {
      if (state === 'AIMING') {
        updateAimFromPoint(x, y);
      }
    },
    onPointerUp(x: number, y: number) {
      if (state === 'AIMING') {
        updateAimFromPoint(x, y);
        if (!isCancelZone) {
          startFiring(aimAngle);
        } else {
          isDragging = false;
          isCancelZone = false;
        }
      }
    },
    onNudge(dir: -1 | 1) {
      if (state === 'AIMING') {
        isCancelZone = false;
        aimAngle = clampAim(aimAngle + dir * 0.06);
      }
    },
    onActionButton() {
      if (state === 'AIMING') {
        startFiring(aimAngle);
      }
    },
    update() {
      const steps = state === 'FIRING' ? speedMult * 2 : 1;
      for (let s = 0; s < steps; s++) {
        if (state !== 'FIRING') break;

        if (fireQueue > 0) {
          if (fireCooldown <= 0) {
            const spd = 6.4;
            balls.push({
              id: nextBallId++,
              x: launchX,
              y: FLOOR_Y - 7,
              vx: Math.cos(fireAngle) * spd,
              vy: Math.sin(fireAngle) * spd,
              r: 6,
            });
            fireQueue--;
            fireCooldown = 4;
          } else {
            fireCooldown--;
          }
        }

        for (let i = balls.length - 1; i >= 0; i--) {
          const ball = balls[i];
          ball.x += ball.vx;
          ball.y += ball.vy;

          // Walls
          if (ball.x - ball.r < PAD_X) {
            ball.x = PAD_X + ball.r;
            ball.vx = Math.abs(ball.vx);
            Sound.bounce();
          } else if (ball.x + ball.r > W - PAD_X) {
            ball.x = W - PAD_X - ball.r;
            ball.vx = -Math.abs(ball.vx);
            Sound.bounce();
          }
          if (ball.y - ball.r < TOP_Y) {
            ball.y = TOP_Y + ball.r;
            ball.vy = Math.abs(ball.vy);
            Sound.bounce();
          }

          // Anti-horizontal deadlock
          if (Math.abs(ball.vy) < 0.28) {
            ball.vy = ball.vy >= 0 ? 0.38 : -0.38;
          }

          // Floor landing
          if (ball.y + ball.r >= FLOOR_Y && ball.vy > 0) {
            if (nextLaunchX === null) nextLaunchX = ball.x;
            balls.splice(i, 1);
            continue;
          }

          // Bricks collision
          for (let j = bricks.length - 1; j >= 0; j--) {
            const br = bricks[j];
            const rx = PAD_X + br.col * CELL + 3;
            const ry = TOP_Y + br.row * CELL + 3;
            const rw = CELL - 6;
            const rh = CELL - 6;

            if (resolveCircleRect(ball, rx, ry, rw, rh)) {
              br.hp -= 1;
              Sound.hit(br.hp * 14);
              fx.spawnParticles(ball.x, ball.y, hpColor(br.hp + 1), 4, 2.5);

              if (br.hp <= 0) {
                fx.spawnParticles(rx + rw / 2, ry + rh / 2, '#38bdf8', 12, 4);
                bricks.splice(j, 1);
              }
              break;
            }
          }

          // Items collision (Laser stays active for the entire turn, triggered once per unique ball.id)
          for (let j = items.length - 1; j >= 0; j--) {
            const it = items[j];
            const ix = PAD_X + it.col * CELL + CELL / 2;
            const iy = TOP_Y + it.row * CELL + CELL / 2;
            const dist = Math.hypot(ball.x - ix, ball.y - iy);

            if (dist < ball.r + 14) {
              if (it.type === 'PLUS_BALL') {
                bonusBallsNextTurn++;
                Sound.powerup();
                fx.spawnFloatText(ix, iy, '+1 BALL', '#fbbf24');
                items.splice(j, 1);
              } else {
                if (!it.hitBalls) it.hitBalls = new Set<number>();
                if (!it.hitBalls.has(ball.id)) {
                  it.hitBalls.add(ball.id);
                  it.triggered = true;
                  Sound.laser();

                  if (it.type === 'LASER_H') {
                    laserBeams.push({ x1: PAD_X, y1: iy, x2: W - PAD_X, y2: iy, life: 1 });
                    for (let k = bricks.length - 1; k >= 0; k--) {
                      if (bricks[k].row === it.row) {
                        bricks[k].hp -= 1;
                        if (bricks[k].hp <= 0) {
                          const rx = PAD_X + bricks[k].col * CELL + CELL / 2;
                          const ry = TOP_Y + bricks[k].row * CELL + CELL / 2;
                          fx.spawnParticles(rx, ry, '#e879f9', 8, 3.5);
                          bricks.splice(k, 1);
                        }
                      }
                    }
                  } else if (it.type === 'LASER_V') {
                    laserBeams.push({ x1: ix, y1: TOP_Y, x2: ix, y2: FLOOR_Y, life: 1 });
                    for (let k = bricks.length - 1; k >= 0; k--) {
                      if (bricks[k].col === it.col) {
                        bricks[k].hp -= 1;
                        if (bricks[k].hp <= 0) {
                          const rx = PAD_X + bricks[k].col * CELL + CELL / 2;
                          const ry = TOP_Y + bricks[k].row * CELL + CELL / 2;
                          fx.spawnParticles(rx, ry, '#e879f9', 8, 3.5);
                          bricks.splice(k, 1);
                        }
                      }
                    }
                  }
                }
              }
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

      // Arena border
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(PAD_X, TOP_Y, COLS * CELL, FLOOR_Y - TOP_Y);

      // Danger floor line
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD_X, FLOOR_Y - CELL);
      ctx.lineTo(W - PAD_X, FLOOR_Y - CELL);
      ctx.stroke();
      ctx.setLineDash([]);

      // Aiming trajectory ray with 1st wall reflection preview
      if (state === 'AIMING') {
        if (isCancelZone && isDragging) {
          ctx.fillStyle = '#f43f5e';
          ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('✕ 放開取消射擊', W / 2, FLOOR_Y - 22);
        } else {
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 6]);

          const startX = launchX;
          const startY = FLOOR_Y - 6;
          const dx = Math.cos(aimAngle);
          const dy = Math.sin(aimAngle);

          let tMin = 340;
          let hitWall: 'LEFT' | 'RIGHT' | 'TOP' | null = null;

          if (dx < -0.001) {
            const tLeft = (PAD_X + 6 - startX) / dx;
            if (tLeft > 0 && tLeft < tMin) {
              tMin = tLeft;
              hitWall = 'LEFT';
            }
          } else if (dx > 0.001) {
            const tRight = (W - PAD_X - 6 - startX) / dx;
            if (tRight > 0 && tRight < tMin) {
              tMin = tRight;
              hitWall = 'RIGHT';
            }
          }
          if (dy < -0.001) {
            const tTop = (TOP_Y + 6 - startY) / dy;
            if (tTop > 0 && tTop < tMin) {
              tMin = tTop;
              hitWall = 'TOP';
            }
          }

          const hitX = startX + dx * tMin;
          const hitY = startY + dy * tMin;

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(hitX, hitY);

          if (hitWall) {
            const rdx = hitWall === 'LEFT' || hitWall === 'RIGHT' ? -dx : dx;
            const rdy = hitWall === 'TOP' ? -dy : dy;
            const bounceLen = 110;
            ctx.lineTo(
              Math.max(PAD_X + 6, Math.min(W - PAD_X - 6, hitX + rdx * bounceLen)),
              Math.max(TOP_Y + 6, Math.min(FLOOR_Y - 6, hitY + rdy * bounceLen))
            );
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Bricks
      for (const br of bricks) {
        const rx = PAD_X + br.col * CELL + 3;
        const ry = TOP_Y + br.row * CELL + 3;
        const rw = CELL - 6;
        const rh = CELL - 6;
        const col = hpColor(br.hp);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
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
        const iy = TOP_Y + it.row * CELL + CELL / 2;
        ctx.beginPath();
        ctx.arc(ix, iy, 12, 0, Math.PI * 2);

        if (it.type === 'PLUS_BALL') {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+1', ix, iy);
        } else {
          ctx.fillStyle = it.triggered ? 'rgba(232, 121, 249, 0.25)' : 'transparent';
          ctx.fill();
          ctx.strokeStyle = '#e879f9';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.fillStyle = '#e879f9';
          ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(it.type === 'LASER_H' ? '━' : '┃', ix, iy);
        }
      }

      // Laser animations
      for (let i = laserBeams.length - 1; i >= 0; i--) {
        const lb = laserBeams[i];
        ctx.strokeStyle = `rgba(232, 121, 249, ${lb.life})`;
        ctx.lineWidth = 6 * lb.life;
        ctx.beginPath();
        ctx.moveTo(lb.x1, lb.y1);
        ctx.lineTo(lb.x2, lb.y2);
        ctx.stroke();
        lb.life -= 0.08;
        if (lb.life <= 0) laserBeams.splice(i, 1);
      }

      // Launcher character
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(launchX, FLOOR_Y - 6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`x${totalBalls}`, launchX, FLOOR_Y + 14);

      if (nextLaunchX !== null) {
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(nextLaunchX, FLOOR_Y - 6, 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Active balls
      ctx.fillStyle = '#f8fafc';
      for (const b of balls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    getTelemetry(): Partial<GameTelemetry> {
      return {
        score: turn,
        extraLeft: `BALLS: ${totalBalls}${bonusBallsNextTurn ? ` (+${bonusBallsNextTurn})` : ''} · ${speedMult}X`,
        entitiesCount: bricks.length + balls.length,
        gravityText: '0.00 px/f² (無重力純幾何)',
      };
    },
  };
}
