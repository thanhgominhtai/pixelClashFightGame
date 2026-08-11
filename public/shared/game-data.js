(function exposeGameData(root, factory) {
  const data = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  if (root) root.PIXEL_CLASH_DATA = data;
}(typeof window !== 'undefined' ? window : globalThis, function createGameData() {
  'use strict';

  const WORLD = Object.freeze({
    // The simulation runs in a 2.5-screen arena. Phaser still renders a
    // 960x540 viewport and the fight camera pans/zooms inside this world.
    width: 2400,
    height: 1350,
    viewWidth: 960,
    viewHeight: 540,
    groundY: 1175,
    groundScreenY: 470,
    minX: 48,
    maxX: 2352,
    cameraMinZoom: 0.4,
    gravity: 0.62
  });

  // Two fighters are cheap to snapshot. Matching the simulation rate avoids
  // client-side extrapolation and keeps teleports/rolls on their server position.
  const NETWORK = Object.freeze({ tickRate: 60, snapshotRate: 60, inputTimeoutMs: 650 });

  const PRIMARY_CONTROLS = Object.freeze({
    left: 'A', right: 'D', jump: 'SPACE', light: 'J', special: 'K',
    roll: 'W + A/D', teleport: 'L', block: 'S', ability: 'I',
    support: 'O', extra: 'P', ultimate: 'U'
  });

  const CONTROLS = Object.freeze({
    // Host and guest each use this layout on their own physical computer.
    // PvE and Training also expose only this player-controlled layout.
    player: PRIMARY_CONTROLS,
    onlineHost: PRIMARY_CONTROLS,
    onlineGuest: PRIMARY_CONTROLS,
    system: Object.freeze({ menu: 'ESC', guide: 'H', debug: 'F3', fullscreen: 'F', trainingReset: 'R' })
  });

  function platform(id, x, y, w, h = 26) {
    return Object.freeze({ id, x, y, w, h, oneWay: true });
  }

  function stage(id, values) {
    return Object.freeze({
      id,
      ...values,
      background: Object.freeze({
        ...values.background,
        layers: values.background.layers ? Object.freeze([...values.background.layers]) : undefined
      }),
      terrain: Object.freeze({ ...values.terrain }),
      platforms: Object.freeze(values.platforms.map((item) => Object.freeze({ ...item })))
    });
  }

  // Every stage keeps the same authoritative world dimensions and ground line.
  // Platform layouts are intentionally mirrored around x=1200 so PvP remains fair.
  const MAPS = Object.freeze({
    desert: stage('desert', {
      name: 'Sa mạc Thiên Sơn',
      biome: 'Sa mạc',
      layout: 'Sàn phẳng',
      description: 'Không có bệ phụ, phù hợp luyện spacing và tầm chiêu.',
      preview: '/backgrounds/BG_DesertMountains/background1.png',
      skyColor: '#68b5df',
      background: {
        kind: 'layers',
        layers: [
          '/backgrounds/BG_DesertMountains/background1.png',
          '/backgrounds/BG_DesertMountains/background2.png',
          '/backgrounds/BG_DesertMountains/background3.png'
        ]
      },
      terrain: { top: '#d8c48e', body: '#8f817b', edge: '#655f5d', accent: '#f2dfa9' },
      platforms: []
    }),
    ancientForest: stage('ancientForest', {
      name: 'Rừng Cổ Thụ',
      biome: 'Rừng sâu',
      layout: 'Bệ cỏ liên hoàn',
      description: 'Nhiều tầng thấp để nối double jump và không chiến.',
      preview: '/backgrounds/Free Pixel Art Forest/Free Pixel Art Forest/Preview/Background.png',
      skyColor: '#7894b3',
      background: { kind: 'image', file: '/backgrounds/Free Pixel Art Forest/Free Pixel Art Forest/Preview/Background.png' },
      terrain: { top: '#4f8f55', body: '#18283c', edge: '#0d1729', accent: '#78b96b' },
      platforms: [
        platform('forest-l1', 420, 1087, 300),
        platform('forest-l2', 820, 1005, 230),
        platform('forest-mid', 1200, 1080, 330),
        platform('forest-r2', 1580, 1005, 230),
        platform('forest-r1', 1980, 1087, 300)
      ]
    }),
    glacial: stage('glacial', {
      name: 'Đỉnh Băng Lam',
      biome: 'Băng sơn',
      layout: 'Cầu băng đối xứng',
      description: 'Các bệ dài tạo đường truy đuổi trên cao rõ ràng.',
      preview: '/backgrounds/Glacial-mountains-parallax-background_vnitti_v3/Glacial-mountains-parallax-background_vnitti/background_glacial_mountains_lightened.png',
      skyColor: '#58b2ec',
      background: { kind: 'image', file: '/backgrounds/Glacial-mountains-parallax-background_vnitti_v3/Glacial-mountains-parallax-background_vnitti/background_glacial_mountains_lightened.png' },
      terrain: { top: '#dff7ff', body: '#74a8ca', edge: '#466f99', accent: '#ffffff' },
      platforms: [
        platform('ice-l1', 360, 1090, 230),
        platform('ice-l2', 750, 1018, 270),
        platform('ice-mid', 1200, 1062, 360),
        platform('ice-r2', 1650, 1018, 270),
        platform('ice-r1', 2040, 1090, 230)
      ]
    }),
    pinePeak: stage('pinePeak', {
      name: 'Chân Núi Tùng',
      biome: 'Sơn cốc',
      layout: 'Hai tháp đấu',
      description: 'Khoảng giữa thoáng, hai cụm bệ dành cho đánh chiếm vị trí.',
      preview: '/backgrounds/Nature Landscapes Free Pixel Art/nature_3/origbig.png',
      skyColor: '#75b9e4',
      background: { kind: 'image', file: '/backgrounds/Nature Landscapes Free Pixel Art/nature_3/origbig.png' },
      terrain: { top: '#76924b', body: '#4d5239', edge: '#34382d', accent: '#a9bd69' },
      platforms: [
        platform('peak-l1', 480, 1085, 360),
        platform('peak-l2', 900, 995, 245),
        platform('peak-r2', 1500, 995, 245),
        platform('peak-r1', 1920, 1085, 360)
      ]
    }),
    meadow: stage('meadow', {
      name: 'Đồng Cỏ Gió',
      biome: 'Thảo nguyên',
      layout: 'Ba đảo cỏ',
      description: 'Bệ rộng, dễ đọc và phù hợp làm quen với địa hình.',
      preview: '/backgrounds/Nature Landscapes Free Pixel Art/nature_2/origbig.png',
      skyColor: '#73b9df',
      background: { kind: 'image', file: '/backgrounds/Nature Landscapes Free Pixel Art/nature_2/origbig.png' },
      terrain: { top: '#83c95d', body: '#559c58', edge: '#37744c', accent: '#c6e77d' },
      platforms: [
        platform('meadow-l', 610, 1088, 430),
        platform('meadow-mid', 1200, 1018, 310),
        platform('meadow-r', 1790, 1088, 430)
      ]
    }),
    aurora: stage('aurora', {
      name: 'Cực Quang Dạ',
      biome: 'Bắc cảnh',
      layout: 'Tháp băng 5 tầng',
      description: 'Bệ trung tâm cao nhất, thưởng cho khả năng kiểm soát không trung.',
      preview: '/backgrounds/Nature Landscapes Free Pixel Art/nature_6/origbig.png',
      skyColor: '#062d52',
      background: { kind: 'image', file: '/backgrounds/Nature Landscapes Free Pixel Art/nature_6/origbig.png' },
      terrain: { top: '#82e8df', body: '#176d7c', edge: '#0a3c5b', accent: '#b9fff2' },
      platforms: [
        platform('aurora-l1', 410, 1090, 260),
        platform('aurora-l2', 805, 1010, 220),
        platform('aurora-mid', 1200, 930, 260),
        platform('aurora-r2', 1595, 1010, 220),
        platform('aurora-r1', 1990, 1090, 260)
      ]
    }),
    coast: stage('coast', {
      name: 'Vịnh Đá Trắng',
      biome: 'Hải vực',
      layout: 'Cầu đá so le',
      description: 'Hai đường lên cao đối xứng, trung tâm thấp dành cho cận chiến.',
      preview: '/backgrounds/Nature Landscapes Free Pixel Art/nature_8/origbig.png',
      skyColor: '#bfe4ee',
      background: { kind: 'image', file: '/backgrounds/Nature Landscapes Free Pixel Art/nature_8/origbig.png' },
      terrain: { top: '#d6d2a0', body: '#89896a', edge: '#5b6658', accent: '#f3e9b7' },
      platforms: [
        platform('coast-l1', 430, 1085, 340),
        platform('coast-l2', 860, 1005, 235),
        platform('coast-mid', 1200, 1095, 300),
        platform('coast-r2', 1540, 1005, 235),
        platform('coast-r1', 1970, 1085, 340)
      ]
    })
  });

  const commonMovement = Object.freeze({
    acceleration: 0.78,
    airAcceleration: 0.42,
    deceleration: 0.9,
    airDeceleration: 0.12,
    jumpVelocity: -11.1,
    doubleJumpVelocity: -10.2,
    maxFallSpeed: 13,
    coyoteFrames: 6,
    inputBufferFrames: 7
  });

  function move(id, label, values) {
    return Object.freeze({ id, label, ...values, hitbox: Object.freeze({ ...values.hitbox }) });
  }

  function comboStep(animationName, values = {}) {
    return Object.freeze({
      animation: animationName,
      ...values,
      hitbox: values.hitbox ? Object.freeze({ ...values.hitbox }) : undefined
    });
  }

  function comboSet(ground, air = ground, resetFrames = 30) {
    return Object.freeze({
      ground: Object.freeze(ground),
      air: Object.freeze(air),
      resetFrames
    });
  }

  function supportSkill(label, stages) {
    return Object.freeze({ label, stages: Object.freeze(stages.map((stage) => Object.freeze({ ...stage }))) });
  }

  const ULTIMATE = Object.freeze({
    maxEnergy: 3,
    introFrames: 54,
    aftermathFrames: 60
  });

  function animation(file, frames, frameRate, repeat = -1, values = {}) {
    return Object.freeze({ file, frames: Array.isArray(frames) ? Object.freeze([...frames]) : frames, frameRate, repeat, ...values });
  }

  const CHARACTERS = Object.freeze({
    buck: Object.freeze({
      id: 'buck',
      name: 'Buck Borris',
      archetype: 'Power / charge',
      source: 'https://penusbmic.itch.io/super-ginger-hero',
      portrait: '/generated/characters/buck/portrait.png',
      color: '#d96a3f',
      movement: Object.freeze({ ...commonMovement, runSpeed: 5.1,
        rollSpeed: 9.6, rollEndSpeed: 2.8, rollFrames: 20, rollDeceleration: 0.45 }),
      hurtbox: Object.freeze({ w: 32, h: 56, offsetX: 0, offsetY: -28 }),
      render: Object.freeze({ scale: 3, originX: 40 / 121, originY: 1 }),
      assets: Object.freeze({
        kind: 'separate-sheets',
        root: '/assets/Buck Borris/Buck Borris/',
        frameWidth: 121,
        frameHeight: 23,
        states: Object.freeze({
          appear: Object.freeze({ file: 'appear.png', frames: 4, frameRate: 4, repeat: -1 }),
          idle: Object.freeze({ file: 'idle.png', frames: 5, frameRate: 8, repeat: -1 }),
          run: Object.freeze({ file: 'run.png', frames: 4, frameRate: 12, repeat: -1 }),
          jump: Object.freeze({ file: 'jump.png', frames: 1, frameRate: 1, repeat: 0 }),
          fall: Object.freeze({ file: 'fall.png', frames: 1, frameRate: 1, repeat: 0 }),
          land: Object.freeze({ file: 'land.png', frames: 2, frameRate: 12, repeat: 0 }),
          light: Object.freeze({ file: 'attacks.png', frames: 12, frameRate: 24, repeat: 0 }),
          charge: Object.freeze({ file: 'charge.png', frames: 8, frameRate: 14, repeat: -1 }),
          special: Object.freeze({ file: 'blast.png', frames: 6, frameRate: 15, repeat: 0 }),
          ability: Object.freeze({ file: 'blast.png', frames: 6, frameRate: 15, repeat: 0 }),
          block: Object.freeze({ file: 'idle.png', frames: 5, frameRate: 8, repeat: -1 }),
          hurt: Object.freeze({ file: 'damaged.png', frames: 2, frameRate: 12, repeat: 0 }),
          ko: Object.freeze({ file: 'damaged.png', frames: 2, frameRate: 8, repeat: 0 }),
          roll: Object.freeze({ file: 'roll.png', frames: 7, frameRate: 20, repeat: 0 }),
          teleport: Object.freeze({ file: 'teleport.png', frames: 5, frameRate: 18, repeat: 0 })
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Straight combo', {
          startup: 6, active: 5, recovery: 13, damage: 8, chip: 1,
          hitstun: 17, blockstun: 8, knockbackX: 5.2, knockbackY: -2.4,
          hitstop: 6, cooldown: 0, airStall: 6, airGravity: 0.42, airDrift: 0.52,
          hitbox: { w: 70, h: 40, offsetX: 40, offsetY: -32 }
        }),
        special: move('special', 'Blast', {
          startup: 10, active: 7, recovery: 24, damage: 19, chip: 4,
          hitstun: 30, blockstun: 13, knockbackX: 9.2, knockbackY: -5.5,
          hitstop: 8, cooldown: 0, airStall: 9, airGravity: 0.34, airDrift: 0.38,
          hitbox: { w: 170, h: 52, offsetX: 96, offsetY: -34 }
        }),
        chargedSpecial: move('chargedSpecial', 'Charged blast', {
          startup: 8, active: 10, recovery: 32, damage: 34, chip: 7,
          hitstun: 40, blockstun: 18, knockbackX: 13, knockbackY: -7.5,
          hitstop: 10, cooldown: 0, airStall: 10, airGravity: 0.3, airDrift: 0.28,
          hitbox: { w: 480, h: 64, offsetX: 250, offsetY: -36 }
        }),
        ability: move('ability', 'Compressed fireball', {
          startup: 11, active: 1, recovery: 22, damage: 14, chip: 3,
          hitstun: 23, blockstun: 10, knockbackX: 7.2, knockbackY: -3.4,
          hitstop: 7, cooldown: 52, projectileSpeed: 10.5, projectileLife: 130,
          projectileWidth: 38, projectileHeight: 28, projectileOffsetX: 48,
          airStall: 9, airGravity: 0.3, airDrift: 0.42,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -35 }
        }),
        ultimate: move('ultimate', 'Worldbreaker Nova', {
          cinematicName: 'Thiên Hỏa Diệt Giới',
          startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 44, chip: 12, hitstun: 52, blockstun: 25,
          knockbackX: 16, knockbackY: -9, hitstop: 13, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 260, offsetX: 0, offsetY: -130 }
        })
      }),
      charge: Object.freeze({ thresholdFrames: 45, maxFrames: 120 })
    }),

    rogue: Object.freeze({
      id: 'rogue',
      name: 'Fantasy Rogue',
      archetype: 'Speed / trick',
      source: 'https://chroma-dave.itch.io/fantasy-rogue-character',
      portrait: '/generated/characters/rogue/portrait.png',
      color: '#66558f',
      movement: Object.freeze({ ...commonMovement, runSpeed: 5.5, jumpVelocity: -11.45,
        rollSpeed: 13, rollEndSpeed: 4.4, rollFrames: 24, rollDeceleration: 0.38,
        rollInvulnerable: 13, rollCooldown: 42 }),
      hurtbox: Object.freeze({ w: 30, h: 58, offsetX: 0, offsetY: -29 }),
      // The source art plants the feet around y=48 inside every 64px cell.
      render: Object.freeze({ scale: 2, originX: 0.5, originY: 48 / 64 }),
      assets: Object.freeze({
        kind: 'atlas-grid',
        file: '/assets/Fantasy Rogue/Full/Rogue - Full.png',
        frameWidth: 64,
        frameHeight: 64,
        // Atlas indices are row positions in the exported 13x11 PNG. They are
        // intentionally not the 0..67 logical frame numbers from Aseprite.
        states: Object.freeze({
          appear: Object.freeze({ frames: Object.freeze([91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103]), frameRate: 20, repeat: 0 }),
          idle: Object.freeze({ frames: Object.freeze([0, 1, 2, 3, 4, 5]), frameRate: 10, repeat: -1 }),
          run: Object.freeze({ frames: Object.freeze([13, 14, 15, 16, 17, 18]), frameRate: 13, repeat: -1 }),
          jump: Object.freeze({ frames: Object.freeze([26, 27, 28, 29]), frameRate: 11, repeat: 0 }),
          fall: Object.freeze({ frames: Object.freeze([30, 31]), frameRate: 8, repeat: -1 }),
          land: Object.freeze({ frames: Object.freeze([31, 30]), frameRate: 12, repeat: 0 }),
          light: Object.freeze({ frames: Object.freeze([65, 66, 67, 68]), frameRate: 13, repeat: 0 }),
          special: Object.freeze({ frames: Object.freeze([91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103]), frameRate: 20, repeat: 0 }),
          charge: Object.freeze({ frames: Object.freeze([91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103]), frameRate: 13, repeat: -1 }),
          throw: Object.freeze({ frames: Object.freeze([78, 79, 80, 81]), frameRate: 13, repeat: 0 }),
          ability: Object.freeze({ frames: Object.freeze([78, 79, 80, 81]), frameRate: 13, repeat: 0 }),
          teleport: Object.freeze({ frames: Object.freeze([91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103]), frameRate: 20, repeat: 0 }),
          roll: Object.freeze({ frames: Object.freeze([104, 105, 106, 107, 108, 109, 110, 111]), frameRate: 22, repeat: 0 }),
          block: Object.freeze({ frames: Object.freeze([30, 31]), frameRate: 8, repeat: -1 }),
          hurt: Object.freeze({ frames: Object.freeze([117, 118, 119]), frameRate: 13, repeat: 0 }),
          ko: Object.freeze({ frames: Object.freeze([130, 131, 132, 133, 134, 135, 136, 137, 138]), frameRate: 10, repeat: 0 })
        }),
        projectile: Object.freeze({ file: '/assets/Fantasy Rogue/Full/Flying Knife.png', frameWidth: 16, frameHeight: 16, frames: 8, frameRate: 16 })
      }),
      moves: Object.freeze({
        light: move('light', 'Twin blade', {
          startup: 5, active: 4, recovery: 12, damage: 7, chip: 1,
          hitstun: 15, blockstun: 7, knockbackX: 4.5, knockbackY: -2,
          hitstop: 5, cooldown: 0, airStall: 5, airGravity: 0.4, airDrift: 0.7,
          hitbox: { w: 68, h: 42, offsetX: 38, offsetY: -32 }
        }),
        special: move('special', 'Shadow strike', {
          startup: 9, active: 8, recovery: 22, damage: 17, chip: 3,
          hitstun: 27, blockstun: 12, knockbackX: 8.4, knockbackY: -4.5,
          hitstop: 8, cooldown: 0, dashSpeed: 11.5, airStall: 8, airGravity: 0.28, airDrift: 0.82,
          hitbox: { w: 220, h: 52, offsetX: 120, offsetY: -33 }
        }),
        ability: move('ability', 'Flying knife', {
          startup: 7, active: 1, recovery: 15, damage: 9, chip: 1,
          hitstun: 14, blockstun: 6, knockbackX: 3.8, knockbackY: -1.2,
          hitstop: 5, cooldown: 28, projectileSpeed: 14, projectileLife: 100,
          projectileWidth: 20, projectileHeight: 16, projectileOffsetX: 38,
          airStall: 7, airGravity: 0.35, airDrift: 0.58,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -31 }
        }),
        ultimate: move('ultimate', 'Nightfall Thousand Blades', {
          cinematicName: 'Dạ Ảnh Vạn Nhẫn',
          startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 39, chip: 9, hitstun: 48, blockstun: 23,
          knockbackX: 12, knockbackY: -6.5, hitstop: 12, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 300, offsetX: 0, offsetY: -150 }
        })
      }),
      charge: Object.freeze({ thresholdFrames: 44, maxFrames: 112 })
    }),

    soul_knight: Object.freeze({
      id: 'soul_knight',
      name: 'Soul Knight',
      archetype: 'Guard / greatsword',
      source: 'https://szadiart.itch.io/2d-soulslike-character',
      color: '#53677a',
      portrait: '/generated/characters/soul_knight/portrait.png',
      movement: Object.freeze({ ...commonMovement, runSpeed: 4.65, jumpVelocity: -10.8,
        rollSpeed: 10.8, rollEndSpeed: 3.1, rollFrames: 23, rollDeceleration: 0.42,
        rollInvulnerable: 13, rollCooldown: 41, teleportDistance: 190, teleportCooldown: 66 }),
      hurtbox: Object.freeze({ w: 38, h: 76, offsetX: 0, offsetY: -38 }),
      render: Object.freeze({ scale: 2, originX: 0.5, originY: 1, sourceFacing: 1 }),
      projectileVisual: Object.freeze({ effect: 'phantomBlade', tint: 0xc9e3e8, scale: 0.48, trail: 'constellation' }),
      assets: Object.freeze({
        kind: 'separate-sheets', root: '/assets/2D_SL_Knight_v1.0/', frameWidth: 128, frameHeight: 64,
        states: Object.freeze({
          appear: animation('Pray.png', 12, 12, -1), idle: animation('Idle.png', 8, 10, -1),
          run: animation('Run.png', 8, 13, -1), jump: animation('Jump.png', [0, 1, 2, 3], 12, 0),
          fall: animation('Jump.png', [4, 5, 6, 7], 10, -1), land: animation('Jump.png', [6, 7], 12, 0),
          light: animation('Attacks.png', [0, 1, 2, 3, 4, 5, 6, 7], 16, 0),
          light1: animation('Attacks.png', [0, 1, 2, 3, 4, 5, 6, 7], 17, 0),
          light2: animation('Attacks.png', [8, 9, 10, 11, 12, 13, 14, 15], 18, 0),
          light3: animation('Attacks.png', [16, 17, 18, 19, 20, 21, 22, 23], 18, 0),
          light4: animation('Attacks.png', [24, 25, 26, 27, 28, 29, 30, 31], 19, 0),
          light5: animation('Attacks.png', [32, 33, 34, 35, 36, 37, 38, 39], 19, 0),
          airLight: animation('attack_from_air.png', 8, 17, 0),
          special: animation('crouch_attacks.png', 8, 18, 0),
          ability: animation('attack_from_air.png', 8, 16, 0),
          health: animation('Health.png', 8, 10, -1), pray: animation('Pray.png', 12, 10, -1),
          charge: animation('Pray.png', 12, 14, -1), roll: animation('Roll.png', 4, 18, 0),
          teleport: animation('Slide.png', 12, 20, 0), block: animation('crouch_idle.png', 8, 9, -1),
          hurt: animation('Hurt.png', 4, 12, 0), ko: animation('Death.png', 4, 8, 0)
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Oath blade chain', {
          animation: 'light', startup: 7, active: 5, recovery: 14, damage: 9, chip: 1,
          hitstun: 18, blockstun: 9, knockbackX: 5.5, knockbackY: -2.6, hitstop: 6, cooldown: 0,
          airStall: 6, airGravity: 0.43, airDrift: 0.48, hitbox: { w: 82, h: 50, offsetX: 45, offsetY: -38 }
        }),
        special: move('special', 'Crescent execution', {
          animation: 'special', startup: 13, active: 7, recovery: 27, damage: 22, chip: 5,
          hitstun: 32, blockstun: 15, knockbackX: 10, knockbackY: -6.4, hitstop: 9, cooldown: 0,
          airStall: 9, airGravity: 0.34, airDrift: 0.34, hitbox: { w: 190, h: 78, offsetX: 96, offsetY: -45 }
        }),
        ability: move('ability', 'Soul lance', {
          animation: 'ability', startup: 10, active: 1, recovery: 20, damage: 12, chip: 2,
          hitstun: 21, blockstun: 9, knockbackX: 6.4, knockbackY: -2.8, hitstop: 6, cooldown: 39,
          projectileSpeed: 12, projectileLife: 125, projectileWidth: 30, projectileHeight: 20, projectileOffsetX: 46,
          airStall: 8, airGravity: 0.34, airDrift: 0.46, hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -39 }
        }),
        ultimate: move('ultimate', 'Abyssal Oath', {
          cinematicName: 'Hắc Kiếm Tận Thế', startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 42, chip: 10, hitstun: 50, blockstun: 24, knockbackX: 14, knockbackY: -8,
          hitstop: 13, cooldown: 0, hitbox: { w: WORLD.maxX - WORLD.minX, h: 300, offsetX: 0, offsetY: -150 }
        })
      }),
      combos: comboSet([
        comboStep('light1', { startup: 6, active: 4, recovery: 9, damage: 7, hitbox: { w: 76, h: 46, offsetX: 42, offsetY: -37 } }),
        comboStep('light2', { startup: 5, active: 5, recovery: 9, damage: 8, hitbox: { w: 88, h: 52, offsetX: 46, offsetY: -39 } }),
        comboStep('light3', { startup: 6, active: 5, recovery: 10, damage: 9, knockbackY: -4.2, hitbox: { w: 94, h: 58, offsetX: 49, offsetY: -40 } }),
        comboStep('light4', { startup: 5, active: 6, recovery: 10, damage: 10, knockbackX: 6.4, hitbox: { w: 104, h: 56, offsetX: 54, offsetY: -39 } }),
        comboStep('light5', { startup: 7, active: 6, recovery: 15, damage: 13, knockbackX: 8.2, knockbackY: -5.8, hitstop: 8, hitbox: { w: 118, h: 66, offsetX: 62, offsetY: -42 } })
      ], [
        comboStep('airLight', { startup: 6, active: 8, recovery: 12, damage: 11, knockbackY: 5.2, hitbox: { w: 94, h: 74, offsetX: 45, offsetY: -18 } })
      ], 34),
      support: supportSkill('Sacred recovery', [
        { animation: 'health', duration: 180, triggerFrame: 90, heal: 24, label: 'Health' },
        { animation: 'pray', duration: 180, triggerFrame: 90, heal: 32, label: 'Pray' }
      ]),
      charge: Object.freeze({ thresholdFrames: 48, maxFrames: 120 })
    }),

    dragon_knight: Object.freeze({
      id: 'dragon_knight', name: 'Dragon Knight', archetype: 'Flame / pressure',
      source: 'https://pixramen.itch.io/2d-action-platformer-fantasy-character-dragon-knight', color: '#c74e3d',
      portrait: '/generated/characters/dragon_knight/portrait.png',
      movement: Object.freeze({ ...commonMovement, runSpeed: 5.05, jumpVelocity: -11,
        rollSpeed: 11.2, rollEndSpeed: 3.5, rollFrames: 21, rollDeceleration: 0.4,
        rollInvulnerable: 12, rollCooldown: 38, teleportDistance: 235, teleportCooldown: 70 }),
      hurtbox: Object.freeze({ w: 38, h: 66, offsetX: 0, offsetY: -33 }),
      render: Object.freeze({ scale: 4, originX: 0.3, originY: 1, sourceFacing: 1 }),
      projectileVisual: Object.freeze({ effect: 'sunburn', tint: 0xff8a38, scale: 0.48, trail: 'orangeSparkle' }),
      assets: Object.freeze({
        kind: 'separate-sheets', root: '/assets/dragon_knight/dragon_knight/spritesheets/1x/', frameWidth: 96, frameHeight: 64,
        states: Object.freeze({
          appear: animation('dragon_knight_firebreath_character_only.png', 11, 14, 0),
          idle: animation('dragon_knight_idle.png', 2, 6, -1), run: animation('dragon_knight_run.png', 4, 12, -1),
          jump: animation('dragon_knight_jump.png', 1, 1, 0), fall: animation('dragon_knight_falling.png', 1, 1, 0),
          land: animation('dragon_knight_prepare_jump.png', 1, 1, 0), light: animation('dragon_knight_attack_1.png', 6, 16, 0),
          light1: animation('dragon_knight_attack_1.png', 6, 17, 0),
          light2: animation('dragon_knight_attack_2.png', 6, 18, 0),
          light3: animation('dragon_knight_attack_3.png', 8, 19, 0),
          airLight1: animation('dragon_knight_jump_attack_1.png', 6, 17, 0),
          airLight2: animation('dragon_knight_jump_attack_2.png', 5, 18, 0),
          airLight3: animation('dragon_knight_jump_attack_3.png', 5, 19, 0),
          special: animation('dragon_knight_firebreath.png', 11, 18, 0), ability: animation('dragon_knight_fireball_down.png', 3, 14, 0),
          airAbility: animation('dragon_knight_firebreath_downward_air.png', 11, 18, 0),
          extra: animation('dragon_knight_attack_3.png', 8, 20, 0), potion: animation('dragon_knight_drink_potion.png', 14, 10, -1),
          roll: animation('dragon_knight_prep_dash.png', 3, 17, 0), teleport: animation('dragon_knight_dash.png', 1, 1, 0),
          block: animation('dragon_knight_idle.png', 2, 6, -1), hurt: animation('dragon_knight_on_hit.png', 2, 11, 0),
          ko: animation('dragon_knight_death.png', 13, 10, 0), charge: animation('dragon_knight_firebreath_character_only.png', 11, 13, -1)
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Dragon claw chain', {
          animation: 'light', startup: 5, active: 5, recovery: 12, damage: 8, chip: 1, hitstun: 17, blockstun: 8,
          knockbackX: 5.1, knockbackY: -2.3, hitstop: 6, cooldown: 0, airStall: 6, airGravity: .4, airDrift: .54,
          hitbox: { w: 80, h: 46, offsetX: 43, offsetY: -33 }
        }),
        special: move('special', 'Dragon breath', {
          animation: 'special', startup: 11, active: 12, recovery: 25, damage: 20, chip: 5, hitstun: 29, blockstun: 15,
          knockbackX: 8.8, knockbackY: -4.2, hitstop: 8, cooldown: 0, airStall: 10, airGravity: .28, airDrift: .34,
          hitbox: { w: 285, h: 64, offsetX: 152, offsetY: -38 }
        }),
        chargedSpecial: move('chargedSpecial', 'Ancient dragon breath', {
          animation: 'special', startup: 9, active: 14, recovery: 32, damage: 32, chip: 8, hitstun: 39, blockstun: 19,
          knockbackX: 12.5, knockbackY: -6.8, hitstop: 11, cooldown: 0, airStall: 10, airGravity: .25, airDrift: .28,
          hitbox: { w: 520, h: 82, offsetX: 272, offsetY: -42 }
        }),
        ability: move('ability', 'Drake fireball', {
          animation: 'ability', startup: 9, active: 1, recovery: 19, damage: 13, chip: 3, hitstun: 22, blockstun: 10,
          knockbackX: 6.8, knockbackY: -3.2, hitstop: 7, cooldown: 44, projectileSpeed: 11, projectileLife: 135,
          projectileWidth: 34, projectileHeight: 26, projectileOffsetX: 44, airStall: 8, airGravity: .3, airDrift: .42,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -34 }
        }),
        airAbility: move('airAbility', 'Downward dragonfire', {
          animation: 'airAbility', startup: 8, active: 1, recovery: 22, damage: 15, chip: 4, hitstun: 24, blockstun: 11,
          knockbackX: 4.4, knockbackY: 7.8, hitstop: 8, cooldown: 44, projectileSpeed: 12, projectileLife: 90,
          projectileWidth: 38, projectileHeight: 34, projectileOffsetX: 28, projectileDirection: 'down',
          airStall: 13, airGravity: .22, airDrift: .3, hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -12 }
        }),
        extra: move('extra', 'Dragon rush', {
          animation: 'extra', startup: 6, active: 8, recovery: 19, damage: 17, chip: 3, hitstun: 26, blockstun: 11,
          knockbackX: 9.4, knockbackY: -4.8, hitstop: 8, cooldown: 72, dashSpeed: 11.8,
          airStall: 8, airGravity: .3, airDrift: .75, hitbox: { w: 170, h: 66, offsetX: 90, offsetY: -35 }
        }),
        ultimate: move('ultimate', 'Dragon Burial Inferno', {
          cinematicName: 'Long Viêm Thiên Táng', startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 46, chip: 13, hitstun: 54, blockstun: 27, knockbackX: 17, knockbackY: -10, hitstop: 14, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 340, offsetX: 0, offsetY: -170 }
        })
      }),
      combos: comboSet([
        comboStep('light1', { startup: 5, active: 4, recovery: 8, damage: 7, hitbox: { w: 76, h: 44, offsetX: 41, offsetY: -32 } }),
        comboStep('light2', { startup: 4, active: 5, recovery: 9, damage: 8, knockbackY: -3.5, hitbox: { w: 88, h: 52, offsetX: 47, offsetY: -34 } }),
        comboStep('light3', { startup: 6, active: 7, recovery: 14, damage: 13, knockbackX: 8.4, knockbackY: -6.2, hitstop: 8, hitbox: { w: 112, h: 64, offsetX: 59, offsetY: -36 } })
      ], [
        comboStep('airLight1', { startup: 4, active: 5, recovery: 8, damage: 7, hitbox: { w: 82, h: 50, offsetX: 43, offsetY: -30 } }),
        comboStep('airLight2', { startup: 4, active: 5, recovery: 9, damage: 8, knockbackY: 2.8, hitbox: { w: 92, h: 56, offsetX: 48, offsetY: -26 } }),
        comboStep('airLight3', { startup: 5, active: 7, recovery: 13, damage: 12, knockbackX: 7.8, knockbackY: 6.8, hitstop: 8, hitbox: { w: 108, h: 68, offsetX: 55, offsetY: -18 } })
      ], 32),
      support: supportSkill('Dragon potion', [
        { animation: 'potion', duration: 150, triggerFrame: 80, heal: 27, label: 'Flame tonic' },
        { animation: 'potion', duration: 150, triggerFrame: 80, heal: 22, label: 'Scale tonic' }
      ]),
      charge: Object.freeze({ thresholdFrames: 48, maxFrames: 120 })
    }),

    iron_sentinel: Object.freeze({
      id: 'iron_sentinel', name: 'Iron Sentinel', archetype: 'Tank / counter',
      source: 'https://pixramen.itch.io/2d-actioncharacter-iron-sentinel', color: '#65717e',
      portrait: '/generated/characters/iron_sentinel/portrait.png',
      movement: Object.freeze({ ...commonMovement, runSpeed: 4.35, jumpVelocity: -10.4, maxFallSpeed: 12,
        rollSpeed: 9.4, rollEndSpeed: 2.4, rollFrames: 24, rollDeceleration: .46,
        rollInvulnerable: 14, rollCooldown: 45, teleportDistance: 175, teleportCooldown: 64 }),
      hurtbox: Object.freeze({ w: 46, h: 72, offsetX: 0, offsetY: -36 }),
      render: Object.freeze({ scale: 4, originX: .58, originY: 1, sourceFacing: 1 }),
      projectileVisual: Object.freeze({ effect: 'thunderSplash', tint: 0xd8eef2, scale: .62, trail: 'orangePuff' }),
      assets: Object.freeze({
        kind: 'separate-sheets', root: '/assets/iron_sentinel/iron_sentinel/spritesheets/1x/', frameWidth: 64, frameHeight: 64,
        states: Object.freeze({
          appear: animation('iron_sentinel_shield_crash_startup.png', 5, 13, 0), idle: animation('iron_sentinel_idle.png', 2, 6, -1),
          run: animation('iron_sentinel_run.png', 4, 11, -1), jump: animation('iron_sentinel_jump.png', 1, 1, 0),
          fall: animation('iron_sentinel_fall.png', 1, 1, 0), land: animation('iron_sentinel_landing_effect.png', 2, 12, 0),
          light: animation('iron_sentinel_combo_a.png', 5, 15, 0),
          light1: animation('iron_sentinel_combo_a.png', 5, 16, 0), light2: animation('iron_sentinel_combo_b.png', 5, 17, 0),
          light3: animation('iron_sentinel_combo_c.png', 5, 18, 0),
          airLight1: animation('iron_sentinel_air_combo_a.png', 5, 16, 0), airLight2: animation('iron_sentinel_air_combo_b.png', 5, 17, 0),
          airLight3: animation('iron_sentinel_air_combo_c.png', 5, 18, 0),
          special: animation('iron_sentinel_shield_crash_landing.png', 5, 15, 0), charge: animation('iron_sentinel_shield_crash_startup.png', 5, 12, -1),
          ability: animation('iron_sentinel_shield_crash_landing.png', 5, 14, 0), extra: animation('iron_sentinel_upward_attack.png', 5, 16, 0),
          potionGreen: animation('iron_sentinel_drink_green_potion.png', 5, 9, -1), potionRed: animation('iron_sentinel_drink_red_potion.png', 5, 9, -1),
          roll: animation('iron_sentinel_dash.png', 5, 17, 0),
          teleport: animation('iron_sentinel_dash.png', 5, 19, 0), block: animation('iron_sentinel_block.png', 2, 8, -1),
          hurt: animation('iron_sentinel_on_hit.png', 2, 10, 0), ko: animation('iron_sentinel_death.png', 6, 8, 0)
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Sentinel cleave', {
          animation: 'light', startup: 7, active: 5, recovery: 15, damage: 10, chip: 2, hitstun: 19, blockstun: 10,
          knockbackX: 5.8, knockbackY: -2.4, hitstop: 7, cooldown: 0, airStall: 6, airGravity: .45, airDrift: .38,
          hitbox: { w: 88, h: 52, offsetX: 47, offsetY: -36 }
        }),
        special: move('special', 'Shield crash', {
          animation: 'special', startup: 14, active: 8, recovery: 29, damage: 24, chip: 7, hitstun: 35, blockstun: 18,
          knockbackX: 8.2, knockbackY: -8.2, hitstop: 10, cooldown: 0, airStall: 8, airGravity: .5, airDrift: .28,
          hitbox: { w: 150, h: 92, offsetX: 78, offsetY: -46 }
        }),
        ability: move('ability', 'Iron shockwave', {
          animation: 'ability', startup: 12, active: 1, recovery: 23, damage: 14, chip: 4, hitstun: 24, blockstun: 12,
          knockbackX: 7.2, knockbackY: -4.8, hitstop: 8, cooldown: 48, projectileSpeed: 9.2, projectileLife: 150,
          projectileWidth: 46, projectileHeight: 30, projectileOffsetX: 46, airStall: 7, airGravity: .42, airDrift: .3,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -31 }
        }),
        extra: move('extra', 'Sentinel launcher', {
          animation: 'extra', startup: 7, active: 7, recovery: 20, damage: 18, chip: 4, hitstun: 31, blockstun: 14,
          knockbackX: 5.8, knockbackY: -10.5, hitstop: 10, cooldown: 64, airStall: 6, airGravity: .46, airDrift: .32,
          hitbox: { w: 94, h: 112, offsetX: 48, offsetY: -59 }
        }),
        ultimate: move('ultimate', 'Citadel Breaker', {
          cinematicName: 'Pháo Đài Thiết Chấn', startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 43, chip: 14, hitstun: 53, blockstun: 28, knockbackX: 13, knockbackY: -9, hitstop: 15, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 280, offsetX: 0, offsetY: -140 }
        })
      }),
      combos: comboSet([
        comboStep('light1', { startup: 7, active: 5, recovery: 9, damage: 9, hitbox: { w: 86, h: 52, offsetX: 46, offsetY: -36 } }),
        comboStep('light2', { startup: 6, active: 6, recovery: 10, damage: 11, knockbackX: 6.8, hitbox: { w: 100, h: 58, offsetX: 53, offsetY: -38 } }),
        comboStep('light3', { startup: 8, active: 7, recovery: 17, damage: 15, knockbackX: 9.5, knockbackY: -6.8, hitstop: 9, hitbox: { w: 122, h: 72, offsetX: 64, offsetY: -42 } })
      ], [
        comboStep('airLight1', { startup: 6, active: 5, recovery: 9, damage: 9, hitbox: { w: 88, h: 58, offsetX: 46, offsetY: -32 } }),
        comboStep('airLight2', { startup: 6, active: 6, recovery: 10, damage: 10, knockbackY: 2.5, hitbox: { w: 98, h: 68, offsetX: 51, offsetY: -26 } }),
        comboStep('airLight3', { startup: 8, active: 8, recovery: 16, damage: 15, knockbackX: 8.5, knockbackY: 8, hitstop: 9, hitbox: { w: 116, h: 82, offsetX: 60, offsetY: -18 } })
      ], 36),
      support: supportSkill('Sentinel tonics', [
        { animation: 'potionGreen', duration: 150, triggerFrame: 78, heal: 20, label: 'Green tonic' },
        { animation: 'potionRed', duration: 150, triggerFrame: 78, heal: 34, label: 'Red tonic' }
      ]),
      charge: Object.freeze({ thresholdFrames: 52, maxFrames: 126 })
    }),

    dark_ninja: Object.freeze({
      id: 'dark_ninja', name: 'Dark Ninja', archetype: 'Ninjutsu / vanish',
      source: 'https://zzzhen-z.itch.io/dark-ninja-2d-pixel-art-character-animation', color: '#7b3fa1',
      portrait: '/generated/characters/dark_ninja/portrait.png',
      movement: Object.freeze({ ...commonMovement, runSpeed: 5.85, jumpVelocity: -11.6, doubleJumpVelocity: -10.8,
        rollSpeed: 13.4, rollEndSpeed: 4.6, rollFrames: 22, rollDeceleration: .36,
        rollInvulnerable: 14, rollCooldown: 39, teleportDistance: 280, teleportCooldown: 68 }),
      hurtbox: Object.freeze({ w: 30, h: 62, offsetX: 0, offsetY: -31 }),
      render: Object.freeze({ scale: 2, originX: .5, originY: 56 / 64, sourceFacing: 1 }),
      projectileVisual: Object.freeze({ effect: 'phantomBlade', tint: 0xb34de0, scale: .42, trail: 'violetSparkle' }),
      assets: Object.freeze({
        kind: 'separate-sheets', root: '/generated/characters/dark_ninja/', frameWidth: 64, frameHeight: 64,
        states: Object.freeze({
          appear: animation('teleport.png', 30, 24, 0), idle: animation('idle.png', 8, 12, -1),
          run: animation('run.png', 8, 14, -1), jump: animation('jump.png', [0, 1, 2, 3, 4, 5], 14, 0),
          fall: animation('jump.png', [6, 7, 8, 9, 10, 11], 12, -1), land: animation('jump.png', [10, 11], 13, 0),
          light: animation('light.png', 6, 16, 0, { frameWidth: 96 }),
          light1: animation('light1.png', 6, 16, 0, { frameWidth: 96 }),
          light2: animation('light2.png', 6, 17, 0, { frameWidth: 96 }),
          light3: animation('light3.png', 6, 18, 0, { frameWidth: 96 }),
          special: animation('special.png', 6, 18, 0, { frameWidth: 96 }),
          ability: animation('ability.png', 6, 16, 0, { frameWidth: 96 }),
          extra: animation('roll.png', 14, 18, 0), charge: animation('roll.png', 14, 14, -1),
          roll: animation('roll.png', 14, 22, 0), teleport: animation('teleport.png', 30, 26, 0),
          block: animation('block.png', 8, 12, -1), hurt: animation('hurt.png', 3, 13, 0), ko: animation('hurt.png', [0, 1, 2], 7, 0)
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Kage claw', {
          animation: 'light', startup: 4, active: 4, recovery: 10, damage: 7, chip: 1, hitstun: 14, blockstun: 7,
          knockbackX: 4.2, knockbackY: -1.8, hitstop: 5, cooldown: 0, airStall: 5, airGravity: .36, airDrift: .76,
          hitbox: { w: 72, h: 42, offsetX: 40, offsetY: -31 }
        }),
        special: move('special', 'Shadow crescent', {
          animation: 'special', startup: 7, active: 8, recovery: 19, damage: 16, chip: 3, hitstun: 25, blockstun: 11,
          knockbackX: 8.5, knockbackY: -4, hitstop: 8, cooldown: 0, dashSpeed: 12.8, airStall: 8, airGravity: .25, airDrift: .9,
          hitbox: { w: 225, h: 58, offsetX: 120, offsetY: -32 }
        }),
        ability: move('ability', 'Void shuriken', {
          animation: 'ability', startup: 6, active: 1, recovery: 14, damage: 9, chip: 1, hitstun: 15, blockstun: 7,
          knockbackX: 4.2, knockbackY: -1.5, hitstop: 5, cooldown: 26, projectileSpeed: 15.2, projectileLife: 105,
          projectileWidth: 22, projectileHeight: 22, projectileOffsetX: 40, airStall: 6, airGravity: .3, airDrift: .68,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -31 }
        }),
        extra: move('extra', 'Veil of invisibility', {
          animation: 'extra', startup: 8, active: 1, recovery: 18, damage: 0, chip: 0, hitstun: 0, blockstun: 0,
          knockbackX: 0, knockbackY: 0, hitstop: 0, cooldown: 210, selfInvulnerableFrames: 90,
          airStall: 8, airGravity: .28, airDrift: .8, hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -31 }
        }),
        ultimate: move('ultimate', 'Eclipse Ninjutsu', {
          cinematicName: 'Nhẫn Pháp: Nhật Thực', startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 38, chip: 8, hitstun: 47, blockstun: 22, knockbackX: 11, knockbackY: -6, hitstop: 12, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 360, offsetX: 0, offsetY: -180 }
        })
      }),
      combos: comboSet([
        comboStep('light1', { startup: 4, active: 4, recovery: 7, damage: 6, hitbox: { w: 70, h: 42, offsetX: 39, offsetY: -31 } }),
        comboStep('light2', { startup: 3, active: 5, recovery: 7, damage: 7, knockbackY: -3.8, hitbox: { w: 84, h: 50, offsetX: 45, offsetY: -33 } }),
        comboStep('light3', { startup: 4, active: 6, recovery: 11, damage: 10, knockbackX: 7.8, knockbackY: -4.8, hitstop: 7, hitbox: { w: 102, h: 58, offsetX: 54, offsetY: -35 } })
      ], undefined, 26),
      charge: Object.freeze({ thresholdFrames: 42, maxFrames: 108 })
    }),

    purple_battlemage: Object.freeze({
      id: 'purple_battlemage', name: 'Purple Battlemage', archetype: 'Arcane / zoning',
      source: 'https://pimen.itch.io/fantasy-platformer-character', color: '#a64c83',
      portrait: '/generated/characters/purple_battlemage/portrait.png',
      movement: Object.freeze({ ...commonMovement, runSpeed: 5.2, jumpVelocity: -11.25,
        rollSpeed: 11.7, rollEndSpeed: 3.7, rollFrames: 22, rollDeceleration: .39,
        rollInvulnerable: 12, rollCooldown: 39, teleportDistance: 225, teleportCooldown: 69 }),
      hurtbox: Object.freeze({ w: 32, h: 68, offsetX: 0, offsetY: -34 }),
      render: Object.freeze({ scale: 2.5, originX: .5, originY: 1, sourceFacing: 1 }),
      projectileVisual: Object.freeze({ effect: 'nebula', tint: 0xe26ab6, scale: .48, trail: 'violetFlare' }),
      assets: Object.freeze({
        kind: 'separate-sheets', root: '/assets/PurpleGirl/PurpleGirl/Battlemage Complete (Sprite Sheet)/', frameWidth: 56, frameHeight: 48,
        states: Object.freeze({
          appear: animation('Sustain Magic/Battlemage Sustain Magic.png', 11, 14, 0),
          idle: animation('Idle/Battlemage Idle.png', 8, 12, -1), run: animation('Running/Battlemage Run.png', 10, 14, -1),
          jump: animation('Jump Foward/Battlemage Jump Foward.png', [0, 1, 2, 3, 4, 5], 13, 0),
          fall: animation('Jump Foward/Battlemage Jump Foward.png', [6, 7, 8, 9, 10], 11, -1),
          land: animation('Stop/Battlemage Stop.png', 5, 13, 0), light: animation('Attack 1/Battlemage Attack 1.png', 8, 16, 0),
          light1: animation('Attack 1/Battlemage Attack 1.png', 8, 16, 0), light2: animation('Attack 2/Battlemage Attack 2.png', 8, 17, 0),
          light3: animation('Attack 3/Battlemage Attack 3.png', 9, 18, 0), airLight: animation('Jump Attack/Jump Foward Attack.png', 5, 17, 0),
          special: animation('Spin Attack/Battlemage Spin Attack.png', 11, 18, 0),
          ability: animation('Fast Magic/Battlemage Fast magic.png', 10, 16, 0), roll: animation('Dash/Battlemage Dash.png', 7, 19, 0),
          extra: animation('Sustain Magic/Battlemage Sustain Magic.png', 11, 16, 0), charge: animation('Sustain Magic/Battlemage Sustain Magic.png', 11, 13, -1),
          teleport: animation('Sustain Magic/Battlemage Sustain Magic.png', 11, 19, 0), block: animation('Crouch/Battlemage Crouch.png', 9, 11, -1),
          hurt: animation('Hurt 1 n 2/Hurt 1.png', 1, 1, 0), ko: animation('Death/Battlemage Death.png', 12, 9, 0)
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Arcane palm', {
          animation: 'light', startup: 5, active: 4, recovery: 12, damage: 7, chip: 1, hitstun: 15, blockstun: 7,
          knockbackX: 4.6, knockbackY: -2, hitstop: 5, cooldown: 0, airStall: 5, airGravity: .4, airDrift: .62,
          hitbox: { w: 74, h: 46, offsetX: 40, offsetY: -34 }
        }),
        special: move('special', 'Arcane spin', {
          animation: 'special', startup: 9, active: 10, recovery: 23, damage: 18, chip: 4, hitstun: 28, blockstun: 13,
          knockbackX: 8, knockbackY: -5.2, hitstop: 8, cooldown: 0, airStall: 9, airGravity: .3, airDrift: .58,
          hitbox: { w: 205, h: 82, offsetX: 70, offsetY: -42 }
        }),
        ability: move('ability', 'Fast arcane bolt', {
          animation: 'ability', startup: 7, active: 1, recovery: 16, damage: 11, chip: 2, hitstun: 18, blockstun: 8,
          knockbackX: 5.3, knockbackY: -2.3, hitstop: 6, cooldown: 31, projectileSpeed: 13.5, projectileLife: 120,
          projectileWidth: 28, projectileHeight: 24, projectileOffsetX: 42, airStall: 7, airGravity: .33, airDrift: .57,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -35 }
        }),
        extra: move('extra', 'Sustained arcane fire', {
          animation: 'extra', startup: 12, active: 1, recovery: 24, damage: 16, chip: 4, hitstun: 26, blockstun: 12,
          knockbackX: 7.4, knockbackY: -4.2, hitstop: 8, cooldown: 78, projectileSpeed: 8.2, projectileLife: 175,
          projectileWidth: 62, projectileHeight: 54, projectileOffsetX: 52, airStall: 9, airGravity: .28, airDrift: .44,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -35 }
        }),
        ultimate: move('ultimate', 'Arcane Dominion', {
          cinematicName: 'Tinh Vực Tử Quang', startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 41, chip: 10, hitstun: 49, blockstun: 24, knockbackX: 12, knockbackY: -7, hitstop: 13, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 380, offsetX: 0, offsetY: -190 }
        })
      }),
      combos: comboSet([
        comboStep('light1', { startup: 5, active: 4, recovery: 8, damage: 6, hitbox: { w: 72, h: 44, offsetX: 39, offsetY: -34 } }),
        comboStep('light2', { startup: 4, active: 5, recovery: 8, damage: 7, knockbackY: -3.4, hitbox: { w: 86, h: 52, offsetX: 45, offsetY: -36 } }),
        comboStep('light3', { startup: 6, active: 6, recovery: 12, damage: 10, knockbackX: 7.2, knockbackY: -5.2, hitstop: 7, hitbox: { w: 104, h: 64, offsetX: 54, offsetY: -39 } })
      ], [
        comboStep('airLight', { startup: 5, active: 7, recovery: 11, damage: 9, knockbackY: 5.2, hitbox: { w: 96, h: 66, offsetX: 48, offsetY: -22 } })
      ], 30),
      charge: Object.freeze({ thresholdFrames: 46, maxFrames: 116 })
    }),

    raptor: Object.freeze({
      id: 'raptor', name: 'Velociraptor', archetype: 'Rushdown / pounce',
      source: 'https://pixramen.itch.io/2d-dino-character-velociraptor', color: '#3f816e',
      portrait: '/generated/characters/raptor/portrait.png',
      movement: Object.freeze({ ...commonMovement, acceleration: .92, runSpeed: 6.15, jumpVelocity: -10.9,
        rollSpeed: 14.2, rollEndSpeed: 5, rollFrames: 20, rollDeceleration: .34,
        rollInvulnerable: 12, rollCooldown: 37, teleportDistance: 265, teleportCooldown: 73 }),
      // The source is a long quadruped. Cover torso/head but deliberately leave
      // most of the trailing tail outside the vulnerable core.
      hurtbox: Object.freeze({ w: 112, h: 68, offsetX: 0, offsetY: -34 }),
      render: Object.freeze({ scale: 3, originX: .5, originY: 1, sourceFacing: 1 }),
      projectileVisual: Object.freeze({ effect: 'powerChords', tint: 0x8bd7a6, scale: .34, trail: 'constellation' }),
      assets: Object.freeze({
        kind: 'separate-sheets', root: '/generated/characters/raptor/', frameWidth: 128, frameHeight: 64,
        states: Object.freeze({
          appear: animation('charge.png', 18, 18, 0), idle: animation('idle.png', 2, 6, -1), run: animation('run.png', 6, 16, -1),
          jump: animation('jump.png', 1, 1, 0), fall: animation('fall.png', 1, 1, 0), land: animation('idle.png', 2, 8, 0),
          light: animation('light.png', 10, 18, 0), special: animation('special.png', 8, 20, 0),
          light1: animation('light.png', [0, 1, 2, 3, 4], 18, 0), light2: animation('light.png', [5, 6, 7, 8, 9], 20, 0),
          ability: animation('ability.png', 6, 15, 0), extra: animation('charge.png', 18, 15, 0), charge: animation('charge.png', 18, 16, -1),
          roll: animation('roll.png', 2, 12, 0),
          teleport: animation('teleport.png', 1, 1, 0), block: animation('roll.png', 2, 9, -1),
          hurt: animation('hurt.png', 1, 1, 0), ko: animation('ko.png', 6, 9, 0)
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Rending bite', {
          animation: 'light', startup: 4, active: 5, recovery: 10, damage: 8, chip: 1, hitstun: 16, blockstun: 7,
          knockbackX: 4.8, knockbackY: -1.8, hitstop: 6, cooldown: 0, airStall: 4, airGravity: .46, airDrift: .7,
          hitbox: { w: 90, h: 42, offsetX: 50, offsetY: -25 }
        }),
        special: move('special', 'Predator pounce', {
          animation: 'special', startup: 7, active: 9, recovery: 18, damage: 18, chip: 3, hitstun: 28, blockstun: 12,
          knockbackX: 9.2, knockbackY: -4.4, hitstop: 8, cooldown: 0, dashSpeed: 14.5, airStall: 7, airGravity: .22, airDrift: 1,
          hitbox: { w: 245, h: 60, offsetX: 132, offsetY: -29 }
        }),
        ability: move('ability', 'Sonic roar', {
          animation: 'ability', startup: 10, active: 1, recovery: 20, damage: 10, chip: 3, hitstun: 19, blockstun: 10,
          knockbackX: 6.2, knockbackY: -2.5, hitstop: 7, cooldown: 38, projectileSpeed: 10, projectileLife: 145,
          projectileWidth: 52, projectileHeight: 36, projectileOffsetX: 60, airStall: 7, airGravity: .38, airDrift: .44,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -27 }
        }),
        extra: move('extra', 'Predator scan', {
          animation: 'extra', startup: 12, active: 1, recovery: 20, damage: 0, chip: 0, hitstun: 0, blockstun: 0,
          knockbackX: 0, knockbackY: 0, hitstop: 0, cooldown: 190, selfInvulnerableFrames: 54,
          airStall: 6, airGravity: .4, airDrift: .5, hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -27 }
        }),
        ultimate: move('ultimate', 'Cretaceous Hunt', {
          cinematicName: 'Kỷ Phấn Truy Sát', startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 40, chip: 9, hitstun: 48, blockstun: 22, knockbackX: 15, knockbackY: -6, hitstop: 12, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 250, offsetX: 0, offsetY: -125 }
        })
      }),
      combos: comboSet([
        comboStep('light1', { startup: 4, active: 5, recovery: 7, damage: 7, hitbox: { w: 86, h: 40, offsetX: 48, offsetY: -25 } }),
        comboStep('light2', { startup: 3, active: 6, recovery: 9, damage: 9, knockbackX: 6.2, hitbox: { w: 104, h: 46, offsetX: 56, offsetY: -27 } }),
        comboStep('special', { startup: 5, active: 7, recovery: 12, damage: 12, knockbackX: 8.8, knockbackY: -4.5, hitstop: 8, dashSpeed: 9.5, hitbox: { w: 142, h: 56, offsetX: 76, offsetY: -29 } })
      ], undefined, 25),
      charge: Object.freeze({ thresholdFrames: 40, maxFrames: 104 })
    }),

    stick_fighter: Object.freeze({
      id: 'stick_fighter', name: 'Stick Fighter', archetype: 'Comic / freestyle',
      source: 'https://rgsdev.itch.io/animated-stick-figure-character-2d-free-cc0', color: '#303944',
      portrait: '/generated/characters/stick_fighter/portrait.png',
      movement: Object.freeze({ ...commonMovement, runSpeed: 5.65, jumpVelocity: -11.5,
        rollSpeed: 12.6, rollEndSpeed: 4.2, rollFrames: 21, rollDeceleration: .37,
        rollInvulnerable: 13, rollCooldown: 38, teleportDistance: 245, teleportCooldown: 65 }),
      hurtbox: Object.freeze({ w: 32, h: 70, offsetX: 0, offsetY: -35 }),
      render: Object.freeze({ scale: 1.65, originX: .5, originY: 98 / 128, sourceFacing: 1 }),
      projectileVisual: Object.freeze({ effect: 'impact', tint: 0xffffff, scale: .28, trail: 'orangePuff' }),
      assets: Object.freeze({
        kind: 'separate-sheets', root: '/generated/characters/stick_fighter/', frameWidth: 128, frameHeight: 128,
        states: Object.freeze({
          appear: animation('teleport.png', 6, 18, 0), idle: animation('idle.png', 8, 12, -1), run: animation('run.png', 8, 15, -1),
          jump: animation('jump.png', [0, 1, 2], 12, 0), fall: animation('jump.png', [3, 4], 10, -1), land: animation('idle.png', [0, 1], 10, 0),
          light: animation('light.png', 19, 20, 0), special: animation('special.png', 2, 8, 0),
          light1: animation('light.png', [0, 1, 2, 3, 4, 5], 18, 0),
          light2: animation('light.png', [6, 7, 8, 9, 10, 11, 12], 20, 0),
          light3: animation('light.png', [13, 14, 15, 16, 17, 18], 21, 0), airLight: animation('special.png', 2, 9, 0),
          ability: animation('ability.png', [9, 10, 11, 12, 13, 14], 17, 0), roll: animation('roll.png', 8, 20, 0),
          charge: animation('ability.png', [0, 1, 2, 3, 4, 5, 6, 7, 8], 14, -1),
          teleport: animation('teleport.png', 6, 20, 0), block: animation('block.png', 8, 9, -1),
          hurt: animation('hurt.png', 4, 12, 0), ko: animation('ko.png', 10, 9, 0)
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Freestyle combo', {
          animation: 'light', startup: 5, active: 5, recovery: 11, damage: 7, chip: 1, hitstun: 15, blockstun: 7,
          knockbackX: 4.6, knockbackY: -2, hitstop: 5, cooldown: 0, airStall: 5, airGravity: .4, airDrift: .7,
          hitbox: { w: 76, h: 48, offsetX: 42, offsetY: -35 }
        }),
        special: move('special', 'Rubber-line smash', {
          animation: 'special', startup: 8, active: 7, recovery: 20, damage: 17, chip: 3, hitstun: 26, blockstun: 11,
          knockbackX: 9, knockbackY: -5.5, hitstop: 8, cooldown: 0, dashSpeed: 9.5, airStall: 8, airGravity: .3, airDrift: .7,
          hitbox: { w: 180, h: 76, offsetX: 92, offsetY: -40 }
        }),
        ability: move('ability', 'Doodle shot', {
          animation: 'ability', startup: 7, active: 1, recovery: 15, damage: 9, chip: 1, hitstun: 15, blockstun: 7,
          knockbackX: 4.5, knockbackY: -1.8, hitstop: 5, cooldown: 27, projectileSpeed: 15, projectileLife: 110,
          projectileWidth: 18, projectileHeight: 12, projectileOffsetX: 42, airStall: 6, airGravity: .35, airDrift: .62,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -36 }
        }),
        ultimate: move('ultimate', 'Panel Breaker', {
          cinematicName: 'Nét Mực Phá Giới', startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 37, chip: 7, hitstun: 46, blockstun: 21, knockbackX: 12, knockbackY: -7, hitstop: 12, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 330, offsetX: 0, offsetY: -165 }
        })
      }),
      combos: comboSet([
        comboStep('light1', { startup: 4, active: 4, recovery: 7, damage: 5, hitbox: { w: 70, h: 44, offsetX: 39, offsetY: -35 } }),
        comboStep('light2', { startup: 3, active: 5, recovery: 7, damage: 7, knockbackY: -3, hitbox: { w: 82, h: 50, offsetX: 44, offsetY: -36 } }),
        comboStep('light3', { startup: 4, active: 6, recovery: 10, damage: 9, knockbackX: 7.6, knockbackY: -5, hitstop: 7, hitbox: { w: 98, h: 60, offsetX: 52, offsetY: -38 } })
      ], [
        comboStep('airLight', { startup: 4, active: 8, recovery: 10, damage: 9, knockbackY: 6, hitbox: { w: 94, h: 68, offsetX: 47, offsetY: -23 } })
      ], 28),
      charge: Object.freeze({ thresholdFrames: 43, maxFrames: 110 })
    }),

    vagabond: Object.freeze({
      id: 'vagabond', name: 'Vagabond', archetype: 'Sci-fi / blade',
      source: 'https://pixramen.itch.io/2d-action-platformer-sci-fi-vagabond', color: '#3e9ea8',
      portrait: '/generated/characters/vagabond/portrait.png',
      movement: Object.freeze({ ...commonMovement, runSpeed: 5.35, jumpVelocity: -11.3,
        rollSpeed: 12.2, rollEndSpeed: 4, rollFrames: 21, rollDeceleration: .38,
        rollInvulnerable: 13, rollCooldown: 39, teleportDistance: 255, teleportCooldown: 66 }),
      hurtbox: Object.freeze({ w: 32, h: 68, offsetX: 0, offsetY: -34 }),
      render: Object.freeze({ scale: 4, originX: .5, originY: 1, sourceFacing: 1 }),
      projectileVisual: Object.freeze({ effect: 'thunderSplash', tint: 0x66e8f2, scale: .5, trail: 'violetFlare' }),
      assets: Object.freeze({
        kind: 'separate-sheets', root: '/generated/characters/vagabond/', frameWidth: 64, frameHeight: 64,
        states: Object.freeze({
          appear: animation('teleport.png', 4, 17, 0), idle: animation('idle.png', 2, 6, -1), run: animation('run.png', 8, 15, -1),
          jump: animation('jump.png', 3, 12, 0), fall: animation('fall.png', [1, 2], 9, -1), land: animation('idle.png', [0, 1], 8, 0),
          light: animation('light.png', 15, 19, 0, { frameWidth: 128 }),
          light1: animation('light.png', [0, 1, 2, 3, 4], 18, 0, { frameWidth: 128 }),
          light2: animation('light.png', [5, 6, 7, 8, 9], 19, 0, { frameWidth: 128 }),
          light3: animation('light.png', [10, 11, 12, 13, 14], 20, 0, { frameWidth: 128 }),
          airLight: animation('ability.png', 16, 20, 0, { frameWidth: 128 }),
          special: animation('special.png', 13, 17, 0, { frameWidth: 128 }),
          ability: animation('ability.png', 16, 20, 0, { frameWidth: 128 }),
          roll: animation('roll.png', 4, 18, 0), teleport: animation('teleport.png', 4, 20, 0),
          block: animation('block.png', 2, 8, -1), hurt: animation('hurt.png', 4, 11, 0),
          ko: animation('ko.png', 7, 8, 0), charge: animation('charge.png', 13, 14, -1, { frameWidth: 128 })
        })
      }),
      moves: Object.freeze({
        light: move('light', 'Plasma edge chain', {
          animation: 'light', startup: 5, active: 5, recovery: 12, damage: 8, chip: 1, hitstun: 16, blockstun: 8,
          knockbackX: 5, knockbackY: -2.2, hitstop: 6, cooldown: 0, airStall: 5, airGravity: .4, airDrift: .64,
          hitbox: { w: 80, h: 46, offsetX: 44, offsetY: -34 }
        }),
        special: move('special', 'Charged saber', {
          animation: 'special', startup: 12, active: 7, recovery: 25, damage: 21, chip: 5, hitstun: 31, blockstun: 14,
          knockbackX: 9.5, knockbackY: -5.8, hitstop: 9, cooldown: 0, airStall: 9, airGravity: .32, airDrift: .46,
          hitbox: { w: 205, h: 70, offsetX: 105, offsetY: -39 }
        }),
        ability: move('ability', 'Vacuum blade', {
          animation: 'ability', startup: 8, active: 1, recovery: 17, damage: 11, chip: 2, hitstun: 19, blockstun: 8,
          knockbackX: 5.8, knockbackY: -2.5, hitstop: 6, cooldown: 33, projectileSpeed: 13, projectileLife: 125,
          projectileWidth: 34, projectileHeight: 22, projectileOffsetX: 44, airStall: 7, airGravity: .32, airDrift: .58,
          hitbox: { w: 0, h: 0, offsetX: 0, offsetY: -35 }
        }),
        ultimate: move('ultimate', 'Event Horizon Saber', {
          cinematicName: 'Tinh Kiếm Chân Không', startup: ULTIMATE.introFrames, active: 1, recovery: ULTIMATE.aftermathFrames,
          damage: 42, chip: 10, hitstun: 50, blockstun: 24, knockbackX: 14, knockbackY: -8, hitstop: 13, cooldown: 0,
          hitbox: { w: WORLD.maxX - WORLD.minX, h: 320, offsetX: 0, offsetY: -160 }
        })
      }),
      combos: comboSet([
        comboStep('light1', { startup: 5, active: 4, recovery: 8, damage: 7, hitbox: { w: 76, h: 44, offsetX: 42, offsetY: -34 } }),
        comboStep('light2', { startup: 4, active: 5, recovery: 8, damage: 8, knockbackY: -3.4, hitbox: { w: 88, h: 50, offsetX: 47, offsetY: -35 } }),
        comboStep('light3', { startup: 5, active: 6, recovery: 12, damage: 11, knockbackX: 8.2, knockbackY: -5.4, hitstop: 8, hitbox: { w: 108, h: 62, offsetX: 57, offsetY: -38 } })
      ], [
        comboStep('airLight', { startup: 5, active: 8, recovery: 11, damage: 10, knockbackX: 7, knockbackY: 5.6, hitbox: { w: 108, h: 70, offsetX: 54, offsetY: -23 } })
      ], 30),
      charge: Object.freeze({ thresholdFrames: 46, maxFrames: 116 })
    })
  });

  const DODGES = Object.freeze({
    roll: Object.freeze({ total: 20, invulnerable: 11, speed: 9.6, endSpeed: 2.8, cooldown: 36 }),
    teleport: Object.freeze({ total: 22, invulnerable: 16, distance: 210, warpFrame: 8, cooldown: 72 })
  });

  return Object.freeze({ version: '3.1.6', WORLD, NETWORK, CONTROLS, MAPS, CHARACTERS, DODGES, ULTIMATE });
}));
