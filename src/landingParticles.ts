export let isLandingActive = false;
let animationFrameId: number | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

const INACTIVE_THEME = {
  particleColor: 'rgba(68, 136, 255, 0.4)',
  lineColor: 'rgba(68, 136, 255, 0.15)'
};

const ACTIVE_THEME = {
  particleColor: 'rgba(0, 229, 255, 0.8)',
  lineColor: 'rgba(0, 229, 255, 0.4)'
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
}

const particles: Particle[] = [];
const particleCount = 100;
const mouse = {
  x: 0,
  y: 0,
  isMoving: false
};

let mouseTimeout: number | undefined;

export function initLandingParticles() {
  canvas = document.getElementById('landing-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  if (!ctx) return;

  isLandingActive = true;
  resizeCanvas();

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('mousemove', onMouseMove);

  // Initialize particles
  particles.length = 0;
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      radius: Math.random() * 2 + 1,
      baseRadius: Math.random() * 2 + 1
    });
  }

  animate();
}

export function stopLandingParticles() {
  isLandingActive = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('mousemove', onMouseMove);

  // Clear canvas one last time just in case
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function onMouseMove(e: MouseEvent) {
  if (!isLandingActive || !canvas) return;

  // Get relative coordinates in case the canvas styling shifts
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;

  mouse.isMoving = true;

  if (mouseTimeout) {
    clearTimeout(mouseTimeout);
  }

  mouseTimeout = window.setTimeout(() => {
    mouse.isMoving = false;
  }, 100);
}

function animate() {
  if (!isLandingActive || !ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update and draw particles
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Move
    p.x += p.vx;
    p.y += p.vy;

    // Bounce off edges
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

    // Interact with mouse
    const dx = mouse.x - p.x;
    const dy = mouse.y - p.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const interactionRadius = 150;

    let theme = INACTIVE_THEME;

    if (distance < interactionRadius) {
      theme = ACTIVE_THEME;

      // Gentle push away from cursor when nearby, proportional to distance
      const forceDirectionX = dx / distance;
      const forceDirectionY = dy / distance;
      const force = (interactionRadius - distance) / interactionRadius;

      // Repel force
      p.vx -= forceDirectionX * force * 0.5;
      p.vy -= forceDirectionY * force * 0.5;

      // Add slight friction
      p.vx *= 0.95;
      p.vy *= 0.95;

      p.radius = p.baseRadius + (force * 2);
    } else {
      // Revert to normal speed and size gradually
      p.radius += (p.baseRadius - p.radius) * 0.1;

      // Add minimal random jitter and enforce maximum speed
      p.vx += (Math.random() - 0.5) * 0.1;
      p.vy += (Math.random() - 0.5) * 0.1;

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 2) {
        p.vx = (p.vx / speed) * 2;
        p.vy = (p.vy / speed) * 2;
      }
    }

    // Draw particle
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = theme.particleColor;
    ctx.fill();

    // Draw lines to nearby particles
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dx2 = p.x - p2.x;
      const dy2 = p.y - p2.y;
      const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      const maxLineDist = 100;
      if (distance2 < maxLineDist) {
        ctx.beginPath();
        // Line opacity scales by distance
        const opacity = 1 - (distance2 / maxLineDist);

        ctx.strokeStyle = `rgba(68, 136, 255, ${opacity * 0.3})`;

        // Boost line visibility if both particles are near the mouse
        if (distance < interactionRadius && Math.sqrt(Math.pow(mouse.x - p2.x, 2) + Math.pow(mouse.y - p2.y, 2)) < interactionRadius) {
          ctx.strokeStyle = `rgba(0, 229, 255, ${opacity * 0.6})`;
        }

        ctx.lineWidth = 1;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  animationFrameId = requestAnimationFrame(animate);
}
