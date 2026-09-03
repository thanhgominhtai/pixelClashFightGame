'use strict';

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const express = require('express');
const { Server } = require('socket.io');
const GAME = require('./public/shared/game-data');

const { WORLD, NETWORK, MAPS, CHARACTERS, DODGES, ULTIMATE } = GAME;
const PORT = Number(process.env.PORT || 3000);
const FRAME_MS = 1000 / NETWORK.tickRate;
const SNAPSHOT_EVERY = Math.max(1, Math.round(NETWORK.tickRate / NETWORK.snapshotRate));
const CHARGED_SPECIAL_WIDTH_MULTIPLIER = 2.15;
const CHARGED_SPECIAL_HEIGHT_MULTIPLIER = 1.35;
const INPUT_KEYS = Object.freeze(['left', 'right', 'jump', 'light', 'special', 'roll', 'teleport', 'block', 'ability', 'support', 'extra', 'ultimate']);
const BUFFERED_KEYS = Object.freeze(['jump', 'light', 'special', 'roll', 'teleport', 'ability', 'support', 'extra', 'ultimate']);
const VALID_MODES = new Set(['training', 'pve', 'online']);
const MAX_ROUNDS = 3;
const WINS_NEEDED = 2;
const AI_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    reactionFrames: 28, jitterFrames: 8, aggression: 0.42, guardChance: 0.22,
    dodgeChance: 0.08, specialChance: 0.16, abilityChance: 0.1, jumpChance: 0.07,
    preferredRange: 74, chargeChance: 0.04, ultimateChance: 0.16
  }),
  normal: Object.freeze({
    reactionFrames: 14, jitterFrames: 5, aggression: 0.64, guardChance: 0.48,
    dodgeChance: 0.2, specialChance: 0.28, abilityChance: 0.2, jumpChance: 0.12,
    preferredRange: 82, chargeChance: 0.18, ultimateChance: 0.42
  }),
  hard: Object.freeze({
    reactionFrames: 7, jitterFrames: 3, aggression: 0.82, guardChance: 0.72,
    dodgeChance: 0.34, specialChance: 0.38, abilityChance: 0.3, jumpChance: 0.16,
    preferredRange: 92, chargeChance: 0.34, ultimateChance: 0.72
  })
});
const ROOM_CODE = /^\d{4}$/;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || true, credentials: false },
  transports: ['websocket', 'polling'],
  serveClient: true
});

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use((request, response, next) => {
  const criticalFiles = new Set(['/', '/index.html', '/styles.css', '/game.js', '/shared/game-data.js']);
  if (criticalFiles.has(request.path)) {
    response.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    });
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/assets', express.static(path.join(__dirname, 'Character_platformer')));
app.use('/backgrounds', express.static(path.join(__dirname, 'backgound_map')));
app.use('/common-vfx', express.static(path.join(__dirname, 'vfx')));
app.use('/sounds', express.static(path.join(__dirname, '400 Sounds Pack')));

const rooms = new Map();

app.get('/health', (_request, response) => {
  response.json({ ok: true, version: GAME.version, rooms: rooms.size, uptime: Math.round(process.uptime()) });
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function approach(value, target, amount) {
  if (value < target) return Math.min(target, value + amount);
  if (value > target) return Math.max(target, value - amount);
  return target;
}

function blankInput() {
  return Object.fromEntries(INPUT_KEYS.map((key) => [key, false]));
}

function sanitizeInput(raw) {
  const result = blankInput();
  if (!raw || typeof raw !== 'object') return result;
  for (const key of INPUT_KEYS) result[key] = raw[key] === true;
  return result;
}

function sanitizeCharacter(value) {
  return Object.prototype.hasOwnProperty.call(CHARACTERS, value) ? value : 'buck';
}

function sanitizeDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(AI_DIFFICULTIES, value) ? value : 'normal';
}

function sanitizeMapId(value) {
  return Object.prototype.hasOwnProperty.call(MAPS, value) ? value : 'desert';
}

function createFighter(slot, characterId) {
  const character = sanitizeCharacter(characterId);
  return {
    slot,
    character,
    x: WORLD.width / 2 + (slot === 0 ? -180 : 180),
    y: WORLD.groundY,
    vx: 0,
    vy: 0,
    facing: slot === 0 ? 1 : -1,
    hp: 100,
    maxHp: 100,
    wins: 0,
    state: 'IDLE',
    stateFrame: 0,
    stateTimer: 0,
    attack: null,
    support: null,
    supportUses: 0,
    chargeFrames: 0,
    comboIndex: 0,
    comboTimer: 0,
    stunFrames: 0,
    invulnerableFrames: 0,
    rollCooldown: 0,
    teleportCooldown: 0,
    abilityCooldown: 0,
    extraCooldown: 0,
    ultimateEnergy: 0,
    jumpsUsed: 0,
    coyoteFrames: 0,
    input: blankInput(),
    previousInput: blankInput(),
    buffers: Object.fromEntries(BUFFERED_KEYS.map((key) => [key, 0])),
    lastInputAt: Date.now(),
    inputSequence: -1,
    teleported: false,
    regenAt: 0,
    onGround: true,
    surfaceId: 'ground',
    surfaceY: WORLD.groundY
  };
}

function defaultTrainingSettings() {
  return {
    invulnerable: false,
    infiniteHp: false,
    noCooldown: false,
    freezeDummy: false,
    dummyGuard: false,
    paused: false
  };
}

function createRoom(mode, ownerId, characters, options = {}) {
  const code = createRoomCode();
  const aiDifficulty = mode === 'pve' ? sanitizeDifficulty(options.difficulty) : null;
  const room = {
    code,
    mode,
    ownerId,
    seats: [ownerId, null],
    fighters: [
      createFighter(0, characters?.[0]),
      createFighter(1, characters?.[1] || 'rogue')
    ],
    phase: mode === 'online' ? 'waiting' : 'intro',
    tick: 0,
    round: 1,
    roundWinner: null,
    matchWinner: null,
    roundTimer: mode === 'training' ? -1 : 99 * NETWORK.tickRate,
    introFrames: mode === 'online' ? 0 : 180,
    roundEndFrames: 0,
    hitstopFrames: 0,
    nextProjectileId: 1,
    projectiles: [],
    ultimate: null,
    rematchVotes: new Set(),
    training: defaultTrainingSettings(),
    trainingStepFrames: 0,
    aiDifficulty,
    mapId: sanitizeMapId(options.mapId),
    ai: { nextDecisionTick: 0, input: blankInput() },
    lastActivityAt: Date.now()
  };
  if (room.phase === 'intro') room.fighters.forEach((fighter) => setState(fighter, 'APPEAR'));
  rooms.set(code, room);
  return room;
}

function createRoomCode() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    if (!rooms.has(code)) return code;
  }
  throw new Error('Không thể cấp mã phòng mới.');
}

function setState(fighter, state, timer = 0) {
  fighter.state = state;
  fighter.stateFrame = 0;
  fighter.stateTimer = timer;
}

function characterFor(fighter) {
  return CHARACTERS[fighter.character] || CHARACTERS.buck;
}

function moveFor(fighter, moveId) {
  const character = characterFor(fighter);
  if (moveId === 'chargedSpecial') {
    const special = character.moves.special;
    if (!special) return null;
    const authored = character.moves.chargedSpecial;
    const charged = authored || {
      ...special,
      id: 'chargedSpecial',
      label: `Charged ${special.label}`,
      startup: Math.max(5, special.startup - 2),
      active: Math.max(special.active + 3, Math.ceil(special.active * 1.35)),
      recovery: special.recovery + 8,
      damage: Math.round(special.damage * 1.58),
      chip: Math.max(special.chip + 2, Math.round(special.chip * 1.5)),
      hitstun: special.hitstun + 10,
      blockstun: special.blockstun + 5,
      knockbackX: special.knockbackX * 1.35,
      knockbackY: special.knockbackY * 1.25,
      hitstop: special.hitstop + 3,
      dashSpeed: special.dashSpeed ? special.dashSpeed * 1.16 : undefined
    };
    const chargedWidth = Math.max(
      charged.hitbox?.w || 0,
      Math.ceil(special.hitbox.w * CHARGED_SPECIAL_WIDTH_MULTIPLIER)
    );
    const chargedHeight = Math.max(
      charged.hitbox?.h || 0,
      Math.ceil(special.hitbox.h * CHARGED_SPECIAL_HEIGHT_MULTIPLIER)
    );
    // Preserve the near edge of the normal K hitbox and extend all added
    // range forward. This prevents a large charged box from reaching behind
    // the fighter or visually separating from its VFX origin.
    const chargedOffsetX = special.hitbox.offsetX + (chargedWidth - special.hitbox.w) / 2;
    return {
      ...charged,
      id: 'chargedSpecial',
      hitbox: {
        ...special.hitbox,
        ...(charged.hitbox || {}),
        w: chargedWidth,
        h: chargedHeight,
        offsetX: Number(chargedOffsetX.toFixed(2))
      }
    };
  }
  return character.moves[moveId];
}

