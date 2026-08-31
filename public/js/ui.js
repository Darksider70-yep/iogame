/**
 * UI Manager for HUD, Radar Minimap, Compass, Evolution Modals, Upgrade Deck, and Lead Reticle.
 */

class UIManager {
  constructor() {
    this.radarCanvas = document.getElementById('radarCanvas');
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;
    this.medalTimer = null;
    this.lastEvolutionsHash = '';
  }

  updateHUD(state, selfId, planeConfigs) {
    if (!state || !state.self) return;
    const self = state.self;

    // Pilot info
    const nameEl = document.getElementById('hudPilotName');
    const classEl = document.getElementById('hudPlaneClass');
    const lvlEl = document.getElementById('hudLevelBadge');
    const xpFill = document.getElementById('hudXpFill');
    const xpText = document.getElementById('hudXpText');

    if (nameEl) nameEl.textContent = self.n;
    if (classEl) {
      const cfg = planeConfigs ? planeConfigs[self.cls] : null;
      classEl.textContent = cfg ? cfg.name : self.cls;
    }
    if (lvlEl) lvlEl.textContent = `LVL ${self.lvl}`;

    if (xpFill && xpText) {
      const xpRatio = Math.max(0, Math.min(1, (self.xp || 0) / (self.nxp || 1)));
      xpFill.style.width = `${(xpRatio * 100).toFixed(1)}%`;
      xpText.textContent = `${self.xp || 0} / ${self.nxp || 100} XP`;
    }

    // Health Armor Bar
    const hpFill = document.getElementById('hpFill');
    const hpVal = document.getElementById('hpValueText');
    if (hpFill && hpVal) {
      const hpRatio = Math.max(0, Math.min(1, self.hp / self.mhp));
      hpFill.style.width = `${(hpRatio * 100).toFixed(1)}%`;
      hpVal.textContent = `${self.hp} / ${self.mhp}`;
    }

    // Overheat Bar
    const heatFill = document.getElementById('heatFill');
    const heatStatus = document.getElementById('heatStatusText');
    if (heatFill && heatStatus) {
      const heatVal = self.heat || 0;
      heatFill.style.width = `${heatVal}%`;
      if (self.ovh) {
        heatStatus.textContent = 'OVERHEATED!';
        heatStatus.style.color = '#ff4757';
      } else {
        heatStatus.textContent = heatVal > 70 ? 'HIGH HEAT' : 'NORMAL';
        heatStatus.style.color = heatVal > 70 ? '#ffa502' : '#f1f2f6';
      }
    }

    // Boost Nitro Bar
    const boostFill = document.getElementById('boostFill');
    const boostVal = document.getElementById('boostValueText');
    if (boostFill && boostVal) {
      const bRatio = Math.max(0, Math.min(1, (self.bstVal || 0) / (self.bstMax || 100)));
      boostFill.style.width = `${(bRatio * 100).toFixed(1)}%`;
      boostVal.textContent = `${Math.round(bRatio * 100)}%`;
    }

    // Special Ability Status
    const spWidget = document.getElementById('specialAbilityWidget');
    const spName = document.getElementById('specialName');
    const spStatus = document.getElementById('specialStatus');
    const spOverlay = document.getElementById('specialCooldownOverlay');

    if (spWidget && planeConfigs && planeConfigs[self.cls]) {
      const spCfg = planeConfigs[self.cls].special;
      if (spCfg) {
        spName.textContent = spCfg.name;
        if (self.spCd > 0) {
          spStatus.textContent = `RECHARGING (${self.spCd}s)`;
          spStatus.className = 'special-status';
          const cdRatio = Math.min(1, self.spCd / spCfg.cooldown);
          spOverlay.style.height = `${cdRatio * 100}%`;
        } else {
          spStatus.textContent = 'READY [E / RMB]';
          spStatus.className = 'special-status ready';
          spOverlay.style.height = '0%';
        }
      }
    }

    // Upgrade Points & Stat Bars
    const ptsEl = document.getElementById('upgradePointsCount');
    if (ptsEl) ptsEl.textContent = self.pts || 0;

    const upgItems = document.querySelectorAll('.upgrade-item');
    upgItems.forEach(item => {
      const statKey = item.dataset.stat;
      const lvl = (self.upg && self.upg[statKey]) || 0;
      const barFill = item.querySelector('.bar-fill');
      const btn = item.querySelector('.upg-btn');
      if (barFill) barFill.style.width = `${(lvl / 8) * 100}%`;
      if (btn) btn.disabled = (self.pts || 0) <= 0 || lvl >= 8;
    });

    // Compass Tape Heading
    const compass = document.getElementById('compassTape');
    if (compass) {
      let deg = Math.round((self.a * 180) / Math.PI);
      while (deg < 0) deg += 360;
      while (deg >= 360) deg -= 360;
      const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const cardIdx = Math.round(deg / 45) % 8;
      compass.textContent = `HEADING ${deg}° [${cardinals[cardIdx]}]`;
    }

    // Leaderboard
    this.updateLeaderboard(state.leaderboard, selfId);

    // Radar Minimap
    this.drawRadar(state, self);

    // Check Evolutions Modal
    this.checkEvolutionsModal(self.evos, planeConfigs);
  }

