'use strict';

const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const GAME = require('../public/shared/game-data.js');

const SERVER_URL = process.env.PIXEL_CLASH_URL || 'http://127.0.0.1:3000';
const INPUT_KEYS = Object.freeze([
  'left', 'right', 'jump', 'light', 'special', 'roll', 'teleport',
  'block', 'ability', 'support', 'extra', 'ultimate'
]);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function neutralInput(overrides = {}) {
  return Object.assign(Object.fromEntries(INPUT_KEYS.map((key) => [key, false])), overrides);
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timed out`)), 4000);
    socket.emit(event, payload, (result) => {
      clearTimeout(timer);
      if (!result?.ok) reject(new Error(result?.message || `${event} failed`));
      else resolve(result);
    });
  });
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 4000 });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function waitForObservation(harness, marker, predicate, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = harness.states.slice(marker).find(predicate);
    if (match) return match;
    await sleep(20);
  }
  throw new Error(`${harness.character}: did not observe ${label}`);
}

async function waitForIdle(harness, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const fighter = harness.states.at(-1)?.fighters?.[0];
    if (fighter?.state === 'IDLE' && !fighter.attack && !fighter.support) return fighter;
    await sleep(20);
  }
  throw new Error(`${harness.character}: did not return to IDLE`);
}

function sendInput(harness, overrides = {}) {
  harness.sequence += 1;
  harness.socket.emit('player:input', {
    slot: 0,
    sequence: harness.sequence,
    input: neutralInput(overrides)
  });
}

async function holdInput(harness, key, milliseconds) {
  const pulse = () => sendInput(harness, { [key]: true });
  pulse();
  const timer = setInterval(pulse, 120);
  await sleep(milliseconds);
  clearInterval(timer);
  sendInput(harness);
}

async function tapInput(harness, key, milliseconds = 100) {
  await holdInput(harness, key, milliseconds);
}

async function createHarness(character) {
  const socket = await connectSocket();
  const harness = { socket, character, states: [], events: [], sequence: 0 };
  socket.on('room:state', (state) => harness.states.push(state));
  socket.on('combat:event', (event) => harness.events.push(event));
  const created = await emitAck(socket, 'room:create', {
    mode: 'training',
    characters: [character, 'buck'],
    mapId: 'desert',
    clientVersion: GAME.version
  });
  harness.states.push(created.state);
  await waitForObservation(harness, 0, (state) => state.phase === 'fight', 'fight phase', 5000);
  return harness;
}

async function verifyCombo(harness, definition) {
  const sequence = definition.combos?.ground || [];
  const base = definition.moves.light;
  if (!sequence.length) {
    const marker = harness.states.length;
    const eventMarker = harness.events.length;
    const moveFrames = base.startup + base.active + base.recovery;
    await holdInput(harness, 'light', Math.ceil(moveFrames * 2.6 * 1000 / GAME.NETWORK.tickRate));
    const repetitions = harness.events.slice(eventMarker)
      .filter((event) => event.kind === 'attack-active' && event.move === 'light').length;
    assert.ok(repetitions >= 2, `${harness.character}: held J did not auto-repeat`);
    await waitForObservation(harness, marker,
      (state) => state.fighters[0].attack?.moveId === 'light', 'held J light attack');
    await waitForIdle(harness);
    return { comboSteps: 1, lightRepetitions: repetitions };
  }
  const cycleFrames = sequence.reduce((total, step) => total
    + (step.startup ?? base.startup)
    + (step.active ?? base.active)
    + (step.recovery ?? base.recovery), 0);
  const marker = harness.states.length;
  await holdInput(harness, 'light', Math.ceil(cycleFrames * 1000 / GAME.NETWORK.tickRate) + 650);
  const observed = new Set(
    harness.states.slice(marker)
      .map((state) => state.fighters[0].attack)
      .filter((attack) => attack?.moveId === 'light')
      .map((attack) => attack.comboStep)
  );
  assert.equal(observed.size, sequence.length,
    `${harness.character}: expected ${sequence.length} combo steps, saw ${[...observed].join(', ')}`);
  await waitForIdle(harness);
  return { comboSteps: observed.size, lightRepetitions: null };
}

async function verifyCharge(harness, definition) {
  if (!definition.charge || !definition.moves.special) return { charged: false };
  const marker = harness.states.length;
  const holdMs = Math.ceil((definition.charge.thresholdFrames + 8) * 1000 / GAME.NETWORK.tickRate);
  await holdInput(harness, 'special', holdMs);
  const chargeState = await waitForObservation(harness, marker,
    (state) => state.fighters[0].state === 'CHARGE'
      && state.fighters[0].chargeFrames >= definition.charge.thresholdFrames,
    'full K charge');
  const attackState = await waitForObservation(harness, marker,
    (state) => state.fighters[0].attack?.moveId === 'chargedSpecial'
      && state.fighters[0].attack?.charged === true,
    'charged special release');
  assert.ok(attackState.fighters[0].attack.data.hitbox.w >= definition.moves.special.hitbox.w * 2.1,
    `${harness.character}: charged hitbox is not at least 2.1x the normal K width`);
  await waitForIdle(harness, 4000);
  return { charged: true, chargeFrames: chargeState.fighters[0].chargeFrames };
}

async function verifyExtra(harness, definition) {
  if (!definition.moves.extra) return { extra: false };
  const marker = harness.states.length;
  await tapInput(harness, 'extra');
  const state = await waitForObservation(harness, marker,
    (snapshot) => snapshot.fighters[0].attack?.moveId === 'extra', 'P extra move');
  assert.equal(state.fighters[0].attack.data.animation, definition.moves.extra.animation,
    `${harness.character}: P animation mismatch`);
  await waitForIdle(harness, 4000);
  return { extra: true };
}

async function verifySupport(harness, definition) {
  const stages = definition.support?.stages || [];
  if (!stages.length) return { supportStages: 0 };
  for (let index = 0; index < stages.length; index += 1) {
    const marker = harness.states.length;
    await tapInput(harness, 'support');
    const supportState = await waitForObservation(harness, marker,
      (state) => state.fighters[0].support?.stageIndex === index, `O support stage ${index + 1}`);
    assert.equal(supportState.fighters[0].support.animation, stages[index].animation,
      `${harness.character}: support animation mismatch at stage ${index + 1}`);
    await waitForIdle(harness, Math.ceil(stages[index].duration * 1000 / GAME.NETWORK.tickRate) + 1200);
  }
  const before = harness.states.at(-1).fighters[0].supportUses;
  const eventMarker = harness.events.length;
  await tapInput(harness, 'support');
  await sleep(180);
  const after = harness.states.at(-1).fighters[0].supportUses;
  assert.equal(before, stages.length, `${harness.character}: support use count mismatch`);
  assert.equal(after, before, `${harness.character}: support exceeded its use limit`);
  assert.ok(harness.events.slice(eventMarker).some((event) => event.kind === 'support-empty'),
    `${harness.character}: missing support-empty feedback`);
  return { supportStages: stages.length };
}

async function verifyCharacter(character) {
  const definition = GAME.CHARACTERS[character];
  const harness = await createHarness(character);
  try {
    const combo = await verifyCombo(harness, definition);
    const charge = await verifyCharge(harness, definition);
    const extra = await verifyExtra(harness, definition);
    const support = await verifySupport(harness, definition);
    return { character, ...combo, ...charge, ...extra, ...support };
  } finally {
    harness.socket.emit('room:leave');
    harness.socket.disconnect();
  }
}

async function main() {
  const health = await fetch(`${SERVER_URL}/health`).then((response) => response.json());
  assert.equal(health.version, GAME.version, 'client/server version mismatch');
  const characters = Object.keys(GAME.CHARACTERS);
  const results = await Promise.all(characters.map(verifyCharacter));
  console.log(`Combat smoke OK: ${results.length} characters on server ${health.version}`);
  results.forEach((result) => console.log(
    `- ${result.character}: Jx${result.comboSteps}${result.lightRepetitions ? ` (loop ${result.lightRepetitions})` : ''}, K=${result.charged ? 'charged' : 'n/a'}, `
    + `O=${result.supportStages}, P=${result.extra ? 'yes' : 'n/a'}`
  ));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