function comboSequenceFor(fighter, airborne) {
  const combos = characterFor(fighter).combos;
  if (!combos) return null;
  const sequence = airborne ? combos.air : combos.ground;
  return Array.isArray(sequence) && sequence.length ? sequence : null;
}

function attackMoveFor(fighter, attack) {
  const base = moveFor(fighter, attack.moveId);
  if (!base || attack.moveId !== 'light' || !Number.isInteger(attack.comboStep)) return base;
  const sequence = comboSequenceFor(fighter, attack.airborneAtStart);
  const step = sequence?.[attack.comboStep % sequence.length];
  if (!step) return base;
  return {
    ...base,
    ...step,
    id: 'light',
    label: `${base.label} ${attack.comboStep + 1}`,
    hitbox: { ...base.hitbox, ...(step.hitbox || {}) }
  };
}

function grounded(fighter) {
  return fighter.onGround === true;
}

function mapForRoom(room) {
  return MAPS[room.mapId] || MAPS.desert;
}

function platformForSurface(room, surfaceId) {
  if (!surfaceId || surfaceId === 'ground') return null;
  return mapForRoom(room).platforms.find((item) => item.id === surfaceId) || null;
}

function hasHorizontalSupport(fighter, platform) {
  const inset = Math.min(12, platform.w * 0.08);
  return fighter.x >= platform.x - platform.w / 2 + inset
    && fighter.x <= platform.x + platform.w / 2 - inset;
}

function stillSupported(room, fighter) {
  if (!grounded(fighter)) return false;
  if (fighter.surfaceId === 'ground') return Math.abs(fighter.y - WORLD.groundY) <= 0.5;
  const platform = platformForSurface(room, fighter.surfaceId);
  return Boolean(platform && Math.abs(fighter.y - platform.y) <= 0.5 && hasHorizontalSupport(fighter, platform));
}

function landingSurface(room, fighter, previousY, nextY) {
  if (fighter.vy < 0 || nextY < previousY) return null;
  const candidates = [{ id: 'ground', y: WORLD.groundY }];
  mapForRoom(room).platforms.forEach((item) => {
    if (hasHorizontalSupport(fighter, item)) candidates.push({ id: item.id, y: item.y });
  });
  return candidates
    .filter((surface) => previousY <= surface.y + 0.01 && nextY >= surface.y - 0.01)
    .sort((a, b) => a.y - b.y)[0] || null;
}

function releaseUnsupportedSurface(room, fighter) {
  if (!grounded(fighter) || stillSupported(room, fighter)) return;
  fighter.onGround = false;
  fighter.surfaceId = null;
  fighter.surfaceY = null;
}

function resetFighter(fighter, preserveWins = true) {
  const wins = preserveWins ? fighter.wins : 0;
  const fresh = createFighter(fighter.slot, fighter.character);
  fresh.wins = wins;
  Object.assign(fighter, fresh);
}

function startRound(room) {
  room.phase = 'intro';
  room.introFrames = 180;
  room.roundEndFrames = 0;
  room.hitstopFrames = 0;
  room.ultimate = null;
  room.roundTimer = room.mode === 'training' ? -1 : 99 * NETWORK.tickRate;
  room.projectiles = [];
  room.roundWinner = null;
  room.matchWinner = null;
  room.ai.nextDecisionTick = 0;
  room.ai.input = blankInput();
  room.fighters.forEach((fighter) => {
    resetFighter(fighter, true);
    setState(fighter, 'APPEAR');
  });
  emitRoom(room, 'match:phase', { phase: room.phase, round: room.round });
  emitSnapshot(room);
}

function beginFight(room) {
  room.phase = 'fight';
  room.fighters.forEach((fighter) => setState(fighter, 'IDLE'));
  emitRoom(room, 'match:phase', { phase: 'fight', round: room.round });
}

function inputDirection(input) {
  return (input.right ? 1 : 0) - (input.left ? 1 : 0);
}

function updateBuffers(fighter) {
  for (const key of BUFFERED_KEYS) {
    if (fighter.input[key] && !fighter.previousInput[key]) {
      fighter.buffers[key] = characterFor(fighter).movement.inputBufferFrames;
    } else if (fighter.buffers[key] > 0) {
      fighter.buffers[key] -= 1;
    }
  }
}

function consumeBuffer(fighter, key) {
  if (fighter.buffers[key] <= 0) return false;
  fighter.buffers[key] = 0;
  return true;
}

function integrate(room, fighter, allowLandingState = true) {
  const wasGrounded = grounded(fighter);
  if (!wasGrounded || fighter.vy < 0) {
    fighter.vy = Math.min(characterFor(fighter).movement.maxFallSpeed, fighter.vy + WORLD.gravity);
  }
  const previousY = fighter.y;
  fighter.x += fighter.vx;
  fighter.x = clamp(fighter.x, WORLD.minX, WORLD.maxX);
  if (fighter.vy < 0) {
    fighter.onGround = false;
    fighter.surfaceId = null;
    fighter.surfaceY = null;
  } else if (wasGrounded) {
    releaseUnsupportedSurface(room, fighter);
  }
  fighter.y += fighter.vy;

  const surface = landingSurface(room, fighter, previousY, fighter.y);
  if (surface) {
    const landed = !wasGrounded && fighter.vy > 0;
    fighter.y = surface.y;
    fighter.vy = 0;
    fighter.onGround = true;
    fighter.surfaceId = surface.id;
    fighter.surfaceY = surface.y;
    fighter.jumpsUsed = 0;
    fighter.coyoteFrames = characterFor(fighter).movement.coyoteFrames;
    if (landed && allowLandingState && ['JUMP', 'FALL'].includes(fighter.state)) setState(fighter, 'LAND', 6);
  } else if (wasGrounded) {
    // A deliberate jump already consumed coyote time. Only walking off an
    // edge receives the grace window.
    if (fighter.vy >= 0) fighter.coyoteFrames = characterFor(fighter).movement.coyoteFrames;
  } else {
    fighter.coyoteFrames = Math.max(0, fighter.coyoteFrames - 1);
  }
}

function beginJump(room, fighter) {
  const movement = characterFor(fighter).movement;
  const firstJump = grounded(fighter) || fighter.coyoteFrames > 0;
  if (!firstJump && fighter.jumpsUsed >= 2) return false;
  fighter.jumpsUsed = firstJump ? 1 : fighter.jumpsUsed + 1;
  fighter.coyoteFrames = 0;
  fighter.vy = firstJump ? movement.jumpVelocity : movement.doubleJumpVelocity;
  fighter.onGround = false;
  fighter.surfaceId = null;
  fighter.surfaceY = null;
  setState(fighter, 'JUMP');
  emitCombat(room, {
    kind: 'jump', actor: fighter.slot, character: fighter.character,
    x: fighter.x, y: fighter.y, facing: fighter.facing, double: !firstJump
  });
  return true;
}

