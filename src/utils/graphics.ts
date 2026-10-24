export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
}

export function createParticleSystem() {
  const particles: Particle[] = [];
  const floatTexts: FloatingText[] = [];

  return {
    particles,
    floatTexts,
    spawnParticles(x: number, y: number, color: string, count: number = 8, speed: number = 3.5) {
      if (particles.length > 180) {
        particles.splice(0, count);
      }
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.3 + Math.random() * 0.7) * speed;
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 1,
          decay: 0.03 + Math.random() * 0.03,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    },
    spawnFloatText(x: number, y: number, text: string, color: string = '#38bdf8') {
      floatTexts.push({
        x,
        y,
        text,
        color,
        life: 1,
        vy: -1.2,
      });
    },
    updateAndDraw(ctx: CanvasRenderingContext2D, stepUpdate: boolean = true) {
      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (stepUpdate) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= p.decay;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
        }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }

      // Floating Texts
      for (let i = floatTexts.length - 1; i >= 0; i--) {
        const ft = floatTexts[i];
        if (stepUpdate) {
          ft.y += ft.vy;
          ft.life -= 0.025;
          if (ft.life <= 0) {
            floatTexts.splice(i, 1);
            continue;
          }
        }
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.font = 'bold 13px ui-monospace, SFMono-Regular, monospace';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      particles.length = 0;
      floatTexts.length = 0;
    },
  };
}

export function hpColor(hp: number): string {
  const hues = [190, 330, 45, 145, 270, 15, 210, 85];
  const h = hues[(Math.max(1, Math.floor(hp)) * 7) % hues.length];
  return `hsl(${h}, 90%, 58%)`;
}

export function resolveCircleRect(
  ball: { x: number; y: number; vx: number; vy: number; r: number },
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const closestX = Math.max(rx, Math.min(ball.x, rx + rw));
  const closestY = Math.max(ry, Math.min(ball.y, ry + rh));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > ball.r * ball.r) return false;

  // Normal-based reflection when ball center is outside the rectangle
  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;

    ball.x = closestX + nx * (ball.r + 0.5);
    ball.y = closestY + ny * (ball.r + 0.5);

    if (Math.abs(dx) > Math.abs(dy) * 1.05) {
      ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
    } else if (Math.abs(dy) > Math.abs(dx) * 1.05) {
      ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
    } else {
      // Exact corner impact: reflect along normal if approaching
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
      } else {
        ball.vx = -ball.vx;
        ball.vy = -ball.vy;
      }
    }
    return true;
  }

  // Fallback if ball center penetrated inside rectangle
  const overlapLeft = ball.x + ball.r - rx;
  const overlapRight = rx + rw - (ball.x - ball.r);
  const overlapTop = ball.y + ball.r - ry;
  const overlapBottom = ry + rh - (ball.y - ball.r);
  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapLeft) {
    ball.x = rx - ball.r - 0.5;
    ball.vx = -Math.abs(ball.vx);
  } else if (minOverlap === overlapRight) {
    ball.x = rx + rw + ball.r + 0.5;
    ball.vx = Math.abs(ball.vx);
  } else if (minOverlap === overlapTop) {
    ball.y = ry - ball.r - 0.5;
    ball.vy = -Math.abs(ball.vy);
  } else {
    ball.y = ry + rh + ball.r + 0.5;
    ball.vy = Math.abs(ball.vy);
  }

  return true;
}
