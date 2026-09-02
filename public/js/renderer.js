/**
 * Canvas 2D Game Renderer with Smooth Lookahead Camera, Dynamic Contrails, Parallax Ocean, Clouds, and Interpolation.
 */

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 3000, y: 3000, zoom: 0.94, targetZoom: 0.94 };
    this.propSpinAngle = 0;
    this.particles = [];
    this.waveOffset = 0;
    this.planeRenderStates = new Map(); // id -> { x, y, a, bk, vx, vy }

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  addParticle(p) {
    this.particles.push(p);
  }

  createExplosion(x, y, radius = 60, projType = 'bullet') {
    const isLarge = radius > 50;
    const count = isLarge ? 25 : 12;

    // Shockwave ring
    this.addParticle({
      type: 'shockwave',
      x, y,
      r: 10,
      maxR: radius * 1.4,
      life: 0.3,
      maxLife: 0.3,
      color: '#ffa502'
    });

    // Fire and smoke debris
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 180 + 40) * (isLarge ? 1.4 : 1.0);
      this.addParticle({
        type: 'fire',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 7 + 5,
        life: Math.random() * 0.35 + 0.25,
        maxLife: 0.6,
        color: Math.random() > 0.4 ? '#ff4757' : '#ffa502'
      });

      // Dark smoke plume
      this.addParticle({
        type: 'smoke',
        x: x + (Math.random() - 0.5) * 15,
        y: y + (Math.random() - 0.5) * 15,
        vx: Math.cos(angle) * (speed * 0.35),
        vy: Math.sin(angle) * (speed * 0.35),
        r: Math.random() * 10 + 8,
        life: Math.random() * 0.7 + 0.4,
        maxLife: 1.1,
        color: 'rgba(30, 41, 59, '
      });
    }
  }

  update(dt, selfPlayer, planes = []) {
    this.propSpinAngle += dt * 35;
    this.waveOffset += dt * 15;

    // Update Plane Interpolation States
    planes.forEach(p => {
      let state = this.planeRenderStates.get(p.id);
      if (!state) {
        state = {
          x: p.x,
          y: p.y,
          a: p.a,
          bk: p.bk || 0,
          vx: p.vx || 0,
          vy: p.vy || 0
        };
        this.planeRenderStates.set(p.id, state);
      } else {
        // Smooth 60 FPS interpolation towards server state
        const lerpPos = Math.min(1, dt * 15.0);
        state.x += (p.x - state.x) * lerpPos;
        state.y += (p.y - state.y) * lerpPos;

        // Angle lerp shortest path
        let angleDiff = p.a - state.a;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        state.a += angleDiff * Math.min(1, dt * 18.0);

        state.bk += ((p.bk || 0) - state.bk) * Math.min(1, dt * 12.0);
      }

      // Aerodynamic Wingtip Contrails (Tight Turns or Nitro Boost)
      const isHighG = Math.abs(state.bk) > 0.45 || p.bst;
      if (isHighG && Math.random() > 0.3) {
        const wingDist = (p.r || 24) * 0.9;
        const perpX = -Math.sin(state.a);
        const perpY = Math.cos(state.a);

        [-1, 1].forEach(side => {
          this.addParticle({
            type: 'contrail',
            x: state.x + perpX * (wingDist * side) - Math.cos(state.a) * 8,
            y: state.y + perpY * (wingDist * side) - Math.sin(state.a) * 8,
            vx: -Math.cos(state.a) * 20,
            vy: -Math.sin(state.a) * 20,
            r: p.bst ? 3.5 : 2.0,
            life: 0.3,
            maxLife: 0.3,
            color: 'rgba(255, 255, 255, '
          });
        });
      }
    });

    // Clean up disconnected planes
    const activeIds = new Set(planes.map(p => p.id));
    for (let id of this.planeRenderStates.keys()) {
      if (!activeIds.has(id)) {
        this.planeRenderStates.delete(id);
      }
    }

    // Dynamic Lookahead Smooth Camera Follow (Rock Steady, No Shake)
    if (selfPlayer) {
      const selfState = this.planeRenderStates.get(selfPlayer.id) || selfPlayer;
      const lookDist = selfPlayer.bst ? 120 : 70;
      const targetCamX = selfState.x + Math.cos(selfState.a) * lookDist;
      const targetCamY = selfState.y + Math.sin(selfState.a) * lookDist;

      const camLerp = Math.min(1, dt * 7.5);
      this.camera.x += (targetCamX - this.camera.x) * camLerp;
      this.camera.y += (targetCamY - this.camera.y) * camLerp;

      // Camera dynamic zoom based on boost
      this.camera.targetZoom = selfPlayer.bst ? 0.90 : 0.96;
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * Math.min(1, dt * 2.5);

      // Damaged plane smoke trail
      const hpRatio = selfPlayer.hp / selfPlayer.mhp;
      if (hpRatio < 0.45) {
        this.addParticle({
          type: 'smoke',
          x: selfState.x - Math.cos(selfState.a) * 20,
          y: selfState.y - Math.sin(selfState.a) * 20,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          r: Math.random() * 7 + 5,
          life: 0.5,
          maxLife: 0.5,
          color: hpRatio < 0.2 ? 'rgba(239, 68, 68, ' : 'rgba(51, 65, 85, '
        });
      }
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
        p.r *= (1 + dt * 0.3);
      }
    }
  }

  render(gameState, selfId) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.save();

    // 100% Steady Camera Transform (Zero Shake)
    ctx.translate(width / 2, height / 2);
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

    // 6. Draw Particles (Smoke, Contrails, Shockwaves)
    this.drawParticles(ctx);

    // 7. Draw Planes with Smoothed Interpolation
    if (gameState.planes) {
      gameState.planes.forEach(p => {
        const smoothState = this.planeRenderStates.get(p.id) || p;
        const renderPlane = {
          ...p,
          x: smoothState.x,
          y: smoothState.y,
          a: smoothState.a,
          bk: smoothState.bk
        };

        ctx.save();
        if (p.cld) ctx.globalAlpha = 0.35; // Cloud stealth
        window.PlaneModels.drawPlane(ctx, renderPlane, this.propSpinAngle);
        this.drawPlaneHUD(ctx, renderPlane, p.id === selfId);
        ctx.restore();
      });
    }

    // 8. Draw Projectiles & Tracers
    this.drawProjectiles(ctx, gameState.projectiles);

    // 9. Draw Volumetric Clouds
    this.drawClouds(ctx, gameState.clouds);

    ctx.restore();
  }

  getViewportBounds(pad = 100) {
    const halfW = (this.canvas.width / 2) / this.camera.zoom + pad;
    const halfH = (this.canvas.height / 2) / this.camera.zoom + pad;
    return {
      minX: this.camera.x - halfW,
      maxX: this.camera.x + halfW,
      minY: this.camera.y - halfH,
      maxY: this.camera.y + halfH
    };
  }

  drawOcean(ctx, world) {
    const w = world ? world.width : 6000;
    const h = world ? world.height : 6000;
    const vp = this.getViewportBounds(150);

    ctx.fillStyle = '#0f2438';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(76, 224, 210, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 120;

    const startX = Math.max(0, Math.floor(vp.minX / gridSize) * gridSize);
    const endX = Math.min(w, Math.ceil(vp.maxX / gridSize) * gridSize);
    const startY = Math.max(0, Math.floor(vp.minY / gridSize) * gridSize);
    const endY = Math.min(h, Math.ceil(vp.maxY / gridSize) * gridSize);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, Math.max(0, vp.minY));
      ctx.lineTo(x, Math.min(h, vp.maxY));
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(Math.max(0, vp.minX), y);
      ctx.lineTo(Math.min(w, vp.maxX), y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 2;
    const waveStepX = 320;
    const waveStepY = 280;
    const waveStartX = Math.max(100, Math.floor(vp.minX / waveStepX) * waveStepX);
    const waveEndX = Math.min(w, Math.ceil(vp.maxX / waveStepX) * waveStepX);
    const waveStartY = Math.max(100, Math.floor(vp.minY / waveStepY) * waveStepY);
    const waveEndY = Math.min(h, Math.ceil(vp.maxY / waveStepY) * waveStepY);

    for (let y = waveStartY; y <= waveEndY; y += waveStepY) {
      for (let x = waveStartX; x <= waveEndX; x += waveStepX) {
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
    const vp = this.getViewportBounds(200);

    islands.forEach(isl => {
      if (isl.x < vp.minX || isl.x > vp.maxX || isl.y < vp.minY || isl.y > vp.maxY) return;
      ctx.fillStyle = '#d4a373';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#475569';
      ctx.fillRect(isl.x - 22, isl.y - 22, 44, 44);
    });

    flakTowers.forEach(flak => {
      if (flak.dead) return;
      if (flak.x < vp.minX || flak.x > vp.maxX || flak.y < vp.minY || flak.y > vp.maxY) return;
      ctx.save();
      ctx.translate(flak.x, flak.y);
      ctx.rotate(flak.a);

      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#e5a93b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, -5, 20, 4);
      ctx.fillRect(4, 1, 20, 4);
      ctx.restore();
    });
  }

  drawCrates(ctx, crates = []) {
    const vp = this.getViewportBounds(60);

    crates.forEach(c => {
      if (c.x < vp.minX || c.x > vp.maxX || c.y < vp.minY || c.y > vp.maxY) return;
      ctx.save();
      ctx.translate(c.x, c.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(4, 6, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      let color = '#e5a93b';
      let icon = '★';
      if (c.type === 'repair') { color = '#2ed573'; icon = '+'; }
      else if (c.type === 'ammo') { color = '#ffa502'; icon = '⚡'; }
      else if (c.type === 'fuel') { color = '#4ce0d2'; icon = '▲'; }

      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fillStyle = color + '22';
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeRect(-12, -12, 24, 24);

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

    ctx.font = 'bold 11px Chakra Petch, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = isSelf ? '#4ce0d2' : p.bot ? '#cbd5e1' : '#f1f2f6';
    ctx.fillText(`${p.n} [Lvl ${p.lvl}]`, 0, -38);

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
    const vp = this.getViewportBounds(50);

    projectiles.forEach(proj => {
      if (proj.x < vp.minX || proj.x > vp.maxX || proj.y < vp.minY || proj.y > vp.maxY) return;
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(proj.a);

      if (proj.t === 'rocket') {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-10, -3, 20, 6);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(10, -3);
        ctx.lineTo(16, 0);
        ctx.lineTo(10, 3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffa502';
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(-24 - Math.random() * 8, 0);
        ctx.lineTo(-10, 2);
        ctx.closePath();
        ctx.fill();
      } else if (proj.t === 'bomb') {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-10, -5, 4, 10);
      } else if (proj.t === 'heavy_cannon') {
        ctx.fillStyle = '#ffa502';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(2, 0, 8, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#e5a93b';
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -1, 8, 2);
      }

      ctx.restore();
    });
  }

  drawParticles(ctx) {
    const vp = this.getViewportBounds(40);

    this.particles.forEach(p => {
      if (p.x < vp.minX || p.x > vp.maxX || p.y < vp.minY || p.y > vp.maxY) return;
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
      } else if (p.type === 'contrail') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.35})`;
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
    const vp = this.getViewportBounds(250);

    clouds.forEach(c => {
      if (c.x < vp.minX || c.x > vp.maxX || c.y < vp.minY || c.y > vp.maxY) return;
      ctx.save();
      ctx.translate(c.x, c.y);

      // Clean, hardware-accelerated volumetric clouds without software shadowBlur
      ctx.fillStyle = 'rgba(240, 246, 252, 0.42)';

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

      ctx.beginPath();
      ctx.arc(0, 0, c.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }
}

window.Renderer = Renderer;
