/**
 * Lightweight Canvas Confetti for Game Over Celebration
 */
class ConfettiShower {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.animationId = null;
    this.colors = ['#fbbf24', '#f59e0b', '#10b981', '#38bdf8', '#f43f5e', '#a855f7', '#ffffff'];

    if (this.canvas) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start(duration = 4000) {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    this.stop();

    const count = 120;
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * -this.canvas.height * 0.5,
        w: Math.random() * 9 + 5,
        h: Math.random() * 5 + 4,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    const startTime = Date.now();

    const loop = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const elapsed = Date.now() - startTime;

      let allDead = true;

      for (let p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        if (elapsed > duration * 0.7) {
          p.opacity -= 0.02;
        }

        if (p.y < this.canvas.height && p.opacity > 0) {
          allDead = false;
          this.ctx.save();
          this.ctx.globalAlpha = Math.max(0, p.opacity);
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rotation * Math.PI) / 180);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          this.ctx.restore();
        }
      }

      if (!allDead && elapsed < duration) {
        this.animationId = requestAnimationFrame(loop);
      } else {
        this.stop();
      }
    };

    loop();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

window.confetti = new ConfettiShower('confettiCanvas');
