'use strict';

// 1. Handshake with p2game SDK as early as possible (RT-006)
if (typeof window !== 'undefined' && window.p2 && typeof window.p2.init === 'function') {
  window.p2.init().then((ctx) => {
    if (ctx?.player && typeof session !== 'undefined') session.p2User = ctx.player;
    if (window.p2.auth && typeof window.p2.auth.getUser === 'function') {
      window.p2.auth.getUser().then((u) => {
        if (u && typeof session !== 'undefined') session.p2User = u;
      }).catch(() => {});
    }
  }).catch((e) => console.warn('[p2game] init error:', e));
}

(function bootPixelClash() {
  const query = new URLSearchParams(window.location.search);
  const isLocalDevServer = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    (window.location.port === '3000' || window.location.port === '3001');
  const defaultRemote = 'https://pixelclashfightgame.onrender.com';
  const socketEndpoint = query.get('socket') || window.PIXEL_SOCKET_URL || (isLocalDevServer ? undefined : defaultRemote);

  if (!window.io) {
    if (window.__pixelClashSocketLoading) return;
    window.__pixelClashSocketLoading = true;
    const script = document.createElement('script');
    script.src = './shared/socket.io.min.js';
    script.onload = () => {
      window.__pixelClashSocketLoading = false;
      bootPixelClash();
    };
    script.onerror = () => {
      const message = document.getElementById('menu-message');
      if (message) {
        message.hidden = false;
        message.textContent = 'Không tải được Socket.io client. Vui lòng kiểm tra kết nối mạng.';
      }
    };
    document.head.append(script);
    return;
  }

  const GAME = window.PIXEL_CLASH_DATA;
  if (!GAME) throw new Error('Không tải được shared/game-data.js');

  const { WORLD, NETWORK, MAPS, CHARACTERS } = GAME;
  const socket = window.io(socketEndpoint, {
    transports: ['polling', 'websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    auth: { clientVersion: GAME.version }
  });

  function ensureSocketConnected() {
    if (!socket.connected && !socket.active) {
      socket.connect();
    }
  }

  if (isLocalDevServer) {
    socket.connect();
  } else {
    ['pointerdown', 'keydown', 'touchstart'].forEach((type) => {
      window.addEventListener(type, ensureSocketConnected, { once: true });
    });
  }

  // Optional VFX kitbash registry. Keep every URL inside the owning character
  // folder; preload rejects cross-character paths. Example:
  // special: { url: '/assets/Buck Borris/Buck Borris/my-blast.png',
  //   frameWidth: 96, frameHeight: 64, frames: 8, frameRate: 18,
  //   fit: 'stretch-x', widthScale: 1, heightScale: 1.15 }
  const VFX_KIT = Object.freeze({
    buck: Object.freeze({ light: null, special: null, chargedSpecial: null, ability: null }),
    rogue: Object.freeze({ light: null, special: null, ability: null })
  });
  // Effect sheets shipped inside each character pack. These always render
  // before the neutral/common VFX layer, preserving the artist's authored
  // motion and silhouette instead of recoloring one generic effect for all.
  const AUTHORED_VFX = Object.freeze({
    dragon_knight: Object.freeze({
      attackA: Object.freeze({ url: '/assets/dragon_knight/dragon_knight/spritesheets/1x/attack_on_hit_a.png', frameWidth: 96, frameHeight: 64, frames: 3, frameRate: 18, anchor: 'fighter' }),
      attackB: Object.freeze({ url: '/assets/dragon_knight/dragon_knight/spritesheets/1x/attack_on_hit_b.png', frameWidth: 96, frameHeight: 64, frames: 3, frameRate: 18, anchor: 'fighter' }),
      breath: Object.freeze({ url: '/assets/dragon_knight/dragon_knight/spritesheets/1x/dragon_knight_firebreath_effect.png', frameWidth: 96, frameHeight: 64, frames: 7, frameRate: 18, anchor: 'fighter' }),
      dash: Object.freeze({ url: '/assets/dragon_knight/dragon_knight/spritesheets/1x/dash_flame_trail.png', frameWidth: 96, frameHeight: 64, frames: 3, frameRate: 18, anchor: 'fighter' }),
      explosion: Object.freeze({ url: '/assets/dragon_knight/dragon_knight/spritesheets/1x/fireball_explosion.png', frameWidth: 96, frameHeight: 64, frames: 5, frameRate: 19, anchor: 'point', scale: 3.4 })
    }),
    iron_sentinel: Object.freeze({
      attackA: Object.freeze({ url: '/assets/iron_sentinel/iron_sentinel/spritesheets/1x/attack_effect_a.png', frameWidth: 64, frameHeight: 64, frames: 3, frameRate: 17, anchor: 'fighter' }),
      attackB: Object.freeze({ url: '/assets/iron_sentinel/iron_sentinel/spritesheets/1x/attack_effect_b.png', frameWidth: 64, frameHeight: 64, frames: 3, frameRate: 18, anchor: 'fighter' }),
      attackC: Object.freeze({ url: '/assets/iron_sentinel/iron_sentinel/spritesheets/1x/attack_effect_c.png', frameWidth: 64, frameHeight: 64, frames: 3, frameRate: 19, anchor: 'fighter' }),
      block: Object.freeze({ url: '/assets/iron_sentinel/iron_sentinel/spritesheets/1x/block_effect.png', frameWidth: 64, frameHeight: 64, frames: 3, frameRate: 14, anchor: 'fighter' }),
      dash: Object.freeze({ url: '/assets/iron_sentinel/iron_sentinel/spritesheets/1x/iron_sentinel_dash_effect.png', frameWidth: 64, frameHeight: 64, frames: 4, frameRate: 18, anchor: 'fighter' })
    }),
    purple_battlemage: Object.freeze({
      fast: Object.freeze({ url: '/assets/PurpleGirl/PurpleGirl/Arcane Effects/Fast Arcane/Fast Arcane Effect.png', frameWidth: 32, frameHeight: 32, frames: 10, frameRate: 18, anchor: 'box', scale: 2.3 }),
      spin: Object.freeze({ url: '/assets/PurpleGirl/PurpleGirl/Arcane Effects/Spin attack Effect/Spin attack Effect.png', frameWidth: 64, frameHeight: 32, frames: 7, frameRate: 18, anchor: 'fighter', scale: 2.5 }),
      sustain: Object.freeze({ url: '/assets/PurpleGirl/PurpleGirl/Arcane Effects/Sustain Arcane/Sustain Arcane fire.png', frameWidth: 72, frameHeight: 36, frames: 16, frameRate: 18, anchor: 'box', scale: 2.25 })
    })
  });
  const BUCK_FIREBALL_VFX = Object.freeze({
    root: '/common-vfx/Fireballs by Weentermakesgames/Fireballs by Weentermakesgames/FireballPixelart/PixelartFireBall-',
    frames: 24,
    frameRate: 24,
    scale: 0.9
  });
  const COMMON_VFX = Object.freeze({
    hit: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_SmallHit/30fps/Spritesheets/Effect_SmallHit_1_532x528.png',
      frameWidth: 532, frameHeight: 528, frames: 30, frameRate: 30, scale: 0.17
    }),
    guard: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_ElectricShield/30fps/Spritesheets/Effect_ElectricShield_1_265x265.png',
      frameWidth: 265, frameHeight: 265, frames: 30, frameRate: 30, scale: 0.42
    }),
    charge: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_Charged/30fps/Spritesheets/Effect_Charged_1_321x371.png',
      frameWidth: 321, frameHeight: 371, frames: 40, frameRate: 30, scale: 0.23
    }),
    hyperspeed: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_Hyperspeed/30fps/Spritesheets/Effect_Hyperspeed_1_517x515.png',
      frameWidth: 517, frameHeight: 515, frames: 30, frameRate: 30, scale: 0.3
    }),
    roll: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_PuffAndStars/30fps/Spritesheets/Effect_PuffAndStars_1_120x109.png',
      frameWidth: 120, frameHeight: 109, frames: 30, frameRate: 30, scale: 0.48
    }),
    teleport: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_Anima/30fps/Spritesheets/Effect_Anima_1_437x437.png',
      frameWidth: 437, frameHeight: 437, frames: 30, frameRate: 30, scale: 0.18
    }),
    impact: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_Impact/30fps/Spritesheets/Effect_Impact_1_291x301.png',
      frameWidth: 291, frameHeight: 301, frames: 30, frameRate: 30, scale: 0.2
    }),
    bigHit: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_BigHit/30fps/Spritesheets/Effect_BigHit_1_557x553.png',
      frameWidth: 557, frameHeight: 553, frames: 30, frameRate: 30, scale: 0.13
    }),
    constellation: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_Constellation/30fps/Spritesheets/Effect_Constellation_1_299x313.png',
      frameWidth: 299, frameHeight: 313, frames: 30, frameRate: 30, scale: 0.2
    }),
    magma: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_Magma/30fps/Spritesheets/Effect_Magma_1_381x186.png',
      frameWidth: 381, frameHeight: 186, frames: 30, frameRate: 30, scale: 0.3
    }),
    powerChords: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_PowerChords/30fps/Spritesheets/Effect_PowerChords_1_517x353.png',
      frameWidth: 517, frameHeight: 353, frames: 30, frameRate: 30, scale: 0.2
    }),
    vortex: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_TheVortex/30fps/Spritesheets/Effect_TheVortex_1_427x431.png',
      frameWidth: 427, frameHeight: 431, frames: 30, frameRate: 30, scale: 0.17
    }),
    explosion: Object.freeze({
      url: '/common-vfx/VFX Free Pack/Effect_Explosion2/30fps/Spritesheets/Effect_Explosion2_1_355x355.png',
      frameWidth: 355, frameHeight: 355, frames: 30, frameRate: 30, scale: 0.22
    }),
    sunburn: Object.freeze({
      url: '/common-vfx/Free Pixel Effects Pack/16_sunburn_spritesheet.png',
      frameWidth: 100, frameHeight: 100, frames: 61, frameRate: 60, scale: 0.9
    }),
    fireSpin: Object.freeze({
      url: '/common-vfx/Free Pixel Effects Pack/7_firespin_spritesheet.png',
      frameWidth: 100, frameHeight: 100, frames: 61, frameRate: 60, scale: 0.9
    }),
    phantomBlade: Object.freeze({
      url: '/common-vfx/Free Pixel Effects Pack/14_phantom_spritesheet.png',
      frameWidth: 100, frameHeight: 100, frames: 61, frameRate: 60, scale: 0.9
    }),
    midnight: Object.freeze({
      url: '/common-vfx/Free Pixel Effects Pack/18_midnight_spritesheet.png',
      frameWidth: 100, frameHeight: 100, frames: 61, frameRate: 60, scale: 0.9
    }),
    nebula: Object.freeze({
      url: '/common-vfx/Free Pixel Effects Pack/12_nebula_spritesheet.png',
      frameWidth: 100, frameHeight: 100, frames: 60, frameRate: 60, scale: 0.9
    }),
    orangePortal: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/03.png',
      frameWidth: 64, frameHeight: 64, frames: 13, frameRate: 22, row: 0, scale: 1.15
    }),
    violetPortal: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/03.png',
      frameWidth: 64, frameHeight: 64, frames: 13, frameRate: 22, row: 1, scale: 1.15
    }),
    orangeFlare: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/13.png',
      frameWidth: 64, frameHeight: 64, frames: 13, frameRate: 24, row: 0, scale: 1
    }),
    violetFlare: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/13.png',
      frameWidth: 64, frameHeight: 64, frames: 13, frameRate: 24, row: 1, scale: 1
    }),
    orangeSparkle: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/24.png',
      frameWidth: 64, frameHeight: 64, frames: 14, frameRate: 26, row: 0, scale: .9
    }),
    violetSparkle: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/24.png',
      frameWidth: 64, frameHeight: 64, frames: 14, frameRate: 26, row: 1, scale: .9
    }),
    orangePuff: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/25.png',
      frameWidth: 64, frameHeight: 64, frames: 14, frameRate: 22, row: 0, scale: 1
    }),
    violetPuff: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/25.png',
      frameWidth: 64, frameHeight: 64, frames: 14, frameRate: 22, row: 1, scale: 1
    }),
    orangeRing: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/26.png',
      frameWidth: 64, frameHeight: 64, frames: 14, frameRate: 24, row: 0, scale: 1.05
    }),
    violetRing: Object.freeze({
      url: '/common-vfx/Effect and FX Pixel All Free/Free/Part 1/26.png',
      frameWidth: 64, frameHeight: 64, frames: 14, frameRate: 24, row: 1, scale: 1.05
    }),
    thunderStrike: Object.freeze({
      url: '/common-vfx/Thunder Effect 02/Thunder Effect 02/Thunder Strike/Thunderstrike wo blur.png',
      frameWidth: 64, frameHeight: 64, frames: 13, frameRate: 18, scale: 1.25
    }),
    thunderSplash: Object.freeze({
      url: '/common-vfx/Thunder Effect 02/Thunder Effect 02/Thunder Splash/Thunder splash wo blur.png',
      frameWidth: 48, frameHeight: 48, frames: 14, frameRate: 18, scale: 1.35
    })
  });

  const freezeRecipes = (recipes) => Object.freeze(recipes.map((recipe) => Object.freeze(recipe)));
  function themedCharacterVfx({ accent, primary, secondary, ring, puff, trail, heavy = primary }) {
    return Object.freeze({
      accent,
      moves: Object.freeze({
        light: freezeRecipes([
          { effect: 'impact', scale: .72, tint: accent, offsetX: 6 },
          { effect: trail, scale: .66, tint: accent, offsetX: 16, offsetY: -5, delay: 28 }
        ]),
        special: freezeRecipes([
          { effect: primary, fit: 'hitbox', widthScale: 1.12, heightScale: 1.45, tint: accent, depth: 13 },
          { effect: secondary, scale: 1.08, tint: accent, offsetX: 42, offsetY: -4, delay: 42 }
        ]),
        chargedSpecial: freezeRecipes([
          { effect: heavy, fit: 'hitbox', widthScale: 1.08, heightScale: 1.8, tint: accent, depth: 13 },
          { effect: primary, fit: 'hitbox', widthScale: .96, heightScale: 1.25, tint: accent, depth: 14, delay: 24 },
          { effect: ring, scale: 1.65, tint: accent, offsetX: -52, offsetY: -4, delay: 38 },
          { effect: secondary, scale: 1.42, tint: accent, offsetX: 72, offsetY: -6, delay: 68 },
          { effect: trail, scale: 1.18, tint: accent, offsetX: 118, offsetY: -10, delay: 104 }
        ]),
        ability: freezeRecipes([
          { effect: ring, scale: .9, tint: accent, offsetX: 28, offsetY: -3 },
          { effect: trail, scale: .68, tint: accent, offsetX: 45, offsetY: -7, delay: 34 }
        ])
      }),
      states: Object.freeze({
        appear: freezeRecipes([
          { effect: secondary, scale: 1.22, tint: accent, offsetY: -34 },
          { effect: ring, scale: 1.45, tint: accent, offsetY: -31, delay: 62 }
        ]),
        jump: freezeRecipes([{ effect: trail, scale: .56, tint: accent, offsetY: 0 }]),
        doubleJump: freezeRecipes([
          { effect: ring, scale: 1.02, tint: accent, offsetY: -3 },
          { effect: trail, scale: .62, tint: accent, offsetY: -9, delay: 38 }
        ]),
        fall: freezeRecipes([{ effect: trail, scale: .38, tint: accent, offsetX: -8, offsetY: -47 }]),
        land: freezeRecipes([
          { effect: 'roll', scale: .68, tint: accent, offsetY: 7 },
          { effect: secondary, scale: .55, tint: accent, offsetY: 2, delay: 24 }
        ]),
        block: freezeRecipes([
          { effect: 'guard', scale: .62, tint: accent, offsetX: 25, offsetY: -34 },
          { effect: ring, scale: .82, tint: accent, offsetX: 25, offsetY: -34, delay: 35 }
        ]),
        hurt: freezeRecipes([{ effect: puff, scale: .78, tint: accent, offsetY: -38 }]),
        ko: freezeRecipes([
          { effect: puff, scale: 1.18, tint: accent, offsetY: -36 },
          { effect: secondary, scale: .85, tint: accent, offsetY: -34, delay: 72 }
        ])
      }),
      mobility: Object.freeze({
        roll: freezeRecipes([
          { effect: 'hyperspeed', width: 112, height: 46, flip: true, tint: accent, offsetX: -28, offsetY: -27 },
          { effect: trail, scale: .58, tint: accent, offsetX: -28, offsetY: -28, delay: 30 }
        ]),
        'teleport-start': freezeRecipes([
          { effect: secondary, scale: .9, tint: accent, offsetY: -31 },
          { effect: ring, scale: 1.22, tint: accent, offsetY: -30, delay: 28 }
        ]),
        'teleport-warp': freezeRecipes([
          { effect: primary, scale: .9, tint: accent, offsetY: -31 },
          { effect: trail, scale: .82, tint: accent, offsetY: -36, delay: 34 }
        ])
      })
    });
  }
  // Shared VFX are neutral source material. This profile is the ownership
  // layer: every fighter selects a distinct recipe for moves and mobility.
  // Adding a character later should add one profile here instead of branching
  // throughout the Phaser scene.
  const CHARACTER_VFX = Object.freeze({
    buck: Object.freeze({
      accent: 0xe09a42,
      moves: Object.freeze({
        light: Object.freeze([
          Object.freeze({ effect: 'impact', scale: 0.78, tint: 0xffbd61, offsetX: 4 }),
          Object.freeze({ effect: 'orangeFlare', scale: .72, offsetX: 12, delay: 32 })
        ]),
        special: Object.freeze([
          Object.freeze({ effect: 'magma', fit: 'hitbox', widthScale: 1.08, heightScale: 1.35, offsetY: 3 }),
          Object.freeze({ effect: 'orangePortal', scale: 1.3, offsetX: -32, offsetY: -2 }),
          Object.freeze({ effect: 'orangeSparkle', scale: 1.05, offsetX: 34, offsetY: -5, delay: 55 })
        ]),
        chargedSpecial: Object.freeze([
          Object.freeze({ effect: 'powerChords', fit: 'hitbox', widthScale: 1.06, heightScale: 2.1, offsetY: -8 }),
          Object.freeze({ effect: 'thunderStrike', scale: 1.65, offsetX: 80, offsetY: -22 }),
          Object.freeze({ effect: 'magma', fit: 'hitbox', widthScale: .98, heightScale: 1.32, offsetY: 2, delay: 24 }),
          Object.freeze({ effect: 'orangeRing', scale: 1.8, offsetX: -74, offsetY: -2, delay: 45 }),
          Object.freeze({ effect: 'orangeFlare', scale: 1.45, offsetX: 120, offsetY: -5, delay: 82 }),
          Object.freeze({ effect: 'orangeSparkle', scale: 1.2, offsetX: 170, offsetY: -12, delay: 118 })
        ]),
        ability: Object.freeze([
          Object.freeze({ effect: 'orangeRing', scale: 1.05, offsetX: 30, offsetY: -1 }),
          Object.freeze({ effect: 'orangeFlare', scale: .9, offsetX: 43, offsetY: -1, delay: 26 }),
          Object.freeze({ effect: 'orangeSparkle', scale: .68, offsetX: 52, offsetY: -8, delay: 58 })
        ])
      }),
      states: Object.freeze({
        appear: Object.freeze([
          Object.freeze({ effect: 'orangePortal', scale: 1.6, offsetY: -30 }),
          Object.freeze({ effect: 'orangeRing', scale: 1.45, offsetY: -29, delay: 80 }),
          Object.freeze({ effect: 'orangeSparkle', scale: 1.15, offsetY: -48, delay: 130 })
        ]),
        jump: Object.freeze([
          Object.freeze({ effect: 'orangeFlare', scale: .72, offsetY: 2 }),
          Object.freeze({ effect: 'orangeSparkle', scale: .58, offsetX: -10, offsetY: 2, delay: 36 })
        ]),
        doubleJump: Object.freeze([
          Object.freeze({ effect: 'orangeRing', scale: 1.08, offsetY: -2 }),
          Object.freeze({ effect: 'orangeFlare', scale: .86, offsetY: 1, delay: 28 }),
          Object.freeze({ effect: 'orangeSparkle', scale: .62, offsetX: -12, offsetY: -9, delay: 62 })
        ]),
        fall: Object.freeze([
          Object.freeze({ effect: 'orangeSparkle', scale: .42, offsetX: -8, offsetY: -48 })
        ]),
        land: Object.freeze([
          Object.freeze({ effect: 'roll', scale: .78, tint: 0xffc77a, offsetY: 8 }),
          Object.freeze({ effect: 'thunderSplash', scale: .76, offsetY: 6, delay: 22 })
        ]),
        block: Object.freeze([
          Object.freeze({ effect: 'orangeRing', scale: 1.05, offsetX: 24, offsetY: -31 }),
          Object.freeze({ effect: 'orangeSparkle', scale: .55, offsetX: 31, offsetY: -38, delay: 45 })
        ]),
        hurt: Object.freeze([
          Object.freeze({ effect: 'orangePuff', scale: .82, offsetY: -42 })
        ]),
        ko: Object.freeze([
          Object.freeze({ effect: 'orangePuff', scale: 1.35, offsetY: -39 }),
          Object.freeze({ effect: 'orangeRing', scale: 1.55, offsetY: -35, delay: 80 }),
          Object.freeze({ effect: 'thunderSplash', scale: 1.05, offsetY: 5, delay: 120 })
        ])
      }),
      mobility: Object.freeze({
        roll: Object.freeze([
          Object.freeze({ effect: 'roll', scale: 1.08, tint: 0xffbf69, offsetX: -18, offsetY: 15 }),
          Object.freeze({ effect: 'impact', scale: 0.62, tint: 0xf09a3e, offsetX: -8, offsetY: -4, depth: 12 }),
          Object.freeze({ effect: 'orangeSparkle', scale: .62, offsetX: -32, offsetY: -20, delay: 35 })
        ]),
        'teleport-start': Object.freeze([
          Object.freeze({ effect: 'magma', scale: 0.82, offsetY: 15, depth: 11 }),
          Object.freeze({ effect: 'impact', scale: 0.72, tint: 0xffb24d, offsetY: -12 }),
          Object.freeze({ effect: 'orangePortal', scale: 1.38, offsetY: -28, delay: 30 })
        ]),
        'teleport-warp': Object.freeze([
          Object.freeze({ effect: 'explosion', scale: 0.92, offsetY: -28 }),
          Object.freeze({ effect: 'impact', scale: 0.68, tint: 0xffd27a, offsetY: -24 }),
          Object.freeze({ effect: 'orangeFlare', scale: 1.05, offsetY: -29, delay: 45 })
        ])
      })
    }),
    rogue: Object.freeze({
      accent: 0x8e72b7,
      moves: Object.freeze({
        light: Object.freeze([
          Object.freeze({ effect: 'bigHit', scale: 0.72, tint: 0xc7b0ee, offsetX: 8 }),
          Object.freeze({ effect: 'violetSparkle', scale: .82, offsetX: 18, offsetY: -4, delay: 28 })
        ]),
        special: Object.freeze([
          Object.freeze({ effect: 'hyperspeed', fit: 'hitbox', widthScale: 1.35, heightScale: 1.8, flip: true, depth: 13 }),
          Object.freeze({ effect: 'vortex', scale: 0.76, tint: 0xa58ad1, offsetX: 82, offsetY: -3, depth: 12 }),
          Object.freeze({ effect: 'violetFlare', scale: 1.2, offsetX: 46, offsetY: -2, delay: 48 })
        ]),
        chargedSpecial: Object.freeze([
          Object.freeze({ effect: 'hyperspeed', fit: 'hitbox', widthScale: 1.16, heightScale: 2.15, flip: true, tint: 0xb99de2, depth: 13 }),
          Object.freeze({ effect: 'phantomBlade', fit: 'hitbox', widthScale: 1.02, heightScale: 1.55, tint: 0xd7c7f1, depth: 14, delay: 22 }),
          Object.freeze({ effect: 'vortex', scale: 1.5, tint: 0x8e72b7, offsetX: 84, offsetY: -5, delay: 42 }),
          Object.freeze({ effect: 'violetRing', scale: 1.8, tint: 0xc9b3ee, offsetX: -64, offsetY: -3, delay: 58 }),
          Object.freeze({ effect: 'violetFlare', scale: 1.42, offsetX: 145, offsetY: -4, delay: 92 }),
          Object.freeze({ effect: 'violetSparkle', scale: 1.18, offsetX: 190, offsetY: -12, delay: 122 })
        ]),
        ability: Object.freeze([
          Object.freeze({ effect: 'constellation', scale: 0.76, tint: 0xb99de2, offsetX: 30, offsetY: -2 }),
          Object.freeze({ effect: 'violetSparkle', scale: .72, offsetX: 22, offsetY: -8, delay: 42 })
        ])
      }),
      states: Object.freeze({
        appear: Object.freeze([
          Object.freeze({ effect: 'violetPortal', scale: 1.55, offsetY: -31 }),
          Object.freeze({ effect: 'violetRing', scale: 1.4, offsetY: -30, delay: 70 }),
          Object.freeze({ effect: 'violetSparkle', scale: 1.1, offsetY: -49, delay: 125 })
        ]),
        jump: Object.freeze([
          Object.freeze({ effect: 'violetFlare', scale: .68, offsetY: 1 }),
          Object.freeze({ effect: 'violetSparkle', scale: .62, offsetX: -8, offsetY: -3, delay: 32 })
        ]),
        doubleJump: Object.freeze([
          Object.freeze({ effect: 'violetRing', scale: 1.08, offsetY: -3 }),
          Object.freeze({ effect: 'violetFlare', scale: .82, offsetY: 0, delay: 26 }),
          Object.freeze({ effect: 'violetSparkle', scale: .68, offsetX: -10, offsetY: -12, delay: 58 })
        ]),
        fall: Object.freeze([
          Object.freeze({ effect: 'violetSparkle', scale: .44, offsetX: -8, offsetY: -49 })
        ]),
        land: Object.freeze([
          Object.freeze({ effect: 'constellation', scale: .52, tint: 0xb99de2, offsetY: 2 }),
          Object.freeze({ effect: 'violetFlare', scale: .68, offsetY: 5, delay: 26 })
        ]),
        block: Object.freeze([
          Object.freeze({ effect: 'violetRing', scale: 1.08, offsetX: 24, offsetY: -32 }),
          Object.freeze({ effect: 'violetSparkle', scale: .58, offsetX: 31, offsetY: -40, delay: 42 })
        ]),
        hurt: Object.freeze([
          Object.freeze({ effect: 'violetPuff', scale: .82, offsetY: -43 })
        ]),
        ko: Object.freeze([
          Object.freeze({ effect: 'violetPuff', scale: 1.35, offsetY: -40 }),
          Object.freeze({ effect: 'vortex', scale: .72, tint: 0x9e80cc, offsetY: -34, delay: 70 }),
          Object.freeze({ effect: 'violetSparkle', scale: 1.2, offsetY: -51, delay: 130 })
        ])
      }),
      mobility: Object.freeze({
        roll: Object.freeze([
          Object.freeze({ effect: 'hyperspeed', width: 118, height: 48, flip: true, tint: 0xa88bd4, offsetX: -32, offsetY: -28, depth: 11 }),
          Object.freeze({ effect: 'constellation', scale: 0.58, tint: 0xb99de2, offsetX: -12, offsetY: -23 }),
          Object.freeze({ effect: 'violetSparkle', scale: .62, offsetX: -34, offsetY: -31, delay: 34 })
        ]),
        'teleport-start': Object.freeze([
          Object.freeze({ effect: 'vortex', scale: 0.88, tint: 0x9e80cc, offsetY: -30, depth: 11 }),
          Object.freeze({ effect: 'constellation', scale: 0.68, tint: 0xc5b0e7, offsetY: -26 }),
          Object.freeze({ effect: 'violetPortal', scale: 1.35, offsetY: -30, delay: 28 })
        ]),
        'teleport-warp': Object.freeze([
          Object.freeze({ effect: 'teleport', scale: 1.05, tint: 0xbda5df, offsetY: -31 }),
          Object.freeze({ effect: 'constellation', scale: 0.78, tint: 0x9e80cc, offsetY: -26 }),
          Object.freeze({ effect: 'violetFlare', scale: 1.05, offsetY: -31, delay: 42 })
        ])
      })
    }),
    soul_knight: themedCharacterVfx({
      accent: 0xa9c4cf, primary: 'phantomBlade', secondary: 'constellation', ring: 'violetRing', puff: 'violetPuff', trail: 'violetSparkle', heavy: 'midnight'
    }),
    dragon_knight: themedCharacterVfx({
      accent: 0xf06b38, primary: 'fireSpin', secondary: 'magma', ring: 'orangeRing', puff: 'orangePuff', trail: 'orangeSparkle', heavy: 'powerChords'
    }),
    iron_sentinel: themedCharacterVfx({
      accent: 0xb8d0d3, primary: 'thunderSplash', secondary: 'impact', ring: 'orangeRing', puff: 'orangePuff', trail: 'orangeFlare', heavy: 'thunderStrike'
    }),
    dark_ninja: themedCharacterVfx({
      accent: 0xb34de0, primary: 'phantomBlade', secondary: 'midnight', ring: 'violetRing', puff: 'violetPuff', trail: 'violetSparkle', heavy: 'vortex'
    }),
    purple_battlemage: themedCharacterVfx({
      accent: 0xe36eb7, primary: 'nebula', secondary: 'vortex', ring: 'violetRing', puff: 'violetPuff', trail: 'violetFlare', heavy: 'powerChords'
    }),
    raptor: themedCharacterVfx({
      accent: 0x70bd8d, primary: 'hyperspeed', secondary: 'powerChords', ring: 'orangeRing', puff: 'orangePuff', trail: 'constellation', heavy: 'bigHit'
    }),
    stick_fighter: themedCharacterVfx({
      accent: 0xffffff, primary: 'bigHit', secondary: 'impact', ring: 'orangeRing', puff: 'orangePuff', trail: 'roll', heavy: 'powerChords'
    }),
    vagabond: themedCharacterVfx({
      accent: 0x62e4ef, primary: 'thunderStrike', secondary: 'thunderSplash', ring: 'violetRing', puff: 'violetPuff', trail: 'violetFlare', heavy: 'phantomBlade'
    })
  });
  const BATTLE_SFX = Object.freeze({
    jump: '/sounds/Retro/jump_short.wav',
    fall: '/sounds/Retro/fall_quick.wav',
    roll: '/sounds/Other/whoosh_1.wav',
    teleport: '/sounds/Environment/air_burst.wav',
    rogueLight: '/sounds/Weapons/sword_slice.wav',
    rogueSpecial: '/sounds/Other/whoosh_2.wav',
    rogueAbility: '/sounds/Retro/throw.wav',
    buckLight: '/sounds/Combat and Gore/punch_2.wav',
    buckSpecial: '/sounds/Retro/explosion_quick.wav',
    buckCharged: '/sounds/Retro/explosion_medium.wav',
    buckAbility: '/sounds/Retro/throw.wav',
    charge: '/sounds/Retro/power_up.wav',
    hit: '/sounds/Combat and Gore/punch_3.wav',
    hurt: '/sounds/Retro/hurt.wav',
    guard: '/sounds/Weapons/sword_clash.wav',
    land: '/sounds/Weapons/harsh_thud.wav',
    pop: '/sounds/UI/pop_2.wav',
    twang: '/sounds/Other/elastic_twang.wav',
    appear: '/sounds/Retro/grow_big.wav',
    mystery: '/sounds/Musical Effects/8_bit_mystery.wav',
    blockStart: '/sounds/Items/item_equip.wav',
    sparkle: '/sounds/Musical Effects/xylophone_chime_quick.wav',
    thunder: '/sounds/Retro/explosion_small.wav',
    defeated: '/sounds/Musical Effects/8_bit_defeated.wav',
    scratch: '/sounds/Other/record_scratch.wav',
    cancel: '/sounds/UI/pop_1.wav',
    combo: '/sounds/Weapons/sword_light.wav',
    prayer: '/sounds/Musical Effects/music_box_chime_positive.wav',
    potion: '/sounds/Other/drink_slurp.wav',
    heal: '/sounds/Match Three/match_xylophone_10_MAX.wav',
    disallow: '/sounds/UI/sci_fi_disallow.wav',
    ghost: '/sounds/Retro/ghost.wav',
    scan: '/sounds/UI/synth_process_complete.wav',
    soulLight: '/sounds/Weapons/sword_light.wav',
    soulSpecial: '/sounds/Weapons/harsh_thud.wav',
    soulAbility: '/sounds/Weapons/sword_unsheath.wav',
    dragonLight: '/sounds/Combat and Gore/swipe.wav',
    dragonSpecial: '/sounds/Environment/fire_lighting.wav',
    dragonAbility: '/sounds/Retro/explosion_quick.wav',
    dragonExtra: '/sounds/Environment/air_burst.wav',
    ironLight: '/sounds/Materials/metal_clang.wav',
    ironSpecial: '/sounds/Materials/stone_push_short.wav',
    ironAbility: '/sounds/Materials/metal_blunt_tap.wav',
    ironExtra: '/sounds/Combat and Gore/bone_snap.wav',
    ninjaLight: '/sounds/Weapons/sword_slice.wav',
    ninjaSpecial: '/sounds/Other/whoosh_2.wav',
    mageLight: '/sounds/UI/synth_confirmation.wav',
    mageSpecial: '/sounds/Match Three/match_synth_7.wav',
    mageAbility: '/sounds/Musical Effects/harpsichord_chime_quick.wav',
    raptorLight: '/sounds/Combat and Gore/crunch_quick.wav',
    raptorSpecial: '/sounds/Combat and Gore/crunch_splat.wav',
    raptorAbility: '/sounds/Human/man_7.wav',
    stickLight: '/sounds/Combat and Gore/slap.wav',
    stickSpecial: '/sounds/Other/elastic_twang.wav',
    stickAbility: '/sounds/UI/pop_4.wav',
    vagabondLight: '/sounds/Weapons/sword_sharpen.wav',
    vagabondSpecial: '/sounds/Machines/razor_buzz.wav',
    vagabondAbility: '/sounds/UI/sci_fi_select_big.wav',
    ultimateReady: '/sounds/Match Three/match_synth_10_MAX.wav',
    ultimateIntroBuck: '/sounds/Musical Effects/brass_mystery.wav',
    ultimateIntroRogue: '/sounds/Musical Effects/horror_sting.wav',
    ultimateBuck: '/sounds/Retro/explosion_large.wav',
    ultimateRogue: '/sounds/Weapons/sword_unsheath.wav',
    ultimateEnd: '/sounds/Retro/power_down_2.wav'
  });
  const CHARACTER_AUDIO = Object.freeze({
    buck: Object.freeze({ light: 'buckLight', special: 'buckSpecial', chargedSpecial: 'buckCharged', ability: 'buckAbility', rate: .92 }),
    rogue: Object.freeze({ light: 'rogueLight', special: 'rogueSpecial', ability: 'rogueAbility', rate: 1.08 }),
    soul_knight: Object.freeze({ light: 'soulLight', special: 'soulSpecial', chargedSpecial: 'ultimateRogue', ability: 'soulAbility', rate: .78 }),
    dragon_knight: Object.freeze({ light: 'dragonLight', special: 'dragonSpecial', chargedSpecial: 'buckCharged', ability: 'dragonAbility', airAbility: 'dragonSpecial', extra: 'dragonExtra', rate: .82 }),
    iron_sentinel: Object.freeze({ light: 'ironLight', special: 'ironSpecial', chargedSpecial: 'land', ability: 'ironAbility', extra: 'ironExtra', rate: .72 }),
    dark_ninja: Object.freeze({ light: 'ninjaLight', special: 'ninjaSpecial', chargedSpecial: 'teleport', ability: 'rogueAbility', extra: 'ghost', rate: 1.18 }),
    purple_battlemage: Object.freeze({ light: 'mageLight', special: 'mageSpecial', chargedSpecial: 'mystery', ability: 'mageAbility', extra: 'mageSpecial', rate: 1.08 }),
    raptor: Object.freeze({ light: 'raptorLight', special: 'raptorSpecial', chargedSpecial: 'twang', ability: 'raptorAbility', extra: 'scan', rate: .76 }),
    stick_fighter: Object.freeze({ light: 'stickLight', special: 'stickSpecial', chargedSpecial: 'scratch', ability: 'stickAbility', rate: 1.2 }),
    vagabond: Object.freeze({ light: 'vagabondLight', special: 'vagabondSpecial', chargedSpecial: 'ultimateRogue', ability: 'vagabondAbility', rate: 1.04 })
  });

  const WARM_VFX_CHARACTERS = new Set(['buck', 'dragon_knight', 'iron_sentinel', 'raptor', 'stick_fighter']);
  const themeRing = (character) => WARM_VFX_CHARACTERS.has(character) ? 'orangeRing' : 'violetRing';
  const themeSparkle = (character) => WARM_VFX_CHARACTERS.has(character) ? 'orangeSparkle' : 'violetSparkle';
  const characterAudioRate = (character) => CHARACTER_AUDIO[character]?.rate || 1;

  // The ultimate profile is deliberately separate from frame data. It lets a
  // fighter keep its own authored sprites while the neutral VFX pool supplies
  // the large spectacle that the source pack does not contain.
  const ULTIMATE_ART = Object.freeze({
    buck: Object.freeze({
      pattern: 'worldbreaker', word: 'THIÊN HỎA!', hitWord: 'DIỆT!', accent: 0xf1a64a,
      intro: 'charge', aura: 'sunburn', ring: 'orangeRing', zoom: 1.42,
      introSound: 'ultimateIntroBuck', releaseSound: 'ultimateBuck', introRate: .82, releaseRate: .72,
      hitPrimary: 'explosion', hitSecondary: 'sunburn'
    }),
    rogue: Object.freeze({
      pattern: 'thousand-blades', word: 'VẠN NHẪN!', hitWord: 'ĐOẠN!', accent: 0xb99de2,
      intro: 'midnight', aura: 'vortex', ring: 'violetRing', zoom: 1.5, afterimages: 5,
      introSound: 'ultimateIntroRogue', releaseSound: 'ultimateRogue', introRate: 1.04, releaseRate: .72,
      hitPrimary: 'bigHit', hitSecondary: 'phantomBlade'
    }),
    soul_knight: Object.freeze({
      pattern: 'abyssal-oath', word: 'HẮC KIẾM!', hitWord: 'TRẢM!', accent: 0xbfd7df,
      intro: 'constellation', aura: 'phantomBlade', ring: 'violetRing', zoom: 1.46,
      introSound: 'ultimateIntroRogue', releaseSound: 'ultimateRogue', introRate: .7, releaseRate: .58,
      hitPrimary: 'phantomBlade', hitSecondary: 'midnight'
    }),
    dragon_knight: Object.freeze({
      pattern: 'dragon-inferno', word: 'LONG VIÊM!', hitWord: 'THIÊU!', accent: 0xff743d,
      intro: 'fireSpin', aura: 'magma', ring: 'orangeRing', zoom: 1.4,
      introSound: 'ultimateIntroBuck', releaseSound: 'ultimateBuck', introRate: .72, releaseRate: .64,
      hitPrimary: 'explosion', hitSecondary: 'fireSpin'
    }),
    iron_sentinel: Object.freeze({
      pattern: 'citadel-breaker', word: 'THIẾT CHẤN!', hitWord: 'NGHIỀN!', accent: 0xd7e8ea,
      intro: 'guard', aura: 'thunderSplash', ring: 'orangeRing', zoom: 1.38,
      introSound: 'guard', releaseSound: 'thunder', introRate: .68, releaseRate: .58,
      hitPrimary: 'thunderSplash', hitSecondary: 'powerChords'
    }),
    dark_ninja: Object.freeze({
      pattern: 'eclipse', word: 'NHẬT THỰC!', hitWord: 'ẢNH SÁT!', accent: 0xc25ee8,
      intro: 'midnight', aura: 'violetPortal', ring: 'violetRing', zoom: 1.54, afterimages: 7,
      introSound: 'ultimateIntroRogue', releaseSound: 'rogueSpecial', introRate: .84, releaseRate: 1.2,
      hitPrimary: 'vortex', hitSecondary: 'phantomBlade'
    }),
    purple_battlemage: Object.freeze({
      pattern: 'arcane-dominion', word: 'TINH VỰC!', hitWord: 'BÙNG NỔ!', accent: 0xf087c9,
      intro: 'nebula', aura: 'vortex', ring: 'violetRing', zoom: 1.48,
      introSound: 'mystery', releaseSound: 'ultimateRogue', introRate: 1.08, releaseRate: .9,
      hitPrimary: 'nebula', hitSecondary: 'powerChords'
    }),
    raptor: Object.freeze({
      pattern: 'cretaceous-hunt', word: 'TRUY SÁT!', hitWord: 'CẮN XÉ!', accent: 0x86d5a1,
      intro: 'powerChords', aura: 'hyperspeed', ring: 'orangeRing', zoom: 1.4,
      introSound: 'hurt', releaseSound: 'twang', introRate: .7, releaseRate: .64,
      hitPrimary: 'bigHit', hitSecondary: 'hyperspeed'
    }),
    stick_fighter: Object.freeze({
      pattern: 'panel-breaker', word: 'PHÁ KHUNG!', hitWord: 'BỐP!!!', accent: 0xffffff,
      intro: 'impact', aura: 'orangePuff', ring: 'orangeRing', zoom: 1.52,
      introSound: 'scratch', releaseSound: 'pop', introRate: .82, releaseRate: .72,
      hitPrimary: 'impact', hitSecondary: 'powerChords'
    }),
    vagabond: Object.freeze({
      pattern: 'event-horizon', word: 'CHÂN KHÔNG!', hitWord: 'ĐOẠN KHÔNG!', accent: 0x75eef5,
      intro: 'thunderSplash', aura: 'hyperspeed', ring: 'violetRing', zoom: 1.5, afterimages: 4,
      introSound: 'ultimateIntroRogue', releaseSound: 'thunder', introRate: 1.16, releaseRate: .76,
      hitPrimary: 'thunderStrike', hitSecondary: 'phantomBlade'
    })
  });

  const byId = (id) => document.getElementById(id);
  const ui = {
    app: byId('app'),
    menuScreen: byId('menu-screen'),
    gameScreen: byId('game-screen'),
    connection: byId('connection-status'),
    launch: byId('launch-match'),
    launchLabel: byId('launch-label'),
    menuMessage: byId('menu-message'),
    roomCodeField: byId('room-code-field'),
    roomCodeInput: byId('room-code-input'),
    aiDifficultyField: byId('ai-difficulty-field'),
    mapPickerField: byId('map-picker-field'),
    mapRail: document.querySelector('.map-card-rail'),
    mapRailPrev: byId('map-rail-prev'),
    mapRailNext: byId('map-rail-next'),
    mapGuestNote: byId('map-guest-note'),
    selectedMapSummary: byId('selected-map-summary'),
    p2Picker: byId('p2-picker-section'),
    p2ControlLabel: byId('p2-control-label'),
    modeKicker: byId('mode-kicker'),
    modeDescription: byId('mode-description'),
    loading: byId('loading-cover'),
    loadingMessage: byId('loading-message'),
    health: [byId('health-p1'), byId('health-p2')],
    ultimateMeters: [byId('ultimate-meter-p1'), byId('ultimate-meter-p2')],
    names: [byId('hud-name-p1'), byId('hud-name-p2')],
    wins: [byId('wins-p1'), byId('wins-p2')],
    hudMode: byId('hud-mode'),
    hudTimer: byId('hud-timer'),
    hudRound: byId('hud-round'),
    roomBadge: byId('room-badge'),
    phaseBanner: byId('phase-banner'),
    phaseEyebrow: byId('phase-eyebrow'),
    phaseTitle: byId('phase-title'),
    phaseCaption: byId('phase-caption'),
    ultimateCinematic: byId('ultimate-cinematic'),
    ultimateFighterName: byId('ultimate-fighter-name'),
    ultimateMoveName: byId('ultimate-move-name'),
    ribbon: byId('control-ribbon'),
    ribbonToggle: byId('ribbon-toggle'),
    drawer: byId('command-drawer'),
    drawerBackdrop: byId('drawer-backdrop'),
    drawerTitle: byId('drawer-title'),
    drawerMode: byId('drawer-mode'),
    drawerRoom: byId('drawer-room'),
    devTab: byId('dev-tab-button'),
    rematch: byId('rematch-button'),
    toastRegion: byId('toast-region'),
    debugReadout: byId('debug-readout'),
    debugState: byId('debug-state'),
    debugFrame: byId('debug-frame'),
    debugPhase: byId('debug-phase'),
    debugPing: byId('debug-ping'),
    sfxVolume: byId('sfx-volume'),
    cameraShake: byId('camera-shake-toggle'),
    reduceMotion: byId('reduce-motion-toggle')
  };

  const MODE_COPY = Object.freeze({
    training: {
      kicker: 'Training dojo',
      description: 'Tự do kiểm tra đòn, va chạm và dev tools.',
      launch: 'Vào training'
    },
    pve: {
      kicker: 'PvE mission',
      description: 'Đấu với CPU authoritative theo thể thức Best of 3 (ai thắng 2 round trước sẽ chiến thắng), có ba cấp phản ứng từ Dễ đến Khó.',
      launch: 'Bắt đầu đấu máy'
    },
    'online-create': {
      kicker: 'Online host',
      description: 'Tạo phòng rồi gửi mã 4 số cho bạn bè.',
      launch: 'Tạo phòng online'
    },
    'online-join': {
      kicker: 'Online guest',
      description: 'Nhập đúng mã 4 số để vào ghế P2.',
      launch: 'Vào phòng'
    }
  });

  const session = {
    menuMode: 'training',
    picks: ['buck', 'rogue'],
    aiDifficulty: 'normal',
    mapId: 'desert',
    active: false,
    mode: null,
    code: null,
    seat: null,
    controlledSlots: [],
    latestState: null,
    lastPhase: null,
    lastIntro: null,
    inputSequence: 0,
    lastInputSent: [{}, {}],
    lastInputAt: [0, 0],
    drawerOpen: false,
    debug: false,
    game: null,
    scene: null,
    cssFullscreen: false,
    phaseHideTimer: 0,
    matchOverTimer: 0,
    lastUltimateEnergy: [0, 0],
    p2User: null
  };

  const preferences = {
    volume: 0.55,
    cameraShake: true,
    ribbon: true,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };
  let connectionWasLost = false;

  try {
    const saved = JSON.parse(localStorage.getItem('pixel-clash-settings') || '{}');
    if (Number.isFinite(saved.volume)) preferences.volume = Math.max(0, Math.min(1, saved.volume));
    if (typeof saved.cameraShake === 'boolean') preferences.cameraShake = saved.cameraShake;
    if (typeof saved.ribbon === 'boolean') preferences.ribbon = saved.ribbon;
    if (typeof saved.reduceMotion === 'boolean') preferences.reduceMotion = saved.reduceMotion;
  } catch (_error) {
    // Storage can be disabled without affecting gameplay.
  }

  function savePreferences() {
    try { localStorage.setItem('pixel-clash-settings', JSON.stringify(preferences)); } catch (_error) { /* optional */ }
  }

  function applyPreferences() {
    ui.sfxVolume.value = String(Math.round(preferences.volume * 100));
    ui.cameraShake.checked = preferences.cameraShake;
    ui.ribbonToggle.checked = preferences.ribbon;
    ui.reduceMotion.checked = preferences.reduceMotion;
    ui.ribbon.hidden = !preferences.ribbon || !session.active;
    document.body.classList.toggle('reduce-motion', preferences.reduceMotion);
  }

  let audioContext = null;
  function playTone(frequency, duration = 0.07, type = 'square', gainScale = 1) {
    if (preferences.volume <= 0) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(preferences.volume * 0.045 * gainScale, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (_error) {
      // Web Audio is a non-critical game-feel layer.
    }
  }

  function showToast(message, duration = 2300) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    ui.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function setLoading(visible, message = 'Đồng bộ với server…') {
    ui.loading.hidden = !visible;
    ui.loadingMessage.textContent = message;
  }

  function setMenuError(message = '') {
    ui.menuMessage.hidden = !message;
    ui.menuMessage.textContent = message;
  }

  function setConnection(state, label) {
    ui.connection.dataset.state = state;
    ui.connection.lastElementChild.textContent = label;
  }

  function selectMenuMode(mode) {
    session.menuMode = mode;
    ui.menuScreen.dataset.mode = mode;
    document.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const copy = MODE_COPY[mode];
    ui.modeKicker.textContent = copy.kicker;
    ui.modeDescription.textContent = copy.description;
    ui.launchLabel.textContent = copy.launch;
    ui.roomCodeField.hidden = mode !== 'online-join';
    ui.aiDifficultyField.hidden = mode !== 'pve';
    ui.mapRail.hidden = mode === 'online-join';
    ui.mapGuestNote.hidden = mode !== 'online-join';
    ui.selectedMapSummary.hidden = mode === 'online-join';
    ui.p2Picker.hidden = mode === 'online-create' || mode === 'online-join';
    ui.p2ControlLabel.textContent = mode === 'training'
      ? 'Dummy training'
      : mode === 'pve'
        ? `CPU · ${difficultyLabel(session.aiDifficulty)}`
        : 'Đối thủ chọn trên máy riêng';
    setMenuError();
    if (mode === 'online-join') window.setTimeout(() => ui.roomCodeInput.focus(), 0);
  }

  function selectCharacter(picker, character) {
    const slot = picker === 'p1' ? 0 : 1;
    session.picks[slot] = character;
    document.querySelectorAll(`[data-picker="${picker}"] [data-character]`).forEach((button) => {
      const active = button.dataset.character === character;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const rosterIndex = Math.max(0, Object.keys(CHARACTERS).indexOf(character));
    playTone(170 + rosterIndex * 18, .045, 'square', .5);
  }

  function buildRosterPickers() {
    document.querySelectorAll('[data-picker]').forEach((picker) => {
      const slot = picker.dataset.picker === 'p1' ? 0 : 1;
      const fragment = document.createDocumentFragment();
      Object.values(CHARACTERS).forEach((definition) => {
        const selected = session.picks[slot] === definition.id;
        const button = document.createElement('button');
        button.className = `fighter-card${selected ? ' is-selected' : ''}`;
        button.type = 'button';
        button.dataset.character = definition.id;
        button.setAttribute('aria-pressed', String(selected));
        const optionalSkills = [
          definition.support ? `O: ${definition.support.label}` : null,
          definition.moves.extra ? `P: ${definition.moves.extra.label}` : null
        ].filter(Boolean).join(' · ');
        const kitSummary = `Giữ J: ${definition.moves.light.label} · Giữ K: ${definition.moves.special.label} · I: ${definition.moves.ability.label}${optionalSkills ? ` · ${optionalSkills}` : ''} · U: ${definition.moves.ultimate.cinematicName}`;
        button.setAttribute('aria-label', `${definition.name} · ${definition.archetype}. ${kitSummary}`);
        button.title = `${definition.name} — ${definition.archetype}\n${kitSummary}`;
        button.style.setProperty('--fighter-accent', definition.color);

        const portrait = document.createElement('span');
        portrait.className = `fighter-portrait fighter-portrait--${definition.id}`;
        portrait.setAttribute('aria-hidden', 'true');
        if (definition.portrait) portrait.style.backgroundImage = `url("${definition.portrait}")`;

        const meta = document.createElement('span');
        meta.className = 'fighter-meta';
        const name = document.createElement('strong');
        name.textContent = definition.name;
        const archetype = document.createElement('small');
        archetype.textContent = definition.archetype;
        meta.append(name, archetype);

        const check = document.createElement('span');
        check.className = 'check-mark';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';
        button.append(portrait, meta, check);
        fragment.append(button);
      });
      picker.replaceChildren(fragment);
    });
  }

  buildRosterPickers();

  function difficultyLabel(difficulty) {
    return difficulty === 'easy' ? 'Dễ' : difficulty === 'hard' ? 'Khó' : 'Vừa';
  }

  function selectDifficulty(difficulty) {
    if (!['easy', 'normal', 'hard'].includes(difficulty)) return;
    session.aiDifficulty = difficulty;
    document.querySelectorAll('[data-difficulty]').forEach((button) => {
      const active = button.dataset.difficulty === difficulty;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (session.menuMode === 'pve') ui.p2ControlLabel.textContent = `CPU · ${difficultyLabel(difficulty)}`;
    playTone(difficulty === 'easy' ? 210 : difficulty === 'hard' ? 130 : 170, .04, 'square', .42);
  }

  function selectMap(mapId, focusCard = false, silent = false) {
    const definition = MAPS[mapId];
    if (!definition) return;
    session.mapId = mapId;
    document.querySelectorAll('[data-map]').forEach((button) => {
      const active = button.dataset.map === mapId;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-checked', String(active));
      if (active && focusCard) {
        const targetLeft = button.offsetLeft - (ui.mapRail.clientWidth - button.offsetWidth) / 2;
        ui.mapRail.scrollTo({ left: Math.max(0, targetLeft), behavior: preferences.reduceMotion ? 'auto' : 'smooth' });
      }
    });
    ui.selectedMapSummary.querySelector('strong').textContent = definition.name;
    ui.selectedMapSummary.querySelector('span').textContent = `${definition.layout} · ${definition.biome}`;
    if (!silent) playTone(155 + Object.keys(MAPS).indexOf(mapId) * 16, .045, 'triangle', .42);
  }

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => selectMenuMode(button.dataset.mode));
  });

  document.querySelectorAll('[data-picker]').forEach((picker) => {
    picker.querySelectorAll('[data-character]').forEach((button) => {
      button.addEventListener('click', () => selectCharacter(picker.dataset.picker, button.dataset.character));
    });
  });

  document.querySelectorAll('[data-difficulty]').forEach((button) => {
    button.addEventListener('click', () => selectDifficulty(button.dataset.difficulty));
  });

  document.querySelectorAll('[data-map]').forEach((button) => {
    button.addEventListener('click', () => selectMap(button.dataset.map, true));
  });

  function moveMapRail(direction) {
    ui.mapRail.scrollBy({
      left: direction * Math.max(150, ui.mapRail.clientWidth * .72),
      behavior: preferences.reduceMotion ? 'auto' : 'smooth'
    });
  }

  ui.mapRailPrev.addEventListener('click', () => moveMapRail(-1));
  ui.mapRailNext.addEventListener('click', () => moveMapRail(1));

  ui.roomCodeInput.addEventListener('input', () => {
    ui.roomCodeInput.value = ui.roomCodeInput.value.replace(/\D/g, '').slice(0, 4);
    setMenuError();
  });

  async function launchSelectedMode() {
    ensureSocketConnected();
    if (!socket.connected) {
      setLoading(true, 'Đang kết nối tới server…');
      let waitMs = 0;
      while (!socket.connected && waitMs < 3000) {
        await new Promise((r) => setTimeout(r, 150));
        waitMs += 150;
      }
      setLoading(false);
      if (!socket.connected) {
        setMenuError('Chưa kết nối được server chiến đấu. Hãy thử lại sau vài giây.');
        return;
      }
    }
    if (!window.Phaser) {
      setMenuError('Không tải được Phaser 3 từ CDN. Hãy kiểm tra kết nối mạng.');
      return;
    }
    ui.launch.disabled = true;
    setLoading(true, session.menuMode === 'online-join' ? 'Đang vào phòng…' : 'Đang tạo sân đấu…');

    const callback = (result) => {
      ui.launch.disabled = false;
      if (!result?.ok) {
        setLoading(false);
        setMenuError(result?.message || 'Không thể bắt đầu trận.');
        return;
      }
      if (!ensureCompatibleVersion(result.state)) return;
      enterSession(result);
    };

    if (session.menuMode === 'online-join') {
      const code = ui.roomCodeInput.value.trim();
      if (!/^\d{4}$/.test(code)) {
        ui.launch.disabled = false;
        setLoading(false);
        setMenuError('Mã phòng phải có đúng 4 chữ số.');
        return;
      }
      socket.emit('room:join', { code, character: session.picks[0], clientVersion: GAME.version }, callback);
      return;
    }

    const mode = session.menuMode === 'online-create' ? 'online' : session.menuMode;
    socket.emit('room:create', {
      mode,
      characters: session.picks,
      difficulty: mode === 'pve' ? session.aiDifficulty : undefined,
      mapId: session.mapId,
      clientVersion: GAME.version
    }, callback);
  }

  ui.launch.addEventListener('click', launchSelectedMode);

  function ensureCompatibleVersion(state) {
    if (!state?.version || state.version === GAME.version) return true;
    const reloadKey = `pixel-clash-reload-${state.version}`;
    setLoading(true, `Đang đồng bộ client ${GAME.version} với server ${state.version}…`);
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('build', state.version);
      window.location.replace(nextUrl.href);
      return false;
    }
    setLoading(false);
    setMenuError(`Client ${GAME.version} không khớp server ${state.version}. Hãy nhấn Ctrl+F5.`);
    return false;
  }

  function enterSession(result) {
    session.active = true;
    session.mode = result.mode;
    session.code = result.code;
    session.seat = result.seat;
    session.controlledSlots = result.controlledSlots || [result.seat];
    session.latestState = result.state;
    session.mapId = result.state.mapId || 'desert';
    selectMap(session.mapId, false, true);
    session.lastPhase = null;
    session.lastIntro = null;
    session.debug = false;
    session.inputSequence = 0;
    session.lastInputSent = [{}, {}];
    session.lastInputAt = [0, 0];
    session.lastUltimateEnergy = [0, 0];
    ui.menuScreen.hidden = true;
    ui.gameScreen.hidden = false;
    ui.devTab.hidden = session.mode !== 'training';
    ui.roomBadge.textContent = session.mode === 'online' ? `ROOM ${session.code}` : (MAPS[session.mapId]?.name || session.mode.toUpperCase());
    ui.drawerMode.textContent = session.mode === 'training'
      ? 'Training'
      : session.mode === 'pve'
        ? `PvE · ${difficultyLabel(result.state.aiDifficulty)}`
        : 'Online duel';
    ui.drawerRoom.textContent = session.mode === 'online'
      ? `Phòng ${session.code} · ${MAPS[session.mapId]?.name || 'Chiến địa'}`
      : `${session.mode === 'pve' ? 'Đối thủ máy' : 'Sân tập'} · ${MAPS[session.mapId]?.name || 'Chiến địa'}`;
    ui.rematch.disabled = true;
    ui.debugReadout.hidden = true;
    ui.ultimateCinematic.hidden = true;
    ui.ultimateCinematic.classList.remove('is-release');
    applyPreferences();
    createGame();
    updateHud(result.state);
    setLoading(false);
    byId('game-container').focus();
  }

  function leaveSession() {
    window.clearTimeout(session.matchOverTimer);
    socket.emit('room:leave');
    closeDrawer();
    session.active = false;
    session.mode = null;
    session.code = null;
    session.latestState = null;
    session.controlledSlots = [];
    session.lastUltimateEnergy = [0, 0];
    if (session.game) {
      session.game.destroy(true);
      session.game = null;
      session.scene = null;
    }
    ui.gameScreen.hidden = true;
    ui.menuScreen.hidden = false;
    ui.phaseBanner.hidden = true;
    ui.ultimateCinematic.hidden = true;
    ui.ultimateCinematic.classList.remove('is-release');
    setLoading(false);
    selectMenuMode(session.menuMode);
  }

  function openDrawer(tab = 'match') {
    session.drawerOpen = true;
    ui.drawer.classList.add('is-open');
    ui.drawer.setAttribute('aria-hidden', 'false');
    ui.drawerBackdrop.hidden = false;
    ui.drawerTitle.textContent = tab === 'controls' ? 'Hướng dẫn phím' : tab === 'dev' ? 'Dev mode' : 'Tạm dừng';
    switchDrawerTab(tab);
    window.setTimeout(() => byId('close-drawer').focus(), 0);
  }

  function closeDrawer() {
    session.drawerOpen = false;
    ui.drawer.classList.remove('is-open');
    ui.drawer.setAttribute('aria-hidden', 'true');
    ui.drawerBackdrop.hidden = true;
    if (session.active) byId('game-container').focus();
  }

  function switchDrawerTab(tab) {
    if (tab === 'dev' && session.mode !== 'training') tab = 'match';
    document.querySelectorAll('[data-drawer-tab]').forEach((button) => {
      const active = button.dataset.drawerTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-drawer-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.drawerPanel === tab));
  }

  document.querySelectorAll('[data-drawer-tab]').forEach((button) => button.addEventListener('click', () => switchDrawerTab(button.dataset.drawerTab)));
  byId('global-guide').addEventListener('click', () => openDrawer('controls'));
  byId('open-full-guide').addEventListener('click', () => openDrawer('controls'));
  byId('arena-menu-button').addEventListener('click', () => openDrawer('match'));
  byId('close-drawer').addEventListener('click', closeDrawer);
  byId('resume-match').addEventListener('click', closeDrawer);
  byId('drawer-guide').addEventListener('click', () => switchDrawerTab('controls'));
  ui.drawerBackdrop.addEventListener('click', closeDrawer);
  byId('leave-match').addEventListener('click', leaveSession);
  byId('brand-home').addEventListener('click', () => { if (session.active) leaveSession(); });

  function toggleHitboxes() {
    if (!session.active || !session.scene) {
      showToast('F3 chỉ hoạt động khi đang ở trong sân đấu.');
      return;
    }
    session.debug = !session.debug;
    session.scene.setDebug(session.debug);
    ui.debugReadout.hidden = !session.debug;
    showToast(session.debug ? 'Đã bật hitbox / hurtbox server.' : 'Đã tắt hitbox / hurtbox.');
  }

  byId('training-hitboxes').addEventListener('click', toggleHitboxes);
  byId('training-reset').addEventListener('click', () => socket.emit('training:reset'));
  byId('training-frame-step').addEventListener('click', () => socket.emit('training:step'));
  byId('training-ultimate-fill').addEventListener('click', () => {
    socket.emit('training:ultimate', { full: true }, (result) => {
      if (result?.ok) showToast('Ultimate P1 đã đầy — nhấn U để thử cinematic.');
    });
  });
  byId('training-ultimate-use').addEventListener('click', () => {
    closeDrawer();
    socket.emit('training:ultimate-use', {}, (result) => {
      if (!result?.ok) showToast(result?.message || 'Không kích hoạt được Ultimate.');
    });
  });
  byId('training-vfx-showcase').addEventListener('click', () => {
    if (session.mode !== 'training' || !session.scene) return;
    closeDrawer();
    session.scene.runVfxShowcase();
  });
  ui.rematch.addEventListener('click', () => socket.emit('match:rematch'));

  document.querySelectorAll('[data-training-setting]').forEach((input) => {
    input.addEventListener('change', () => {
      socket.emit('training:update', { [input.dataset.trainingSetting]: input.checked }, (result) => {
        if (!result?.ok) showToast(result?.message || 'Không đổi được training setting.');
      });
    });
  });

  ui.sfxVolume.addEventListener('input', () => {
    preferences.volume = Number(ui.sfxVolume.value) / 100;
    savePreferences();
  });
  ui.cameraShake.addEventListener('change', () => { preferences.cameraShake = ui.cameraShake.checked; savePreferences(); });
  ui.ribbonToggle.addEventListener('change', () => {
    preferences.ribbon = ui.ribbonToggle.checked;
    ui.ribbon.hidden = !preferences.ribbon || !session.active;
    savePreferences();
  });
  ui.reduceMotion.addEventListener('change', () => {
    preferences.reduceMotion = ui.reduceMotion.checked;
    applyPreferences();
    savePreferences();
  });
  byId('hide-ribbon').addEventListener('click', () => {
    preferences.ribbon = false;
    applyPreferences();
    savePreferences();
  });

  async function toggleFullscreen() {
    try {
      if (typeof window !== 'undefined' && window.p2?.ui && typeof window.p2.ui.requestFullscreen === 'function') {
        await window.p2.ui.requestFullscreen();
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const target = session.active ? byId('arena-shell') : ui.app;
      if (target.requestFullscreen) {
        await target.requestFullscreen();
        return;
      }
      throw new Error('Fullscreen API unavailable');
    } catch (_error) {
      session.cssFullscreen = !session.cssFullscreen;
      ui.app.classList.toggle('is-css-fullscreen', session.cssFullscreen);
      showToast(session.cssFullscreen ? 'Đã dùng chế độ toàn màn hình tương thích.' : 'Đã thoát toàn màn hình.');
      session.game?.scale.refresh();
    }
  }

  ['global-fullscreen', 'drawer-fullscreen', 'settings-fullscreen'].forEach((id) => byId(id).addEventListener('click', toggleFullscreen));
  document.addEventListener('fullscreenchange', () => session.game?.scale.refresh());

  window.addEventListener('keydown', (event) => {
    if (event.repeat && ['Escape', 'KeyH', 'F3', 'KeyF', 'KeyR'].includes(event.code)) return;
    if (event.code === 'Escape' && session.active) {
      event.preventDefault();
      session.drawerOpen ? closeDrawer() : openDrawer('match');
    } else if (event.code === 'KeyH') {
      event.preventDefault();
      openDrawer('controls');
    } else if (event.code === 'F3') {
      event.preventDefault();
      toggleHitboxes();
    } else if (event.code === 'KeyF' && !isTyping()) {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.code === 'KeyR' && session.mode === 'training' && !isTyping()) {
      event.preventDefault();
      socket.emit('training:reset');
    }
  });

  function isTyping() {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function updateHud(state) {
    if (!state?.fighters) return;
    state.fighters.forEach((fighter, slot) => {
      const definition = CHARACTERS[fighter.character];
      ui.names[slot].textContent = (slot === 0 && session.p2User?.displayName)
        ? `${definition.name} · ${session.p2User.displayName}`
        : definition.name;
      const ratio = Math.max(0, Math.min(1, fighter.hp / fighter.maxHp));
      ui.health[slot].style.transform = `scaleX(${ratio})`;
      ui.health[slot].style.backgroundColor = ratio <= .25 ? '#ad443d' : slot === 0 ? '#d66043' : '#66558f';
      const meter = ui.ultimateMeters[slot];
      const energy = Math.max(0, Math.min(fighter.ultimateMax || 3, fighter.ultimateEnergy || 0));
      const maxEnergy = fighter.ultimateMax || 3;
      meter.setAttribute('aria-valuemax', String(maxEnergy));
      meter.setAttribute('aria-valuenow', String(energy));
      meter.classList.toggle('is-ready', energy >= maxEnergy);
      meter.querySelector('.ultimate-caption').textContent = energy >= maxEnergy ? 'U READY' : 'ULT';
      [...meter.querySelectorAll('.ultimate-seals i')].forEach((seal, index) => {
        seal.classList.toggle('is-filled', index < energy);
      });
      session.lastUltimateEnergy[slot] = energy;
      [...ui.wins[slot].children].forEach((pip, index) => pip.classList.toggle('is-won', index < fighter.wins));
    });
    const stageName = MAPS[state.mapId]?.name || 'Chiến địa';
    ui.roomBadge.textContent = state.mode === 'online' ? `ROOM ${state.code}` : stageName;
    ui.hudMode.textContent = state.mode === 'training'
      ? 'TRAINING'
      : state.mode === 'pve'
        ? `PVE · ${difficultyLabel(state.aiDifficulty).toUpperCase()}`
        : `ROOM ${state.code}`;
    ui.hudTimer.textContent = state.timer == null ? '∞' : String(state.timer).padStart(2, '0');
    ui.hudRound.textContent = `ROUND ${state.round}`;
    ui.rematch.disabled = state.phase !== 'match-over';
    updatePhaseBanner(state);
    updateTrainingControls(state.training);

    if (session.debug) {
      const slot = session.controlledSlots[0] ?? 0;
      const fighter = state.fighters[slot];
      ui.debugState.textContent = fighter?.state || '—';
      ui.debugFrame.textContent = fighter?.attack ? `${fighter.attack.frame}/${fighter.attack.total}` : String(fighter?.stateFrame ?? '—');
      ui.debugPhase.textContent = `${fighter?.attack?.phase || state.phase} · ${fighter?.surfaceId || 'air'}`;
    }
  }

  function updateTrainingControls(training) {
    if (!training) return;
    document.querySelectorAll('[data-training-setting]').forEach((input) => {
      input.checked = Boolean(training[input.dataset.trainingSetting]);
    });
  }

  function updatePhaseBanner(state) {
    if (state.phase === 'waiting') {
      showPhase('PHÒNG ONLINE', state.code, 'Gửi mã này cho người chơi thứ hai');
    } else if (state.phase === 'intro') {
      if (session.lastIntro !== state.intro) playTone(220 + state.intro * 35, .06, 'square', .55);
      showPhase(`ROUND ${state.round}`, String(Math.max(1, state.intro)), MAPS[state.mapId]?.name || 'Chuẩn bị xuất hiện');
    } else if (state.phase === 'fight' && session.lastPhase !== 'fight') {
      showPhase(`ROUND ${state.round}`, 'FIGHT', 'Bắt đầu');
      window.clearTimeout(session.phaseHideTimer);
      session.phaseHideTimer = window.setTimeout(() => { ui.phaseBanner.hidden = true; }, 650);
      playTone(360, .12, 'sawtooth', .75);
    } else if (state.phase === 'round-over') {
      const winner = Number.isInteger(state.roundWinner) ? state.fighters[state.roundWinner] : null;
      showPhase(`ROUND ${state.round}`, 'KẾT THÚC', winner ? `${CHARACTERS[winner.character].name} thắng ván` : 'Hòa');
    } else if (state.phase === 'match-over') {
      const winner = Number.isInteger(state.matchWinner) ? state.fighters[state.matchWinner] : null;
      const winsA = state.fighters[0]?.wins || 0;
      const winsB = state.fighters[1]?.wins || 0;
      showPhase('BEST OF 3', winner ? 'THẮNG' : 'HÒA', winner ? `${CHARACTERS[winner.character].name} (${winsA}–${winsB})` : `Tỷ số ${winsA}–${winsB}`);
      if (typeof window !== 'undefined' && window.p2 && typeof window.p2.gameOver === 'function') {
        try {
          window.p2.gameOver({
            winner: winner ? winner.character : 'draw',
            score: state.matchWinner === 0 ? (winsA * 1000 + 500) : (winsA * 500),
            winsA,
            winsB
          });
        } catch (_) {}
      }
      // Auto-return to main menu after 5 seconds
      window.clearTimeout(session.matchOverTimer);
      session.matchOverTimer = window.setTimeout(() => {
        if (session.active) leaveSession();
      }, 5000);
    }
    // Clear auto-return timer if phase changed away from match-over (e.g. rematch)
    if (state.phase !== 'match-over') {
      window.clearTimeout(session.matchOverTimer);
    }
    session.lastPhase = state.phase;
    session.lastIntro = state.intro;
  }

  function showPhase(eyebrow, title, caption) {
    ui.phaseEyebrow.textContent = eyebrow;
    ui.phaseTitle.textContent = title;
    ui.phaseCaption.textContent = caption;
    ui.phaseBanner.hidden = false;
  }

  socket.on('connect', () => {
    setConnection('online', 'Server sẵn sàng');
    if (connectionWasLost && session.active) {
      showToast('Đã kết nối lại. Trận cũ đã hết phiên, hãy vào phòng lại.', 4200);
      leaveSession();
    }
    connectionWasLost = false;
  });
  socket.on('disconnect', () => {
    setConnection('offline', 'Mất kết nối');
    if (session.active) {
      connectionWasLost = true;
      showToast('Mất kết nối server. Nhân vật đã dừng nhận input.', 4000);
    }
  });
  socket.on('connect_error', () => setConnection('offline', 'Không có server'));
  socket.on('room:notice', ({ message }) => showToast(message));
  socket.on('room:state', (state) => {
    if (!session.active || state.code !== session.code) return;
    if (!ensureCompatibleVersion(state)) return;
    session.latestState = state;
    updateHud(state);
    session.scene?.consumeSnapshot(state);
  });
  socket.on('combat:event', (event) => session.scene?.handleCombatEvent(event));

  window.setInterval(() => {
    if (!socket.connected) return;
    const started = performance.now();
    socket.timeout(1200).emit('net:ping', { clientSentAt: Date.now() }, (error) => {
      if (!error) ui.debugPing.textContent = `${Math.round(performance.now() - started)} ms`;
    });
  }, 2000);

  class PixelClashScene extends Phaser.Scene {
    constructor() {
      super({ key: 'PixelClashV2' });
      this.views = [null, null];
      this.projectileViews = new Map();
      this.snapshot = null;
      this.appliedTick = -1;
      this.visualHitstopUntil = 0;
      this.debugEnabled = false;
      this.lastVisualStates = ['', ''];
      this.assetFailures = [];
      this.cameraZoom = 1;
      this.ultimateCinematic = null;
    }

    preload() {
      this.load.on('loaderror', (file) => this.assetFailures.push(file.src || file.key));
      const stage = MAPS[session.mapId] || MAPS.desert;
      if (stage.background.kind === 'layers') {
        stage.background.layers.forEach((url, index) => this.load.image(`stage-layer-${index}`, url));
        ['cloud1', 'cloud2', 'cloud4', 'cloud7'].forEach((name) => this.load.image(`stage-${name}`, `./backgrounds/BG_DesertMountains/${name}.png`));
      } else {
        this.load.image('stage-image', stage.background.file);
      }

      Object.values(CHARACTERS).forEach((definition) => {
        const assets = definition.assets;
        if (assets.kind === 'atlas-grid') {
          this.load.spritesheet(`fighter-${definition.id}-atlas`, assets.file, {
            frameWidth: assets.frameWidth,
            frameHeight: assets.frameHeight
          });
        } else if (assets.kind === 'separate-sheets') {
          Object.entries(assets.states).forEach(([state, spec]) => {
            const frameWidth = spec.frameWidth || assets.frameWidth;
            const frameHeight = spec.frameHeight || assets.frameHeight;
            const frameCount = Array.isArray(spec.frames) ? Math.max(...spec.frames) + 1 : spec.frames;
            this.load.spritesheet(`fighter-${definition.id}-${state}`, `${assets.root}${spec.file}`, {
              frameWidth,
              frameHeight,
              endFrame: Math.max(0, frameCount - 1)
            });
          });
        }
        if (assets.projectile) {
          this.load.spritesheet(`fighter-${definition.id}-projectile`, assets.projectile.file, {
            frameWidth: assets.projectile.frameWidth,
            frameHeight: assets.projectile.frameHeight,
            endFrame: assets.projectile.frames - 1
          });
        }
      });
      for (let frame = 1; frame <= BUCK_FIREBALL_VFX.frames; frame += 1) {
        this.load.image(`fighter-buck-fireball-${frame}`, `${BUCK_FIREBALL_VFX.root}${frame}.png`);
      }
      Object.entries(COMMON_VFX).forEach(([name, spec]) => {
        const firstFrame = (spec.row || 0) * spec.frames;
        this.load.spritesheet(`common-vfx-${name}`, spec.url, {
          frameWidth: spec.frameWidth,
          frameHeight: spec.frameHeight,
          endFrame: firstFrame + spec.frames - 1
        });
      });
      Object.entries(BATTLE_SFX).forEach(([name, url]) => this.load.audio(`battle-sfx-${name}`, url));

      Object.entries(AUTHORED_VFX).forEach(([character, effects]) => {
        Object.entries(effects).forEach(([name, spec]) => {
          this.load.spritesheet(`authored-vfx-${character}-${name}`, spec.url, {
            frameWidth: spec.frameWidth,
            frameHeight: spec.frameHeight,
            endFrame: spec.frames - 1
          });
        });
      });

      Object.entries(VFX_KIT).forEach(([character, moves]) => {
        const requiredRoot = character === 'buck' ? 'assets/Buck Borris/' : 'assets/Fantasy Rogue/';
        Object.entries(moves).forEach(([move, spec]) => {
          if (!spec) return;
          if (!spec.url.includes(requiredRoot)) {
            console.error(`[VFX ownership] ${character}.${move} phải nằm trong ${requiredRoot}`);
            return;
          }
          this.load.spritesheet(`kit-vfx-${character}-${move}`, spec.url, {
            frameWidth: spec.frameWidth,
            frameHeight: spec.frameHeight,
            endFrame: Math.max(0, spec.frames - 1)
          });
        });
      });
    }

    create() {
      session.scene = this;
      this.cameras.main.setRoundPixels(true);
      this.buildStage();
      this.configureFightCamera();
      this.createAnimations();
      this.createFallbackFx();
      this.debugGraphics = this.add.graphics().setDepth(80);
      this.guardGraphics = this.add.graphics().setDepth(18);
      this.createKeyboard();

      const initial = session.latestState;
      initial?.fighters?.forEach((fighter) => this.ensureView(fighter));
      if (initial) this.consumeSnapshot(initial);
      if (this.assetFailures.length) showToast(`Thiếu ${this.assetFailures.length} asset. Kiểm tra console và đường dẫn folder.`, 5000);
    }

    buildStage() {
      const stage = MAPS[session.mapId] || MAPS.desert;
      const segmentWidth = WORLD.viewWidth;
      const stageOffsetY = WORLD.groundY - WORLD.groundScreenY;
      this.cameras.main.setBackgroundColor(stage.skyColor);

      if (stage.background.kind === 'layers') {
        for (let segmentX = 0; segmentX < WORLD.width; segmentX += segmentWidth) {
          stage.background.layers.forEach((_url, index) => {
            this.add.image(segmentX, stageOffsetY, `stage-layer-${index}`).setOrigin(0).setScale(1.5).setDepth(-30 + index);
          });
        }
        const cloudSpecs = [
          ['stage-cloud7', 120, 112, 38, 16000],
          ['stage-cloud2', 620, 145, 28, 19000],
          ['stage-cloud4', 410, 72, 32, 21000],
          ['stage-cloud1', 820, 205, 24, 15000]
        ];
        for (let segmentX = 0; segmentX < WORLD.width; segmentX += segmentWidth) {
          cloudSpecs.forEach(([key, x, y, drift, duration], index) => {
            const cloudX = segmentX + x;
            const cloud = this.add.image(cloudX, stageOffsetY + y, key).setScale(1.4).setAlpha(.78).setDepth(-20 + index);
            this.tweens.add({ targets: cloud, x: cloudX + drift, duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          });
        }
      } else {
        const source = this.textures.get('stage-image').getSourceImage();
        const scale = Math.max(segmentWidth / source.width, WORLD.viewHeight / source.height);
        for (let segmentX = 0, segment = 0; segmentX < WORLD.width; segmentX += segmentWidth, segment += 1) {
          this.add.image(segmentX + segmentWidth / 2, WORLD.groundY, 'stage-image')
            .setOrigin(.5, 1)
            .setScale(scale)
            .setFlipX(segment % 2 === 1)
            .setDepth(-30);
        }
      }
      this.drawStageTerrain(stage);
    }

    drawStageTerrain(stage) {
      const graphics = this.add.graphics().setDepth(-4);
      const color = (value) => Phaser.Display.Color.HexStringToColor(value).color;
      const terrain = stage.terrain;
      graphics.fillStyle(color(terrain.body), .96).fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);
      graphics.fillStyle(color(terrain.edge), .82).fillRect(0, WORLD.groundY + 17, WORLD.width, 6);
      graphics.fillStyle(color(terrain.top), 1).fillRect(0, WORLD.groundY, WORLD.width, 7);
      graphics.fillStyle(color(terrain.accent), .9).fillRect(0, WORLD.groundY, WORLD.width, 2);

      stage.platforms.forEach((platform, index) => {
        const left = platform.x - platform.w / 2;
        graphics.fillStyle(color(terrain.edge), 1).fillRect(left - 2, platform.y - 2, platform.w + 4, platform.h + 5);
        graphics.fillStyle(color(terrain.body), 1).fillRect(left, platform.y, platform.w, platform.h);
        graphics.fillStyle(color(terrain.top), 1).fillRect(left, platform.y, platform.w, 7);
        graphics.fillStyle(color(terrain.accent), .95).fillRect(left + 3, platform.y, platform.w - 6, 2);
        for (let x = left + 18 + (index % 2) * 7; x < left + platform.w - 8; x += 36) {
          graphics.fillStyle(color(terrain.edge), .5).fillRect(x, platform.y + 13, 12, 3);
        }
      });
    }

    configureFightCamera() {
      const camera = this.cameras.main;
      camera.setBounds(0, 0, WORLD.width, WORLD.height);
      camera.setZoom(1);
      camera.scrollX = (WORLD.width - WORLD.viewWidth) / 2;
      camera.scrollY = WORLD.groundY - WORLD.groundScreenY;
    }

    updateFightCamera(delta) {
      if (this.ultimateCinematic) return;
      const fighters = this.snapshot?.fighters;
      if (!fighters?.[0] || !fighters?.[1]) return;
      const midpoint = (fighters[0].x + fighters[1].x) / 2;
      const separation = Math.abs(fighters[1].x - fighters[0].x);
      const desiredZoom = Phaser.Math.Clamp(
        WORLD.viewWidth / Math.max(WORLD.viewWidth, separation + 220),
        WORLD.cameraMinZoom,
        1
      );
      const blend = 1 - Math.exp(-Math.min(50, delta) / 1000 * 4.8);
      this.cameraZoom = Phaser.Math.Linear(this.cameraZoom, desiredZoom, blend);
      const camera = this.cameras.main;
      camera.setZoom(this.cameraZoom);

      // Phaser zooms around the camera origin (viewport center), not its
      // top-left corner. Scroll must therefore keep the midpoint at x=480 and
      // solve ground screen Y around y=270, otherwise zoom-out pushes fighters
      // below the canvas.
      const halfWidth = WORLD.viewWidth / 2;
      const halfHeight = WORLD.viewHeight / 2;
      const minScrollX = halfWidth / this.cameraZoom - halfWidth;
      const maxScrollX = WORLD.width - halfWidth - halfWidth / this.cameraZoom;
      const targetX = Phaser.Math.Clamp(midpoint - halfWidth, minScrollX, Math.max(minScrollX, maxScrollX));
      const minScrollY = halfHeight / this.cameraZoom - halfHeight;
      const maxScrollY = WORLD.height - halfHeight - halfHeight / this.cameraZoom;
      const groundedScrollY = WORLD.groundY - halfHeight
        - (WORLD.groundScreenY - halfHeight) / this.cameraZoom;
      const targetY = Phaser.Math.Clamp(groundedScrollY, minScrollY, Math.max(minScrollY, maxScrollY));
      camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetX, blend);
      camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetY, blend);
    }

    createAnimations() {
      Object.values(CHARACTERS).forEach((definition) => {
        const assets = definition.assets;
        Object.entries(assets.states).forEach(([state, spec]) => {
          const key = `anim-${definition.id}-${state}`;
          if (this.anims.exists(key)) return;
          const texture = assets.kind === 'atlas-grid'
            ? `fighter-${definition.id}-atlas`
            : `fighter-${definition.id}-${state}`;
          const frames = Array.isArray(spec.frames)
            ? spec.frames.map((frame) => ({ key: texture, frame }))
            : this.anims.generateFrameNumbers(texture, { start: 0, end: spec.frames - 1 });
          this.anims.create({ key, frames, frameRate: spec.frameRate, repeat: spec.repeat });
        });
        if (assets.projectile) {
          this.anims.create({
            key: `anim-${definition.id}-projectile`,
            frames: this.anims.generateFrameNumbers(`fighter-${definition.id}-projectile`, {
              start: 0,
              end: assets.projectile.frames - 1
            }),
            frameRate: assets.projectile.frameRate,
            repeat: -1
          });
        }
      });
      this.anims.create({
        key: 'anim-buck-fireball',
        frames: Array.from({ length: BUCK_FIREBALL_VFX.frames }, (_, index) => ({
          key: `fighter-buck-fireball-${index + 1}`
        })),
        frameRate: BUCK_FIREBALL_VFX.frameRate,
        repeat: -1
      });
      Object.entries(COMMON_VFX).forEach(([name, spec]) => {
        const firstFrame = (spec.row || 0) * spec.frames;
        this.anims.create({
          key: `anim-common-vfx-${name}`,
          frames: this.anims.generateFrameNumbers(`common-vfx-${name}`, {
            start: firstFrame,
            end: firstFrame + spec.frames - 1
          }),
          frameRate: spec.frameRate,
          repeat: spec.repeat ?? 0
        });
      });

      Object.entries(AUTHORED_VFX).forEach(([character, effects]) => {
        Object.entries(effects).forEach(([name, spec]) => {
          const texture = `authored-vfx-${character}-${name}`;
          this.anims.create({
            key: `anim-${texture}`,
            frames: this.anims.generateFrameNumbers(texture, { start: 0, end: spec.frames - 1 }),
            frameRate: spec.frameRate,
            repeat: 0
          });
        });
      });

      Object.entries(VFX_KIT).forEach(([character, moves]) => {
        Object.entries(moves).forEach(([move, spec]) => {
          const texture = `kit-vfx-${character}-${move}`;
          if (!spec || !this.textures.exists(texture)) return;
          this.anims.create({
            key: `anim-${texture}`,
            frames: this.anims.generateFrameNumbers(texture, { start: 0, end: Math.max(0, spec.frames - 1) }),
            frameRate: spec.frameRate || 16,
            repeat: 0
          });
        });
      });
    }

    createFallbackFx() {
      const spark = this.make.graphics({ x: 0, y: 0, add: false });
      spark.fillStyle(0xfff4c7, 1);
      spark.fillTriangle(12, 0, 16, 12, 28, 12);
      spark.fillTriangle(16, 16, 28, 20, 16, 24);
      spark.fillTriangle(12, 16, 12, 28, 8, 16);
      spark.fillTriangle(8, 12, 0, 8, 12, 8);
      spark.generateTexture('fx-impact', 28, 28);
      spark.destroy();

      const slash = this.make.graphics({ x: 0, y: 0, add: false });
      slash.lineStyle(5, 0xfff4c7, 1);
      slash.beginPath();
      slash.arc(32, 32, 25, -1.15, 1.15, false);
      slash.strokePath();
      slash.lineStyle(2, 0xd66043, .9);
      slash.beginPath();
      slash.arc(32, 32, 20, -1.15, 1.15, false);
      slash.strokePath();
      slash.generateTexture('fx-slash', 64, 64);
      slash.destroy();
    }

    createKeyboard() {
      const keyboard = this.input.keyboard;
      keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
      this.keys = {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        jump: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        light: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
        special: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
        roll: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        teleport: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
        block: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        ability: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I),
        support: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O),
        extra: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
        ultimate: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U)
      };
    }

    readInput() {
      if (session.drawerOpen || isTyping()) return neutralInput();
      return Object.fromEntries(Object.entries(this.keys).map(([name, key]) => [name, key.isDown]));
    }

    sendInputs(time) {
      if (!socket.connected || !session.active) return;
      session.controlledSlots.forEach((slot) => {
        // Online seats are server-owned, but each physical computer uses the
        // same primary layout. A guest controlling slot 1 must not inherit the
        // removed same-keyboard P2 bindings.
        const input = this.readInput();
        const encoded = JSON.stringify(input);
        const previous = session.lastInputSent[slot]?.encoded;
        if (encoded === previous && time - session.lastInputAt[slot] < 120) return;
        session.inputSequence += 1;
        socket.emit('player:input', { slot, sequence: session.inputSequence, input });
        session.lastInputSent[slot] = { encoded };
        session.lastInputAt[slot] = time;
      });
    }

    ensureView(fighter) {
      let view = this.views[fighter.slot];
      if (view && view.character === fighter.character) return view;
      if (view) view.sprite.destroy();
      const definition = CHARACTERS[fighter.character];
      const texture = definition.assets.kind === 'atlas-grid'
        ? `fighter-${fighter.character}-atlas`
        : `fighter-${fighter.character}-idle`;
      const sprite = this.add.sprite(fighter.x, fighter.y, texture)
        .setOrigin(definition.render.originX, definition.render.originY)
        .setScale(definition.render.scale)
        .setDepth(10 + fighter.slot);
      view = {
        character: fighter.character,
        sprite,
        targetX: fighter.x,
        targetY: fighter.y,
        renderX: fighter.x,
        renderY: fighter.y,
        stateKey: '',
        facing: fighter.facing,
        flashTimer: null
      };
      this.views[fighter.slot] = view;
      return view;
    }

    visualState(fighter) {
      const definition = CHARACTERS[fighter.character];
      const states = definition.assets.states;
      const firstAvailable = (...candidates) => candidates.find((state) => states[state]) || 'idle';
      if (fighter.state === 'APPEAR') return firstAvailable('appear', 'teleport', 'idle');
      if (fighter.state === 'RUN') return firstAvailable('run', 'idle');
      if (fighter.state === 'JUMP') return firstAvailable('jump', 'fall', 'idle');
      if (fighter.state === 'FALL') return firstAvailable('fall', 'jump', 'idle');
      if (fighter.state === 'LAND') return firstAvailable('land', 'idle');
      if (fighter.state === 'ROLL') return firstAvailable('roll', 'run', 'idle');
      if (fighter.state === 'TELEPORT') return firstAvailable('teleport', 'roll', 'run', 'idle');
      if (fighter.state === 'HURT') return firstAvailable('hurt', 'idle');
      if (fighter.state === 'KO') return firstAvailable('ko', 'hurt', 'idle');
      if (fighter.state === 'ULTIMATE') return firstAvailable('charge', 'teleport', 'special', 'idle');
      if (fighter.state === 'CHARGE') return firstAvailable('charge', 'special', 'idle');
      if (fighter.state === 'SUPPORT') return firstAvailable(fighter.support?.animation, 'charge', 'idle');
      if (fighter.state === 'ATTACK') {
        const moveId = fighter.attack?.moveId || 'light';
        const move = definition.moves[moveId];
        const authoredAnimation = fighter.attack?.data?.animation || move?.animation;
        if (authoredAnimation) return firstAvailable(authoredAnimation, 'light', 'idle');
        if (moveId === 'light') return firstAvailable('light', 'idle');
        if (moveId === 'ability') return firstAvailable('ability', 'throw', 'special', 'light', 'idle');
        return firstAvailable('special', 'teleport', 'light', 'idle');
      }
      if (fighter.state === 'BLOCK') return firstAvailable('block', 'idle');
      return 'idle';
    }

    playVisualState(view, fighter) {
      const state = this.visualState(fighter);
      const key = `anim-${fighter.character}-${state}`;
      if (view.stateKey !== key && this.anims.exists(key)) {
        view.sprite.play(key, true);
        view.stateKey = key;
      }
      const render = CHARACTERS[fighter.character].render;
      // Phaser mirrors texture pixels but keeps a custom origin numeric value.
      // Buck's body is centered around x=40 in a 121px effects frame, so the
      // anchor must also be mirrored or the art jumps while server x stays put.
      const sourceFacing = render.sourceFacing || 1;
      const flipped = fighter.facing !== sourceFacing;
      view.sprite.setOrigin(flipped ? 1 - render.originX : render.originX, render.originY);
      view.sprite.setFlipX(flipped);
      view.sprite.setAlpha(fighter.state === 'TELEPORT' ? (fighter.stateFrame < 8 ? .22 : .65) : fighter.invulnerable ? .72 : 1);
      if (fighter.state === 'BLOCK') view.sprite.setTint(0xd7eef0);
      else if (fighter.state !== 'HURT') view.sprite.clearTint();

      const previousState = this.lastVisualStates[fighter.slot];
      if (previousState !== fighter.state) this.handleStateTransition(fighter, previousState);
      this.lastVisualStates[fighter.slot] = fighter.state;
    }

    handleStateTransition(fighter, previousState) {
      const stateKey = {
        APPEAR: 'appear',
        FALL: 'fall',
        LAND: 'land',
        BLOCK: 'block',
        HURT: 'hurt',
        KO: 'ko'
      }[fighter.state];
      if (!stateKey) return;
      this.spawnCharacterVfx(fighter.character, 'states', stateKey, {
        x: fighter.x,
        y: fighter.y,
        facing: fighter.facing
      });

      const accent = CHARACTER_VFX[fighter.character]?.accent || 0xffd58a;
      const audioRate = characterAudioRate(fighter.character);
      const definition = CHARACTERS[fighter.character];
      const isHeavy = definition.movement.runSpeed < 4.8 || definition.hurtbox.w >= 44;
      const controlled = session.controlledSlots.includes(fighter.slot);
      if (stateKey === 'appear') {
        if (fighter.slot === 0) this.playBattleSfxStack([
          { name: 'appear', volume: .42, rate: audioRate },
          { name: 'mystery', volume: .22, rate: audioRate, delay: 90 }
        ]);
        this.spawnComicWord('PỐP!', fighter.x, fighter.y - 76, accent, fighter.facing * -5);
      } else if (stateKey === 'fall' && controlled) {
        this.playBattleSfx('fall', .12, audioRate);
      } else if (stateKey === 'land' && previousState) {
        this.playBattleSfxStack([
          { name: 'land', volume: isHeavy ? .34 : .22, rate: isHeavy ? audioRate * .9 : audioRate * 1.08 },
          { name: 'pop', volume: .12, rate: isHeavy ? audioRate * .9 : audioRate * 1.15, delay: 24 }
        ]);
        this.spawnComicWord('BỤP!', fighter.x, fighter.y - 30, accent, fighter.facing * 4, .72);
      } else if (stateKey === 'block' && controlled) {
        if (fighter.character === 'iron_sentinel') this.spawnAuthoredVfx('iron_sentinel', 'block', {
          actor: fighter.slot, x: fighter.x, y: fighter.y, facing: fighter.facing
        });
        this.playBattleSfxStack([
          { name: 'blockStart', volume: .22, rate: audioRate },
          { name: 'sparkle', volume: .08, rate: 1.35, delay: 38 }
        ]);
      } else if (stateKey === 'ko' && previousState) {
        this.playBattleSfxStack([
          { name: 'defeated', volume: .52, rate: audioRate },
          { name: 'scratch', volume: .18, rate: 1, delay: 135 }
        ]);
        this.spawnComicWord('ĐO VÁN!', fighter.x, fighter.y - 68, accent, -7, 1.05);
      }
    }

    playBattleSfx(name, volume = 1, rate = 1) {
      if (preferences.volume <= 0) return true;
      const key = `battle-sfx-${name}`;
      if (!this.cache.audio.exists(key)) return false;
      this.sound.play(key, {
        volume: Phaser.Math.Clamp(preferences.volume * volume, 0, 1),
        rate: Phaser.Math.Clamp(rate, .55, 1.65)
      });
      return true;
    }

    playBattleSfxStack(layers) {
      layers.forEach(({ name, volume = 1, rate = 1, delay = 0 }) => {
        const play = () => this.playBattleSfx(name, volume, rate);
        if (delay > 0) this.time.delayedCall(delay, play);
        else play();
      });
    }

    runVfxShowcase() {
      const fighters = this.snapshot?.fighters || [];
      fighters.forEach((fighter, index) => {
        const definition = CHARACTERS[fighter.character];
        const facing = fighter.facing || (index === 0 ? 1 : -1);
        this.spawnCharacterVfx(fighter.character, 'states', 'appear', {
          x: fighter.x,
          y: fighter.y,
          facing
        });
        this.time.delayedCall(260, () => {
          const move = definition.moves.special;
          const centerX = fighter.x + facing * move.hitbox.offsetX;
          const centerY = fighter.y + move.hitbox.offsetY;
          const box = {
            x: centerX - move.hitbox.w / 2,
            y: centerY - move.hitbox.h / 2,
            w: move.hitbox.w,
            h: move.hitbox.h
          };
          this.spawnCharacterVfx(fighter.character, 'moves', 'special', {
            x: centerX,
            y: centerY,
            box,
            facing
          });
        });
        this.time.delayedCall(590, () => {
          const normal = definition.moves.special;
          const authored = definition.moves.chargedSpecial;
          const width = Math.max(authored?.hitbox?.w || 0, Math.ceil(normal.hitbox.w * 2.15));
          const height = Math.max(authored?.hitbox?.h || 0, Math.ceil(normal.hitbox.h * 1.35));
          const offsetX = normal.hitbox.offsetX + (width - normal.hitbox.w) / 2;
          const centerX = fighter.x + facing * offsetX;
          const centerY = fighter.y + (authored?.hitbox?.offsetY ?? normal.hitbox.offsetY);
          const box = { x: centerX - width / 2, y: centerY - height / 2, w: width, h: height };
          const event = {
            character: fighter.character,
            actor: fighter.slot,
            move: 'chargedSpecial',
            box,
            facing
          };
          this.spawnAuthoredMoveVfx(event);
          this.spawnCharacterVfx(fighter.character, 'moves', 'chargedSpecial', { x: centerX, y: centerY, box, facing });
          this.spawnChargedSpecialAccents(event, box);
          this.spawnComicWord('MAX K!', centerX, centerY - height * .72, CHARACTER_VFX[fighter.character]?.accent, facing * -5, .88);
        });
        this.time.delayedCall(1050, () => this.spawnCharacterVfx(fighter.character, 'mobility', 'teleport-warp', {
          x: fighter.x,
          y: fighter.y - 18,
          facing
        }));
        this.spawnComicWord('VFX TEST!', fighter.x, fighter.y - 83, CHARACTER_VFX[fighter.character]?.accent, facing * -5, .78);
      });
      this.playBattleSfxStack([
        { name: 'mystery', volume: .2, rate: 1.05 },
        { name: 'sparkle', volume: .13, rate: 1.2, delay: 260 },
        { name: 'thunder', volume: .3, rate: .76, delay: 590 },
        { name: 'teleport', volume: .24, rate: .96, delay: 1050 }
      ]);
      showToast('Đang trình diễn VFX: xuất hiện → K thường → MAX K → teleport. Hitbox và máu không thay đổi.');
    }

    consumeSnapshot(state) {
      this.snapshot = state;
      if (state.tick === this.appliedTick) return;
      this.appliedTick = state.tick;
      state.fighters.forEach((fighter) => {
        const view = this.ensureView(fighter);
        // Never draw ahead of the authoritative position. At 60 snapshots/s,
        // interpolation is enough and a teleport cannot visually rubber-band.
        view.targetX = fighter.x;
        view.targetY = fighter.y;
        if (Math.abs(view.renderX - fighter.x) > 105 || Math.abs(view.renderY - fighter.y) > 90) {
          view.renderX = fighter.x;
          view.renderY = fighter.y;
        }
        this.playVisualState(view, fighter);
      });
      this.syncProjectiles(state.projectiles || []);
      this.drawGuard(state);
      if (this.debugEnabled) this.drawDebug(state);
    }

    syncProjectiles(projectiles) {
      const active = new Set(projectiles.map((projectile) => projectile.id));
      for (const [id, view] of this.projectileViews.entries()) {
        if (!active.has(id)) {
          view.sprite.destroy();
          this.projectileViews.delete(id);
        }
      }
      projectiles.forEach((projectile) => {
        let view = this.projectileViews.get(projectile.id);
        if (!view) {
          const definition = CHARACTERS[projectile.character];
          const visual = definition.projectileVisual || {};
          const isBuck = projectile.character === 'buck';
          const hasDedicatedProjectile = Boolean(definition.assets.projectile);
          const texture = isBuck
            ? 'fighter-buck-fireball-1'
            : hasDedicatedProjectile
              ? `fighter-${projectile.character}-projectile`
              : `common-vfx-${visual.effect || 'impact'}`;
          const sprite = this.add.sprite(
            projectile.x,
            projectile.y,
            texture
          )
            .setScale(isBuck ? BUCK_FIREBALL_VFX.scale : hasDedicatedProjectile ? 3 : (visual.scale || .35))
            .setFlipX(projectile.facing < 0)
            .setDepth(16);
          const animationKey = isBuck
            ? 'anim-buck-fireball'
            : hasDedicatedProjectile
              ? `anim-${projectile.character}-projectile`
              : `anim-common-vfx-${visual.effect || 'impact'}`;
          if (this.anims.exists(animationKey)) sprite.play({ key: animationKey, repeat: -1 });
          if (visual.tint) sprite.setTint(visual.tint);
          if (isBuck) {
            sprite.setTint(0xffa447);
            this.spawnCommonVfx('orangeRing', projectile.x, projectile.y, { scale: .72, depth: 14 });
          } else if (!hasDedicatedProjectile) {
            this.spawnCommonVfx(themeRing(projectile.character), projectile.x, projectile.y, {
              scale: .56,
              tint: visual.tint,
              depth: 14
            });
          }
          view = {
            sprite,
            character: projectile.character,
            visual,
            facing: projectile.facing,
            x: projectile.x,
            y: projectile.y,
            targetX: projectile.x,
            targetY: projectile.y,
            lastTrailAt: 0,
            trailCount: 0
          };
          this.projectileViews.set(projectile.id, view);
        }
        view.targetX = projectile.x;
        view.targetY = projectile.y;
        const trailInterval = view.character === 'buck' ? 70 : 82;
        if (this.time.now - view.lastTrailAt >= trailInterval) {
          view.lastTrailAt = this.time.now;
          view.trailCount += 1;
          if (view.character === 'buck') {
            this.spawnCommonVfx('orangeSparkle', projectile.x - projectile.facing * 25, projectile.y, {
              scale: .36,
              alpha: .8,
              depth: 13
            });
            if (view.trailCount % 2 === 0) {
              this.spawnCommonVfx('orangePuff', projectile.x - projectile.facing * 31, projectile.y + 2, {
                scale: .28,
                alpha: .55,
                depth: 12
              });
            }
          } else {
            this.spawnCommonVfx(view.visual?.trail || themeSparkle(view.character), projectile.x - projectile.facing * 12, projectile.y, {
              scale: .28,
              alpha: .72,
              tint: view.visual?.tint,
              depth: 13
            });
          }
        }
      });
    }

    drawGuard(state) {
      this.guardGraphics.clear();
      state.fighters.forEach((fighter) => {
        if (fighter.state !== 'BLOCK') return;
        const side = fighter.facing;
        const x = fighter.x + side * 29;
        this.guardGraphics.lineStyle(3, 0xeaf8f6, .85);
        this.guardGraphics.beginPath();
        this.guardGraphics.arc(x, fighter.y - 38, 31, side > 0 ? -1.25 : 1.9, side > 0 ? 1.25 : 4.4, false);
        this.guardGraphics.strokePath();
      });
    }

    drawDebug(state) {
      this.debugGraphics.clear();
      this.debugGraphics.lineStyle(1, 0x293b52, .7).lineBetween(0, WORLD.groundY, WORLD.width, WORLD.groundY);
      (MAPS[state.mapId]?.platforms || []).forEach((platform) => {
        this.debugGraphics.lineStyle(2, 0x55a86d, .95).strokeRect(
          platform.x - platform.w / 2,
          platform.y,
          platform.w,
          platform.h
        );
      });
      state.fighters.forEach((fighter) => {
        const hurt = fighter.hurtbox;
        this.debugGraphics.lineStyle(2, 0xd34d45, .95).strokeRect(
          fighter.x + hurt.offsetX - hurt.w / 2,
          fighter.y + hurt.offsetY - hurt.h / 2,
          hurt.w,
          hurt.h
        );
        this.debugGraphics.fillStyle(0x293b52, 1).fillRect(fighter.x - 2, fighter.y - 2, 4, 4);
        if (fighter.attack) {
          const move = fighter.attack.data;
          const centerX = fighter.x + fighter.facing * move.hitbox.offsetX;
          const color = fighter.attack.phase === 'active' ? 0xf0bd3e : 0x6a88a1;
          this.debugGraphics.lineStyle(2, color, .95).strokeRect(
            centerX - move.hitbox.w / 2,
            fighter.y + move.hitbox.offsetY - move.hitbox.h / 2,
            move.hitbox.w,
            move.hitbox.h
          );
        }
      });
      state.projectiles.forEach((projectile) => {
        const width = projectile.w || 20;
        const height = projectile.h || 16;
        this.debugGraphics
          .lineStyle(2, CHARACTER_VFX[projectile.character]?.accent || 0xffd58a, .95)
          .strokeRect(projectile.x - width / 2, projectile.y - height / 2, width, height);
      });
      if (state.ultimate?.phase === 'aftermath') {
        this.debugGraphics
          .lineStyle(4, CHARACTER_VFX[state.ultimate.character]?.accent || 0xf0a03e, .9)
          .strokeRect(WORLD.minX, 0, WORLD.maxX - WORLD.minX, WORLD.height);
      }
    }

    setDebug(enabled) {
      this.debugEnabled = enabled;
      if (!enabled) this.debugGraphics.clear();
      else if (this.snapshot) this.drawDebug(this.snapshot);
    }

    handleCombatEvent(event) {
      if (event.kind === 'ultimate-energy') {
        const effect = themeRing(event.character);
        const sparkle = themeSparkle(event.character);
        this.spawnCommonVfx(effect, event.x, event.y - 35, { scale: event.ready ? 1.28 : .72, depth: 28 });
        this.time.delayedCall(32, () => this.spawnCommonVfx(sparkle, event.x, event.y - 48, event.ready ? .96 : .54));
        this.spawnComicWord(
          event.ready ? 'U SẴN SÀNG!' : `ẤN ${event.energy}/${event.maxEnergy}`,
          event.x,
          event.y - 73,
          CHARACTER_VFX[event.character]?.accent,
          event.facing * -4,
          event.ready ? .88 : .6
        );
        if (event.ready) {
          this.playBattleSfxStack([
            { name: 'ultimateReady', volume: .52, rate: characterAudioRate(event.character) },
            { name: 'sparkle', volume: .16, rate: 1.18, delay: 90 }
          ]);
          if (session.controlledSlots.includes(event.actor)) showToast('Ultimate đã đầy — nhấn U để tung chiêu.');
        } else {
          this.playBattleSfx('pop', .1, 1.18 + event.energy * .08);
        }
        return;
      }
      if (event.kind === 'ultimate-start') {
        this.startUltimateCinematic(event);
        return;
      }
      if (event.kind === 'ultimate-release') {
        this.releaseUltimateCinematic(event);
        return;
      }
      if (event.kind === 'ultimate-end') {
        this.endUltimateCinematic(event);
        return;
      }
      if (event.kind === 'jump') {
        this.spawnCharacterVfx(event.character, 'states', event.double ? 'doubleJump' : 'jump', {
          x: event.x,
          y: event.y,
          facing: event.facing
        });
        if (session.controlledSlots.includes(event.actor)) {
          const audioRate = characterAudioRate(event.character);
          if (!this.playBattleSfx('jump', event.double ? .5 : .42, audioRate)) playTone(280, .05, 'square', .35);
          this.playBattleSfxStack([{
            name: 'twang',
            volume: event.double ? .18 : .13,
            rate: event.double ? Math.min(1.5, audioRate * 1.25) : audioRate,
            delay: 32
          }]);
        }
        if (event.double) this.spawnComicWord('NHẢY ×2!', event.x, event.y - 58, CHARACTER_VFX[event.character]?.accent, event.facing * -5, .7);
        return;
      }
      if (event.kind === 'support-start') {
        const accent = CHARACTER_VFX[event.character]?.accent || 0xbfe3cc;
        this.spawnCommonVfx(themeRing(event.character), event.x, event.y - 37, { scale: 1.08, tint: accent, depth: 25 });
        this.spawnCommonVfx('charge', event.x, event.y - 39, { scale: .72, tint: accent, depth: 22 });
        this.spawnComicWord(event.label?.toUpperCase() || 'HỒI PHỤC!', event.x, event.y - 82, accent, -4, .7);
        this.playBattleSfxStack([
          { name: event.character === 'soul_knight' ? 'prayer' : 'potion', volume: .52, rate: characterAudioRate(event.character) },
          { name: 'sparkle', volume: .12, rate: .9, delay: 120 }
        ]);
        if (session.controlledSlots.includes(event.actor)) showToast(`${event.label}: còn ${event.remaining} lần hồi phục.`);
        return;
      }
      if (event.kind === 'support-heal') {
        const accent = CHARACTER_VFX[event.character]?.accent || 0xbfe3cc;
        this.spawnCommonVfx('constellation', event.x, event.y - 41, { scale: 1.05, tint: accent, depth: 28 });
        this.spawnCommonVfx(themeSparkle(event.character), event.x, event.y - 56, { scale: 1.2, tint: accent, depth: 29 });
        this.spawnComicWord(`+${event.amount} HP`, event.x, event.y - 92, 0x9ce6a8, 3, .82);
        this.playBattleSfxStack([
          { name: 'heal', volume: .58, rate: characterAudioRate(event.character) },
          { name: 'sparkle', volume: .18, rate: 1.24, delay: 70 }
        ]);
        return;
      }
      if (event.kind === 'support-empty') {
        if (session.controlledSlots.includes(event.actor)) showToast('Kỹ năng hồi phục O đã hết lượt dùng.');
        this.playBattleSfx('disallow', .22, .9);
        return;
      }
      if (event.kind === 'self-buff') {
        this.spawnCommonVfx(event.character === 'dark_ninja' ? 'midnight' : 'constellation', event.x, event.y - 35, {
          scale: 1.05, tint: CHARACTER_VFX[event.character]?.accent, depth: 27
        });
        this.spawnCommonVfx(themeRing(event.character), event.x, event.y - 34, { scale: 1.25, depth: 26 });
        this.playBattleSfx(event.character === 'dark_ninja' ? 'ghost' : 'scan', .48, characterAudioRate(event.character));
        return;
      }
      if (event.kind === 'combo-chain') {
        this.spawnCommonVfx(themeSparkle(event.character), event.x + event.facing * 18, event.y - 40, { scale: .42, depth: 24 });
        this.playBattleSfx('combo', .12, Math.min(1.55, 1.1 + (event.comboStep || 0) * .08));
        return;
      }
      if (event.kind === 'attack-active') {
        this.spawnMoveVfx(event);
        const activeX = event.box.x + event.box.w / 2;
        const activeY = event.box.y + event.box.h / 2;
        const audio = CHARACTER_AUDIO[event.character] || CHARACTER_AUDIO.buck;
        const sound = audio[event.move] || audio.special;
        if (!this.playBattleSfx(sound, event.move === 'light' ? .62 : .78, audio.rate)) playTone(event.move === 'light' ? 210 : 145, .055, 'sawtooth', .45);
        if (event.move === 'chargedSpecial') {
          this.playBattleSfxStack([
            { name: 'thunder', volume: .48, rate: .78, delay: 55 },
            { name: 'sparkle', volume: .12, rate: .82, delay: 115 }
          ]);
          this.spawnComicWord('MAX!', activeX, activeY - 74, 0xf1a64a, event.facing * -6, .95);
        } else if (event.move === 'special') {
          this.playBattleSfxStack([{ name: 'sparkle', volume: .11, rate: Math.min(1.55, audio.rate * 1.12), delay: 62 }]);
          this.spawnComicWord(CHARACTERS[event.character].moves.special.dashSpeed ? 'XOẸT!' : 'ÙM!', activeX, activeY - 54, CHARACTER_VFX[event.character]?.accent, event.facing * 5, .76);
        } else if (['ability', 'airAbility'].includes(event.move)) {
          this.playBattleSfxStack([
            { name: 'twang', volume: .13, rate: Math.min(1.55, audio.rate * 1.12), delay: 35 },
            { name: 'sparkle', volume: .08, rate: Math.min(1.6, audio.rate * 1.2), delay: 64 }
          ]);
          this.spawnComicWord('PHÓNG!', activeX, activeY - 48, CHARACTER_VFX[event.character]?.accent, event.facing * -5, .7);
        } else if (event.move === 'extra') {
          this.playBattleSfxStack([
            { name: 'charge', volume: .2, rate: audio.rate, delay: 35 },
            { name: 'sparkle', volume: .12, rate: Math.min(1.5, audio.rate * 1.14), delay: 82 }
          ]);
          this.spawnComicWord('TUYET KY!', activeX, activeY - 55, CHARACTER_VFX[event.character]?.accent, event.facing * -5, .76);
        }
        return;
      }
      if (event.kind === 'charge') {
        this.spawnChargeVfx(event);
        this.playBattleSfxStack([
          { name: 'charge', volume: .6, rate: .92 },
          { name: 'mystery', volume: .14, rate: .76, delay: 90 }
        ]);
        if (session.controlledSlots.includes(event.actor)) showToast('Giữ K để tăng sức mạnh, thả K để bắn.');
        return;
      }
      if (event.kind === 'mobility') {
        this.spawnMobilityVfx(event);
        const mobilitySound = event.mobility.includes('teleport') ? 'teleport' : 'roll';
        const mobilityRate = characterAudioRate(event.character);
        if (!this.playBattleSfx(mobilitySound, event.mobility.includes('teleport') ? .6 : .48, mobilityRate)) {
          playTone(event.mobility.includes('teleport') ? 330 : 250, .06, 'triangle', .4);
        }
        if (event.mobility === 'roll') {
          this.playBattleSfxStack([{ name: 'pop', volume: .1, rate: Math.min(1.55, mobilityRate * 1.15), delay: 48 }]);
          this.spawnComicWord('VỤT!', event.x, event.y - 49, CHARACTER_VFX[event.character]?.accent, event.facing * -7, .7);
        } else if (event.mobility === 'teleport-start') {
          this.playBattleSfxStack([{ name: 'mystery', volume: .13, rate: mobilityRate, delay: 42 }]);
          this.spawnComicWord('BIẾN!', event.x, event.y - 65, CHARACTER_VFX[event.character]?.accent, event.facing * 6, .72);
        }
        return;
      }
      if (event.kind === 'cancel') {
        this.spawnImpact(event.x + event.facing * 18, event.y - 30, 0xffe4a5, .52);
        this.spawnCommonVfx(themeSparkle(event.character), event.x + event.facing * 18, event.y - 30, .62);
        this.playBattleSfx('cancel', .14, 1.2);
        this.spawnComicWord('NỐI!', event.x, event.y - 62, CHARACTER_VFX[event.character]?.accent, event.facing * 5, .62);
        playTone(390, .035, 'triangle', .28);
        return;
      }
      if (event.kind === 'evade') {
        this.spawnImpact(event.x, event.y, 0x9ad8df, .8);
        this.spawnCommonVfx(themeRing(event.character), event.x, event.y - 30, .82);
        this.spawnComicWord('NÉ!', event.x, event.y - 62, CHARACTER_VFX[event.character]?.accent, event.facing * -5, .66);
        return;
      }
      if (event.kind === 'hit') {
        this.startVisualHitstop(event.hitstopMs || 100);
        this.flashFighter(event.target, event.blocked);
        this.spawnCharacterHitVfx(event);
        this.spawnImpact(event.x, event.y, event.blocked ? 0xd7eef0 : 0xfff1b8, event.move === 'ultimate' ? 2.1 : event.move === 'chargedSpecial' ? 1.5 : .8);
        if (event.blocked) {
          this.playBattleSfxStack([
            { name: 'guard', volume: .72 },
            { name: 'sparkle', volume: .1, rate: 1.45, delay: 30 }
          ]);
        }
        else {
          const ultimateHit = event.move === 'ultimate';
          this.playBattleSfx('hit', ultimateHit ? 1 : event.move === 'chargedSpecial' ? .95 : .72, ultimateHit ? .68 : event.move === 'chargedSpecial' ? .82 : 1);
          this.playBattleSfx('hurt', ultimateHit ? .58 : .42, ultimateHit ? .82 : .95);
          this.playBattleSfx(ultimateHit || event.move === 'chargedSpecial' ? 'thunder' : 'pop', ultimateHit ? .7 : event.move === 'chargedSpecial' ? .52 : .11, ultimateHit ? .62 : event.move === 'chargedSpecial' ? .74 : 1.22);
        }
        this.spawnComicWord(
          event.blocked ? 'KENG!' : event.move === 'ultimate' ? (ULTIMATE_ART[event.character]?.hitWord || 'DIỆT!') : event.move === 'chargedSpecial' ? 'ĐOÀNG!' : event.move === 'ability' ? 'BÙM!' : event.move === 'special' ? 'ẦM!' : 'BỐP!',
          event.x,
          event.y - 28,
          event.blocked ? 0xc8edf0 : CHARACTER_VFX[event.character]?.accent,
          event.facing * -6,
          event.move === 'ultimate' ? 1.32 : event.move === 'chargedSpecial' ? 1.05 : .78
        );
        if (preferences.cameraShake && ['special', 'chargedSpecial', 'ultimate', 'ability', 'airAbility', 'extra'].includes(event.move)) {
          const projectile = ['ability', 'airAbility'].includes(event.move);
          const ultimateHit = event.move === 'ultimate';
          this.cameras.main.shake(ultimateHit ? 360 : event.move === 'chargedSpecial' ? 210 : projectile ? 105 : 130, ultimateHit ? .024 : event.move === 'chargedSpecial' ? .014 : projectile ? .006 : .008);
        }
      }
    }

    startUltimateCinematic(event) {
      this.ultimateCinematic = {
        actor: event.actor,
        target: event.target,
        character: event.character,
        phase: 'intro'
      };
      const definition = CHARACTERS[event.character];
      ui.ultimateCinematic.dataset.character = event.character;
      ui.ultimateCinematic.dataset.slot = String(event.actor);
      ui.ultimateCinematic.classList.remove('is-release');
      ui.ultimateFighterName.textContent = definition.name.toUpperCase();
      ui.ultimateMoveName.textContent = event.name.toUpperCase();
      ui.ultimateCinematic.hidden = false;

      const actorView = this.views[event.actor];
      if (actorView) actorView.sprite.setDepth(110);
      const camera = this.cameras.main;
      const profile = ULTIMATE_ART[event.character] || ULTIMATE_ART.buck;
      const accentCss = `#${profile.accent.toString(16).padStart(6, '0')}`;
      ui.ultimateCinematic.style.setProperty('--ultimate-accent', accentCss);
      const duration = preferences.reduceMotion ? 0 : 480;
      camera.pan(event.x, event.y - 48, duration, 'Cubic.easeInOut', true);
      camera.zoomTo(profile.zoom, duration, 'Cubic.easeOut', true);

      this.spawnCommonVfx(profile.intro, event.x, event.y - 36, { scale: 1.28, tint: profile.accent, depth: 104 });
      this.spawnCommonVfx(profile.aura, event.x, event.y - 36, { scale: 1.22, tint: profile.accent, depth: 103 });
      this.time.delayedCall(100, () => this.spawnCommonVfx(profile.ring, event.x, event.y - 35, {
        scale: 1.65,
        tint: profile.accent,
        depth: 105
      }));
      this.time.delayedCall(175, () => this.spawnCommonVfx(themeSparkle(event.character), event.x - event.facing * 28, event.y - 58, {
        scale: 1.18,
        tint: profile.accent,
        depth: 106
      }));
      this.time.delayedCall(260, () => this.spawnCommonVfx(profile.aura, event.x + event.facing * 24, event.y - 40, {
        scale: 1.58,
        tint: profile.accent,
        depth: 102
      }));
      if (profile.afterimages) this.spawnAfterimages(event, profile.afterimages);
      this.playBattleSfxStack([
        { name: profile.introSound, volume: .62, rate: profile.introRate },
        { name: event.character === 'iron_sentinel' ? 'guard' : 'charge', volume: .38, rate: profile.introRate, delay: 90 },
        { name: event.character === 'dark_ninja' ? 'teleport' : 'mystery', volume: .2, rate: profile.introRate, delay: 280 }
      ]);
    }

    releaseUltimateCinematic(event) {
      if (!this.ultimateCinematic) {
        this.ultimateCinematic = { actor: event.actor, target: event.target, character: event.character };
      }
      this.ultimateCinematic.phase = 'release';
      ui.ultimateCinematic.classList.add('is-release');
      const actorView = this.views[event.actor];
      if (actorView) actorView.sprite.setDepth(10 + event.actor);

      const camera = this.cameras.main;
      const duration = preferences.reduceMotion ? 0 : 360;
      camera.pan(WORLD.width / 2, WORLD.groundY - 170, duration, 'Cubic.easeOut', true);
      camera.zoomTo(WORLD.cameraMinZoom, duration, 'Cubic.easeOut', true);

      if (event.character === 'buck') this.spawnBuckUltimate(event);
      else if (event.character === 'rogue') this.spawnRogueUltimate(event);
      else this.spawnRosterUltimate(event);
      this.spawnUltimateEncore(event);
    }

    spawnBuckUltimate(event) {
      const strikeXs = [170, 430, 690, 950, 1200, 1450, 1710, 1970, 2230];
      this.spawnCommonVfx('magma', WORLD.width / 2, WORLD.groundY - 94, {
        width: WORLD.width * .92,
        height: 280,
        depth: 26,
        tint: 0xffb04f
      });
      this.spawnCommonVfx('fireSpin', event.targetX, event.targetY - 54, { scale: 2.75, depth: 31 });
      this.spawnCommonVfx('explosion', event.targetX, event.targetY - 46, { scale: 1.55, tint: 0xffbd61, depth: 33 });
      strikeXs.forEach((x, index) => {
        this.time.delayedCall(index * 58, () => {
          this.spawnCommonVfx('sunburn', x, WORLD.groundY - 66, { scale: 2.15, depth: 29 });
          this.spawnCommonVfx('thunderStrike', x, WORLD.groundY - 94, {
            scale: index === 2 ? 2.1 : 1.55,
            tint: 0xffcf71,
            depth: 30
          });
        });
      });
      this.time.delayedCall(170, () => this.spawnCommonVfx('powerChords', event.targetX, event.targetY - 68, {
        scale: 1.38,
        tint: 0xffc763,
        depth: 32
      }));
      this.spawnComicWord('THIÊN HỎA!', event.targetX, event.targetY - 150, 0xf1a64a, -4, 1.25);
      this.playBattleSfxStack([
        { name: 'ultimateBuck', volume: .92, rate: .72 },
        { name: 'thunder', volume: .72, rate: .62, delay: 90 },
        { name: 'ultimateBuck', volume: .62, rate: .9, delay: 210 },
        { name: 'scratch', volume: .14, rate: .82, delay: 320 }
      ]);
      if (preferences.cameraShake) this.cameras.main.shake(520, .026);
    }

    spawnRogueUltimate(event) {
      const bladeXs = [170, 400, 630, 860, 1090, 1320, 1550, 1780, 2010, 2240];
      this.spawnCommonVfx('hyperspeed', WORLD.width / 2, WORLD.groundY - 120, {
        width: WORLD.width * .96,
        height: 330,
        flipX: event.facing < 0,
        tint: 0x9e80cc,
        depth: 24
      });
      this.spawnCommonVfx('midnight', event.targetX, event.targetY - 58, { scale: 2.8, depth: 29 });
      this.spawnCommonVfx('vortex', event.targetX, event.targetY - 56, {
        scale: 1.65,
        tint: 0x9e80cc,
        depth: 28
      });
      bladeXs.forEach((x, index) => {
        this.time.delayedCall(index * 48, () => {
          this.spawnCommonVfx('phantomBlade', x, WORLD.groundY - 70 - (index % 2) * 58, {
            scale: index === 2 || index === 3 ? 1.9 : 1.45,
            angle: index % 2 ? -18 : 18,
            tint: 0xd7c7f1,
            depth: 31
          });
          if (index % 2 === 0) this.spawnCommonVfx('nebula', x + 90, WORLD.groundY - 95, { scale: 1.28, depth: 27 });
        });
      });
      const slashes = this.add.graphics().setDepth(30);
      slashes.lineStyle(9, 0xeee6fb, .9);
      slashes.lineBetween(120, WORLD.groundY - 260, WORLD.width - 120, WORLD.groundY - 22);
      slashes.lineStyle(5, 0x9c82c8, .84);
      slashes.lineBetween(140, WORLD.groundY - 30, WORLD.width - 160, WORLD.groundY - 245);
      slashes.lineStyle(3, 0xffffff, .72);
      slashes.lineBetween(430, WORLD.groundY - 290, WORLD.width - 360, WORLD.groundY - 10);
      this.tweens.add({
        targets: slashes,
        alpha: 0,
        duration: 520,
        delay: 120,
        ease: 'Quad.easeIn',
        onComplete: () => slashes.destroy()
      });
      this.spawnAfterimages(event, 7);
      this.spawnComicWord('VẠN NHẪN!', event.targetX, event.targetY - 150, 0xb99de2, 4, 1.2);
      this.playBattleSfxStack([
        { name: 'ultimateRogue', volume: .78, rate: .72 },
        { name: 'rogueSpecial', volume: .76, rate: .78, delay: 75 },
        { name: 'rogueLight', volume: .68, rate: .88, delay: 160 },
        { name: 'ultimateRogue', volume: .6, rate: 1.12, delay: 245 }
      ]);
      if (preferences.cameraShake) this.cameras.main.shake(420, .017);
    }

    spawnRosterUltimate(event) {
      const profile = ULTIMATE_ART[event.character] || ULTIMATE_ART.soul_knight;
      const centerX = (WORLD.minX + WORLD.maxX) / 2;
      const floorY = WORLD.groundY;
      const laneXs = Array.from({ length: 11 }, (_, index) => 150 + index * ((WORLD.width - 300) / 10));
      const burst = (effect, x, y, index, options = {}) => {
        this.time.delayedCall(index * (options.step || 52), () => this.spawnCommonVfx(effect, x, y, {
          scale: options.scale || 1.35,
          tint: options.tint || profile.accent,
          angle: options.angle || 0,
          flipX: Boolean(options.flip && index % 2),
          depth: options.depth || 31
        }));
      };

      if (profile.pattern === 'abyssal-oath') {
        this.spawnCommonVfx('midnight', centerX, floorY - 160, { width: WORLD.width * .95, height: 390, tint: 0x526a78, depth: 23 });
        laneXs.forEach((x, index) => burst('phantomBlade', x, floorY - 205 - (index % 2) * 85, index, {
          scale: index === 3 ? 2.55 : 1.8, angle: index % 2 ? 90 : -90, step: 62
        }));
        this.time.delayedCall(190, () => this.spawnCommonVfx('constellation', event.targetX, event.targetY - 60, { scale: 2.2, tint: profile.accent, depth: 33 }));
      } else if (profile.pattern === 'dragon-inferno') {
        this.spawnCommonVfx('magma', centerX, floorY - 105, { width: WORLD.width * .96, height: 300, tint: 0xff6a2f, depth: 24 });
        laneXs.forEach((x, index) => burst(index % 2 ? 'fireSpin' : 'sunburn', x, floorY - 78, index, {
          scale: index === 3 ? 3.1 : 2.15, step: 48
        }));
        this.time.delayedCall(150, () => this.spawnCommonVfx('explosion', event.targetX, event.targetY - 58, { scale: 2.4, tint: 0xffa044, depth: 35 }));
      } else if (profile.pattern === 'citadel-breaker') {
        laneXs.forEach((x, index) => burst('thunderStrike', x, floorY - 105, index, {
          scale: index === 3 ? 2.6 : 1.9, step: 70
        }));
        this.spawnCommonVfx('powerChords', event.targetX, event.targetY - 48, { scale: 2.6, tint: profile.accent, depth: 34 });
        const quake = this.add.graphics().setDepth(32);
        quake.lineStyle(12, profile.accent, .92);
        quake.beginPath();
        quake.moveTo(WORLD.minX, floorY - 12);
        laneXs.forEach((x, index) => quake.lineTo(x, floorY - 12 - (index % 2 ? 45 : 3)));
        quake.lineTo(WORLD.maxX, floorY - 12);
        quake.strokePath();
        this.tweens.add({ targets: quake, alpha: 0, y: -18, duration: 620, onComplete: () => quake.destroy() });
      } else if (profile.pattern === 'eclipse') {
        this.spawnCommonVfx('midnight', centerX, floorY - 180, { width: WORLD.width, height: 460, tint: 0x5f237a, depth: 24 });
        this.spawnCommonVfx('vortex', event.targetX, event.targetY - 70, { scale: 3.2, tint: profile.accent, depth: 28 });
        laneXs.forEach((x, index) => burst('phantomBlade', x, floorY - 75 - (index % 3) * 82, index, {
          scale: 1.75, angle: index % 2 ? -28 : 28, step: 38
        }));
        this.spawnAfterimages(event, 9);
      } else if (profile.pattern === 'arcane-dominion') {
        laneXs.forEach((x, index) => burst(index % 2 ? 'nebula' : 'vortex', x, floorY - 95 - (index % 3) * 90, index, {
          scale: index === 3 ? 2.35 : 1.55, step: 56
        }));
        this.spawnCommonVfx('powerChords', centerX, floorY - 150, { width: WORLD.width * .88, height: 330, tint: profile.accent, depth: 30 });
        this.time.delayedCall(210, () => this.spawnCommonVfx('explosion', event.targetX, event.targetY - 58, { scale: 1.85, tint: profile.accent, depth: 35 }));
      } else if (profile.pattern === 'cretaceous-hunt') {
        this.spawnCommonVfx('hyperspeed', centerX, floorY - 105, { width: WORLD.width, height: 270, tint: profile.accent, flipX: event.facing < 0, depth: 25 });
        laneXs.forEach((x, index) => burst(index % 2 ? 'bigHit' : 'powerChords', x, floorY - 45 - (index % 2) * 42, index, {
          scale: index === 3 ? 1.9 : 1.25, angle: index % 2 ? -18 : 18, step: 44
        }));
        const claws = this.add.graphics().setDepth(33);
        [0, 28, 56].forEach((offset) => {
          claws.lineStyle(7, 0xdff6d9, .85 - offset / 140);
          claws.lineBetween(90, floorY - 230 + offset, WORLD.maxX - 80, floorY - 55 + offset);
        });
        this.tweens.add({ targets: claws, alpha: 0, duration: 480, delay: 100, onComplete: () => claws.destroy() });
      } else if (profile.pattern === 'panel-breaker') {
        const panel = this.add.graphics().setDepth(32);
        panel.fillStyle(0xffffff, .86).fillRect(WORLD.minX, floorY - 390, WORLD.maxX - WORLD.minX, 370);
        panel.lineStyle(14, 0x18202b, .95).strokeRect(WORLD.minX + 35, floorY - 355, WORLD.maxX - WORLD.minX - 70, 305);
        for (let index = 0; index < 11; index += 1) {
          panel.lineStyle(4 + (index % 3), 0x18202b, .82);
          panel.lineBetween(centerX, floorY - 180, 100 + index * 218, floorY - 350 + (index % 2) * 300);
        }
        this.tweens.add({ targets: panel, alpha: 0, duration: 560, delay: 130, onComplete: () => panel.destroy() });
        laneXs.filter((_, index) => index % 2 === 0).forEach((x, index) => burst('impact', x, floorY - 95 - index * 22, index, { scale: 1.55, tint: 0xffffff, step: 62, depth: 34 }));
      } else if (profile.pattern === 'event-horizon') {
        this.spawnCommonVfx('vortex', centerX, floorY - 170, { scale: 4.1, tint: 0x3bd8e5, depth: 25 });
        this.spawnCommonVfx('hyperspeed', centerX, floorY - 130, { width: WORLD.width, height: 330, tint: profile.accent, flipX: event.facing < 0, depth: 27 });
        laneXs.forEach((x, index) => burst('thunderStrike', x, floorY - 115, index, { scale: 1.55, step: 46 }));
        const saber = this.add.graphics().setDepth(35);
        saber.lineStyle(22, 0x57eaf3, .66).lineBetween(WORLD.minX, floorY - 250, WORLD.maxX, floorY - 35);
        saber.lineStyle(7, 0xffffff, .96).lineBetween(WORLD.minX, floorY - 250, WORLD.maxX, floorY - 35);
        this.tweens.add({ targets: saber, alpha: 0, duration: 520, delay: 80, onComplete: () => saber.destroy() });
      }

      this.spawnCommonVfx(profile.hitPrimary, event.targetX, event.targetY - 54, { scale: 1.7, tint: profile.accent, depth: 36 });
      this.time.delayedCall(55, () => this.spawnCommonVfx(profile.hitSecondary, event.targetX, event.targetY - 58, { scale: 2.05, tint: profile.accent, depth: 37 }));
      this.spawnComicWord(profile.word, event.targetX, event.targetY - 155, profile.accent, event.facing * -4, 1.22);
      this.playBattleSfxStack([
        { name: profile.releaseSound, volume: .9, rate: profile.releaseRate },
        { name: 'thunder', volume: .58, rate: Math.max(.58, profile.releaseRate * .88), delay: 95 },
        { name: profile.releaseSound, volume: .48, rate: Math.min(1.45, profile.releaseRate * 1.22), delay: 215 },
        { name: 'scratch', volume: .1, rate: 1, delay: 325 }
      ]);
      if (preferences.cameraShake) this.cameras.main.shake(480, event.character === 'iron_sentinel' ? .026 : .02);
    }

    spawnUltimateEncore(event) {
      const profile = ULTIMATE_ART[event.character] || ULTIMATE_ART.buck;
      const centerX = (WORLD.minX + WORLD.maxX) / 2;
      const floorY = WORLD.groundY;
      const targetX = event.targetX;
      const targetY = event.targetY;

      this.spawnCommonVfx(profile.ring, event.x, event.y - 36, {
        scale: 2.05, tint: profile.accent, depth: 38
      });
      this.spawnCommonVfx(profile.aura, targetX, targetY - 58, {
        scale: 2.35, tint: profile.accent, depth: 34
      });
      this.time.delayedCall(90, () => this.spawnCommonVfx(profile.hitPrimary, targetX, targetY - 54, {
        scale: 2.45, tint: profile.accent, depth: 39
      }));
      this.time.delayedCall(180, () => this.spawnCommonVfx(profile.hitSecondary, targetX, targetY - 62, {
        scale: 2.75, tint: profile.accent, depth: 40
      }));

      [260, 620, 980, 1420, 1780, 2140].forEach((x, index) => {
        this.time.delayedCall(35 + index * 44, () => {
          this.spawnCommonVfx(index % 2 ? profile.ring : themeSparkle(event.character), x, floorY - 68 - (index % 3) * 55, {
            scale: index % 2 ? 1.22 : .96,
            tint: profile.accent,
            depth: 36
          });
        });
      });

      const rays = this.add.graphics().setDepth(37);
      [-120, -55, 0, 55, 120].forEach((spread, index) => {
        rays.lineStyle(index === 2 ? 9 : 4, profile.accent, index === 2 ? .88 : .5);
        rays.lineBetween(event.x, event.y - 50, targetX + spread, targetY - 55 - Math.abs(spread) * .25);
      });
      this.tweens.add({
        targets: rays,
        alpha: 0,
        duration: 520,
        delay: 100,
        ease: 'Quad.easeIn',
        onComplete: () => rays.destroy()
      });

      if (event.character === 'dragon_knight') {
        this.spawnAuthoredVfx('dragon_knight', 'explosion', { x: targetX, y: targetY - 48, facing: event.facing, depth: 41 });
        this.time.delayedCall(125, () => this.spawnAuthoredVfx('dragon_knight', 'breath', {
          actor: event.actor, x: event.x, y: event.y, facing: event.facing, depth: 39
        }));
      } else if (event.character === 'iron_sentinel') {
        ['attackA', 'attackB', 'attackC'].forEach((name, index) => this.time.delayedCall(index * 70, () => {
          this.spawnAuthoredVfx('iron_sentinel', name, { actor: event.actor, facing: event.facing, depth: 39 + index });
        }));
      } else if (event.character === 'purple_battlemage') {
        const targetBox = { x: targetX - 110, y: targetY - 125, w: 220, h: 100 };
        this.spawnAuthoredVfx('purple_battlemage', 'sustain', { box: targetBox, facing: event.facing, depth: 39 });
        this.time.delayedCall(110, () => this.spawnAuthoredVfx('purple_battlemage', 'fast', {
          box: targetBox, facing: event.facing, depth: 41
        }));
      }

      this.spawnCommonVfx(profile.aura, centerX, floorY - 150, {
        width: WORLD.width * .82,
        height: 270,
        tint: profile.accent,
        alpha: .42,
        depth: 22
      });
    }

    endUltimateCinematic(event) {
      const actorView = this.views[event.actor];
      if (actorView) actorView.sprite.setDepth(10 + event.actor);
      ui.ultimateCinematic.hidden = true;
      ui.ultimateCinematic.classList.remove('is-release');
      delete ui.ultimateCinematic.dataset.character;
      delete ui.ultimateCinematic.dataset.slot;
      ui.ultimateCinematic.style.removeProperty('--ultimate-accent');
      this.cameraZoom = this.cameras.main.zoom;
      this.ultimateCinematic = null;
      this.playBattleSfx('ultimateEnd', .2, characterAudioRate(event.character));
    }

    startVisualHitstop(duration) {
      const until = performance.now() + duration;
      this.visualHitstopUntil = Math.max(this.visualHitstopUntil, until);
      this.views.forEach((view) => view?.sprite.anims.pause());
      this.time.delayedCall(duration, () => {
        if (performance.now() + 2 >= this.visualHitstopUntil) this.views.forEach((view) => view?.sprite.anims.resume());
      });
    }

    flashFighter(slot, blocked) {
      const view = this.views[slot];
      if (!view) return;
      if (view.flashTimer) view.flashTimer.remove(false);
      view.sprite.setTintFill(blocked ? 0xd7eef0 : 0xffffff);
      view.flashTimer = this.time.delayedCall(85, () => {
        if (this.snapshot?.fighters?.[slot]?.state === 'HURT') view.sprite.setTint(0xf39b86);
        else view.sprite.clearTint();
      });
    }

    spawnImpact(x, y, tint = 0xffffff, scale = 1) {
      const fx = this.add.sprite(x, y, 'fx-impact').setTint(tint).setScale(.4 * scale).setDepth(25);
      this.tweens.add({
        targets: fx,
        scale: 1.35 * scale,
        angle: 35,
        alpha: 0,
        duration: 190,
        ease: 'Quad.easeOut',
        onComplete: () => fx.destroy()
      });
    }

    spawnComicWord(text, x, y, color = 0xffd58a, angle = -5, scale = .8) {
      const label = this.add.text(x, y, text, {
        fontFamily: 'Bungee, Impact, sans-serif',
        fontSize: '18px',
        color: `#${Number(color || 0xffd58a).toString(16).padStart(6, '0')}`,
        stroke: '#293b52',
        strokeThickness: 4,
        align: 'center'
      })
        .setOrigin(.5)
        .setDepth(34)
        .setAngle(angle)
        .setScale(.28 * scale)
        .setAlpha(0);
      this.tweens.add({
        targets: label,
        y: y - 35,
        scale: scale,
        alpha: 1,
        duration: 105,
        ease: 'Back.easeOut',
        onComplete: () => this.tweens.add({
          targets: label,
          y: y - 54,
          scale: scale * 1.08,
          alpha: 0,
          duration: 320,
          delay: 90,
          ease: 'Quad.easeIn',
          onComplete: () => label.destroy()
        })
      });
    }

    spawnCommonVfx(name, x, y, options = 1) {
      const spec = COMMON_VFX[name];
      const texture = `common-vfx-${name}`;
      if (!spec || !this.textures.exists(texture)) return;
      const style = typeof options === 'number' ? { scale: options } : (options || {});
      const fx = this.add.sprite(x, y, texture)
        .setScale(spec.scale * (style.scale ?? 1))
        .setDepth(style.depth ?? 24)
        .setFlipX(Boolean(style.flipX))
        .setAlpha(style.alpha ?? 1)
        .play(`anim-${texture}`);
      if (Number.isFinite(style.tint)) fx.setTint(style.tint);
      if (Number.isFinite(style.width) && Number.isFinite(style.height)) {
        fx.setDisplaySize(Math.max(1, style.width), Math.max(1, style.height));
      }
      if (Number.isFinite(style.angle)) fx.setAngle(style.angle);
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
      this.time.delayedCall(1900, () => { if (fx.active) fx.destroy(); });
      return fx;
    }

    spawnAuthoredVfx(character, name, context = {}) {
      const spec = AUTHORED_VFX[character]?.[name];
      const texture = `authored-vfx-${character}-${name}`;
      if (!spec || !this.textures.exists(texture)) return false;
      const definition = CHARACTERS[character];
      const actorView = Number.isInteger(context.actor) ? this.views[context.actor] : null;
      const box = context.box;
      const facing = context.facing || 1;
      let x = context.x;
      let y = context.y;
      if (spec.anchor === 'fighter' && actorView) {
        x = actorView.sprite.x;
        y = actorView.sprite.y;
      } else if (box) {
        x = box.x + box.w / 2;
        y = box.y + box.h / 2;
      }
      const fx = this.add.sprite(x || 0, y || 0, texture).setDepth(context.depth || 19);
      if (spec.anchor === 'fighter' && !spec.scale) {
        const render = definition.render;
        const flipped = facing !== (render.sourceFacing || 1);
        fx.setOrigin(flipped ? 1 - render.originX : render.originX, render.originY)
          .setScale(render.scale)
          .setFlipX(flipped);
      } else {
        fx.setOrigin(.5).setScale(spec.scale || 1).setFlipX(facing < 0);
        if (spec.anchor === 'fighter') fx.y -= 30;
      }
      fx.play(`anim-${texture}`);
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
      this.time.delayedCall(1200, () => { if (fx.active) fx.destroy(); });
      return true;
    }

    spawnAuthoredMoveVfx(event) {
      const step = Number.isInteger(event.comboStep) ? event.comboStep : 0;
      let effects = [];
      if (event.character === 'dragon_knight') {
        if (event.move === 'light') effects = [step % 2 === 0 ? 'attackA' : 'attackB'];
        else if (event.move === 'chargedSpecial') effects = ['breath', 'attackA', 'attackB'];
        else if (event.move === 'special') effects = ['breath'];
      } else if (event.character === 'iron_sentinel') {
        if (event.move === 'light') effects = [['attackA', 'attackB', 'attackC'][step % 3]];
        else if (event.move === 'chargedSpecial') effects = ['attackC', 'attackA', 'attackB'];
        else if (event.move === 'special') effects = ['attackC'];
        else if (event.move === 'extra') effects = ['attackB'];
      } else if (event.character === 'purple_battlemage') {
        if (event.move === 'chargedSpecial') effects = ['spin', 'sustain'];
        else if (event.move === 'special') effects = ['spin'];
        else if (['ability', 'airAbility'].includes(event.move)) effects = ['fast'];
        else if (event.move === 'extra') effects = ['sustain'];
      }
      effects.forEach((name, index) => {
        const spawn = () => this.spawnAuthoredVfx(event.character, name, event);
        if (index) this.time.delayedCall(index * 42, spawn);
        else spawn();
      });
      return effects.length > 0;
    }

    spawnCharacterVfx(character, group, key, context) {
      const recipes = CHARACTER_VFX[character]?.[group]?.[key];
      if (!recipes?.length) return false;
      const facing = context.facing || 1;
      recipes.forEach((recipe) => {
        const spawn = () => {
          const style = {
            scale: recipe.scale ?? 1,
            tint: recipe.tint,
            depth: recipe.depth,
            flipX: Boolean(recipe.flip && facing < 0),
            width: recipe.width,
            height: recipe.height
          };
          if (recipe.fit === 'hitbox' && context.box) {
            style.width = Math.max(1, context.box.w * (recipe.widthScale || 1));
            style.height = Math.max(1, context.box.h * (recipe.heightScale || 1));
          }
          this.spawnCommonVfx(
            recipe.effect,
            context.x + facing * (recipe.offsetX || 0),
            context.y + (recipe.offsetY || 0),
            style
          );
        };
        if (recipe.delay > 0) this.time.delayedCall(recipe.delay, spawn);
        else spawn();
      });
      return true;
    }

    spawnCharacterHitVfx(event) {
      if (event.blocked) {
        this.spawnCommonVfx('guard', event.x, event.y, { scale: 1, tint: 0xd8edf2 });
        this.spawnCommonVfx(themeRing(event.character), event.x, event.y, { scale: .92, tint: CHARACTER_VFX[event.character]?.accent });
        this.time.delayedCall(32, () => this.spawnCommonVfx(themeSparkle(event.character), event.x, event.y - 4, {
          scale: .68,
          tint: CHARACTER_VFX[event.character]?.accent
        }));
        return;
      }
      if (event.move === 'ultimate') {
        const profile = ULTIMATE_ART[event.character] || ULTIMATE_ART.buck;
        this.spawnCommonVfx(profile.hitPrimary, event.x, event.y, { scale: 1.65, tint: profile.accent, depth: 36 });
        this.spawnCommonVfx(profile.hitSecondary, event.x, event.y, { scale: 2.15, tint: profile.accent, depth: 37 });
        this.time.delayedCall(42, () => this.spawnCommonVfx(themeSparkle(event.character), event.x, event.y - 8, {
          scale: 1.15,
          tint: profile.accent,
          depth: 38
        }));
        return;
      }
      if (event.character === 'dragon_knight' && ['ability', 'airAbility'].includes(event.move)) {
        this.spawnAuthoredVfx('dragon_knight', 'explosion', {
          x: event.x, y: event.y, facing: event.facing, depth: 36
        });
      }
      if (event.character === 'buck') {
        const charged = event.move === 'chargedSpecial';
        const projectile = event.move === 'ability';
        this.spawnCommonVfx(charged || projectile ? 'explosion' : 'impact', event.x, event.y, {
          scale: charged ? 1.08 : projectile ? .72 : event.move === 'special' ? 1.1 : 0.86,
          tint: charged ? undefined : 0xffbd61
        });
        this.spawnCommonVfx(charged ? 'thunderSplash' : 'orangeFlare', event.x, event.y, {
          scale: charged ? 1.2 : projectile ? .92 : .78
        });
        this.time.delayedCall(38, () => this.spawnCommonVfx('orangeSparkle', event.x + 7, event.y - 8, charged ? 1.05 : .62));
        return;
      }
      const profile = CHARACTER_VFX[event.character];
      const recipes = profile?.moves?.[event.move] || profile?.moves?.light || [];
      const first = recipes[0]?.effect || (event.move === 'special' ? 'vortex' : 'bigHit');
      const second = recipes[1]?.effect || themeSparkle(event.character);
      const charged = event.move === 'chargedSpecial';
      const special = event.move === 'special';
      this.spawnCommonVfx(first, event.x, event.y, {
        scale: charged ? 1.45 : special ? .9 : .72,
        tint: profile?.accent
      });
      this.spawnCommonVfx(second, event.x, event.y - (charged ? 22 : special ? 16 : 0), {
        scale: charged ? 1.72 : special ? 1.06 : .72,
        tint: profile?.accent
      });
      this.time.delayedCall(35, () => this.spawnCommonVfx(themeSparkle(event.character), event.x + 6, event.y - 8, {
        scale: charged ? 1.32 : special ? .96 : .62,
        tint: profile?.accent
      }));
      if (charged) {
        this.time.delayedCall(78, () => this.spawnCommonVfx('bigHit', event.x, event.y - 4, {
          scale: 1.28,
          tint: profile?.accent,
          depth: 35
        }));
      }
    }

    spawnAfterimages(event, count = 3) {
      const actorView = this.views[event.actor];
      if (!actorView) return;
      const render = CHARACTERS[event.character]?.render || { sourceFacing: 1 };
      const flipped = event.facing !== (render.sourceFacing || 1);
      for (let index = 1; index <= count; index += 1) {
        const echo = this.add.sprite(
          actorView.sprite.x - event.facing * index * 20,
          actorView.sprite.y,
          actorView.sprite.texture.key,
          actorView.sprite.frame.name
        )
          .setOrigin(actorView.sprite.originX, actorView.sprite.originY)
          .setScale(actorView.sprite.scaleX, actorView.sprite.scaleY)
          .setFlipX(flipped)
          .setTint(CHARACTER_VFX[event.character]?.accent || 0x8f75b7)
          .setAlpha(.3 / index)
          .setDepth(8);
        this.tweens.add({
          targets: echo,
          alpha: 0,
          duration: 150 + index * 38,
          onComplete: () => echo.destroy()
        });
      }
    }

    spawnChargedSpecialAccents(event, box) {
      if (!box?.w || !box?.h) return;
      const art = ULTIMATE_ART[event.character] || ULTIMATE_ART.buck;
      const facing = event.facing || 1;
      const startX = facing > 0 ? box.x : box.x + box.w;
      const direction = facing > 0 ? 1 : -1;
      const centerY = box.y + box.h / 2;

      this.spawnCommonVfx(art.aura, box.x + box.w / 2, centerY, {
        width: box.w * 1.06,
        height: Math.max(90, box.h * 1.9),
        tint: art.accent,
        alpha: .68,
        depth: 12,
        flipX: facing < 0
      });
      [0.16, 0.38, 0.62, 0.84].forEach((ratio, index) => {
        this.time.delayedCall(index * 38, () => {
          const x = startX + direction * box.w * ratio;
          this.spawnCommonVfx(index % 2 ? art.hitSecondary : art.hitPrimary, x, centerY - (index % 2) * 10, {
            scale: 1.05 + index * .13,
            tint: art.accent,
            depth: 16 + index
          });
          this.spawnCommonVfx(index === 3 ? art.ring : themeSparkle(event.character), x, centerY - 8, {
            scale: index === 3 ? 1.65 : .82 + index * .08,
            tint: art.accent,
            depth: 20 + index
          });
        });
      });
    }

    spawnMoveVfx(event) {
      const authored = this.spawnAuthoredMoveVfx(event);
      const box = event.box;
      const x = box.x + box.w / 2;
      const y = box.y + box.h / 2;
      if (event.move === 'chargedSpecial') this.spawnChargedSpecialAccents(event, box);
      const kitSpec = VFX_KIT[event.character]?.[event.move];
      const kitTexture = `kit-vfx-${event.character}-${event.move}`;
      if (kitSpec && this.textures.exists(kitTexture)) {
        const fx = this.add.sprite(x, y, kitTexture)
          .setFlipX(event.facing < 0)
          .setDepth(15)
          .play(`anim-${kitTexture}`);
        const widthScale = kitSpec.widthScale || 1;
        const heightScale = kitSpec.heightScale || 1;
        if (kitSpec.fit === 'hitbox') {
          fx.setDisplaySize(Math.max(1, box.w * widthScale), Math.max(1, box.h * heightScale));
        } else if (kitSpec.fit === 'stretch-x') {
          const height = Math.max(1, box.h * heightScale);
          const naturalRatio = kitSpec.frameWidth / Math.max(1, kitSpec.frameHeight);
          fx.setDisplaySize(Math.max(box.w * widthScale, height * naturalRatio), height);
        } else {
          fx.setScale(kitSpec.scale || 1);
        }
        fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
        this.time.delayedCall(1600, () => { if (fx.active) fx.destroy(); });
        return;
      }
      const profiled = this.spawnCharacterVfx(event.character, 'moves', event.move, {
        x, y, box, facing: event.facing
      });
      if (event.character === 'buck' && ['special', 'chargedSpecial'].includes(event.move)) {
        if (profiled) return;
        const color = event.move === 'chargedSpecial' ? 0xffe19d : 0xbfdbea;
        const wave = this.add.rectangle(x, y, Math.max(18, box.w * .18), box.h * .7, color, .58).setDepth(14);
        wave.setOrigin(event.facing > 0 ? 0 : 1, .5);
        wave.x = event.facing > 0 ? box.x : box.x + box.w;
        this.tweens.add({
          targets: wave,
          displayWidth: box.w,
          alpha: 0,
          duration: event.move === 'chargedSpecial' ? 340 : 230,
          ease: 'Cubic.easeOut',
          onComplete: () => wave.destroy()
        });
        return;
      }
      if (event.character === 'rogue' && event.move === 'special') {
        if (!profiled) {
          this.spawnCommonVfx('hyperspeed', x, y, {
            width: box.w * 1.35,
            height: Math.max(86, box.h * 1.8),
            flipX: event.facing < 0,
            depth: 13
          });
        }
        this.spawnAfterimages(event, 3);
        return;
      }
      if (['ability', 'airAbility', 'extra'].includes(event.move) && (profiled || authored) && box.w === 0) return;
      const slash = this.add.sprite(x, y, 'fx-slash').setFlipX(event.facing < 0).setDepth(14);
      const targetWidth = Math.max(58, Math.min(180, box.w * 1.05));
      const targetHeight = Math.max(46, Math.min(100, box.h * 1.4));
      slash.setDisplaySize(targetWidth * .55, targetHeight * .55);
      slash.setTint(CHARACTER_VFX[event.character]?.accent || 0xffffff);
      this.tweens.add({
        targets: slash,
        displayWidth: targetWidth,
        displayHeight: targetHeight,
        alpha: 0,
        duration: 190,
        ease: 'Quad.easeOut',
        onComplete: () => slash.destroy()
      });
    }

    spawnChargeVfx(event) {
      this.spawnCommonVfx('charge', event.x, event.y, 1);
      const accent = CHARACTER_VFX[event.character]?.accent || 0xffd99b;
      this.spawnCommonVfx(themeRing(event.character), event.x, event.y + 2, { scale: 1.18, tint: accent, depth: 12 });
      this.time.delayedCall(90, () => this.spawnCommonVfx(themeSparkle(event.character), event.x, event.y - 8, {
        scale: .9,
        tint: accent,
        depth: 15
      }));
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6;
        const mote = this.add.rectangle(event.x + Math.cos(angle) * 34, event.y + Math.sin(angle) * 24, 5, 5, accent, .9).setDepth(14);
        this.tweens.add({
          targets: mote,
          x: event.x,
          y: event.y,
          alpha: 0,
          duration: 420 + index * 25,
          repeat: 1,
          onComplete: () => mote.destroy()
        });
      }
    }

    spawnMobilityVfx(event) {
      if (['dragon_knight', 'iron_sentinel'].includes(event.character)
        && ['roll', 'teleport-start'].includes(event.mobility)) {
        this.spawnAuthoredVfx(event.character, 'dash', event);
      }
      const profiled = this.spawnCharacterVfx(event.character, 'mobility', event.mobility, {
        x: event.x,
        y: event.y - 18,
        facing: event.facing
      });
      if (!profiled) {
        if (event.mobility === 'roll') {
          this.spawnCommonVfx('roll', event.x - event.facing * 14, event.y - 18, .92);
        } else {
          this.spawnCommonVfx('teleport', event.x, event.y - 31, event.mobility === 'teleport-warp' ? 1.08 : .82);
        }
      }
      const definition = CHARACTERS[event.character];
      if (definition.movement.runSpeed > 5.25 && ['roll', 'teleport-start'].includes(event.mobility)) {
        this.spawnAfterimages(event, event.mobility === 'roll' ? 2 : 3);
      }
      const profile = CHARACTER_VFX[event.character];
      const heavy = definition.movement.runSpeed < 4.8 || definition.hurtbox.w >= 44;
      const ring = this.add.ellipse(
        event.x,
        event.y - (heavy ? 16 : 34),
        heavy ? 56 : 34,
        heavy ? 22 : 62,
        profile?.accent || 0x9e8cc1,
        .25
      )
        .setStrokeStyle(2, heavy ? 0xffd18b : 0xe5d9f6, .85)
        .setDepth(7);
      this.tweens.add({
        targets: ring,
        scaleX: heavy ? 1.9 : 1.45,
        scaleY: heavy ? .55 : .82,
        alpha: 0,
        duration: heavy ? 190 : 250,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy()
      });
    }

    renderViews(delta) {
      if (performance.now() < this.visualHitstopUntil) return;
      const blend = 1 - Math.exp(-Math.min(50, delta) / 1000 * 28);
      this.views.forEach((view) => {
        if (!view) return;
        view.renderX = Phaser.Math.Linear(view.renderX, view.targetX, blend);
        view.renderY = Phaser.Math.Linear(view.renderY, view.targetY, blend);
        view.sprite.setPosition(Math.round(view.renderX), Math.round(view.renderY));
      });
      this.projectileViews.forEach((view) => {
        view.x = Phaser.Math.Linear(view.x, view.targetX, Math.min(1, blend * 1.5));
        view.y = Phaser.Math.Linear(view.y, view.targetY, Math.min(1, blend * 1.5));
        view.sprite.setPosition(Math.round(view.x), Math.round(view.y));
      });
      this.updateFightCamera(delta);
    }

    update(time, delta) {
      this.sendInputs(time);
      if (session.latestState && session.latestState.tick !== this.appliedTick) this.consumeSnapshot(session.latestState);
      this.renderViews(delta);
    }
  }

  function neutralInput() {
    return { left: false, right: false, jump: false, light: false, special: false, roll: false, teleport: false, block: false, ability: false, support: false, extra: false, ultimate: false };
  }

  function createGame() {
    if (session.game) return;
    const existingCanvas = document.getElementById('game-canvas');
    const isWebGLSupported = () => {
      try {
        const c = document.createElement('canvas');
        return Boolean(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
      } catch (_) { return false; }
    };
    const renderType = isWebGLSupported() ? Phaser.WEBGL : Phaser.CANVAS;
    session.game = new Phaser.Game({
      type: renderType,
      parent: 'game-container',
      canvas: existingCanvas || undefined,
      width: WORLD.viewWidth,
      height: WORLD.viewHeight,
      // Matches the top pixel of background1, so zooming out reveals a
      // seamless sky above the repeated 640px parallax layers.
      backgroundColor: '#68b5df',
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      render: { antialias: false, pixelArt: true, roundPixels: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: WORLD.viewWidth,
        height: WORLD.viewHeight
      },
      physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
      scene: [PixelClashScene]
    });
  }

  window.addEventListener('resize', () => session.game?.scale.refresh());
  applyPreferences();
  selectMenuMode('training');

  // p2game SDK Handshake & Lifecycle
  if (typeof window !== 'undefined' && window.p2) {
    if (typeof window.p2.init === 'function') {
      window.p2.init().then((ctx) => {
        if (ctx && ctx.player) session.p2User = ctx.player;
        if (window.p2.auth && typeof window.p2.auth.getUser === 'function') {
          window.p2.auth.getUser().then((u) => { if (u) session.p2User = u; }).catch(() => {});
        }
      }).catch((e) => console.warn('P2 SDK init notice:', e));
    }
    if (typeof window.p2.ready === 'function') {
      try { window.p2.ready(); } catch (_) {}
    }
    if (typeof window.p2.onPause === 'function') {
      window.p2.onPause(() => {
        if (session.game) session.game.scene.pause('default');
      });
    }
    if (typeof window.p2.onResume === 'function') {
      window.p2.onResume(() => {
        if (session.game) session.game.scene.resume('default');
      });
    }
  }
})();
