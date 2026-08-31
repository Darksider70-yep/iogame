/**
 * Procedural vector drawing engine for WW2 Warbirds and Dreadnought Zeppelins.
 */
const PlaneModels = {
  drawPlane(ctx, plane, propSpinAngle = 0) {
    const clsKey = plane.cls || 'biplane_scout';
    const isBoosting = plane.bst;
    const isInvulnerable = plane.inv;
    const bank = plane.bk || 0; // -1 to 1

    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.a);

    // Apply 3D banking perspective scale
    ctx.scale(1, 1 - Math.abs(bank) * 0.25);

    // Draw Plane Shadow first
    this.drawShadow(ctx, clsKey);

    // Invulnerability shield shimmer
    if (isInvulnerable) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, (plane.r || 24) + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(76, 224, 210, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(76, 224, 210, 0.15)';
      ctx.fill();
      ctx.restore();
    }

    // Render specific warbird model
    if (clsKey === 'biplane_scout') {
      this.drawBiplane(ctx, propSpinAngle);
    } else if (clsKey === 'spitfire_ace') {
      this.drawSpitfire(ctx, propSpinAngle, isBoosting);
    } else if (clsKey === 'fokker_triplane') {
      this.drawFokkerTriplane(ctx, propSpinAngle);
    } else if (clsKey === 'bf109_interceptor') {
      this.drawBF109(ctx, propSpinAngle, isBoosting);
    } else if (clsKey === 'b17_fortress') {
      this.drawB17(ctx, propSpinAngle, plane);
    } else if (clsKey === 'stuka_dive') {
      this.drawStuka(ctx, propSpinAngle, isBoosting);
    } else if (clsKey === 'me262_jet') {
      this.drawMe262(ctx, isBoosting);
    } else if (clsKey === 'mustang_p51') {
      this.drawMustang(ctx, propSpinAngle, isBoosting);
    } else {
      this.drawBiplane(ctx, propSpinAngle);
    }

    ctx.restore();
  },

  drawShadow(ctx, clsKey) {
    ctx.save();
    ctx.translate(14, 18);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // 1. SOPWITH CAMEL BIPLANE
  drawBiplane(ctx, propAngle) {
    // Wings (Dual wings)
    ctx.fillStyle = '#6b705c';
    ctx.strokeStyle = '#3f4238';
    ctx.lineWidth = 1.5;

    // Lower wing
    ctx.fillRect(-10, -32, 14, 64);
    ctx.strokeRect(-10, -32, 14, 64);

    // Fuselage
    ctx.fillStyle = '#b7b7a4';
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(8, -7);
    ctx.lineTo(-24, -4);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-24, 4);
    ctx.lineTo(8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Upper wing
    ctx.fillStyle = '#a5a58d';
    ctx.fillRect(-6, -34, 14, 68);
    ctx.strokeRect(-6, -34, 14, 68);

    // Tail Fin
    ctx.fillStyle = '#cb997e';
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-30, -12);
    ctx.lineTo(-32, 12);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-2, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Propeller
    this.drawPropeller(ctx, 22, 0, propAngle, 16);
  },

  // 2. SPITFIRE ACE
  drawSpitfire(ctx, propAngle, isBoosting) {
    // Elliptical Wings (Camouflage RAF)
    ctx.fillStyle = '#4f5d2f';
    ctx.strokeStyle = '#283618';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.ellipse(2, 0, 14, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Yellow wing tips
    ctx.fillStyle = '#e5a93b';
    ctx.fillRect(-2, -40, 8, 4);
    ctx.fillRect(-2, 36, 8, 4);

    // Fuselage
    ctx.fillStyle = '#606c38';
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(12, -7);
    ctx.lineTo(-26, -3);
    ctx.lineTo(-32, 0);
    ctx.lineTo(-26, 3);
    ctx.lineTo(12, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // RAF Roundels on wings
    this.drawRoundel(ctx, 2, -24, 6);
    this.drawRoundel(ctx, 2, 24, 6);

    // Cockpit Glass
    ctx.fillStyle = '#90e0ef';
    ctx.beginPath();
    ctx.ellipse(2, 0, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail Stabilizers
    ctx.fillStyle = '#4f5d2f';
    ctx.fillRect(-28, -14, 8, 28);

    // Propeller
    this.drawPropeller(ctx, 28, 0, propAngle, 18);

    if (isBoosting) this.drawThrustFlame(ctx, -32, 0, 1.2);
  },

  // 3. FOKKER TRIPLANE (RED BARON)
  drawFokkerTriplane(ctx, propAngle) {
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;

    // 3 Wings
    ctx.fillRect(-14, -28, 10, 56);
    ctx.fillRect(-4, -32, 11, 64);
    ctx.fillRect(6, -30, 10, 60);

    // Fuselage
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(10, -7);
    ctx.lineTo(-24, -4);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-24, 4);
    ctx.lineTo(10, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Balkenkreuz Crosses
    this.drawCross(ctx, 6, -20);
    this.drawCross(ctx, 6, 20);

    // Cockpit
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-28, -12, 6, 24);

    this.drawPropeller(ctx, 24, 0, propAngle, 16);
  },

  // 4. MESSERSCHMITT BF-109
  drawBF109(ctx, propAngle, isBoosting) {
    // Angular Luftwaffe Wings
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-2, -38);
    ctx.lineTo(-12, -38);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, 38);
    ctx.lineTo(-2, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Yellow nose cowling
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(14, -6);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fill();

    // Fuselage
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(14, -6);
    ctx.lineTo(-28, -3);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-28, 3);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 20mm Center nose cannon tip
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(28, -1.5, 6, 3);

    // Cockpit squared canopy
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-2, -3.5, 10, 7);

    // Tail
    ctx.fillStyle = '#475569';
    ctx.fillRect(-30, -14, 6, 28);

    this.drawPropeller(ctx, 30, 0, propAngle, 18);
    if (isBoosting) this.drawThrustFlame(ctx, -34, 0, 1.3);
  },

  // 5. B-17 FLYING FORTRESS
  drawB17(ctx, propAngle, plane) {
    // Massive Olive Drab Wings
    ctx.fillStyle = '#3f4f34';
    ctx.strokeStyle = '#242f1e';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -56);
    ctx.lineTo(-24, -56);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-24, 56);
    ctx.lineTo(-10, 56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4 Engines on wings
    [-38, -20, 20, 38].forEach(yPos => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-6, yPos - 3, 16, 6);
      this.drawPropeller(ctx, 10, yPos, propAngle, 10);
    });

    // Heavy Fuselage
    ctx.fillStyle = '#4a5d3e';
    ctx.beginPath();
    ctx.moveTo(38, 0);
    ctx.lineTo(18, -11);
    ctx.lineTo(-36, -6);
    ctx.lineTo(-44, 0);
    ctx.lineTo(-36, 6);
    ctx.lineTo(18, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glass Nose & Cockpit
    ctx.fillStyle = '#90e0ef';
    ctx.beginPath();
    ctx.arc(28, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(8, -4, 10, 8);

    // Tail Turret (Automated 360 rear gunner)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-42, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-48, -1.5, 6, 3);

    // Tail Fins
    ctx.fillStyle = '#3f4f34';
    ctx.fillRect(-38, -24, 10, 48);
  },

  // 6. STUKA DIVE BOMBER
  drawStuka(ctx, propAngle, isBoosting) {
    // Inverted Gull Wings
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(2, -22);
    ctx.lineTo(-6, -42);
    ctx.lineTo(-16, -42);
    ctx.lineTo(-8, -22);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-8, 22);
    ctx.lineTo(-16, 42);
    ctx.lineTo(-6, 42);
    ctx.lineTo(2, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Heavy 37mm Bordkanone gun pods under wings
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-2, -26, 18, 4);
    ctx.fillRect(-2, 22, 18, 4);

    // Fuselage
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(10, -7);
    ctx.lineTo(-28, -4);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-28, 4);
    ctx.lineTo(10, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-4, -3.5, 12, 7);

    // Tail
    ctx.fillStyle = '#334155';
    ctx.fillRect(-30, -16, 6, 32);

    this.drawPropeller(ctx, 28, 0, propAngle, 18);
    if (isBoosting) this.drawThrustFlame(ctx, -34, 0, 1.4);
  },

  // 7. ME-262 SCHWALBE JET
  drawMe262(ctx, isBoosting) {
    // Swept wings
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -38);
    ctx.lineTo(-20, -38);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-20, 38);
    ctx.lineTo(-10, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Jumo 004 Jet Engines
    [-18, 18].forEach(yPos => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-12, yPos - 5, 24, 10);

      // Jet exhaust flame
      this.drawThrustFlame(ctx, -12, yPos, isBoosting ? 1.6 : 0.9, true);
    });

    // Sleek Fuselage
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(12, -7);
    ctx.lineTo(-28, -4);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-28, 4);
    ctx.lineTo(12, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4x 30mm nose cannon ports
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(24, -3, 6, 2);
    ctx.fillRect(24, 1, 6, 2);

    // Teardrop Canopy
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(2, 0, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = '#475569';
    ctx.fillRect(-30, -14, 6, 28);
  },

  // 8. P-51 MUSTANG
  drawMustang(ctx, propAngle, isBoosting) {
    // Silver Polished Aluminum Wings
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-2, -38);
    ctx.lineTo(-14, -38);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 38);
    ctx.lineTo(-2, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red Nose Cowling
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(16, -6);
    ctx.lineTo(16, 6);
    ctx.closePath();
    ctx.fill();

    // Fuselage
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.lineTo(-28, -4);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-28, 4);
    ctx.lineTo(16, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bubble Canopy
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // USAAF Stars & Bars
    this.drawStar(ctx, -2, -22, 5);
    this.drawStar(ctx, -2, 22, 5);

    // Tail
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-30, -14, 6, 28);

    this.drawPropeller(ctx, 30, 0, propAngle, 18);
    if (isBoosting) this.drawThrustFlame(ctx, -34, 0, 1.3);
  },

  // HELPER: PROPELLER BLUR
  drawPropeller(ctx, x, y, angle, radius) {
    ctx.save();
    ctx.translate(x, y);

    // Spinning Blur Disk
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(229, 169, 59, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Prop blades
    ctx.rotate(angle);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-radius, -1.5, radius * 2, 3);
    ctx.restore();
  },

  // HELPER: THRUST / AFTERBURNER FLAME
  drawThrustFlame(ctx, x, y, scale = 1, isJet = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -4 * scale);
    ctx.lineTo(-20 * scale - Math.random() * 8, 0);
    ctx.lineTo(0, 4 * scale);
    ctx.closePath();
    ctx.fillStyle = isJet ? '#00d2d3' : '#ff9f43';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -2 * scale);
    ctx.lineTo(-12 * scale - Math.random() * 4, 0);
    ctx.lineTo(0, 2 * scale);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  },

  // HELPER: RAF ROUNDEL
  drawRoundel(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1d4ed8';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
  },

  // HELPER: BALKENKREUZ CROSS
  drawCross(ctx, x, y) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 1, y - 5, 2, 10);
    ctx.fillRect(x - 5, y - 1, 10, 2);
  },

  // HELPER: STAR
  drawStar(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // DREADNOUGHT ZEPPELIN BOSS
  drawZeppelin(ctx, zep) {
    ctx.save();
    ctx.translate(zep.x, zep.y);
    ctx.rotate(zep.a);

    // Massive Shadow
    ctx.save();
    ctx.translate(35, 45);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 75, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dirigible Hull (Steel plates)
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.ellipse(0, 0, 70, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Steel Ribs
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    [-40, -20, 0, 20, 40].forEach(xOff => {
      ctx.beginPath();
      ctx.moveTo(xOff, -25);
      ctx.lineTo(xOff, 25);
      ctx.stroke();
    });

    // Gondola Command Cabin
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-15, -6, 30, 12);

    // Tail Fins
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-70, -22, 14, 44);

    // 3 Rotating Flak Turrets
    const turretOffsets = [-45, 0, 45];
    const turretsAngles = zep.turrets || [0, 0, 0];

    turretOffsets.forEach((xOff, idx) => {
      const tAngle = turretsAngles[idx] || 0;
      ctx.save();
      ctx.translate(xOff, 0);

      // Turret Base
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#e5a93b';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Gun Barrel rotated to world aim relative to zep
      ctx.rotate(tAngle - zep.a);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, -2, 14, 4);
      ctx.restore();
    });

    // Zeppelin HP Bar
    const hpRatio = zep.hp / zep.maxHp;
    ctx.rotate(-zep.a); // un-rotate for HP bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(-45, -45, 90, 8);
    ctx.fillStyle = hpRatio > 0.4 ? '#e5a93b' : '#ff4757';
    ctx.fillRect(-45, -45, 90 * hpRatio, 8);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-45, -45, 90, 8);

    ctx.restore();
  }
};

window.PlaneModels = PlaneModels;
