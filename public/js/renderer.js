/**
 * Canvas 2D Game Renderer with Camera interpolation, Parallax Ocean, Clouds, Particles, and Tracers.
 */

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 3000, y: 3000, zoom: 1.0, targetZoom: 1.0 };
    this.screenShake = 0;
    this.propSpinAngle = 0;
    this.particles = [];
    this.waveOffset = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  addScreenShake(intensity) {
    this.screenShake = Math.min(25, this.screenShake + intensity);
  }

  addParticle(p) {
    this.particles.push(p);
  }

  createExplosion(x, y, radius = 60, projType = 'bullet') {
    const isLarge = radius > 50;
    const count = isLarge ? 35 : 18;

    this.addScreenShake(isLarge ? 12 : 5);

    // Shockwave ring
    this.addParticle({
      type: 'shockwave',
      x, y,
      r: 10,
      maxR: radius * 1.5,
      life: 0.35,
      maxLife: 0.35,
      color: '#ffa502'
    });

    // Fire and smoke debris
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 200 + 50) * (isLarge ? 1.5 : 1.0);
      this.addParticle({
        type: 'fire',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 8 + 6,
        life: Math.random() * 0.4 + 0.3,
        maxLife: 0.7,
        color: Math.random() > 0.4 ? '#ff4757' : '#ffa502'
      });

      // Dark smoke plume
      this.addParticle({
        type: 'smoke',
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * (speed * 0.4),
        vy: Math.sin(angle) * (speed * 0.4),
        r: Math.random() * 12 + 10,
        life: Math.random() * 0.8 + 0.5,
        maxLife: 1.3,
        color: 'rgba(30, 41, 59, '
      });
    }
  }

  update(dt, selfPlayer) {
    this.propSpinAngle += dt * 35;
    this.waveOffset += dt * 15;

    // Smooth Camera Follow
    if (selfPlayer) {
      this.camera.x += (selfPlayer.x - this.camera.x) * Math.min(1, dt * 6.0);
      this.camera.y += (selfPlayer.y - this.camera.y) * Math.min(1, dt * 6.0);

      // Camera zoom dynamic with speed / boost
      this.camera.targetZoom = selfPlayer.bst ? 0.88 : 0.95;
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * Math.min(1, dt * 3.0);

      // Damaged plane smoke trail
      const hpRatio = selfPlayer.hp / selfPlayer.mhp;
      if (hpRatio < 0.45) {
        this.addParticle({
          type: 'smoke',
          x: selfPlayer.x - Math.cos(selfPlayer.a) * 20,
          y: selfPlayer.y - Math.sin(selfPlayer.a) * 20,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          r: Math.random() * 8 + 6,
          life: 0.6,
          maxLife: 0.6,
          color: hpRatio < 0.2 ? 'rgba(239, 68, 68, ' : 'rgba(51, 65, 85, '
        });
      }
    }

    // Screen Shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'shockwave') {
        const prog = 1 - (p.life / p.maxLife);
        p.r = 10 + (p.maxR - 10) * prog;
      } else {
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        p.r *= (1 + dt * 0.4); // expand
      }
    }
  }

  render(gameState, selfId) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.save();

    // Screen Shake Offset
    let shakeX = (Math.random() - 0.5) * this.screenShake;
    let shakeY = (Math.random() - 0.5) * this.screenShake;

    // Apply Camera Transform
    ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Draw Ocean Water Background
    this.drawOcean(ctx, gameState.world);

    // 2. Draw World Boundaries
    this.drawWorldBounds(ctx, gameState.world);

    // 3. Draw Islands & Flak Towers
    this.drawIslands(ctx, gameState.islands, gameState.flakTowers);

    // 4. Draw Supply Crates
    this.drawCrates(ctx, gameState.crates);

    // 5. Draw Dreadnought Zeppelins
    if (gameState.zeppelins) {
      gameState.zeppelins.forEach(z => window.PlaneModels.drawZeppelin(ctx, z));
    }

    // 6. Draw Planes
    if (gameState.planes) {
      gameState.planes.forEach(p => {
        ctx.save();
        if (p.cld) ctx.globalAlpha = 0.35; // Cloud stealth transparency
        window.PlaneModels.drawPlane(ctx, p, this.propSpinAngle);
        this.drawPlaneHUD(ctx, p, p.id === selfId);
        ctx.restore();
      });
    }

    // 7. Draw Projectiles & Tracers
    this.drawProjectiles(ctx, gameState.projectiles);

    // 8. Draw Particle Effects
    this.drawParticles(ctx);

    // 9. Draw Volumetric Clouds on top (semi-transparent ceiling)
    this.drawClouds(ctx, gameState.clouds);

    ctx.restore();
  }

  drawOcean(ctx, world) {
    const w = world ? world.width : 6000;
    const h = world ? world.height : 6000;

    // Deep naval sea blue
    ctx.fillStyle = '#0f2438';
    ctx.fillRect(0, 0, w, h);

    // Grid water ripples
    ctx.strokeStyle = 'rgba(76, 224, 210, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 120;

    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Animated gentle wave lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    for (let y = 100; y < h; y += 280) {
      for (let x = 100; x < w; x += 320) {
        ctx.beginPath();
        const offsetX = Math.sin((y + this.waveOffset) * 0.02) * 15;
        ctx.arc(x + offsetX, y, 20, 0, Math.PI * 0.6);
        ctx.stroke();
      }
    }
  }

  drawWorldBounds(ctx, world) {
    const w = world ? world.width : 6000;
    const h = world ? world.height : 6000;

    ctx.strokeStyle = 'rgba(255, 71, 87, 0.6)';
    ctx.lineWidth = 6;
    ctx.setLineDash([20, 15]);
    ctx.strokeRect(0, 0, w, h);
    ctx.setLineDash([]);
  }

  drawIslands(ctx, islands = [], flakTowers = []) {
    islands.forEach(isl => {
      // Sand rim
      ctx.fillStyle = '#d4a373';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius, 0, Math.PI * 2);
      ctx.fill();

      // Lush Jungle Center
      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Fortress bunker concrete
      ctx.fillStyle = '#475569';
      ctx.fillRect(isl.x - 22, isl.y - 22, 44, 44);
    });

    // Flak Turret Gun Barrels
    flakTowers.forEach(flak => {
      if (flak.dead) return;
      ctx.save();
      ctx.translate(flak.x, flak.y);
      ctx.rotate(flak.a);

      // Gun base
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#e5a93b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Dual heavy flak barrels
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, -5, 20, 4);
      ctx.fillRect(4, 1, 20, 4);
      ctx.restore();
    });
  }

  drawCrates(ctx, crates = []) {
    crates.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);

      // Floating bob shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(4, 6, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crate box
      let color = '#e5a93b'; // gold
      let icon = '★';
      if (c.type === 'repair') { color = '#2ed573'; icon = '+'; }
      else if (c.type === 'ammo') { color = '#ffa502'; icon = '⚡'; }
      else if (c.type === 'fuel') { color = '#4ce0d2'; icon = '▲'; }

      // Glow beacon
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fillStyle = color + '22';
      ctx.fill();

      // Box body
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeRect(-12, -12, 24, 24);

      // Icon symbol
      ctx.fillStyle = color;
      ctx.font = 'bold 12px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 0, 1);

      ctx.restore();
    });
  }

  drawPlaneHUD(ctx, p, isSelf) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Nametag
    ctx.font = 'bold 11px Chakra Petch, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = isSelf ? '#4ce0d2' : p.bot ? '#cbd5e1' : '#f1f2f6';
    ctx.fillText(`${p.n} [Lvl ${p.lvl}]`, 0, -38);

    // Mini Health Bar
    const hpRatio = Math.max(0, Math.min(1, p.hp / p.mhp));
    const barW = 44;
    const barH = 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(-barW / 2, -32, barW, barH);

    ctx.fillStyle = isSelf ? '#4ce0d2' : hpRatio > 0.4 ? '#2ed573' : '#ff4757';
    ctx.fillRect(-barW / 2, -32, barW * hpRatio, barH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barW / 2, -32, barW, barH);

    ctx.restore();
  }

  drawProjectiles(ctx, projectiles = []) {
    projectiles.forEach(proj => {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(proj.a);

      if (proj.t === 'rocket') {
        // Rocket Body
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-10, -3, 20, 6);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(10, -3);
        ctx.lineTo(16, 0);
        ctx.lineTo(10, 3);
        ctx.closePath();
        ctx.fill();

        // Rocket exhaust trail
        ctx.fillStyle = '#ffa502';
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(-24 - Math.random() * 8, 0);
        ctx.lineTo(-10, 2);
        ctx.closePath();
        ctx.fill();
      } else if (proj.t === 'bomb') {
        // Aerial Bomb
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-10, -5, 4, 10);
      } else if (proj.t === 'heavy_cannon') {
        // Glowing Heavy 30mm/37mm Tracer
        ctx.fillStyle = '#ffa502';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(2, 0, 8, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Machine gun tracer round
        ctx.fillStyle = '#e5a93b';
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -1, 8, 2);
      }

      ctx.restore();
    });
  }

  drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      const alpha = Math.max(0, p.life / p.maxLife);

      if (p.type === 'shockwave') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 165, 2, ${alpha * 0.8})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (p.type === 'smoke') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${alpha * 0.45})`;
        ctx.fill();
      } else if (p.type === 'fire') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
      }
      ctx.restore();
    });
  }

  drawClouds(ctx, clouds = []) {
    clouds.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);

      // Fluffy Cloud Puffs
      ctx.fillStyle = 'rgba(240, 246, 252, 0.45)';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = 20;

      for (let i = 0; i < c.puffCount; i++) {
        const pAngle = (i / c.puffCount) * Math.PI * 2;
        const dist = c.radius * 0.45;
        const px = Math.cos(pAngle) * dist;
        const py = Math.sin(pAngle) * dist;
        const pRad = c.radius * 0.55;

        ctx.beginPath();
        ctx.arc(px, py, pRad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center core
      ctx.beginPath();
      ctx.arc(0, 0, c.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }
}

window.Renderer = Renderer;
