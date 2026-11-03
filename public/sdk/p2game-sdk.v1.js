/* @p2game.io/sdk v1.1 — https://dev.p2game.io/docs/sdk */
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __typeError = (msg) => {
    throw TypeError(msg);
  };
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
  var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
  var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
  var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
  var __privateWrapper = (obj, member, setter, getter) => ({
    set _(value) {
      __privateSet(obj, member, value, setter);
    },
    get _() {
      return __privateGet(obj, member, getter);
    }
  });

  // src/protocol.ts
  var SDK_PROTOCOL_VERSION = "1.0";
  var SDK_MESSAGE_NAMESPACE = "p2game";
  var REALTIME_LIMITS = {
    /** Trần số người một phòng mà manifest được phép khai. */
    maxPlayersCeiling: 16,
    minPlayers: 2,
    /** Kích thước một thông điệp sau khi JSON hoá. */
    maxMessageBytes: 8 * 1024,
    /** Tốc độ gửi bền vững (thông điệp/giây) và mức dồn tối đa cho mỗi người. */
    messagesPerSecond: 30,
    messageBurst: 60,
    /** Trạng thái phòng (chủ phòng ghi) và trạng thái riêng từng người. */
    maxRoomStateBytes: 32 * 1024,
    maxPlayerStateBytes: 4 * 1024,
    maxMetadataBytes: 1024,
    /** Tên loại thông điệp do game tự đặt. */
    maxMessageTypeLength: 32,
    /** Mất kết nối trong ngần này thì vẫn giữ chỗ trong phòng để nối lại. */
    reconnectGraceMs: 15e3,
    /** Mã mời vào phòng: chữ in hoa và số, bỏ các ký tự dễ nhầm (0/O, 1/I). */
    codeLength: 6,
    maxRoomsListed: 50,
    /** Phòng không có hoạt động gì trong ngần này thì bị dọn. */
    idleRoomTtlSeconds: 3600
  };

  // src/rooms.ts
  var _snap, _transport, _handlers, _unsubs, _closed, _onClosed, _Room_instances, wire_fn, close_fn, assertOpen_fn, listen_fn, emit_fn;
  var Room = class {
    /** @internal — game lấy phòng qua `p2.rooms.create/join/quickMatch`, không tự dựng. */
    constructor(snapshot, transport, onClosed) {
      __privateAdd(this, _Room_instances);
      __privateAdd(this, _snap);
      __privateAdd(this, _transport);
      __privateAdd(this, _handlers, /* @__PURE__ */ new Map());
      __privateAdd(this, _unsubs, []);
      __privateAdd(this, _closed, false);
      __privateAdd(this, _onClosed);
      __privateSet(this, _snap, snapshot);
      __privateSet(this, _transport, transport);
      __privateSet(this, _onClosed, onClosed);
      __privateMethod(this, _Room_instances, wire_fn).call(this);
    }
    get id() {
      return __privateGet(this, _snap).id;
    }
    /** Mã mời ngắn, đưa cho bạn bè gõ vào `p2.rooms.join(code)`. */
    get code() {
      return __privateGet(this, _snap).code;
    }
    get hostId() {
      return __privateGet(this, _snap).hostId;
    }
    /** Chủ phòng là người duy nhất ghi được trạng thái phòng — thường cũng là trọng tài của ván. */
    get isHost() {
      return __privateGet(this, _snap).hostId === __privateGet(this, _snap).selfId;
    }
    get selfId() {
      return __privateGet(this, _snap).selfId;
    }
    get self() {
      return this.player(__privateGet(this, _snap).selfId);
    }
    get players() {
      return __privateGet(this, _snap).players;
    }
    get maxPlayers() {
      return __privateGet(this, _snap).maxPlayers;
    }
    get visibility() {
      return __privateGet(this, _snap).visibility;
    }
    get locked() {
      return __privateGet(this, _snap).locked;
    }
    get metadata() {
      return __privateGet(this, _snap).metadata;
    }
    get state() {
      return __privateGet(this, _snap).state;
    }
    get closed() {
      return __privateGet(this, _closed);
    }
    player(id) {
      return __privateGet(this, _snap).players.find((p) => p.id === id);
    }
    /**
     * Gửi thông điệp cho cả phòng (trừ chính mình), hoặc chỉ cho vài người qua `to`.
     * Tối đa 8 KB mỗi thông điệp và khoảng 30 thông điệp mỗi giây.
     */
    async send(type, data, opts = {}) {
      __privateMethod(this, _Room_instances, assertOpen_fn).call(this);
      assertMessageType(type, __privateGet(this, _transport));
      const to = opts.to === void 0 ? void 0 : Array.isArray(opts.to) ? opts.to : [opts.to];
      await __privateGet(this, _transport).request("room.send", { type, data, to });
    }
    /**
     * Gộp các khoá vào trạng thái phòng; khoá mang giá trị `null` bị xoá.
     * Chỉ chủ phòng được gọi. Mọi người (kể cả chủ phòng) nhận `onStateChange`.
     */
    async setState(patch) {
      __privateMethod(this, _Room_instances, assertOpen_fn).call(this);
      await __privateGet(this, _transport).request("room.setState", { patch });
    }
    /** Thay toàn bộ trạng thái riêng của mình (tối đa 4 KB). Mọi người nhận `onPlayerUpdate`. */
    async setPlayerState(state) {
      __privateMethod(this, _Room_instances, assertOpen_fn).call(this);
      await __privateGet(this, _transport).request("room.setPlayerState", { state });
    }
    /** Khoá phòng để không ai vào thêm — thường gọi khi ván bắt đầu. Chỉ chủ phòng. */
    async lock(locked = true) {
      __privateMethod(this, _Room_instances, assertOpen_fn).call(this);
      await __privateGet(this, _transport).request("room.setLocked", { locked });
    }
    /** Mời một người ra khỏi phòng. Chỉ chủ phòng. */
    async kick(playerId) {
      __privateMethod(this, _Room_instances, assertOpen_fn).call(this);
      await __privateGet(this, _transport).request("room.kick", { playerId });
    }
    /** Rời phòng. Nếu mình là chủ phòng, quyền chủ chuyển cho người vào sớm nhất còn lại. */
    async leave() {
      if (__privateGet(this, _closed)) return;
      try {
        await __privateGet(this, _transport).request("room.leave", {});
      } finally {
        __privateMethod(this, _Room_instances, close_fn).call(this, "left");
      }
    }
    // ───────────────────────────── sự kiện ─────────────────────────────
    /** Nghe thông điệp theo loại. Dùng `"*"` để nghe mọi loại. */
    on(type, fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, `msg:${type}`, fn);
    }
    onPlayerJoin(fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, "playerJoined", fn);
    }
    onPlayerLeave(fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, "playerLeft", fn);
    }
    /** Người chơi đổi trạng thái riêng, hoặc rớt mạng / nối lại (`connected`). */
    onPlayerUpdate(fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, "playerUpdated", fn);
    }
    onStateChange(fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, "stateChanged", fn);
    }
    onHostChange(fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, "hostChanged", fn);
    }
    /** Khoá/mở phòng hoặc đổi metadata. */
    onUpdate(fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, "updated", fn);
    }
    /** Đường truyền của chính mình: `reconnecting` khi rớt mạng, `open` khi đã nối lại. */
    onConnection(fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, "connection", fn);
    }
    onClose(fn) {
      return __privateMethod(this, _Room_instances, listen_fn).call(this, "closed", fn);
    }
  };
  _snap = new WeakMap();
  _transport = new WeakMap();
  _handlers = new WeakMap();
  _unsubs = new WeakMap();
  _closed = new WeakMap();
  _onClosed = new WeakMap();
  _Room_instances = new WeakSet();
  // ───────────────────────────── nội bộ ─────────────────────────────
  wire_fn = function() {
    const t = __privateGet(this, _transport);
    const mine = (fn) => (p) => {
      if (!__privateGet(this, _closed) && (!p?.roomId || p.roomId === __privateGet(this, _snap).id)) fn(p);
    };
    __privateGet(this, _unsubs).push(
      t.on("room.message", mine((m) => {
        const msg = { type: m.type, data: m.data, from: m.from, at: m.at };
        __privateMethod(this, _Room_instances, emit_fn).call(this, `msg:${m.type}`, msg);
        __privateMethod(this, _Room_instances, emit_fn).call(this, "msg:*", msg);
      })),
      t.on("room.playerJoined", mine(({ player }) => {
        __privateGet(this, _snap).players = [...__privateGet(this, _snap).players.filter((p) => p.id !== player.id), player];
        __privateMethod(this, _Room_instances, emit_fn).call(this, "playerJoined", player);
      })),
      t.on("room.playerLeft", mine(({ playerId, reason }) => {
        const player = this.player(playerId);
        __privateGet(this, _snap).players = __privateGet(this, _snap).players.filter((p) => p.id !== playerId);
        if (player) __privateMethod(this, _Room_instances, emit_fn).call(this, "playerLeft", { player, reason });
      })),
      t.on("room.playerUpdated", mine(({ player }) => {
        __privateGet(this, _snap).players = __privateGet(this, _snap).players.map((p) => p.id === player.id ? player : p);
        __privateMethod(this, _Room_instances, emit_fn).call(this, "playerUpdated", player);
      })),
      t.on("room.stateChanged", mine(({ changes, by }) => {
        const next = { ...__privateGet(this, _snap).state };
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) delete next[k];
          else next[k] = v;
        }
        __privateGet(this, _snap).state = next;
        __privateMethod(this, _Room_instances, emit_fn).call(this, "stateChanged", { state: next, changes, by });
      })),
      t.on("room.hostChanged", mine(({ hostId }) => {
        __privateGet(this, _snap).hostId = hostId;
        __privateMethod(this, _Room_instances, emit_fn).call(this, "hostChanged", { hostId, isHost: this.isHost });
      })),
      // Bản vá một phần (khoá, metadata) hoặc cả ảnh chụp khi vừa nối lại.
      t.on("room.updated", mine((patch) => {
        const { roomId: _ignored, ...rest } = patch;
        __privateSet(this, _snap, { ...__privateGet(this, _snap), ...rest });
        __privateMethod(this, _Room_instances, emit_fn).call(this, "updated", this);
      })),
      t.on("room.connection", ({ state }) => {
        if (!__privateGet(this, _closed)) __privateMethod(this, _Room_instances, emit_fn).call(this, "connection", state);
      }),
      t.on("room.closed", mine(({ reason }) => __privateMethod(this, _Room_instances, close_fn).call(this, reason)))
    );
  };
  close_fn = function(reason) {
    if (__privateGet(this, _closed)) return;
    __privateSet(this, _closed, true);
    __privateMethod(this, _Room_instances, emit_fn).call(this, "closed", { reason });
    for (const off of __privateGet(this, _unsubs)) off();
    __privateSet(this, _unsubs, []);
    __privateGet(this, _handlers).clear();
    __privateGet(this, _onClosed).call(this);
  };
  assertOpen_fn = function() {
    if (__privateGet(this, _closed)) {
      throw __privateGet(this, _transport).fail({ code: "FORBIDDEN", message: "Ph\xF2ng \u0111\xE3 \u0111\xF3ng ho\u1EB7c b\u1EA1n \u0111\xE3 r\u1EDDi ph\xF2ng." });
    }
  };
  listen_fn = function(event, fn) {
    const set = __privateGet(this, _handlers).get(event) ?? /* @__PURE__ */ new Set();
    set.add(fn);
    __privateGet(this, _handlers).set(event, set);
    return () => set.delete(fn);
  };
  emit_fn = function(event, payload) {
    for (const fn of __privateGet(this, _handlers).get(event) ?? []) {
      try {
        fn(payload);
      } catch (err) {
        console.error("[p2game] l\u1ED7i trong tr\xECnh x\u1EED l\xFD s\u1EF1 ki\u1EC7n ph\xF2ng:", err);
      }
    }
  };
  function assertMessageType(type, t) {
    if (typeof type !== "string" || !type || type.length > REALTIME_LIMITS.maxMessageTypeLength) {
      throw t.fail({
        code: "INVALID_ARGUMENT",
        message: `Lo\u1EA1i th\xF4ng \u0111i\u1EC7p ph\u1EA3i l\xE0 chu\u1ED7i 1\u2013${REALTIME_LIMITS.maxMessageTypeLength} k\xFD t\u1EF1.`
      });
    }
  }

  // src/room-core.ts
  var RoomRuleError = class extends Error {
    constructor(shape) {
      super(shape.message);
      this.shape = shape;
      this.name = "RoomRuleError";
    }
  };
  var fail = (code, message) => {
    throw new RoomRuleError({ code, message });
  };
  var ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function randomRoomCode(random) {
    const bytes = random(REALTIME_LIMITS.codeLength);
    let out = "";
    for (const b of bytes) out += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
    return out;
  }
  function createRoom(input, creator) {
    const req = input.request ?? {};
    const ceiling = input.manifestMaxPlayers;
    const maxPlayers = req.maxPlayers ?? ceiling;
    if (!Number.isInteger(maxPlayers) || maxPlayers < REALTIME_LIMITS.minPlayers || maxPlayers > ceiling) {
      fail("INVALID_ARGUMENT", `maxPlayers ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn t\u1EEB ${REALTIME_LIMITS.minPlayers} \u0111\u1EBFn ${ceiling}.`);
    }
    const visibility = req.visibility ?? "public";
    if (visibility !== "public" && visibility !== "private") {
      fail("INVALID_ARGUMENT", 'visibility ch\u1EC9 nh\u1EADn "public" ho\u1EB7c "private".');
    }
    const metadata = checkMetadata(req.metadata);
    const state = req.state ?? {};
    if (!isPlainObject(state)) fail("INVALID_ARGUMENT", "state ban \u0111\u1EA7u ph\u1EA3i l\xE0 m\u1ED9t object.");
    assertSize(state, REALTIME_LIMITS.maxRoomStateBytes, "Tr\u1EA1ng th\xE1i ph\xF2ng");
    return {
      id: input.id,
      code: input.code,
      gameId: input.gameId,
      hostId: creator.id,
      maxPlayers,
      visibility,
      locked: false,
      metadata,
      state,
      createdAt: input.now,
      seats: [seatFrom(creator, input.now)]
    };
  }
  function canJoin(room, playerId) {
    if (room.seats.some((s) => s.id === playerId)) return null;
    if (room.locked) return { code: "FORBIDDEN", message: "Ph\xF2ng \u0111\xE3 kho\xE1, kh\xF4ng nh\u1EADn th\xEAm ng\u01B0\u1EDDi." };
    if (room.seats.length >= room.maxPlayers) return { code: "ROOM_FULL", message: "Ph\xF2ng \u0111\xE3 \u0111\u1EE7 ng\u01B0\u1EDDi." };
    return null;
  }
  function joinRoom(room, seat, now) {
    const denied = canJoin(room, seat.id);
    if (denied) throw new RoomRuleError(denied);
    const existing = room.seats.find((s) => s.id === seat.id);
    if (existing) {
      const events = [];
      if (existing.sessionId !== seat.sessionId) {
        events.push({
          type: "room.closed",
          payload: { roomId: room.id, reason: "replaced" },
          to: [seat.id],
          session: existing.sessionId
        });
      }
      Object.assign(existing, {
        sessionId: seat.sessionId,
        displayName: seat.displayName,
        avatarUrl: seat.avatarUrl,
        anonymous: seat.anonymous,
        connected: true,
        disconnectedAt: null
      });
      events.push({ type: "room.playerUpdated", payload: { roomId: room.id, player: publicPlayer(existing) }, except: seat.id });
      return events;
    }
    const fresh = seatFrom(seat, now);
    room.seats.push(fresh);
    return [{ type: "room.playerJoined", payload: { roomId: room.id, player: publicPlayer(fresh) }, except: seat.id }];
  }
  function leaveRoom(room, playerId, reason) {
    const idx = room.seats.findIndex((s) => s.id === playerId);
    if (idx < 0) return { events: [], empty: room.seats.length === 0, removed: null };
    const [removed] = room.seats.splice(idx, 1);
    const events = [
      { type: "room.playerLeft", payload: { roomId: room.id, playerId, reason }, except: playerId }
    ];
    if (room.seats.length > 0 && room.hostId === playerId) {
      room.hostId = pickHost(room).id;
      events.push({ type: "room.hostChanged", payload: { roomId: room.id, hostId: room.hostId } });
    }
    return { events, empty: room.seats.length === 0, removed: removed ?? null };
  }
  function setRoomState(room, actorId, patch) {
    requireHost(room, actorId, "ghi tr\u1EA1ng th\xE1i ph\xF2ng");
    if (!isPlainObject(patch) || Object.keys(patch).length === 0) {
      fail("INVALID_ARGUMENT", "patch ph\u1EA3i l\xE0 object c\xF3 \xEDt nh\u1EA5t m\u1ED9t kho\xE1.");
    }
    const next = { ...room.state };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === void 0) delete next[k];
      else next[k] = v;
    }
    assertSize(next, REALTIME_LIMITS.maxRoomStateBytes, "Tr\u1EA1ng th\xE1i ph\xF2ng");
    room.state = next;
    const changes = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v ?? null])
    );
    return [{ type: "room.stateChanged", payload: { roomId: room.id, changes, by: actorId } }];
  }
  function setLocked(room, actorId, locked) {
    requireHost(room, actorId, "kho\xE1 ph\xF2ng");
    if (typeof locked !== "boolean") fail("INVALID_ARGUMENT", "locked ph\u1EA3i l\xE0 true ho\u1EB7c false.");
    if (room.locked === locked) return [];
    room.locked = locked;
    return [{ type: "room.updated", payload: { roomId: room.id, locked: room.locked } }];
  }
  function kickPlayer(room, actorId, targetId) {
    requireHost(room, actorId, "m\u1EDDi ng\u01B0\u1EDDi kh\xE1c ra");
    if (typeof targetId !== "string") return fail("INVALID_ARGUMENT", "playerId ph\u1EA3i l\xE0 chu\u1ED7i.");
    if (targetId === actorId) return fail("INVALID_ARGUMENT", "Kh\xF4ng t\u1EF1 m\u1EDDi m\xECnh ra \u0111\u01B0\u1EE3c \u2014 h\xE3y g\u1ECDi leave().");
    const target = room.seats.find((s) => s.id === targetId);
    if (!target) return fail("NOT_FOUND", "Ng\u01B0\u1EDDi n\xE0y kh\xF4ng c\xF3 trong ph\xF2ng.");
    const { events } = leaveRoom(room, targetId, "kicked");
    events.push({ type: "room.closed", payload: { roomId: room.id, reason: "kicked" }, to: [targetId], session: target.sessionId });
    return { events, removed: target };
  }
  function setPlayerState(room, actorId, state) {
    const seat = room.seats.find((s) => s.id === actorId);
    if (!seat) return fail("FORBIDDEN", "B\u1EA1n kh\xF4ng \u1EDF trong ph\xF2ng n\xE0y.");
    assertSize(state ?? null, REALTIME_LIMITS.maxPlayerStateBytes, "Tr\u1EA1ng th\xE1i ng\u01B0\u1EDDi ch\u01A1i");
    seat.state = state ?? null;
    return [{ type: "room.playerUpdated", payload: { roomId: room.id, player: publicPlayer(seat) } }];
  }
  function buildMessage(roomId, from, req, now) {
    if (!isPlainObject(req)) return fail("INVALID_ARGUMENT", "Th\xF4ng \u0111i\u1EC7p kh\xF4ng h\u1EE3p l\u1EC7.");
    const { type, data, to } = req;
    if (typeof type !== "string" || !type || type.length > REALTIME_LIMITS.maxMessageTypeLength) {
      fail("INVALID_ARGUMENT", `Lo\u1EA1i th\xF4ng \u0111i\u1EC7p ph\u1EA3i l\xE0 chu\u1ED7i 1\u2013${REALTIME_LIMITS.maxMessageTypeLength} k\xFD t\u1EF1.`);
    }
    if (to !== void 0 && (!Array.isArray(to) || to.length === 0 || to.length > REALTIME_LIMITS.maxPlayersCeiling || !to.every((t) => typeof t === "string"))) {
      fail("INVALID_ARGUMENT", "to ph\u1EA3i l\xE0 danh s\xE1ch id ng\u01B0\u1EDDi ch\u01A1i.");
    }
    assertSize(data ?? null, REALTIME_LIMITS.maxMessageBytes, "Th\xF4ng \u0111i\u1EC7p");
    return {
      type: "room.message",
      payload: { roomId, type, data: data ?? null, from, at: now },
      ...to ? { to: to.filter((t) => t !== from) } : { except: from }
    };
  }
  function snapshotFor(room, selfId) {
    return {
      id: room.id,
      code: room.code,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      visibility: room.visibility,
      locked: room.locked,
      metadata: room.metadata,
      state: room.state,
      players: room.seats.map(publicPlayer),
      selfId,
      createdAt: room.createdAt
    };
  }
  function listingOf(room) {
    return {
      id: room.id,
      code: room.code,
      playerCount: room.seats.length,
      maxPlayers: room.maxPlayers,
      metadata: room.metadata,
      createdAt: room.createdAt
    };
  }
  function checkFilter(filter) {
    if (filter === void 0 || filter === null) return void 0;
    return checkMetadata(filter, "filter");
  }
  function publicPlayer(seat) {
    return {
      id: seat.id,
      displayName: seat.displayName,
      avatarUrl: seat.avatarUrl,
      anonymous: seat.anonymous,
      joinedAt: seat.joinedAt,
      connected: seat.connected,
      state: seat.state
    };
  }
  function seatFrom(p, now) {
    return {
      id: p.id,
      sessionId: p.sessionId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      anonymous: p.anonymous,
      joinedAt: now,
      connected: true,
      disconnectedAt: null,
      state: null
    };
  }
  function pickHost(room) {
    return room.seats.find((s) => s.connected) ?? room.seats[0];
  }
  function requireHost(room, actorId, what) {
    if (!room.seats.some((s) => s.id === actorId)) fail("FORBIDDEN", "B\u1EA1n kh\xF4ng \u1EDF trong ph\xF2ng n\xE0y.");
    if (room.hostId !== actorId) fail("FORBIDDEN", `Ch\u1EC9 ch\u1EE7 ph\xF2ng \u0111\u01B0\u1EE3c ${what}.`);
  }
  function checkMetadata(raw, name = "metadata") {
    if (raw === void 0 || raw === null) return {};
    if (!isPlainObject(raw)) return fail("INVALID_ARGUMENT", `${name} ph\u1EA3i l\xE0 object.`);
    const entries = Object.entries(raw);
    if (entries.length > 16) fail("INVALID_ARGUMENT", `${name} t\u1ED1i \u0111a 16 kho\xE1.`);
    for (const [k, v] of entries) {
      if (k.length > 32) fail("INVALID_ARGUMENT", `Kho\xE1 ${name} t\u1ED1i \u0111a 32 k\xFD t\u1EF1.`);
      const ok = typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v);
      if (!ok) fail("INVALID_ARGUMENT", `${name}.${k} ch\u1EC9 nh\u1EADn chu\u1ED7i, s\u1ED1 ho\u1EB7c true/false.`);
    }
    assertSize(raw, REALTIME_LIMITS.maxMetadataBytes, name);
    return raw;
  }
  var encoder = new TextEncoder();
  function jsonBytes(value) {
    const s = JSON.stringify(value);
    return s === void 0 ? 0 : encoder.encode(s).length;
  }
  function assertSize(value, max, what) {
    let bytes;
    try {
      bytes = jsonBytes(value);
    } catch {
      return fail("INVALID_ARGUMENT", `${what} ph\u1EA3i JSON ho\xE1 \u0111\u01B0\u1EE3c (kh\xF4ng v\xF2ng l\u1EB7p, kh\xF4ng BigInt).`);
    }
    if (bytes > max) {
      fail("QUOTA_EXCEEDED", `${what} ${Math.ceil(bytes / 1024)} KB v\u01B0\u1EE3t h\u1EA1n m\u1EE9c ${Math.floor(max / 1024)} KB.`);
    }
  }
  function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
  }
  function isRecipient(event, playerId, sessionId) {
    if (event.to && !event.to.includes(playerId)) return false;
    if (event.except && event.except === playerId) return false;
    if (event.session && event.session !== sessionId) return false;
    return true;
  }

  // src/standalone-rooms.ts
  var CHANNEL = "p2game:standalone:rooms";
  var DISCOVER_MS = 150;
  var REQUEST_TIMEOUT_MS = 5e3;
  var _peer, _seat, _channel, _fail, _owned, _membership, _listeners, _waiting, _LocalRoomHost_instances, dispatch_fn, enter_fn, discover_fn, remote_fn, apply_fn, onWire_fn, deliver_fn, shutdown_fn, post_fn;
  var LocalRoomHost = class {
    constructor(player, fail2) {
      __privateAdd(this, _LocalRoomHost_instances);
      __privateAdd(this, _peer, randomId());
      __privateAdd(this, _seat);
      __privateAdd(this, _channel);
      __privateAdd(this, _fail);
      /** Phòng do tab này giữ bản ghi. */
      __privateAdd(this, _owned, /* @__PURE__ */ new Map());
      /** Phòng tab này đang ngồi, và tab nào giữ bản ghi của nó. */
      __privateAdd(this, _membership, null);
      __privateAdd(this, _listeners, /* @__PURE__ */ new Map());
      __privateAdd(this, _waiting, /* @__PURE__ */ new Map());
      __privateSet(this, _fail, fail2);
      const tag = __privateGet(this, _peer).slice(0, 4).toUpperCase();
      __privateSet(this, _seat, {
        id: `${player.id}-${tag.toLowerCase()}`,
        sessionId: __privateGet(this, _peer),
        displayName: `${player.displayName} ${tag}`,
        avatarUrl: player.avatarUrl,
        anonymous: true
      });
      __privateSet(this, _channel, typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL));
      __privateGet(this, _channel)?.addEventListener("message", (e) => __privateMethod(this, _LocalRoomHost_instances, onWire_fn).call(this, e.data));
      if (typeof window !== "undefined") window.addEventListener("pagehide", () => __privateMethod(this, _LocalRoomHost_instances, shutdown_fn).call(this));
    }
    on(event, fn) {
      const set = __privateGet(this, _listeners).get(event) ?? /* @__PURE__ */ new Set();
      set.add(fn);
      __privateGet(this, _listeners).set(event, set);
      return () => set.delete(fn);
    }
    fail(shape) {
      return __privateGet(this, _fail).call(this, shape);
    }
    /** Rời phòng, đóng các phòng mình giữ và đóng kênh giữa các tab. */
    close() {
      __privateMethod(this, _LocalRoomHost_instances, shutdown_fn).call(this);
      __privateGet(this, _channel)?.close();
    }
    async request(type, payload) {
      try {
        return await __privateMethod(this, _LocalRoomHost_instances, dispatch_fn).call(this, type, payload ?? {});
      } catch (err) {
        if (err instanceof RoomRuleError) throw __privateGet(this, _fail).call(this, err.shape);
        throw err;
      }
    }
  };
  _peer = new WeakMap();
  _seat = new WeakMap();
  _channel = new WeakMap();
  _fail = new WeakMap();
  _owned = new WeakMap();
  _membership = new WeakMap();
  _listeners = new WeakMap();
  _waiting = new WeakMap();
  _LocalRoomHost_instances = new WeakSet();
  dispatch_fn = async function(type, payload) {
    switch (type) {
      case "room.create": {
        const room = createRoom({
          id: randomId(),
          code: randomRoomCode(randomBytes),
          gameId: "standalone",
          manifestMaxPlayers: REALTIME_LIMITS.maxPlayersCeiling,
          request: payload,
          now: Date.now()
        }, __privateGet(this, _seat));
        __privateGet(this, _owned).set(room.id, room);
        __privateSet(this, _membership, { roomId: room.id, authority: __privateGet(this, _peer) });
        return snapshotFor(room, __privateGet(this, _seat).id);
      }
      case "room.list": {
        const filter = checkFilter(payload.filter);
        return (await __privateMethod(this, _LocalRoomHost_instances, discover_fn).call(this)).filter((r) => r.visibility === "public" && !r.locked && r.playerCount < r.maxPlayers).filter((r) => !filter || Object.entries(filter).every(([k, v]) => r.metadata[k] === v)).sort((a, b) => b.createdAt - a.createdAt).slice(0, REALTIME_LIMITS.maxRoomsListed).map(({ visibility: _v, locked: _l, ...listing }) => listing);
      }
      case "room.join": {
        const code = String(payload.code ?? "");
        const found = (await __privateMethod(this, _LocalRoomHost_instances, discover_fn).call(this)).find((r) => r.code === code);
        if (!found) throw new RoomRuleError({ code: "NOT_FOUND", message: `Kh\xF4ng c\xF3 ph\xF2ng n\xE0o mang m\xE3 ${code}.` });
        return __privateMethod(this, _LocalRoomHost_instances, enter_fn).call(this, found);
      }
      case "room.quickMatch": {
        const filter = checkFilter(payload.filter);
        const open = await __privateMethod(this, _LocalRoomHost_instances, dispatch_fn).call(this, "room.list", { filter });
        for (const r of open) {
          try {
            return await __privateMethod(this, _LocalRoomHost_instances, enter_fn).call(this, r);
          } catch {
          }
        }
        return __privateMethod(this, _LocalRoomHost_instances, dispatch_fn).call(this, "room.create", { maxPlayers: payload.maxPlayers, metadata: filter });
      }
      default: {
        const m = __privateGet(this, _membership);
        if (!m) throw new RoomRuleError({ code: "FORBIDDEN", message: "B\u1EA1n ch\u01B0a \u1EDF trong ph\xF2ng n\xE0o." });
        const result = m.authority === __privateGet(this, _peer) ? __privateMethod(this, _LocalRoomHost_instances, apply_fn).call(this, m.roomId, type, payload, __privateGet(this, _seat)) : await __privateMethod(this, _LocalRoomHost_instances, remote_fn).call(this, { to: m.authority, roomId: m.roomId, type, payload });
        if (type === "room.leave") __privateSet(this, _membership, null);
        return result;
      }
    }
  };
  enter_fn = async function(listing) {
    const authority = listing.authority ?? __privateGet(this, _peer);
    const snapshot = authority === __privateGet(this, _peer) ? __privateMethod(this, _LocalRoomHost_instances, apply_fn).call(this, listing.id, "room.join", {}, __privateGet(this, _seat)) : await __privateMethod(this, _LocalRoomHost_instances, remote_fn).call(this, { to: authority, roomId: listing.id, type: "room.join", payload: {} });
    __privateSet(this, _membership, { roomId: listing.id, authority });
    return snapshot;
  };
  discover_fn = async function() {
    const mine = [...__privateGet(this, _owned).values()].map((r) => ({ ...describe(r), authority: __privateGet(this, _peer) }));
    if (!__privateGet(this, _channel)) return mine;
    const id = randomId();
    const found = [...mine];
    __privateGet(this, _waiting).set(id, (msg) => {
      if (msg.k === "rooms") found.push(...msg.rooms.map((r) => ({ ...r, authority: msg.from })));
    });
    __privateMethod(this, _LocalRoomHost_instances, post_fn).call(this, { k: "discover", id, from: __privateGet(this, _peer) });
    await new Promise((r) => setTimeout(r, DISCOVER_MS));
    __privateGet(this, _waiting).delete(id);
    return found;
  };
  remote_fn = function(req) {
    return new Promise((resolve, reject) => {
      const id = randomId();
      const timer = setTimeout(() => {
        __privateGet(this, _waiting).delete(id);
        reject(__privateGet(this, _fail).call(this, { code: "UNAVAILABLE", message: "Tab gi\u1EEF ph\xF2ng kh\xF4ng ph\u1EA3n h\u1ED3i \u2014 c\xF3 th\u1EC3 \u0111\xE3 b\u1ECB \u0111\xF3ng." }));
      }, REQUEST_TIMEOUT_MS);
      __privateGet(this, _waiting).set(id, (msg) => {
        if (msg.k !== "res") return;
        clearTimeout(timer);
        __privateGet(this, _waiting).delete(id);
        if (msg.ok) resolve(msg.data);
        else reject(__privateGet(this, _fail).call(this, msg.error));
      });
      __privateMethod(this, _LocalRoomHost_instances, post_fn).call(this, { k: "req", id, from: __privateGet(this, _peer), seat: __privateGet(this, _seat), ...req });
    });
  };
  // ───────────────────────────── phía giữ phòng ─────────────────────────────
  /** Áp một thao tác lên phòng mình giữ, phát sự kiện, trả kết quả cho người gọi. */
  apply_fn = function(roomId, type, payload, actor) {
    const room = __privateGet(this, _owned).get(roomId);
    if (!room) throw new RoomRuleError({ code: "NOT_FOUND", message: "Ph\xF2ng kh\xF4ng c\xF2n t\u1ED3n t\u1EA1i." });
    const now = Date.now();
    let events = [];
    let result = null;
    switch (type) {
      case "room.join":
        events = joinRoom(room, actor, now);
        result = snapshotFor(room, actor.id);
        break;
      case "room.leave": {
        const out = leaveRoom(room, actor.id, "left");
        events = out.events;
        if (out.empty) __privateGet(this, _owned).delete(roomId);
        break;
      }
      case "room.send":
        events = [buildMessage(roomId, actor.id, payload, now)];
        break;
      case "room.setState":
        events = setRoomState(room, actor.id, payload.patch);
        break;
      case "room.setPlayerState":
        events = setPlayerState(room, actor.id, payload.state);
        break;
      case "room.setLocked":
        events = setLocked(room, actor.id, payload.locked);
        break;
      case "room.kick":
        events = kickPlayer(room, actor.id, payload.playerId).events;
        break;
      default:
        throw new RoomRuleError({ code: "INVALID_ARGUMENT", message: `Thao t\xE1c kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3: ${type}` });
    }
    for (const event of events) {
      __privateMethod(this, _LocalRoomHost_instances, deliver_fn).call(this, roomId, event);
      __privateMethod(this, _LocalRoomHost_instances, post_fn).call(this, { k: "evt", roomId, event });
    }
    return result;
  };
  onWire_fn = function(msg) {
    if (!msg || typeof msg !== "object") return;
    switch (msg.k) {
      case "discover":
        if (__privateGet(this, _owned).size > 0) {
          __privateMethod(this, _LocalRoomHost_instances, post_fn).call(this, { k: "rooms", id: msg.id, to: msg.from, from: __privateGet(this, _peer), rooms: [...__privateGet(this, _owned).values()].map(describe) });
        }
        return;
      case "rooms":
      case "res":
        if (msg.to === __privateGet(this, _peer)) __privateGet(this, _waiting).get(msg.id)?.(msg);
        return;
      case "req": {
        if (msg.to !== __privateGet(this, _peer)) return;
        try {
          const data = __privateMethod(this, _LocalRoomHost_instances, apply_fn).call(this, msg.roomId ?? "", msg.type, msg.payload ?? {}, msg.seat);
          __privateMethod(this, _LocalRoomHost_instances, post_fn).call(this, { k: "res", id: msg.id, to: msg.from, ok: true, data });
        } catch (err) {
          const error = err instanceof RoomRuleError ? err.shape : { code: "INTERNAL", message: String(err) };
          __privateMethod(this, _LocalRoomHost_instances, post_fn).call(this, { k: "res", id: msg.id, to: msg.from, ok: false, error });
        }
        return;
      }
      case "evt":
        __privateMethod(this, _LocalRoomHost_instances, deliver_fn).call(this, msg.roomId, msg.event);
        return;
    }
  };
  deliver_fn = function(roomId, event) {
    if (__privateGet(this, _membership)?.roomId !== roomId) return;
    if (!isRecipient(event, __privateGet(this, _seat).id, __privateGet(this, _seat).sessionId)) return;
    if (event.type === "room.closed") __privateSet(this, _membership, null);
    for (const fn of __privateGet(this, _listeners).get(event.type) ?? []) fn(event.payload);
  };
  shutdown_fn = function() {
    const m = __privateGet(this, _membership);
    if (m && m.authority !== __privateGet(this, _peer)) {
      __privateMethod(this, _LocalRoomHost_instances, post_fn).call(this, { k: "req", id: randomId(), from: __privateGet(this, _peer), to: m.authority, roomId: m.roomId, type: "room.leave", payload: {}, seat: __privateGet(this, _seat) });
    }
    for (const room of __privateGet(this, _owned).values()) {
      __privateMethod(this, _LocalRoomHost_instances, post_fn).call(this, { k: "evt", roomId: room.id, event: { type: "room.closed", payload: { roomId: room.id, reason: "expired" } } });
    }
    __privateGet(this, _owned).clear();
  };
  post_fn = function(msg) {
    __privateGet(this, _channel)?.postMessage(msg);
  };
  function describe(r) {
    return { ...listingOf(r), visibility: r.visibility, locked: r.locked };
  }
  function randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }
  function randomId() {
    return Array.from(randomBytes(9), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // src/index.ts
  var P2GameError = class extends Error {
    constructor(shape) {
      super(shape.message);
      __publicField(this, "code");
      __publicField(this, "retryAfterMs");
      this.name = "P2GameError";
      this.code = shape.code;
      this.retryAfterMs = shape.retryAfterMs;
    }
  };
  var Emitter = class {
    constructor() {
      __publicField(this, "map", /* @__PURE__ */ new Map());
    }
    on(event, fn) {
      const set = this.map.get(event) ?? /* @__PURE__ */ new Set();
      set.add(fn);
      this.map.set(event, set);
      return () => set.delete(fn);
    }
    emit(event, payload) {
      for (const fn of this.map.get(event) ?? []) {
        try {
          fn(payload);
        } catch (err) {
          console.error("[p2game] l\u1ED7i trong tr\xECnh x\u1EED l\xFD s\u1EF1 ki\u1EC7n:", err);
        }
      }
    }
  };
  var _ctx, _pending, _emitter, _seq, _standalone, _debug, _initPromise, _heartbeat, _room, _localRooms, _P2Game_instances, enterRoom_fn, assertMultiplayer_fn, roomTransport_fn, _onMessage, post_fn2, request_fn, startHeartbeat_fn, log_fn;
  var P2Game = class {
    constructor() {
      __privateAdd(this, _P2Game_instances);
      __privateAdd(this, _ctx, null);
      __privateAdd(this, _pending, /* @__PURE__ */ new Map());
      __privateAdd(this, _emitter, new Emitter());
      __privateAdd(this, _seq, 0);
      __privateAdd(this, _standalone, false);
      __privateAdd(this, _debug, false);
      __privateAdd(this, _initPromise, null);
      __privateAdd(this, _heartbeat, null);
      __privateAdd(this, _room, null);
      __privateAdd(this, _localRooms, null);
      __publicField(this, "auth", {
        /** Lấy thông tin người chơi hiện tại. `null` nếu chưa đăng nhập. */
        getUser: async () => {
          if (__privateGet(this, _standalone)) return __privateGet(this, _ctx)?.player ?? null;
          const p = await __privateMethod(this, _P2Game_instances, request_fn).call(this, "auth.getUser", {});
          if (__privateGet(this, _ctx)) __privateGet(this, _ctx).player = p;
          return p;
        },
        /**
         * Yêu cầu nền tảng hiển thị hộp thoại đăng nhập.
         * Game không bao giờ tự dựng form đăng nhập — đó là quy tắc bắt buộc.
         */
        requestLogin: async () => {
          if (__privateGet(this, _standalone)) return __privateGet(this, _ctx)?.player ?? null;
          const p = await __privateMethod(this, _P2Game_instances, request_fn).call(this, "auth.requestLogin", {}, 3e5);
          if (__privateGet(this, _ctx)) __privateGet(this, _ctx).player = p;
          return p;
        },
        /** Đăng ký nhận thông báo khi trạng thái đăng nhập thay đổi. */
        onChange: (fn) => __privateGet(this, _emitter).on("auth.changed", fn)
      });
      __publicField(this, "leaderboard", {
        /** Gửi điểm. Nền tảng tự đối chiếu với trần điểm và thời lượng ván đã khai báo. */
        submit: async (leaderboardId, score, meta) => {
          if (!Number.isFinite(score)) {
            throw new P2GameError({ code: "INVALID_ARGUMENT", message: "score ph\u1EA3i l\xE0 m\u1ED9t s\u1ED1 h\u1EEFu h\u1EA1n." });
          }
          if (__privateGet(this, _standalone)) return standaloneSubmit(leaderboardId, score);
          return __privateMethod(this, _P2Game_instances, request_fn).call(this, "leaderboard.submit", { leaderboardId, score, meta });
        },
        /** Lấy bảng xếp hạng. */
        top: async (leaderboardId, opts = {}) => {
          if (__privateGet(this, _standalone)) return standaloneTop(leaderboardId, opts.limit ?? 10);
          return __privateMethod(this, _P2Game_instances, request_fn).call(this, "leaderboard.top", {
            leaderboardId,
            limit: Math.min(opts.limit ?? 10, 100),
            window: opts.window ?? "ALL_TIME"
          });
        },
        /** Lấy các hạng quanh người chơi hiện tại. */
        aroundMe: async (leaderboardId, opts = {}) => {
          if (__privateGet(this, _standalone)) return standaloneTop(leaderboardId, 5);
          return __privateMethod(this, _P2Game_instances, request_fn).call(this, "leaderboard.aroundMe", {
            leaderboardId,
            range: Math.min(opts.range ?? 3, 25),
            window: opts.window ?? "ALL_TIME"
          });
        }
      });
      /** Cloud save: lưu tiến trình theo từng người chơi, đồng bộ giữa các thiết bị. */
      __publicField(this, "storage", {
        get: async (key) => {
          if (__privateGet(this, _standalone)) return standaloneStorageGet(key);
          return __privateMethod(this, _P2Game_instances, request_fn).call(this, "storage.get", { key });
        },
        set: async (key, value) => {
          if (__privateGet(this, _standalone)) return standaloneStorageSet(key, value);
          await __privateMethod(this, _P2Game_instances, request_fn).call(this, "storage.set", { key, value });
        },
        remove: async (key) => {
          if (__privateGet(this, _standalone)) return standaloneStorageSet(key, null);
          await __privateMethod(this, _P2Game_instances, request_fn).call(this, "storage.remove", { key });
        },
        keys: async () => {
          if (__privateGet(this, _standalone)) return standaloneStorageKeys();
          return __privateMethod(this, _P2Game_instances, request_fn).call(this, "storage.keys", {});
        }
      });
      __publicField(this, "ui", {
        /** Hiện thông báo ngắn trên khung nền tảng (không che game). */
        toast: (message, tone = "info") => {
          if (__privateGet(this, _standalone)) {
            console.info(`[p2game toast:${tone}] ${message}`);
            return;
          }
          __privateMethod(this, _P2Game_instances, post_fn2).call(this, "ui.toast", { message: String(message).slice(0, 160), tone });
        },
        /**
         * Xin vào toàn màn hình. Phải gọi từ bên trong một cử chỉ người dùng.
         * Chỉ hoạt động khi manifest đã khai quyền `fullscreen`.
         */
        requestFullscreen: async () => {
          if (__privateGet(this, _standalone)) {
            await document.documentElement.requestFullscreen?.().catch(() => {
            });
            return !!document.fullscreenElement;
          }
          return __privateMethod(this, _P2Game_instances, request_fn).call(this, "ui.requestFullscreen", {});
        }
      });
      __publicField(this, "analytics", {
        /** Ghi nhận sự kiện trong phạm vi nền tảng. Không rời khỏi hệ thống p2game. */
        event: (name, props = {}) => {
          if (__privateGet(this, _standalone)) {
            console.debug(`[p2game event] ${name}`, props);
            return;
          }
          __privateMethod(this, _P2Game_instances, post_fn2).call(this, "analytics.event", { name: name.slice(0, 48), props });
        }
      });
      /**
       * Phòng chơi mạng thời gian thực. Nền tảng chỉ chuyển tiếp: không chạy logic
       * game, chỉ giữ danh sách người, trạng thái dùng chung và chuyển thông điệp.
       * Mỗi người chơi ở tối đa một phòng tại một thời điểm.
       */
      __publicField(this, "rooms", {
        /** Phòng đang ở, `null` nếu chưa vào phòng nào. */
        current: () => __privateGet(this, _room),
        /** Tạo phòng mới và vào làm chủ phòng. */
        create: async (opts = {}) => __privateMethod(this, _P2Game_instances, enterRoom_fn).call(this, "room.create", opts),
        /** Vào phòng bằng mã mời (không phân biệt hoa thường). */
        join: async (code) => __privateMethod(this, _P2Game_instances, enterRoom_fn).call(this, "room.join", { code: String(code ?? "").trim().toUpperCase() }),
        /** Ghép vào một phòng công khai còn chỗ; không có thì tạo phòng mới. */
        quickMatch: async (opts = {}) => __privateMethod(this, _P2Game_instances, enterRoom_fn).call(this, "room.quickMatch", opts),
        /** Liệt kê phòng công khai còn chỗ, mới nhất trước. */
        list: async (opts = {}) => {
          __privateMethod(this, _P2Game_instances, assertMultiplayer_fn).call(this);
          return __privateMethod(this, _P2Game_instances, roomTransport_fn).call(this).request("room.list", opts);
        }
      });
      __privateAdd(this, _onMessage, (event) => {
        const data = event.data;
        if (!data || data.ns !== SDK_MESSAGE_NAMESPACE) return;
        if (event.source !== window.parent) return;
        if (data.kind === "response") {
          const pending = __privateGet(this, _pending).get(data.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          __privateGet(this, _pending).delete(data.id);
          const payload = data.payload;
          if (payload && "ok" in payload && payload.ok === false) pending.reject(new P2GameError(payload.error));
          else pending.resolve(payload?.data);
          return;
        }
        if (data.kind === "event") {
          __privateMethod(this, _P2Game_instances, log_fn).call(this, "s\u1EF1 ki\u1EC7n", data.type, data.payload);
          if (data.type === "auth.changed" && __privateGet(this, _ctx)) __privateGet(this, _ctx).player = data.payload;
          __privateGet(this, _emitter).emit(data.type, data.payload);
        }
      });
    }
    /** Thông tin phiên chơi hiện tại. `null` trước khi gọi init(). */
    get context() {
      return __privateGet(this, _ctx);
    }
    get player() {
      return __privateGet(this, _ctx)?.player ?? null;
    }
    /** `true` khi game đang chạy ngoài khung nền tảng (chế độ phát triển). */
    get isStandalone() {
      return __privateGet(this, _standalone);
    }
    /** Bắt tay với khung nền tảng. Gọi một lần, càng sớm càng tốt. */
    init(options = {}) {
      if (__privateGet(this, _initPromise)) return __privateGet(this, _initPromise);
      __privateSet(this, _debug, options.debug ?? false);
      __privateSet(this, _initPromise, (async () => {
        const inFrame = typeof window !== "undefined" && window.parent !== window;
        if (!inFrame) {
          if (options.allowStandalone === false) {
            throw new P2GameError({ code: "FORBIDDEN", message: "Game ph\u1EA3i ch\u1EA1y b\xEAn trong khung n\u1EC1n t\u1EA3ng p2game." });
          }
          __privateSet(this, _standalone, true);
          __privateSet(this, _ctx, standaloneContext());
          __privateMethod(this, _P2Game_instances, log_fn).call(this, "ch\u1EA1y \u1EDF ch\u1EBF \u0111\u1ED9 gi\u1EA3 l\u1EADp c\u1EE5c b\u1ED9 \u2014 \u0111i\u1EC3m s\u1ED1 l\u01B0u trong localStorage");
          return __privateGet(this, _ctx);
        }
        window.addEventListener("message", __privateGet(this, _onMessage));
        const ctx = await __privateMethod(this, _P2Game_instances, request_fn).call(this, "handshake", {
          protocolVersion: SDK_PROTOCOL_VERSION,
          // Để khung cha đối chiếu xem đúng game đang chạy hay không.
          href: location.pathname
        }, options.timeoutMs ?? 1e4);
        __privateSet(this, _ctx, ctx);
        __privateMethod(this, _P2Game_instances, startHeartbeat_fn).call(this);
        __privateMethod(this, _P2Game_instances, log_fn).call(this, "\u0111\xE3 b\u1EAFt tay", ctx);
        return ctx;
      })());
      return __privateGet(this, _initPromise);
    }
    /**
     * Báo cho nền tảng biết game đã dựng xong khung hình đầu tiên.
     * Nền tảng dùng tín hiệu này để gỡ màn hình chờ.
     */
    ready() {
      if (__privateGet(this, _standalone)) return;
      __privateMethod(this, _P2Game_instances, post_fn2).call(this, "ready", { at: Date.now() });
    }
    /** Báo kết thúc một ván. Nền tảng dùng để đo thời lượng ván chơi. */
    gameOver(payload = {}) {
      if (__privateGet(this, _standalone)) return;
      __privateMethod(this, _P2Game_instances, post_fn2).call(this, "game.over", payload);
    }
    /** Lắng nghe vòng đời: tạm dừng khi người chơi chuyển tab, tiếp tục khi quay lại. */
    onPause(fn) {
      return __privateGet(this, _emitter).on("lifecycle.pause", fn);
    }
    onResume(fn) {
      return __privateGet(this, _emitter).on("lifecycle.resume", fn);
    }
    onBeforeUnload(fn) {
      return __privateGet(this, _emitter).on("lifecycle.beforeUnload", fn);
    }
    /** Ngắt kết nối và dọn dẹp. Hiếm khi cần gọi thủ công. */
    destroy() {
      if (__privateGet(this, _room) && !__privateGet(this, _room).closed) void __privateGet(this, _room).leave().catch(() => {
      });
      __privateGet(this, _localRooms)?.close();
      if (__privateGet(this, _heartbeat)) clearInterval(__privateGet(this, _heartbeat));
      window.removeEventListener("message", __privateGet(this, _onMessage));
      for (const p of __privateGet(this, _pending).values()) {
        clearTimeout(p.timer);
        p.reject(new P2GameError({ code: "INTERNAL", message: "SDK \u0111\xE3 b\u1ECB hu\u1EF7." }));
      }
      __privateGet(this, _pending).clear();
    }
  };
  _ctx = new WeakMap();
  _pending = new WeakMap();
  _emitter = new WeakMap();
  _seq = new WeakMap();
  _standalone = new WeakMap();
  _debug = new WeakMap();
  _initPromise = new WeakMap();
  _heartbeat = new WeakMap();
  _room = new WeakMap();
  _localRooms = new WeakMap();
  _P2Game_instances = new WeakSet();
  enterRoom_fn = async function(type, payload) {
    __privateMethod(this, _P2Game_instances, assertMultiplayer_fn).call(this);
    if (__privateGet(this, _room) && !__privateGet(this, _room).closed) {
      throw new P2GameError({ code: "CONFLICT", message: "\u0110ang \u1EDF trong m\u1ED9t ph\xF2ng. G\u1ECDi room.leave() tr\u01B0\u1EDBc khi v\xE0o ph\xF2ng kh\xE1c." });
    }
    const transport = __privateMethod(this, _P2Game_instances, roomTransport_fn).call(this);
    const snapshot = await transport.request(type, payload);
    const room = new Room(snapshot, transport, () => {
      if (__privateGet(this, _room) === room) __privateSet(this, _room, null);
    });
    __privateSet(this, _room, room);
    return room;
  };
  assertMultiplayer_fn = function() {
    if (!__privateGet(this, _ctx)) {
      throw new P2GameError({ code: "FORBIDDEN", message: "Ph\u1EA3i g\u1ECDi p2.init() tr\u01B0\u1EDBc khi d\xF9ng ph\xF2ng ch\u01A1i." });
    }
    if (!__privateGet(this, _standalone) && !__privateGet(this, _ctx).multiplayer) {
      throw new P2GameError({
        code: "FORBIDDEN",
        message: "Game ch\u01B0a khai kh\u1ED1i `multiplayer` trong manifest, ho\u1EB7c n\u1EC1n t\u1EA3ng ch\u01B0a h\u1ED7 tr\u1EE3 ch\u01A1i m\u1EA1ng."
      });
    }
  };
  /** Kênh của phòng: qua khung nền tảng, hoặc một phòng giả lập khi chạy độc lập. */
  roomTransport_fn = function() {
    if (__privateGet(this, _standalone)) {
      __privateGet(this, _localRooms) ?? __privateSet(this, _localRooms, new LocalRoomHost(__privateGet(this, _ctx).player, (shape) => new P2GameError(shape)));
      return __privateGet(this, _localRooms);
    }
    return {
      request: (type, payload) => __privateMethod(this, _P2Game_instances, request_fn).call(this, type, payload),
      on: (event, fn) => __privateGet(this, _emitter).on(event, fn),
      fail: (shape) => new P2GameError(shape)
    };
  };
  _onMessage = new WeakMap();
  post_fn2 = function(type, payload) {
    const envelope = {
      ns: SDK_MESSAGE_NAMESPACE,
      v: SDK_PROTOCOL_VERSION,
      id: `p2-${++__privateWrapper(this, _seq)._}`,
      kind: "request",
      type,
      payload
    };
    window.parent.postMessage(envelope, "*");
  };
  request_fn = function(type, payload, timeoutMs = 15e3) {
    return new Promise((resolve, reject) => {
      const id = `p2-${++__privateWrapper(this, _seq)._}`;
      const timer = setTimeout(() => {
        __privateGet(this, _pending).delete(id);
        reject(new P2GameError({ code: "TIMEOUT", message: `Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c ph\u1EA3n h\u1ED3i cho "${type}" sau ${timeoutMs}ms.` }));
      }, timeoutMs);
      __privateGet(this, _pending).set(id, { resolve, reject, timer });
      const envelope = {
        ns: SDK_MESSAGE_NAMESPACE,
        v: SDK_PROTOCOL_VERSION,
        id,
        kind: "request",
        type,
        payload
      };
      window.parent.postMessage(envelope, "*");
      __privateMethod(this, _P2Game_instances, log_fn).call(this, "\u2192", type, payload);
    });
  };
  /** Nhịp tim giữ phiên chơi sống, đồng thời cho nền tảng đo thời lượng thật. */
  startHeartbeat_fn = function() {
    __privateSet(this, _heartbeat, setInterval(() => {
      if (document.visibilityState === "visible") __privateMethod(this, _P2Game_instances, post_fn2).call(this, "session.heartbeat", { at: Date.now() });
    }, 3e4));
  };
  log_fn = function(...args) {
    if (__privateGet(this, _debug)) console.debug("[p2game]", ...args);
  };
  var LS_PREFIX = "p2game:standalone:";
  function standaloneContext() {
    return {
      protocolVersion: SDK_PROTOCOL_VERSION,
      gameId: "standalone",
      sessionId: `local-${Date.now()}`,
      player: { id: "local-player", displayName: "Ng\u01B0\u1EDDi ch\u01A1i th\u1EED", avatarUrl: null, anonymous: true },
      locale: typeof navigator !== "undefined" ? navigator.language : "vi-VN",
      permissions: ["fullscreen", "audio", "gamepad", "pointer-lock", "persistent-storage"],
      leaderboards: [],
      // Giả lập cho phép mọi thứ; nền tảng thật mới áp đúng giới hạn của manifest.
      multiplayer: { maxPlayers: REALTIME_LIMITS.maxPlayersCeiling, requiresAuth: false }
    };
  }
  function standaloneSubmit(boardId, score) {
    const key = `${LS_PREFIX}lb:${boardId}`;
    const best = Number(localStorage.getItem(key) ?? "0");
    const improved = score > best;
    if (improved) localStorage.setItem(key, String(score));
    return { accepted: true, rank: 1, personalBest: Math.max(best, score), improved };
  }
  function standaloneTop(boardId, limit) {
    const best = Number(localStorage.getItem(`${LS_PREFIX}lb:${boardId}`) ?? "0");
    return [{
      rank: 1,
      playerId: "local-player",
      displayName: "Ng\u01B0\u1EDDi ch\u01A1i th\u1EED",
      avatarUrl: null,
      score: best,
      achievedAt: (/* @__PURE__ */ new Date()).toISOString(),
      isMe: true
    }].slice(0, limit);
  }
  function standaloneStorageGet(key) {
    const raw = localStorage.getItem(`${LS_PREFIX}kv:${key}`);
    return raw === null ? null : JSON.parse(raw);
  }
  function standaloneStorageSet(key, value) {
    if (value === null) localStorage.removeItem(`${LS_PREFIX}kv:${key}`);
    else localStorage.setItem(`${LS_PREFIX}kv:${key}`, JSON.stringify(value));
  }
  function standaloneStorageKeys() {
    return Object.keys(localStorage).filter((k) => k.startsWith(`${LS_PREFIX}kv:`)).map((k) => k.slice(`${LS_PREFIX}kv:`.length));
  }
  var p2 = new P2Game();

  // src/global.ts
  var api = Object.assign(p2, { P2Game, P2GameError });
  window.p2game = api;
  window.p2 = p2;
  var global_default = api;
})();
