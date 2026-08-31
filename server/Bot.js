const Player = require('./Player');
const { PLANE_CLASSES, UPGRADE_TYPES } = require('./planeConfig');

const BOT_NAMES = [
  'Red Baron', 'Maverick', 'Viper', 'Goose', 'Iceman', 'Richthofen',
  'Sky Hunter', 'Thunderbolt', 'Iron Wing', 'Corsair', 'Night Hawk',
  'Spitfire Sally', 'Ghost Rider', 'Ace Combat', 'Sky Wolf', 'Balkenkreuz'
];

class Bot extends Player {
  constructor(id) {
    const randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + '_' + Math.floor(Math.random() * 90 + 10);
    super(id, randomName, true, 'biplane_scout');

    this.target = null;
    this.state = 'patrol'; // 'patrol', 'attack', 'evade', 'gather'
    this.stateTimer = 0;
    this.decisionTimer = 0;
    this.patrolTargetX = 0;
    this.patrolTargetY = 0;
  }

  aiUpdate(dt, worldWidth, worldHeight, allPlayers, allCrates, allZeppelins) {
    if (this.isDead) return;

    this.decisionTimer -= dt;
    this.stateTimer -= dt;

    // Auto allocate upgrade points
    if (this.availableUpgradePoints > 0) {
      const stats = [
        UPGRADE_TYPES.BULLET_DAMAGE,
        UPGRADE_TYPES.FIRE_RATE,
        UPGRADE_TYPES.SPEED,
        UPGRADE_TYPES.MAX_HP,
        UPGRADE_TYPES.TURN_RATE
      ];
      const pick = stats[Math.floor(Math.random() * stats.length)];
      this.applyUpgrade(pick);
    }

    // Auto evolve
    if (this.availableEvolutions.length > 0) {
      const chosenEvo = this.availableEvolutions[Math.floor(Math.random() * this.availableEvolutions.length)];
      this.evolve(chosenEvo);
    }

    // High level decision making every 0.3s
    if (this.decisionTimer <= 0) {
      this.decisionTimer = 0.25 + Math.random() * 0.15;

      // Check health status
      const hpRatio = this.hp / this.maxHp;

      if (hpRatio < 0.35 && allCrates.length > 0) {
        // Find nearest repair or score crate
        let nearestCrate = null;
        let minDist = 1500;
        for (let i = 0; i < allCrates.length; i++) {
          const c = allCrates[i];
          const d = Math.hypot(c.x - this.x, c.y - this.y);
          if (d < minDist) {
            minDist = d;
            nearestCrate = c;
          }
        }
        if (nearestCrate) {
          this.state = 'gather';
          this.target = nearestCrate;
        }
      } else {
        // Find closest enemy player/bot
        let bestTarget = null;
        let bestDist = 1200;

        for (let i = 0; i < allPlayers.length; i++) {
          const p = allPlayers[i];
          if (p.id === this.id || p.isDead || p.inCloud) continue;
          const d = Math.hypot(p.x - this.x, p.y - this.y);
          if (d < bestDist) {
            bestDist = d;
            bestTarget = p;
          }
        }

        // If no player, check zeppelins
        if (!bestTarget && allZeppelins.length > 0) {
          for (let z of allZeppelins) {
            if (!z.isDead) {
              const d = Math.hypot(z.x - this.x, z.y - this.y);
              if (d < 1800) {
                bestTarget = z;
                break;
              }
            }
          }
        }

        if (bestTarget) {
          this.target = bestTarget;
          this.state = 'attack';
        } else if (this.state !== 'patrol' || this.stateTimer <= 0) {
          this.state = 'patrol';
          this.stateTimer = 4 + Math.random() * 4;
          this.patrolTargetX = 300 + Math.random() * (worldWidth - 600);
          this.patrolTargetY = 300 + Math.random() * (worldHeight - 600);
        }
      }
    }

    // Execute state behavior
    this.input.shooting = false;
    this.input.boosting = false;
    this.input.braking = false;
    this.input.special = false;

    if (this.state === 'attack' && this.target && !this.target.isDead) {
      const target = this.target;
      const dist = Math.hypot(target.x - this.x, target.y - this.y);

      // Calculate lead aim
      const bulletSpeed = this.getBaseStat('bulletSpeed');
      const timeToHit = Math.max(0.1, dist / bulletSpeed);
      const targetVx = target.vx || 0;
      const targetVy = target.vy || 0;
      const leadX = target.x + targetVx * timeToHit * 0.8;
      const leadY = target.y + targetVy * timeToHit * 0.8;

      const aimAngle = Math.atan2(leadY - this.y, leadX - this.x);
      this.input.targetAngle = aimAngle;

      let angleDiff = Math.abs(aimAngle - this.angle);
      while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

      // Fire when roughly facing target
      if (angleDiff < 0.35 && dist < 750) {
        this.input.shooting = true;
      }

      // Boost to close in if far, or brake if dangerously close
      if (dist > 500 && dist < 1200) {
        this.input.boosting = true;
      } else if (dist < 120) {
        this.input.braking = true;
      }

      // Special ability logic
      if (this.specialCooldown <= 0) {
        if (dist < 400 && angleDiff < 0.2) {
          this.input.special = true;
        }
      }
    } else if (this.state === 'gather' && this.target) {
      const aimAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      this.input.targetAngle = aimAngle;
      this.input.boosting = true;
    } else {
      // Patrol
      const aimAngle = Math.atan2(this.patrolTargetY - this.y, this.patrolTargetX - this.x);
      this.input.targetAngle = aimAngle;
    }

    // Avoid world bounds
    const margin = 300;
    if (this.x < margin) this.input.targetAngle = 0;
    else if (this.x > worldWidth - margin) this.input.targetAngle = Math.PI;
    if (this.y < margin) this.input.targetAngle = Math.PI / 2;
    else if (this.y > worldHeight - margin) this.input.targetAngle = -Math.PI / 2;
  }
}

module.exports = Bot;
