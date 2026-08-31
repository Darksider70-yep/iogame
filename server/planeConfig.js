/**
 * Plane configurations, evolution classes, base stats, and upgrade definitions.
 */

const UPGRADE_TYPES = {
  MAX_HP: 'maxHp',
  HP_REGEN: 'hpRegen',
  SPEED: 'speed',
  TURN_RATE: 'turnRate',
  BULLET_DAMAGE: 'bulletDamage',
  BULLET_SPEED: 'bulletSpeed',
  FIRE_RATE: 'fireRate',
  BOOST_CAPACITY: 'boostMax'
};

const UPGRADE_INCREMENTS = {
  maxHp: 25,
  hpRegen: 0.6,
  speed: 18,
  turnRate: 0.22,
  bulletDamage: 3.5,
  bulletSpeed: 50,
  fireRate: 0.8, // increases shots per second
  boostMax: 20
};

const MAX_UPGRADE_POINTS_PER_STAT = 8;

const PLANE_CLASSES = {
  // --- TIER 1 ---
  biplane_scout: {
    id: 'biplane_scout',
    name: 'Sopwith Camel',
    nickname: 'Scout Biplane',
    tier: 1,
    minLevel: 1,
    description: 'Nimble starter biplane with twin synchronized machine guns.',
    evolutions: ['spitfire_ace', 'fokker_triplane', 'bf109_interceptor'],
    stats: {
      maxHp: 100,
      hpRegen: 1.0,
      speed: 240,
      turnRate: 2.8,
      bulletDamage: 12,
      bulletSpeed: 650,
      fireRate: 4.5, // shots per sec
      bulletSpread: 0.04,
      bulletCount: 2,
      gunOffset: 12, // distance from center for dual guns
      boostMax: 100,
      boostDrain: 35,
      boostRegen: 18,
      boostSpeedMultiplier: 1.45,
      radius: 24
    },
    special: {
      type: 'barrel_roll',
      name: 'Evasive Roll',
      cooldown: 5.0,
      description: 'Quick barrel roll making you invulnerable to bullets for 0.6s.'
    }
  },

  // --- TIER 2 ---
  spitfire_ace: {
    id: 'spitfire_ace',
    name: 'Supermarine Spitfire',
    nickname: 'All-Round Fighter',
    tier: 2,
    minLevel: 10,
    description: 'Iconic British fighter. High fire rate, superb responsiveness, and afterburner boost.',
    evolutions: ['mustang_p51', 'b17_fortress'],
    stats: {
      maxHp: 140,
      hpRegen: 1.4,
      speed: 280,
      turnRate: 3.2,
      bulletDamage: 15,
      bulletSpeed: 750,
      fireRate: 6.5,
      bulletSpread: 0.05,
      bulletCount: 2,
      gunOffset: 16,
      boostMax: 120,
      boostDrain: 30,
      boostRegen: 22,
      boostSpeedMultiplier: 1.55,
      radius: 26
    },
    special: {
      type: 'afterburner',
      name: 'Supercharger Burst',
      cooldown: 4.5,
      description: 'Instant 1.5s turbo speed burst leaving thick smoke behind.'
    }
  },

  fokker_triplane: {
    id: 'fokker_triplane',
    name: 'Fokker Dr.I',
    nickname: 'Red Baron Triplane',
    tier: 2,
    minLevel: 10,
    description: 'Unmatched 3-wing turning agility. Tight turn circle for out-maneuvering any tail.',
    evolutions: ['stuka_dive', 'mustang_p51'],
    stats: {
      maxHp: 130,
      hpRegen: 1.6,
      speed: 250,
      turnRate: 4.2, // very high turn rate
      bulletDamage: 16,
      bulletSpeed: 700,
      fireRate: 5.5,
      bulletSpread: 0.04,
      bulletCount: 2,
      gunOffset: 10,
      boostMax: 110,
      boostDrain: 32,
      boostRegen: 20,
      boostSpeedMultiplier: 1.4,
      radius: 25
    },
    special: {
      type: 'snap_turn',
      name: '180° Snap Turn',
      cooldown: 4.0,
      description: 'Instantly pivot 180 degrees to counter trailing opponents.'
    }
  },

  bf109_interceptor: {
    id: 'bf109_interceptor',
    name: 'Messerschmitt Bf 109',
    nickname: 'Heavy Interceptor',
    tier: 2,
    minLevel: 10,
    description: 'German interceptor with high top speed and heavy 20mm center cannon.',
    evolutions: ['me262_jet', 'stuka_dive'],
    stats: {
      maxHp: 150,
      hpRegen: 1.2,
      speed: 300,
      turnRate: 2.6,
      bulletDamage: 22,
      bulletSpeed: 820,
      fireRate: 4.2,
      bulletSpread: 0.02,
      bulletCount: 1, // heavy center cannon + 2 wings
      hasHeavyCenter: true,
      gunOffset: 14,
      boostMax: 130,
      boostDrain: 35,
      boostRegen: 20,
      boostSpeedMultiplier: 1.5,
      radius: 27
    },
    special: {
      type: 'cannon_burst',
      name: 'Flak Cannon Burst',
      cooldown: 5.0,
      description: 'Fires a high-velocity 37mm explosive round.'
    }
  },

  // --- TIER 3 ---
  b17_fortress: {
    id: 'b17_fortress',
    name: 'B-17 Flying Fortress',
    nickname: 'Heavy Bomber',
    tier: 3,
    minLevel: 20,
    description: 'Heavily armored behemoth. Automated rear tail turret and heavy carpet bomb drops.',
    evolutions: [],
    stats: {
      maxHp: 320,
      hpRegen: 2.5,
      speed: 210,
      turnRate: 1.9,
      bulletDamage: 16,
      bulletSpeed: 680,
      fireRate: 4.8,
      bulletSpread: 0.06,
      bulletCount: 4, // Quad guns
      gunOffset: 22,
      hasRearTurret: true,
      rearTurretDamage: 12,
      rearTurretRange: 350,
      rearTurretFireRate: 3.5,
      boostMax: 140,
      boostDrain: 40,
      boostRegen: 15,
      boostSpeedMultiplier: 1.3,
      radius: 36
    },
    special: {
      type: 'carpet_bomb',
      name: 'Carpet Bombing',
      cooldown: 6.0,
      description: 'Drops a cluster of 4 high-explosive aerial bombs that detonate behind you.'
    }
  },

  stuka_dive: {
    id: 'stuka_dive',
    name: 'Junkers Ju 87 Stuka',
    nickname: 'Dive Bomber',
    tier: 3,
    minLevel: 20,
    description: 'Iconic dive bomber with twin 37mm Bordkanone cannons and dual heavy aerial rockets.',
    evolutions: [],
    stats: {
      maxHp: 220,
      hpRegen: 1.8,
      speed: 270,
      turnRate: 2.7,
      bulletDamage: 28,
      bulletSpeed: 780,
      fireRate: 3.8,
      bulletSpread: 0.03,
      bulletCount: 2,
      gunOffset: 20,
      boostMax: 140,
      boostDrain: 30,
      boostRegen: 22,
      boostSpeedMultiplier: 1.6,
      radius: 29
    },
    special: {
      type: 'heavy_rockets',
      name: 'Dual Heavy Rockets',
      cooldown: 4.5,
      description: 'Fires two unguided anti-plane/anti-zeppelin rockets with massive explosion radii.'
    }
  },

  me262_jet: {
    id: 'me262_jet',
    name: 'Messerschmitt Me 262',
    nickname: 'Jet Fighter Prototype',
    tier: 3,
    minLevel: 20,
    description: 'First operational jet fighter. Blistering straight-line velocity with 4x MK 108 cannons.',
    evolutions: [],
    stats: {
      maxHp: 190,
      hpRegen: 1.5,
      speed: 360,
      turnRate: 2.5,
      bulletDamage: 20,
      bulletSpeed: 950,
      fireRate: 7.0,
      bulletSpread: 0.05,
      bulletCount: 4,
      gunOffset: 12,
      isJet: true,
      boostMax: 160,
      boostDrain: 45,
      boostRegen: 25,
      boostSpeedMultiplier: 1.65,
      radius: 28
    },
    special: {
      type: 'turbo_ramjet',
      name: 'Ramjet Supersonic Dash',
      cooldown: 5.0,
      description: 'Ignites twin turbojets for extreme velocity and instant invulnerable dash.'
    }
  },

  mustang_p51: {
    id: 'mustang_p51',
    name: 'P-51D Mustang',
    nickname: 'Dominance Fighter',
    tier: 3,
    minLevel: 20,
    description: 'Six .50 caliber machine guns, immense stamina boost, and peak combat versatility.',
    evolutions: [],
    stats: {
      maxHp: 210,
      hpRegen: 2.0,
      speed: 310,
      turnRate: 3.1,
      bulletDamage: 18,
      bulletSpeed: 880,
      fireRate: 6.2,
      bulletSpread: 0.04,
      bulletCount: 4,
      gunOffset: 18,
      boostMax: 180,
      boostDrain: 25,
      boostRegen: 26,
      boostSpeedMultiplier: 1.5,
      radius: 27
    },
    special: {
      type: 'quad_burst',
      name: 'Full Throttle Overdrive',
      cooldown: 5.5,
      description: 'Boosts fire rate by 60% and grants unlimited boost stamina for 3 seconds.'
    }
  }
};

// Level curve: XP required for each level
function getXpForLevel(level) {
  return Math.floor(40 * Math.pow(level, 1.35));
}

module.exports = {
  UPGRADE_TYPES,
  UPGRADE_INCREMENTS,
  MAX_UPGRADE_POINTS_PER_STAT,
  PLANE_CLASSES,
  getXpForLevel
};