function beginAttack(fighter, moveId, charged = false, options = {}) {
  const baseMove = moveFor(fighter, moveId);
  if (!baseMove) return false;
  const airborne = !grounded(fighter);
  const sequence = moveId === 'light' ? comboSequenceFor(fighter, airborne) : null;
  const comboStep = sequence
    ? (Number.isInteger(options.comboStep)
      ? options.comboStep % sequence.length
      : fighter.comboTimer > 0 ? fighter.comboIndex % sequence.length : 0)
    : null;
  if (airborne) {
    // Air attacks briefly suspend the fighter without deleting all momentum.
    fighter.vx *= 0.58;
    fighter.vy = clamp(fighter.vy * 0.25, -2.2, 0.8);
  } else {
    fighter.vx = 0;
  }
  const attack = {
    moveId,
    frame: 0,
    phase: 'startup',
    total: 0,
    charged,
    airborne,
    airborneAtStart: airborne,
    comboStep,
    lightQueued: false,
    activeEventSent: false,
    selfEffectApplied: false,
    projectileSpawned: false,
    hitTargets: new Set()
  };
  const move = attackMoveFor(fighter, attack);
  attack.total = move.startup + move.active + move.recovery;
  fighter.attack = attack;
  fighter.support = null;
  setState(fighter, 'ATTACK');
  return true;
}

function beginSupport(room, fighter) {
  const definition = characterFor(fighter);
  const stages = definition.support?.stages;
  if (!stages?.length || fighter.supportUses >= stages.length) {
    emitCombat(room, {
      kind: 'support-empty', actor: fighter.slot, character: fighter.character,
      x: fighter.x, y: fighter.y, remaining: 0
    });
    return false;
  }
  const stageIndex = fighter.supportUses;
  const stage = stages[stageIndex];
  fighter.supportUses += 1;
  fighter.attack = null;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.support = {
    stageIndex,
    animation: stage.animation,
    label: stage.label,
    frame: 0,
    duration: stage.duration,
    triggerFrame: stage.triggerFrame,
    heal: stage.heal,
    applied: false
  };
  setState(fighter, 'SUPPORT', stage.duration);
  emitCombat(room, {
    kind: 'support-start', actor: fighter.slot, character: fighter.character,
    label: stage.label, stageIndex, duration: stage.duration,
    remaining: stages.length - fighter.supportUses,
    x: fighter.x, y: fighter.y, facing: fighter.facing
  });
  return true;
}

function stepSupport(room, fighter) {
  const support = fighter.support;
  if (!support) {
    setState(fighter, grounded(fighter) ? 'IDLE' : 'FALL');
    return;
  }
  support.frame += 1;
  fighter.stateFrame = support.frame;
  fighter.stateTimer = Math.max(0, support.duration - support.frame);
  fighter.vx = 0;
  if (!support.applied && support.frame >= support.triggerFrame) {
    support.applied = true;
    const before = fighter.hp;
    fighter.hp = Math.min(fighter.maxHp, fighter.hp + support.heal);
    emitCombat(room, {
      kind: 'support-heal', actor: fighter.slot, character: fighter.character,
      label: support.label, amount: fighter.hp - before, hp: fighter.hp,
      x: fighter.x, y: fighter.y, facing: fighter.facing
    });
  }
  if (support.frame < support.duration) return;
  fighter.support = null;
  setState(fighter, grounded(fighter) ? 'IDLE' : 'FALL');
}

function beginUltimate(room, fighter, opponent) {
  const move = moveFor(fighter, 'ultimate');
  if (!move || room.ultimate || fighter.ultimateEnergy < ULTIMATE.maxEnergy) return false;

  fighter.ultimateEnergy = 0;
  fighter.attack = null;
  fighter.chargeFrames = 0;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.facing = Math.sign(opponent.x - fighter.x) || fighter.facing;
  opponent.attack = null;
  opponent.chargeFrames = 0;
  opponent.vx = 0;
  opponent.vy = 0;
  if (!['HURT', 'KO', 'BLOCK'].includes(opponent.state)) setState(opponent, 'IDLE');
  setState(fighter, 'ULTIMATE', ULTIMATE.introFrames + ULTIMATE.aftermathFrames + 1);
  room.projectiles = [];
  room.ultimate = {
    actor: fighter.slot,
    target: opponent.slot,
    character: fighter.character,
    frame: 0,
    phase: 'intro',
    resolved: false,
    pendingWinner: null
  };
  emitCombat(room, {
    kind: 'ultimate-start', actor: fighter.slot, target: opponent.slot,
    character: fighter.character, name: move.cinematicName,
    x: fighter.x, y: fighter.y, targetX: opponent.x, targetY: opponent.y,
    facing: fighter.facing, introFrames: ULTIMATE.introFrames
  });
  return true;
}

function stepUltimate(room) {
  const sequence = room.ultimate;
  if (!sequence) return;
  const attacker = room.fighters[sequence.actor];
  const defender = room.fighters[sequence.target];
  const move = moveFor(attacker, 'ultimate');
  sequence.frame += 1;
  attacker.vx = 0;
  attacker.vy = 0;
  defender.vx = 0;
  defender.vy = 0;

  // The defender may react during the cinematic. Guard stays directional:
  // holding S alone keeps the current facing; A/D + S can turn before impact.
  if (!sequence.resolved && !['HURT', 'KO'].includes(defender.state)) {
    const guardDirection = inputDirection(defender.input);
    if (guardDirection) defender.facing = guardDirection;
    if (defender.input.block && grounded(defender)) setState(defender, 'BLOCK');
    else if (defender.state === 'BLOCK' && defender.stunFrames === 0) setState(defender, 'IDLE');
  }

  if (!sequence.resolved && sequence.frame >= ULTIMATE.introFrames) {
    sequence.resolved = true;
    sequence.phase = 'aftermath';
    emitCombat(room, {
      kind: 'ultimate-release', actor: attacker.slot, target: defender.slot,
      character: attacker.character, name: move.cinematicName,
      x: attacker.x, y: attacker.y, targetX: defender.x, targetY: defender.y,
      facing: attacker.facing,
      box: { x: WORLD.minX, y: 0, w: WORLD.maxX - WORLD.minX, h: WORLD.height }
    });
    dealDamage(room, attacker, defender, move, attacker.x, null, {
      deferRoundEnd: true,
      noEnergy: true
    });
    if (defender.hp <= 0) sequence.pendingWinner = attacker.slot;
  }

  const total = ULTIMATE.introFrames + ULTIMATE.aftermathFrames;
  if (sequence.frame < total) return;
  const pendingWinner = sequence.pendingWinner;
  room.ultimate = null;
  if (attacker.state === 'ULTIMATE') setState(attacker, grounded(attacker) ? 'IDLE' : 'FALL');
  emitCombat(room, {
    kind: 'ultimate-end', actor: attacker.slot, target: defender.slot,
    character: attacker.character, x: attacker.x, y: attacker.y
  });
  if (Number.isInteger(pendingWinner)) finishRound(room, pendingWinner);
}

function beginRoll(room, fighter, direction) {
  const movement = characterFor(fighter).movement;
  fighter.facing = direction;
  fighter.vx = direction * (movement.rollSpeed || DODGES.roll.speed);
  fighter.invulnerableFrames = movement.rollInvulnerable || DODGES.roll.invulnerable;
  fighter.rollCooldown = movement.rollCooldown || DODGES.roll.cooldown;
  setState(fighter, 'ROLL', movement.rollFrames || DODGES.roll.total);
  emitCombat(room, { kind: 'mobility', mobility: 'roll', actor: fighter.slot, character: fighter.character, x: fighter.x, y: fighter.y, facing: direction });
}

function beginTeleport(room, fighter, direction) {
  const movement = characterFor(fighter).movement;
  if (direction) fighter.facing = direction;
  fighter.vx = 0;
  fighter.invulnerableFrames = movement.teleportInvulnerable || DODGES.teleport.invulnerable;
  fighter.teleportCooldown = movement.teleportCooldown || DODGES.teleport.cooldown;
  fighter.teleported = false;
  setState(fighter, 'TELEPORT', movement.teleportFrames || DODGES.teleport.total);
  emitCombat(room, { kind: 'mobility', mobility: 'teleport-start', actor: fighter.slot, character: fighter.character, x: fighter.x, y: fighter.y, facing: fighter.facing });
}

