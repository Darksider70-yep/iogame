/**
 * Main Client Game Controller for Wings of War .io
 */

class GameClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.planeConfigs = null;
    this.gameState = {};
    this.isConnected = false;
    this.isPlaying = false;

    // Components
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new window.Renderer(this.canvas);
    this.ui = new window.UIManager();
    this.sound = window.soundEngine;

    // Input state
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.keys = {
      w: false,
      s: false,
      a: false,
      d: false,
      shift: false,
      space: false,
      e: false,
      lmb: false,
      rmb: false
    };

    // Telemetry & FPS
    this.lastFrameTime = performance.now();
    this.fpsCount = 0;
    this.fpsTimer = 0;
    this.currentFps = 60;
    this.lastPingSent = 0;
    this.ping = 20;

    this.initEventListeners();
  }

  initEventListeners() {
    // Mouse inputs
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPlaying) return;
      if (e.button === 0) this.keys.lmb = true;
      if (e.button === 2) {
        e.preventDefault();
        this.keys.rmb = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.keys.lmb = false;
      if (e.button === 2) this.keys.rmb = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      if (key === 'w') this.keys.w = true;
      if (key === 's') this.keys.s = true;
      if (key === 'a') this.keys.a = true;
      if (key === 'd') this.keys.d = true;
      if (key === 'shift') this.keys.shift = true;
      if (key === ' ') { e.preventDefault(); this.keys.space = true; }
      if (key === 'e') this.keys.e = true;

      // Quick upgrade keys 1-8
      if (key >= '1' && key <= '8') {
        const statKeys = [
          'bulletDamage', 'fireRate', 'bulletSpeed', 'speed',
          'turnRate', 'maxHp', 'hpRegen', 'boostMax'
        ];
        const idx = parseInt(key) - 1;
        if (statKeys[idx]) {
          this.sendUpgrade(statKeys[idx]);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') this.keys.w = false;
      if (key === 's') this.keys.s = false;
      if (key === 'a') this.keys.a = false;
      if (key === 'd') this.keys.d = false;
      if (key === 'shift') this.keys.shift = false;
      if (key === ' ') this.keys.space = false;
      if (key === 'e') this.keys.e = false;
    });

    // Deploy Play Button
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', () => this.joinBattle());
    }

    // Enter key on name input
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.joinBattle();
      });
    }

    // Respawn Button
    const respawnBtn = document.getElementById('respawnBtn');
    if (respawnBtn) {
      respawnBtn.addEventListener('click', () => this.respawnBattle());
    }

    // Sound toggle button
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const enabled = this.sound.toggle();
        soundBtn.textContent = enabled ? '🔊 SFX ON' : '🔇 SFX OFF';
      });
    }

    // Click on upgrade deck buttons
    const upgButtons = document.querySelectorAll('.upg-btn');
    upgButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.upgrade-item');
        if (item && item.dataset.stat) {
          this.sendUpgrade(item.dataset.stat);
        }
      });
    });
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.startPingLoop();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'init') {
          this.playerId = msg.id;
          this.planeConfigs = msg.planeConfig;
          this.gameState.world = msg.world;
          this.gameState.clouds = msg.clouds;
          this.gameState.islands = msg.islands;
        } else if (msg.type === 'state') {
          this.handleStateUpdate(msg.data);
        } else if (msg.type === 'pong') {
          this.ping = Date.now() - msg.time;
          const pingEl = document.getElementById('hudPing');
          if (pingEl) pingEl.textContent = `${this.ping} ms`;
        }
      } catch (err) {
        console.error('Error parsing server message', err);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      setTimeout(() => this.connect(), 2000);
    };
  }

  startPingLoop() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', time: Date.now() }));
      }
    }, 2000);
  }

  joinBattle() {
    this.sound.init();
    this.sound.startEngineSound();

    if (!this.isConnected) {
      this.connect();
    }

    const nameInput = document.getElementById('playerNameInput');
    const playerName = nameInput ? nameInput.value : 'Ace Pilot';

    const sendJoin = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'join',
          name: playerName,
          planeClass: 'biplane_scout'
        }));

        document.getElementById('lobbyScreen').classList.remove('active');
        document.getElementById('lobbyScreen').classList.add('hidden');
        document.getElementById('gameHud').classList.remove('hidden');
        this.isPlaying = true;
      } else {
        setTimeout(sendJoin, 100);
      }
    };

    sendJoin();
  }

  respawnBattle() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const select = document.getElementById('respawnClassSelect');
      const chosenClass = select ? select.value : 'biplane_scout';

      this.ws.send(JSON.stringify({
        type: 'respawn',
        planeClass: chosenClass
      }));

      document.getElementById('deathScreen').classList.add('hidden');
      this.isPlaying = true;
      this.sound.startEngineSound();
    }
  }

  sendUpgrade(statKey) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'upgrade',
        stat: statKey
      }));
    }
  }

  sendEvolve(classKey) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'evolve',
        classKey: classKey
      }));
    }
  }

  handleStateUpdate(stateData) {
    this.gameState = {
      ...this.gameState,
      ...stateData,
      clouds: stateData.clouds || this.gameState.clouds,
      islands: stateData.islands || this.gameState.islands,
      world: stateData.world || this.gameState.world
    };

    // Process transient audio/visual events
    if (stateData.events && stateData.events.length > 0) {
      const self = stateData.self;
      stateData.events.forEach(evt => {
        const distToSelf = self ? Math.hypot(evt.x - self.x, evt.y - self.y) : 9999;
        const isNearby = distToSelf < 1400;

        if (evt.type === 'explosion') {
          if (isNearby) {
            this.renderer.createExplosion(evt.x, evt.y, evt.radius, evt.projType);
            this.sound.playExplosion(evt.radius > 60);
          }
        } else if (evt.type === 'crate_pickup') {
          if (evt.playerId === this.playerId) {
            this.sound.playPickup();
          }
        } else if (evt.type === 'plane_crash') {
          if (isNearby) {
            this.renderer.createExplosion(evt.x, evt.y, 80, 'bullet');
            this.sound.playExplosion(true);
          }
        } else if (evt.type === 'special_fx') {
          if (evt.effect === 'heavy_rockets' && isNearby) {
            this.sound.playRocketLaunch();
          }
        } else if (evt.type === 'medal' && evt.playerId === this.playerId) {
          this.ui.showMedal(evt.medal.toUpperCase(), 'Outstanding Flight Combat');
        }
      });
    }

    // Check if player died
    if (stateData.self && stateData.self.hp <= 0 && this.isPlaying) {
      this.isPlaying = false;
      this.sound.stopEngine();
      this.ui.showDeathScreen(stateData.self);
    }

    // Update HUD & UI
    this.ui.updateHUD(stateData, this.playerId, this.planeConfigs);
    this.ui.updateKillfeed(stateData.killFeed);
  }

  sendInputs() {
    if (!this.isPlaying || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Calculate angle from screen center to mouse position
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const aimAngle = Math.atan2(this.mouse.y - centerY, this.mouse.x - centerX);

    const isShooting = this.keys.lmb || this.keys.space;
    const isBoosting = this.keys.w || this.keys.shift;
    const isBraking = this.keys.s;
    const isSpecial = this.keys.e || this.keys.rmb;

    this.ws.send(JSON.stringify({
      type: 'input',
      data: {
        targetAngle: aimAngle,
        shooting: isShooting,
        boosting: isBoosting,
        braking: isBraking,
        special: isSpecial
      }
    }));
  }

  updateAudio() {
    if (!this.isPlaying) return;
    const self = this.gameState.self;
    if (self) {
      const isBoosting = this.keys.w || this.keys.shift;
      const isBraking = this.keys.s;
      const isShooting = this.keys.lmb || this.keys.space;
      this.sound.updateEngine(1.0, isBoosting, isBraking);
      if (isShooting && !self.ovh) {
        const isHeavy = self.cls === 'bf109_interceptor' || self.cls === 'me262_jet' || self.cls === 'b17_fortress';
        const interval = self.cls === 'mustang_p51' ? 0.08 : self.cls === 'spitfire_ace' ? 0.09 : 0.12;
        this.sound.playShoot(isHeavy, interval);
      }
    }
  }

  start() {
    this.connect();
    this.inputAccumulator = 0;

    const loop = (timestamp) => {
      const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
      this.lastFrameTime = timestamp;

      // FPS tracking
      this.fpsCount++;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 0.5) {
        this.currentFps = Math.round(this.fpsCount / this.fpsTimer);
        this.fpsCount = 0;
        this.fpsTimer = 0;
        const fpsEl = document.getElementById('hudFps');
        if (fpsEl) fpsEl.textContent = `${this.currentFps} FPS`;
      }

      // Throttled input broadcast to server (Fixed 30Hz network tick)
      this.inputAccumulator += dt;
      if (this.inputAccumulator >= 1 / 30) {
        this.sendInputs();
        this.inputAccumulator = 0;
      }

      // Audio update
      this.updateAudio();

      // Render update with full entity interpolation
      const self = this.gameState.self;
      this.renderer.update(dt, self, this.gameState.planes || []);
      this.renderer.render(this.gameState, this.playerId);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameClient = new GameClient();
  window.gameClient.start();
});