  updateLeaderboard(leaderboard = [], selfId) {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;

    listEl.innerHTML = '';
    leaderboard.forEach(entry => {
      const item = document.createElement('div');
      item.className = `leader-item ${entry.id === selfId ? 'is-self' : ''} ${entry.isKing ? 'is-king' : ''}`;
      const crown = entry.isKing ? '👑 ' : '';
      item.innerHTML = `
        <span>${entry.rank}. ${crown}${entry.name}</span>
        <span>${entry.score}</span>
      `;
      listEl.appendChild(item);
    });
  }

  updateKillfeed(killFeed = []) {
    const feedEl = document.getElementById('killFeed');
    if (!feedEl) return;

    feedEl.innerHTML = '';
    killFeed.slice(0, 5).forEach(k => {
      const item = document.createElement('div');
      item.className = 'kill-item';
      item.innerHTML = `<span class="killer">${k.killer}</span> downed <span class="victim">${k.victim}</span>`;
      feedEl.appendChild(item);
    });
  }

  showMedal(title, subtitle) {
    const banner = document.getElementById('medalBanner');
    const tEl = document.getElementById('medalTitle');
    const sEl = document.getElementById('medalSubtitle');
    if (!banner || !tEl || !sEl) return;

    tEl.textContent = title;
    sEl.textContent = subtitle || 'Dogfight Ace Achievement';
    banner.classList.remove('hidden');

    if (window.soundEngine) window.soundEngine.playMedal();

    if (this.medalTimer) clearTimeout(this.medalTimer);
    this.medalTimer = setTimeout(() => {
      banner.classList.add('hidden');
    }, 3500);
  }

  drawRadar(state, self) {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = 180;
    const h = 180;
    const worldW = state.world ? state.world.width : 6000;
    const worldH = state.world ? state.world.height : 6000;

    ctx.clearRect(0, 0, w, h);

    const scaleX = w / worldW;
    const scaleY = h / worldH;

    // Draw Islands on radar
    if (state.islands) {
      ctx.fillStyle = '#2d6a4f';
      state.islands.forEach(isl => {
        ctx.beginPath();
        ctx.arc(isl.x * scaleX, isl.y * scaleY, isl.radius * scaleX, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw Boss Zeppelins
    if (state.zeppelins) {
      ctx.fillStyle = '#e5a93b';
      state.zeppelins.forEach(z => {
        ctx.beginPath();
        ctx.arc(z.x * scaleX, z.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw Enemy Planes
    if (state.planes) {
      state.planes.forEach(p => {
        if (p.id === self.id) return;
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(p.x * scaleX, p.y * scaleY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw Self Blip (Green with heading line)
    ctx.fillStyle = '#2ed573';
    const sx = self.x * scaleX;
    const sy = self.y * scaleY;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2ed573';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(self.a) * 8, sy + Math.sin(self.a) * 8);
    ctx.stroke();
  }

  checkEvolutionsModal(evolutions = [], planeConfigs) {
    const modal = document.getElementById('evolutionModal');
    const container = document.getElementById('evolutionOptions');
    if (!modal || !container) return;

    if (!evolutions || evolutions.length === 0) {
      modal.classList.add('hidden');
      this.lastEvolutionsHash = '';
      return;
    }

    const currentHash = evolutions.join(',');
    if (currentHash === this.lastEvolutionsHash) return;
    this.lastEvolutionsHash = currentHash;

    container.innerHTML = '';
    evolutions.forEach(evoKey => {
      const cfg = planeConfigs ? planeConfigs[evoKey] : null;
      if (!cfg) return;

      const card = document.createElement('div');
      card.className = 'evo-option-card';
      card.innerHTML = `
        <h3>${cfg.name}</h3>
        <span class="nickname">${cfg.nickname}</span>
        <p>${cfg.description}</p>
        <button class="evo-select-btn" data-key="${evoKey}">SELECT WARBIRD</button>
      `;

      card.querySelector('.evo-select-btn').addEventListener('click', () => {
        if (window.gameClient) {
          window.gameClient.sendEvolve(evoKey);
        }
        modal.classList.add('hidden');
      });

      container.appendChild(card);
    });

    modal.classList.remove('hidden');
  }

  showDeathScreen(self, lastAttackerName) {
    const deathScreen = document.getElementById('deathScreen');
    const deathBy = document.getElementById('deathKilledBy');
    const scoreVal = document.getElementById('finalScore');
    const killsVal = document.getElementById('finalKills');
    const lvlVal = document.getElementById('finalLevel');

    if (deathBy) deathBy.textContent = `Shot down by ${lastAttackerName || 'Enemy Flak'}`;
    if (scoreVal) scoreVal.textContent = self ? self.sc : 0;
    if (killsVal) killsVal.textContent = self ? self.k : 0;
    if (lvlVal) lvlVal.textContent = self ? self.lvl : 1;

    if (deathScreen) deathScreen.classList.remove('hidden');
  }
}

window.UIManager = UIManager;