function integrateAirAttack(room, fighter, attack, move) {
  const movement = characterFor(fighter).movement;
  const direction = inputDirection(fighter.input);
  const stalled = attack.frame <= (move.airStall || 0);
  const gravityScale = stalled ? 0.08 : (move.airGravity ?? 0.45);
  const drift = move.airDrift ?? 0.55;

  if (!(move.dashSpeed && attack.phase === 'active')) {
    const target = direction * movement.runSpeed * drift;
    fighter.vx = direction
      ? approach(fighter.vx, target, movement.airAcceleration * 0.72)
      : approach(fighter.vx, 0, movement.airDeceleration * 0.45);
  }
  fighter.vy = Math.min(movement.maxFallSpeed, fighter.vy + WORLD.gravity * gravityScale);
  fighter.x = clamp(fighter.x + fighter.vx, WORLD.minX, WORLD.maxX);
  const previousY = fighter.y;
  fighter.y += fighter.vy;
  const surface = landingSurface(room, fighter, previousY, fighter.y);
  if (surface) {
    fighter.y = surface.y;
    fighter.vy = 0;
    fighter.onGround = true;
    fighter.surfaceId = surface.id;
    fighter.surfaceY = surface.y;
    fighter.jumpsUsed = 0;
    fighter.coyoteFrames = movement.coyoteFrames;
    attack.airborne = false;
  }
}

function tryAttackCancel(room, fighter, attack, move) {
  if (attack.moveId !== 'light') return false;
  // The last two active frames and all recovery frames form an intentional
  // cancel window. Startup cannot be skipped by mashing.
  const cancelStart = move.startup + Math.max(1, move.active - 2);
  if (attack.frame < cancelStart) return false;

  let nextMove = null;
  if (fighter.buffers.special > 0) {
    consumeBuffer(fighter, 'special');
    nextMove = 'special';
  } else if (moveFor(fighter, 'ability') && fighter.abilityCooldown === 0 && fighter.buffers.ability > 0) {
    consumeBuffer(fighter, 'ability');
    nextMove = attack.airborne && moveFor(fighter, 'airAbility') ? 'airAbility' : 'ability';
    fighter.abilityCooldown = moveFor(fighter, nextMove).cooldown;
  }
  if (!nextMove) return false;

  emitCombat(room, {
    kind: 'cancel', actor: fighter.slot, character: fighter.character,
    from: attack.moveId, to: nextMove, x: fighter.x, y: fighter.y, facing: fighter.facing
  });
  beginAttack(fighter, nextMove);
  return true;
}

function tryLightChain(room, fighter, attack, move) {
  if (attack.moveId !== 'light') return false;
  const chainWindow = Math.max(3, move.comboWindow || 5);
  if (attack.frame < attack.total - chainWindow) return false;
  if (!fighter.input.light && !attack.lightQueued && fighter.buffers.light <= 0) return false;
  if (fighter.buffers.light > 0) consumeBuffer(fighter, 'light');
  const sequence = comboSequenceFor(fighter, attack.airborneAtStart);
  const nextStep = sequence ? ((attack.comboStep ?? 0) + 1) % sequence.length : null;
  fighter.comboIndex = nextStep ?? 0;
  fighter.comboTimer = characterFor(fighter).combos?.resetFrames || 24;
  emitCombat(room, {
    kind: 'combo-chain', actor: fighter.slot, character: fighter.character,
    comboStep: nextStep, x: fighter.x, y: fighter.y, facing: fighter.facing
  });
  beginAttack(fighter, 'light', false, { comboStep: nextStep });
  return true;
}

function stepAttack(room, fighter) {
  const attack = fighter.attack;
  if (!attack) {
    setState(fighter, grounded(fighter) ? 'IDLE' : 'FALL');
    return;
  }
  const move = attackMoveFor(fighter, attack);
  attack.frame += 1;
  if (attack.moveId === 'light' && fighter.buffers.light > 0) attack.lightQueued = true;
  if (attack.frame <= move.startup) attack.phase = 'startup';
  else if (attack.frame <= move.startup + move.active) attack.phase = 'active';
  else attack.phase = 'recovery';

  if (tryAttackCancel(room, fighter, attack, move)) return;
  if (tryLightChain(room, fighter, attack, move)) return;

  if (attack.phase === 'active' && !attack.activeEventSent) {
    attack.activeEventSent = true;
    emitCombat(room, {
      kind: 'attack-active', actor: fighter.slot, character: fighter.character,
      move: attack.moveId, charged: attack.charged, facing: fighter.facing,
      comboStep: attack.comboStep, animation: move.animation,
      box: attackBox(fighter, move)
    });
    if (move.projectileSpeed) spawnProjectile(room, fighter, move);
    if (!attack.selfEffectApplied && move.selfInvulnerableFrames) {
      attack.selfEffectApplied = true;
      fighter.invulnerableFrames = Math.max(fighter.invulnerableFrames, move.selfInvulnerableFrames);
      emitCombat(room, {
        kind: 'self-buff', actor: fighter.slot, character: fighter.character,
        move: attack.moveId, frames: move.selfInvulnerableFrames,
        x: fighter.x, y: fighter.y, facing: fighter.facing
      });
    }
  }

  if (move.dashSpeed && attack.phase === 'active') {
    fighter.vx = fighter.facing * move.dashSpeed;
  } else if (!attack.airborne) {
    fighter.vx = approach(fighter.vx, 0, 1.5);
  }
  if (attack.airborne) integrateAirAttack(room, fighter, attack, move);
  else integrate(room, fighter, false);

  if (attack.frame >= attack.total) {
    if (attack.moveId === 'light') {
      const sequence = comboSequenceFor(fighter, attack.airborneAtStart);
      fighter.comboIndex = sequence ? ((attack.comboStep ?? 0) + 1) % sequence.length : 0;
      fighter.comboTimer = characterFor(fighter).combos?.resetFrames || 24;
    }
    fighter.attack = null;
    if (grounded(fighter)) fighter.vx = 0;
    else fighter.vx *= 0.72;
    setState(fighter, grounded(fighter) ? 'IDLE' : 'FALL');
  }
}

function stepFighter(room, fighter, opponent) {
  const movement = characterFor(fighter).movement;
  updateBuffers(fighter);
  fighter.comboTimer = Math.max(0, fighter.comboTimer - 1);
  if (fighter.comboTimer === 0 && fighter.state !== 'ATTACK') fighter.comboIndex = 0;
  fighter.invulnerableFrames = Math.max(0, fighter.invulnerableFrames - 1);
  fighter.rollCooldown = Math.max(0, fighter.rollCooldown - 1);
  fighter.teleportCooldown = Math.max(0, fighter.teleportCooldown - 1);
  fighter.abilityCooldown = Math.max(0, fighter.abilityCooldown - 1);
  fighter.extraCooldown = Math.max(0, fighter.extraCooldown - 1);
  if (room.mode === 'training' && room.training.noCooldown && fighter.slot === 0) {
    fighter.rollCooldown = 0;
    fighter.teleportCooldown = 0;
    fighter.abilityCooldown = 0;
    fighter.extraCooldown = 0;
  }

  if (fighter.state === 'APPEAR' || fighter.state === 'KO' || fighter.state === 'ULTIMATE') {
    fighter.vx = 0;
    return;
  }

  if (fighter.state === 'HURT') {
    fighter.stunFrames = Math.max(0, fighter.stunFrames - 1);
    integrate(room, fighter, false);
    if (fighter.stunFrames === 0) setState(fighter, grounded(fighter) ? 'IDLE' : 'FALL');
    return;
  }

  if (fighter.state === 'SUPPORT') {
    stepSupport(room, fighter);
    return;
  }

  if (fighter.state === 'BLOCK') {
    fighter.vx = 0;
    fighter.stunFrames = Math.max(0, fighter.stunFrames - 1);
    if (fighter.stunFrames === 0 && !fighter.input.block) setState(fighter, 'IDLE');
    return;
  }

  if (fighter.state === 'LAND') {
    fighter.stateTimer -= 1;
    fighter.vx = approach(fighter.vx, 0, movement.deceleration);
    if (fighter.stateTimer <= 0) setState(fighter, 'IDLE');
    return;
  }

  if (fighter.state === 'ROLL') {
    fighter.stateFrame += 1;
    fighter.stateTimer -= 1;
    fighter.vx = approach(
      fighter.vx,
      fighter.facing * (movement.rollEndSpeed || DODGES.roll.endSpeed),
      movement.rollDeceleration || 0.45
    );
    integrate(room, fighter, false);
    if (fighter.stateTimer <= 0) {
      fighter.vx *= 0.35;
      setState(fighter, grounded(fighter) ? 'IDLE' : 'FALL');
    }
    return;
  }

  if (fighter.state === 'TELEPORT') {
    const teleportDistance = movement.teleportDistance || DODGES.teleport.distance;
    const warpFrame = movement.teleportWarpFrame || DODGES.teleport.warpFrame;
    fighter.stateFrame += 1;
    fighter.stateTimer -= 1;
    fighter.vx = 0;
    if (!fighter.teleported && fighter.stateFrame >= warpFrame) {
      fighter.teleported = true;
      const opponentAhead = fighter.facing > 0 ? opponent.x > fighter.x : opponent.x < fighter.x;
      const closeEnough = Math.abs(opponent.x - fighter.x) < teleportDistance + 70;
      const destination = opponentAhead && closeEnough
        ? opponent.x + fighter.facing * 58
        : fighter.x + fighter.facing * teleportDistance;
      fighter.x = clamp(destination, WORLD.minX, WORLD.maxX);
      releaseUnsupportedSurface(room, fighter);
      emitCombat(room, { kind: 'mobility', mobility: 'teleport-warp', actor: fighter.slot, character: fighter.character, x: fighter.x, y: fighter.y, facing: fighter.facing });
    }
    if (fighter.stateTimer <= 0) setState(fighter, grounded(fighter) ? 'IDLE' : 'FALL');
    return;
  }

  if (fighter.state === 'CHARGE') {
    fighter.vx = 0;
    if (fighter.input.special) {
      fighter.chargeFrames = Math.min(characterFor(fighter).charge.maxFrames, fighter.chargeFrames + 1);
    } else {
      const charged = fighter.chargeFrames >= characterFor(fighter).charge.thresholdFrames;
      beginAttack(fighter, charged ? 'chargedSpecial' : 'special', charged);
      fighter.chargeFrames = 0;
    }
    return;
  }

  if (fighter.state === 'ATTACK') {
    stepAttack(room, fighter);
    return;
  }

  const onGround = grounded(fighter);
  const direction = inputDirection(fighter.input);
  // Player direction owns facing. It is sampled before dodge/attack and then
  // locked by those states, so turning is readable and guard remains directional.
  if (direction) fighter.facing = direction;

  if (fighter.buffers.ultimate > 0 && fighter.ultimateEnergy >= ULTIMATE.maxEnergy) {
    consumeBuffer(fighter, 'ultimate');
    if (beginUltimate(room, fighter, opponent)) return;
  }

  if (fighter.input.block && onGround) {
    fighter.vx = 0;
    setState(fighter, 'BLOCK');
    return;
  }

  if (fighter.buffers.teleport > 0 && fighter.teleportCooldown === 0) {
    consumeBuffer(fighter, 'teleport');
    beginTeleport(room, fighter, direction);
    return;
  }

  if (fighter.buffers.roll > 0 && fighter.rollCooldown === 0 && onGround && direction) {
    consumeBuffer(fighter, 'roll');
    beginRoll(room, fighter, direction);
    return;
  }

  if (fighter.buffers.light > 0) {
    consumeBuffer(fighter, 'light');
    beginAttack(fighter, 'light');
    return;
  }

  if (fighter.buffers.special > 0) {
    consumeBuffer(fighter, 'special');
    if (characterFor(fighter).charge && onGround) {
      fighter.vx = 0;
      fighter.chargeFrames = 0;
      setState(fighter, 'CHARGE');
      emitCombat(room, { kind: 'charge', actor: fighter.slot, character: fighter.character, x: fighter.x, y: fighter.y - 42 });
    } else {
      beginAttack(fighter, 'special');
    }
    return;
  }

  if (fighter.buffers.ability > 0 && moveFor(fighter, 'ability') && fighter.abilityCooldown === 0) {
    consumeBuffer(fighter, 'ability');
    const abilityMove = !onGround && moveFor(fighter, 'airAbility') ? 'airAbility' : 'ability';
    fighter.abilityCooldown = moveFor(fighter, abilityMove).cooldown;
    beginAttack(fighter, abilityMove);
    return;
  }

  if (fighter.buffers.support > 0 && onGround && characterFor(fighter).support) {
    consumeBuffer(fighter, 'support');
    beginSupport(room, fighter);
    return;
  }

  if (fighter.buffers.extra > 0 && moveFor(fighter, 'extra') && fighter.extraCooldown === 0) {
    consumeBuffer(fighter, 'extra');
    fighter.extraCooldown = moveFor(fighter, 'extra').cooldown || 0;
    beginAttack(fighter, 'extra');
    return;
  }

  if (fighter.buffers.jump > 0 && beginJump(room, fighter)) consumeBuffer(fighter, 'jump');

  const airborne = !grounded(fighter);
  const acceleration = airborne ? movement.airAcceleration : movement.acceleration;
  const deceleration = airborne ? movement.airDeceleration : movement.deceleration;
  fighter.vx = direction
    ? approach(fighter.vx, direction * movement.runSpeed, acceleration)
    : approach(fighter.vx, 0, deceleration);
  integrate(room, fighter);

  if (!grounded(fighter) && fighter.vy > 0 && fighter.state !== 'LAND') setState(fighter, 'FALL');
  else if (!grounded(fighter) && fighter.vy <= 0) setState(fighter, 'JUMP');
  else if (fighter.state !== 'LAND') setState(fighter, Math.abs(fighter.vx) > 0.25 ? 'RUN' : 'IDLE');
}

function hurtbox(fighter) {
  const box = characterFor(fighter).hurtbox;
  return {
    x: fighter.x + box.offsetX - box.w / 2,
    y: fighter.y + box.offsetY - box.h / 2,
    w: box.w,
    h: box.h
  };
}

function attackBox(fighter, move) {
  const centerX = fighter.x + fighter.facing * move.hitbox.offsetX;
  return {
    x: centerX - move.hitbox.w / 2,
    y: fighter.y + move.hitbox.offsetY - move.hitbox.h / 2,
    w: move.hitbox.w,
    h: move.hitbox.h
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function frontGuard(attackerX, defender) {
  if (defender.state !== 'BLOCK') return false;
  const incomingDirection = Math.sign(attackerX - defender.x) || defender.facing;
  return incomingDirection === defender.facing;
}

function canDamageTrainingPlayer(room, defender) {
  return !(room.mode === 'training' && defender.slot === 0 && room.training.invulnerable);
}

function gainUltimateEnergy(room, fighter) {
  const previous = fighter.ultimateEnergy;
  fighter.ultimateEnergy = Math.min(ULTIMATE.maxEnergy, fighter.ultimateEnergy + 1);
  if (fighter.ultimateEnergy === previous) return;
  emitCombat(room, {
    kind: 'ultimate-energy', actor: fighter.slot, character: fighter.character,
    energy: fighter.ultimateEnergy, maxEnergy: ULTIMATE.maxEnergy,
    ready: fighter.ultimateEnergy >= ULTIMATE.maxEnergy,
    x: fighter.x, y: fighter.y, facing: fighter.facing
  });
}

function dealDamage(room, attacker, defender, move, impactX, projectileId = null, options = {}) {
  if (!canDamageTrainingPlayer(room, defender)) {
    emitCombat(room, { kind: 'evade', actor: defender.slot, character: defender.character, x: defender.x, y: defender.y - 42 });
    return;
  }
  if (defender.invulnerableFrames > 0 || defender.state === 'KO') {
    emitCombat(room, { kind: 'evade', actor: defender.slot, character: defender.character, x: defender.x, y: defender.y - 42 });
    return;
  }

  const blocked = frontGuard(impactX, defender);
  const damage = blocked ? move.chip : move.damage;
  const keepFullHp = room.mode === 'training' && defender.slot === 0 && room.training.infiniteHp;
  defender.hp = keepFullHp ? defender.maxHp : Math.max(0, defender.hp - damage);
  defender.attack = null;
  defender.support = null;
  defender.chargeFrames = 0;
  defender.stunFrames = blocked ? move.blockstun : move.hitstun;
  if (blocked) {
    defender.vx = 0;
    defender.vy = 0;
    setState(defender, 'BLOCK');
  } else {
    defender.vx = attacker.facing * move.knockbackX;
    defender.vy = move.knockbackY;
    setState(defender, 'HURT');
  }
  room.hitstopFrames = Math.max(room.hitstopFrames, move.hitstop);

  if (room.mode === 'training' && defender.slot === 1) {
    defender.hp = Math.max(1, defender.hp);
    defender.regenAt = room.tick + 90;
  }

  emitCombat(room, {
    kind: 'hit', actor: attacker.slot, target: defender.slot,
    character: attacker.character, targetCharacter: defender.character,
    move: move.id, blocked, damage, projectileId, facing: attacker.facing,
    x: defender.x, y: defender.y - 42, hitstopMs: Math.round(move.hitstop * FRAME_MS)
  });

  if (!options.noEnergy && move.id !== 'ultimate') gainUltimateEnergy(room, attacker);

  if (defender.hp <= 0) {
    setState(defender, 'KO');
    defender.vx = 0;
    defender.vy = 0;
    if (!options.deferRoundEnd) finishRound(room, attacker.slot);
  }
}

function resolveMeleeHit(room, attacker, defender) {
  const attack = attacker.attack;
  if (!attack || attack.phase !== 'active' || attack.hitTargets.has(defender.slot)) return;
  const move = attackMoveFor(attacker, attack);
  if (move.projectileSpeed) return;
  if (!overlaps(attackBox(attacker, move), hurtbox(defender))) return;
  attack.hitTargets.add(defender.slot);
  dealDamage(room, attacker, defender, move, attacker.x);
}

function spawnProjectile(room, fighter, move) {
  if (!fighter.attack || fighter.attack.projectileSpawned) return;
  fighter.attack.projectileSpawned = true;
  const projectile = {
    id: room.nextProjectileId++,
    owner: fighter.slot,
    character: fighter.character,
    moveId: move.id,
    x: fighter.x + fighter.facing * (move.projectileOffsetX || 38),
    y: fighter.y + move.hitbox.offsetY,
    vx: move.projectileDirection === 'down' ? fighter.facing * Math.min(2.4, move.projectileSpeed * .2) : fighter.facing * move.projectileSpeed,
    vy: move.projectileDirection === 'down' ? move.projectileSpeed : (move.projectileVelocityY || 0),
    facing: fighter.facing,
    w: move.projectileWidth || 20,
    h: move.projectileHeight || 16,
    life: move.projectileLife || 100
  };
  room.projectiles.push(projectile);
  emitCombat(room, { kind: 'projectile-spawn', ...projectile });
}

function stepProjectiles(room) {
  for (let index = room.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = room.projectiles[index];
    projectile.x += projectile.vx;
    projectile.y += projectile.vy || 0;
    projectile.life -= 1;
    const owner = room.fighters[projectile.owner];
    const defender = room.fighters[projectile.owner === 0 ? 1 : 0];
    const box = {
      x: projectile.x - projectile.w / 2,
      y: projectile.y - projectile.h / 2,
      w: projectile.w,
      h: projectile.h
    };
    if (overlaps(box, hurtbox(defender)) && defender.state !== 'KO') {
      dealDamage(room, owner, defender, moveFor(owner, projectile.moveId), projectile.x, projectile.id);
      room.projectiles.splice(index, 1);
      continue;
    }
    if (projectile.life <= 0 || projectile.x < -48 || projectile.x > WORLD.width + 48 || projectile.y > WORLD.height + 48 || projectile.y < -48) {
      emitCombat(room, { kind: 'projectile-end', id: projectile.id });
      room.projectiles.splice(index, 1);
    }
  }
}

function resolveBodyPush(a, b) {
  if (['TELEPORT', 'ROLL', 'KO'].includes(a.state) || ['TELEPORT', 'ROLL', 'KO'].includes(b.state)) return;
  const aBox = hurtbox(a);
  const bBox = hurtbox(b);
  if (aBox.y + aBox.h <= bBox.y || bBox.y + bBox.h <= aBox.y) return;
  const minimum = (aBox.w + bBox.w) / 2 + 3;
  const delta = b.x - a.x;
  if (Math.abs(delta) >= minimum) return;
  const direction = delta === 0 ? 1 : Math.sign(delta);
  const correction = (minimum - Math.abs(delta)) / 2;
  a.x = clamp(a.x - direction * correction, WORLD.minX, WORLD.maxX);
  b.x = clamp(b.x + direction * correction, WORLD.minX, WORLD.maxX);
}

function leadingFighterSlot(room) {
  const [a, b] = room.fighters;
  if (a.wins === b.wins) return null;
  return a.wins > b.wins ? 0 : 1;
}

function finishRound(room, winnerSlot = null) {
  if (room.phase !== 'fight') return;
  if (room.mode === 'training') return;
  if (Number.isInteger(winnerSlot)) room.fighters[winnerSlot].wins += 1;
  room.roundWinner = Number.isInteger(winnerSlot) ? winnerSlot : null;
  const someoneWon = room.fighters.some((f) => f.wins >= WINS_NEEDED);
  const finalRound = room.round >= MAX_ROUNDS || someoneWon;
  room.phase = finalRound ? 'match-over' : 'round-over';
  room.matchWinner = finalRound ? leadingFighterSlot(room) : null;
  room.roundEndFrames = 180;
  emitRoom(room, 'match:phase', { phase: room.phase, winner: winnerSlot, round: room.round });
}

function finishByTimer(room) {
  const [a, b] = room.fighters;
  if (a.hp === b.hp) {
    finishRound(room, null);
    return;
  }
  finishRound(room, a.hp > b.hp ? 0 : 1);
}

function prepareTrainingDummy(room) {
  if (room.mode !== 'training') return;
  const player = room.fighters[0];
  const dummy = room.fighters[1];
  dummy.input = blankInput();
  if (room.training.freezeDummy) {
    dummy.vx = 0;
    dummy.vy = 0;
    if (!['HURT', 'BLOCK'].includes(dummy.state)) setState(dummy, 'IDLE');
  }
  if (room.training.dummyGuard && !['HURT', 'KO'].includes(dummy.state)) {
    dummy.facing = Math.sign(player.x - dummy.x) || dummy.facing;
    dummy.input.block = true;
  }
  if (dummy.regenAt && room.tick >= dummy.regenAt && dummy.state !== 'HURT') {
    dummy.hp = dummy.maxHp;
    dummy.regenAt = 0;
  }
}

function setAiDirection(input, direction) {
  input.left = direction < 0;
  input.right = direction > 0;
}

function preparePveAI(room) {
  if (room.mode !== 'pve') return;
  const player = room.fighters[0];
  const cpu = room.fighters[1];
  if (cpu.state === 'KO') {
    cpu.input = blankInput();
    return;
  }

  if (room.tick < room.ai.nextDecisionTick) {
    cpu.input = { ...room.ai.input };
    return;
  }

  const profile = AI_DIFFICULTIES[room.aiDifficulty] || AI_DIFFICULTIES.normal;
  const input = blankInput();
  const delta = player.x - cpu.x;
  const distance = Math.abs(delta);
  const toward = Math.sign(delta) || cpu.facing;
  const away = -toward;
  const cpuCharacter = characterFor(cpu);
  const onGround = grounded(cpu);
  const attackerMove = player.attack ? attackMoveFor(player, player.attack) : null;
  const attackerFacesCpu = Math.sign(cpu.x - player.x) === player.facing;
  const threatReach = attackerMove
    ? Math.abs(attackerMove.hitbox.offsetX) + attackerMove.hitbox.w / 2 + 26
    : 0;
  const threatened = Boolean(
    attackerMove
    && attackerFacesCpu
    && ['startup', 'active'].includes(player.attack.phase)
    && distance <= threatReach
  );

  let planFrames = profile.reactionFrames + Math.floor(Math.random() * (profile.jitterFrames + 1));
  const canUltimate = cpu.ultimateEnergy >= ULTIMATE.maxEnergy && Boolean(cpuCharacter.moves.ultimate);
  if (canUltimate && Math.random() < profile.ultimateChance) {
    input.ultimate = true;
    planFrames = 8;
  } else if (onGround && cpu.hp <= 48 && cpuCharacter.support?.stages?.[cpu.supportUses] && Math.random() < .48) {
    input.support = true;
    planFrames = 18;
  } else if (threatened && Math.random() < profile.guardChance) {
    if (onGround && Math.random() < profile.dodgeChance) {
      setAiDirection(input, away);
      if (cpu.teleportCooldown === 0 && Math.random() < 0.42) input.teleport = true;
      else input.roll = true;
    } else {
      // Supplying the toward direction makes the server orient the guard at
      // the attacker before BLOCK is evaluated; movement is still locked.
      setAiDirection(input, toward);
      input.block = true;
    }
  } else if (distance > profile.preferredRange + 48) {
    setAiDirection(input, toward);
    const canThrow = Boolean(cpuCharacter.moves.ability) && cpu.abilityCooldown === 0;
    if (canThrow && distance < 430 && Math.random() < profile.abilityChance) {
      input.ability = true;
    } else if (distance < 280 && Math.random() < profile.specialChance * 0.55) {
      input.special = true;
    } else if (onGround && Math.random() < profile.jumpChance) {
      input.jump = true;
    }
  } else if (Math.random() < profile.aggression) {
    setAiDirection(input, toward);
    const canThrow = Boolean(cpuCharacter.moves.ability) && cpu.abilityCooldown === 0;
    const attackRoll = Math.random();
    if (canThrow && distance > 105 && attackRoll < profile.abilityChance) {
      input.ability = true;
    } else if (cpuCharacter.moves.extra && cpu.extraCooldown === 0 && attackRoll < profile.abilityChance + .12) {
      input.extra = true;
    } else if (attackRoll < profile.specialChance + 0.18) {
      input.special = true;
      if (cpuCharacter.charge && Math.random() < profile.chargeChance) {
        planFrames = cpuCharacter.charge.thresholdFrames + 5;
      }
    } else {
      input.light = true;
    }
  } else if (onGround && Math.random() < profile.dodgeChance) {
    setAiDirection(input, away);
    input.roll = true;
  } else {
    setAiDirection(input, toward);
    input.block = Math.random() < profile.guardChance * 0.7;
  }

  room.ai.input = input;
  room.ai.nextDecisionTick = room.tick + Math.max(3, planFrames);
  cpu.input = { ...input };
}

function expireStaleInput(room) {
  const now = Date.now();
  room.fighters.forEach((fighter) => {
    if (['training', 'pve'].includes(room.mode) && fighter.slot === 1) return;
    if (now - fighter.lastInputAt > NETWORK.inputTimeoutMs) fighter.input = blankInput();
  });
}

function stepRoom(room) {
  room.tick += 1;

  if (room.phase === 'waiting') {
    if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
    return;
  }

  if (room.mode === 'training' && room.training.paused && room.trainingStepFrames <= 0) {
    if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
    return;
  }
  if (room.trainingStepFrames > 0) room.trainingStepFrames -= 1;

  if (room.phase === 'intro') {
    room.introFrames -= 1;
    if (room.introFrames <= 0) beginFight(room);
    if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
    return;
  }

  if (['round-over', 'match-over'].includes(room.phase)) {
    room.roundEndFrames -= 1;
    if (room.phase === 'round-over' && room.roundEndFrames <= 0) {
      room.round += 1;
      startRound(room);
    }
    if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
    return;
  }

  if (room.phase !== 'fight') return;
  expireStaleInput(room);

  if (room.ultimate) {
    stepUltimate(room);
    room.fighters.forEach((fighter) => { fighter.previousInput = { ...fighter.input }; });
    if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
    return;
  }

  prepareTrainingDummy(room);
  preparePveAI(room);

  if (room.hitstopFrames > 0) {
    room.hitstopFrames -= 1;
    if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
    return;
  }

  stepFighter(room, room.fighters[0], room.fighters[1]);
  if (room.ultimate) {
    room.fighters.forEach((fighter) => { fighter.previousInput = { ...fighter.input }; });
    if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
    return;
  }
  stepFighter(room, room.fighters[1], room.fighters[0]);
  if (room.ultimate) {
    room.fighters.forEach((fighter) => { fighter.previousInput = { ...fighter.input }; });
    if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
    return;
  }
  resolveBodyPush(room.fighters[0], room.fighters[1]);
  resolveMeleeHit(room, room.fighters[0], room.fighters[1]);
  resolveMeleeHit(room, room.fighters[1], room.fighters[0]);
  stepProjectiles(room);

  if (room.roundTimer > 0) {
    room.roundTimer -= 1;
    if (room.roundTimer <= 0) finishByTimer(room);
  }

  room.fighters.forEach((fighter) => {
    fighter.previousInput = { ...fighter.input };
  });
  if (room.tick % SNAPSHOT_EVERY === 0) emitSnapshot(room);
}

function fighterSnapshot(fighter) {
  const move = fighter.attack ? attackMoveFor(fighter, fighter.attack) : null;
  return {
    slot: fighter.slot,
    character: fighter.character,
    x: Number(fighter.x.toFixed(2)),
    y: Number(fighter.y.toFixed(2)),
    vx: Number(fighter.vx.toFixed(2)),
    vy: Number(fighter.vy.toFixed(2)),
    facing: fighter.facing,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    wins: fighter.wins,
    state: fighter.state,
    stateFrame: fighter.stateFrame,
    surfaceId: fighter.surfaceId,
    surfaceY: fighter.surfaceY,
    invulnerable: fighter.invulnerableFrames > 0,
    chargeFrames: fighter.chargeFrames,
    comboIndex: fighter.comboIndex,
    supportUses: fighter.supportUses,
    ultimateEnergy: fighter.ultimateEnergy,
    ultimateMax: ULTIMATE.maxEnergy,
    cooldowns: {
      roll: fighter.rollCooldown,
      teleport: fighter.teleportCooldown,
      ability: fighter.abilityCooldown,
      extra: fighter.extraCooldown
    },
    hurtbox: characterFor(fighter).hurtbox,
    attack: fighter.attack ? {
      moveId: fighter.attack.moveId,
      frame: fighter.attack.frame,
      phase: fighter.attack.phase,
      total: fighter.attack.total,
      charged: fighter.attack.charged,
      comboStep: fighter.attack.comboStep,
      data: move
    } : null,
    support: fighter.support ? {
      stageIndex: fighter.support.stageIndex,
      animation: fighter.support.animation,
      label: fighter.support.label,
      frame: fighter.support.frame,
      duration: fighter.support.duration
    } : null
  };
}

function roomSnapshot(room) {
  return {
    version: GAME.version,
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    tick: room.tick,
    round: room.round,
    roundWinner: room.roundWinner,
    matchWinner: room.matchWinner,
    timer: room.roundTimer < 0 ? null : Math.max(0, Math.ceil(room.roundTimer / NETWORK.tickRate)),
    intro: room.phase === 'intro' ? Math.max(0, Math.ceil(room.introFrames / NETWORK.tickRate)) : 0,
    fighters: room.fighters.map(fighterSnapshot),
    projectiles: room.projectiles.map((projectile) => ({ ...projectile })),
    ultimate: room.ultimate ? {
      actor: room.ultimate.actor,
      target: room.ultimate.target,
      character: room.ultimate.character,
      frame: room.ultimate.frame,
      phase: room.ultimate.phase,
      introFrames: ULTIMATE.introFrames,
      totalFrames: ULTIMATE.introFrames + ULTIMATE.aftermathFrames
    } : null,
    training: room.mode === 'training' ? { ...room.training } : null,
    aiDifficulty: room.mode === 'pve' ? room.aiDifficulty : null,
    mapId: room.mapId,
    occupied: room.seats.filter(Boolean).length
  };
}

function emitSnapshot(room) {
  emitRoom(room, 'room:state', roomSnapshot(room));
}

function emitRoom(room, event, payload) {
  io.to(room.code).emit(event, payload);
}

function emitCombat(room, payload) {
  emitRoom(room, 'combat:event', { tick: room.tick, ...payload });
}

function leaveCurrentRoom(socket, notify = true) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = null;
  if (!room) return;

  room.seats = room.seats.map((id) => (id === socket.id ? null : id));
  const remaining = [...new Set(room.seats.filter(Boolean))];
  if (remaining.length === 0 || room.mode !== 'online') {
    rooms.delete(code);
    return;
  }
  room.phase = 'waiting';
  room.projectiles = [];
  room.ultimate = null;
  if (notify) emitRoom(room, 'room:notice', { message: 'Đối thủ đã rời phòng. Đang chờ người chơi mới.' });
  emitSnapshot(room);
}

function joinSocketToRoom(socket, room) {
  leaveCurrentRoom(socket, false);
  socket.join(room.code);
  socket.data.roomCode = room.code;
  room.lastActivityAt = Date.now();
}

function responseError(callback, message) {
  if (typeof callback === 'function') callback({ ok: false, message });
}

function requireCurrentClient(payload, callback) {
  const clientVersion = String(payload?.clientVersion || '').trim();
  if (clientVersion === GAME.version) return true;
  responseError(
    callback,
    `Client ${clientVersion || 'cũ'} không khớp server ${GAME.version}. Hãy nhấn Ctrl+F5 để tải bản mới.`
  );
  return false;
}

io.on('connection', (socket) => {
  socket.data.roomCode = null;

  socket.on('net:ping', (payload, callback) => {
    callback?.({ clientSentAt: Number(payload?.clientSentAt) || 0, serverAt: Date.now() });
  });

  socket.on('room:create', (payload, callback) => {
    if (!requireCurrentClient(payload, callback)) return;
    try {
      const mode = VALID_MODES.has(payload?.mode) ? payload.mode : 'training';
      const characters = [sanitizeCharacter(payload?.characters?.[0]), sanitizeCharacter(payload?.characters?.[1])];
      const room = createRoom(mode, socket.id, characters, {
        difficulty: payload?.difficulty,
        mapId: payload?.mapId
      });
      joinSocketToRoom(socket, room);
      const controlledSlots = [0];
      callback?.({ ok: true, code: room.code, mode, seat: 0, controlledSlots, state: roomSnapshot(room) });
      emitSnapshot(room);
    } catch (_error) {
      responseError(callback, 'Không tạo được phòng lúc này.');
    }
  });

  socket.on('room:join', (payload, callback) => {
    if (!requireCurrentClient(payload, callback)) return;
    const code = String(payload?.code || '').trim();
    if (!ROOM_CODE.test(code)) return responseError(callback, 'Mã phòng phải có đúng 4 chữ số.');
    const room = rooms.get(code);
    if (!room || room.mode !== 'online') return responseError(callback, 'Không tìm thấy phòng online này.');
    if (room.seats[1] && room.seats[1] !== socket.id) return responseError(callback, 'Phòng đã đủ 2 người.');
    joinSocketToRoom(socket, room);
    room.seats[1] = socket.id;
    room.fighters[1].character = sanitizeCharacter(payload?.character);
    room.round = 1;
    room.roundWinner = null;
    room.matchWinner = null;
    room.fighters.forEach((fighter) => { fighter.wins = 0; });
    callback?.({ ok: true, code, mode: 'online', seat: 1, controlledSlots: [1], state: roomSnapshot(room) });
    startRound(room);
  });

  socket.on('player:input', (payload) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    let slot = Number(payload?.slot);
    if (room.mode === 'online') slot = room.seats[0] === socket.id ? 0 : room.seats[1] === socket.id ? 1 : -1;
    if (['training', 'pve'].includes(room.mode)) slot = 0;
    if (slot !== 0 && slot !== 1) return;
    if (room.seats[slot] !== socket.id) return;
    const fighter = room.fighters[slot];
    const sequence = Number.isFinite(payload?.sequence) ? payload.sequence : fighter.inputSequence + 1;
    if (sequence <= fighter.inputSequence) return;
    fighter.inputSequence = sequence;
    fighter.input = sanitizeInput(payload?.input);
    fighter.lastInputAt = Date.now();
    room.lastActivityAt = fighter.lastInputAt;
  });

  socket.on('training:update', (payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.mode !== 'training' || room.ownerId !== socket.id) return responseError(callback, 'Thiết lập này chỉ dùng trong Training.');
    for (const key of Object.keys(room.training)) {
      if (Object.prototype.hasOwnProperty.call(payload || {}, key)) room.training[key] = payload[key] === true;
    }
    callback?.({ ok: true, training: { ...room.training } });
    emitSnapshot(room);
  });

  socket.on('training:step', () => {
    const room = rooms.get(socket.data.roomCode);
    if (room?.mode === 'training' && room.ownerId === socket.id && room.training.paused) room.trainingStepFrames += 1;
  });

  socket.on('training:ultimate', (payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.mode !== 'training' || room.ownerId !== socket.id) {
      return responseError(callback, 'Nạp Ultimate chỉ dùng cho P1 trong Training.');
    }
    const fighter = room.fighters[0];
    fighter.ultimateEnergy = payload?.full === false ? 0 : ULTIMATE.maxEnergy;
    emitCombat(room, {
      kind: 'ultimate-energy', actor: 0, character: fighter.character,
      energy: fighter.ultimateEnergy, maxEnergy: ULTIMATE.maxEnergy,
      ready: fighter.ultimateEnergy >= ULTIMATE.maxEnergy,
      x: fighter.x, y: fighter.y, facing: fighter.facing
    });
    emitSnapshot(room);
    callback?.({ ok: true, energy: fighter.ultimateEnergy });
  });

  socket.on('training:ultimate-use', (_payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.mode !== 'training' || room.ownerId !== socket.id) {
      return responseError(callback, 'Kích hoạt Ultimate trực tiếp chỉ dùng cho P1 trong Training.');
    }
    if (room.phase !== 'fight' || room.ultimate) {
      return responseError(callback, 'Ultimate chưa thể bắt đầu ở trạng thái hiện tại.');
    }
    const fighter = room.fighters[0];
    fighter.ultimateEnergy = ULTIMATE.maxEnergy;
    if (!beginUltimate(room, fighter, room.fighters[1])) {
      return responseError(callback, 'Không thể khởi động Ultimate.');
    }
    emitSnapshot(room);
    callback?.({ ok: true });
  });

  socket.on('training:reset', () => {
    const room = rooms.get(socket.data.roomCode);
    if (room?.mode !== 'training' || room.ownerId !== socket.id) return;
    room.round = 1;
    room.roundWinner = null;
    room.matchWinner = null;
    room.fighters.forEach((fighter) => { fighter.wins = 0; });
    startRound(room);
  });

  socket.on('match:rematch', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'match-over') return;
    room.rematchVotes.add(socket.id);
    const required = room.mode === 'online' ? 2 : 1;
    if (room.rematchVotes.size >= required) {
      room.round = 1;
      room.roundWinner = null;
      room.matchWinner = null;
      room.fighters.forEach((fighter) => { fighter.wins = 0; });
      room.rematchVotes.clear();
      startRound(room);
    } else {
      emitRoom(room, 'room:notice', { message: 'Đã gửi yêu cầu tái đấu.' });
    }
  });

  socket.on('room:leave', () => leaveCurrentRoom(socket));
  socket.on('disconnect', () => leaveCurrentRoom(socket));
});

let previousTime = performance.now();
let accumulator = 0;
setInterval(() => {
  const now = performance.now();
  accumulator += Math.min(250, now - previousTime);
  previousTime = now;
  let steps = 0;
  while (accumulator >= FRAME_MS && steps < 5) {
    for (const room of rooms.values()) stepRoom(room);
    accumulator -= FRAME_MS;
    steps += 1;
  }
}, 4).unref();

setInterval(() => {
  const staleBefore = Date.now() - 30 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.lastActivityAt < staleBefore || room.seats.every((seat) => !seat)) rooms.delete(code);
  }
}, 60 * 1000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pixel Clash v${GAME.version} listening on http://0.0.0.0:${PORT}`);
});
