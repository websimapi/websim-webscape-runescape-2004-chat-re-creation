// A lightweight "server" simulator providing real-time behavior across tabs using BroadcastChannel.
// Persists user records in localStorage with one entry per username.

const CHAN = "webscape-2004";
const bc = "BroadcastChannel" in self ? new BroadcastChannel(CHAN) : null;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

const KEY_INDEX = "webscape:userIndex"; // JSON array of usernames (unique)
const KEY_USER_PREFIX = "webscape:user:"; // + username
const KEY_WORLD = "webscape:world:"; // + username

function getIndex() {
  try { return JSON.parse(localStorage.getItem(KEY_INDEX)) || []; }
  catch { return []; }
}
function setIndex(list) {
  localStorage.setItem(KEY_INDEX, JSON.stringify(Array.from(new Set(list))));
}

function getUser(username) {
  try { return JSON.parse(localStorage.getItem(KEY_USER_PREFIX + username)) || null; }
  catch { return null; }
}
function putUser(user) {
  const uname = user.username;
  const existing = getUser(uname) || {};
  const merged = {
    username: uname,
    friendList: Array.from(new Set(user.friendList || existing.friendList || [])),
    ignoreList: Array.from(new Set(user.ignoreList || existing.ignoreList || [])),
    world: user.world || existing.world || "World1"
  };
  localStorage.setItem(KEY_USER_PREFIX + uname, JSON.stringify(merged));
  const idx = getIndex();
  if (!idx.includes(uname)) {
    idx.push(uname);
    setIndex(idx);
  }
  return merged;
}
function setWorld(username, world) {
  const u = getUser(username) || { username, friendList: [], ignoreList: [], world };
  u.world = world;
  putUser(u);
}

function listUsers() {
  return getIndex().map(getUser).filter(Boolean);
}

const listeners = new Set();
function onEvent(handler) { listeners.add(handler); return () => listeners.delete(handler); }
function emitEvent(evt) {
  listeners.forEach((fn) => { try { fn(evt); } catch {} });
  if (bc) bc.postMessage(evt);
}

// Receive events from other tabs
if (bc) {
  bc.onmessage = (ev) => {
    const evt = ev.data;
    listeners.forEach((fn) => { try { fn(evt); } catch {} });
  };
}

// Boot some NPC chatter to simulate population
let botsStarted = false;
function startBots() {
  if (botsStarted) return;
  botsStarted = true;
  const bots = ["Hans", "Banker", "Guide", "Fisherman", "Miner", "Chef", "Wizard"];
  // Ensure bots exist
  bots.forEach((b) => putUser({ username: b, friendList: [], ignoreList: [], world: "World1" }));
  // Send periodic messages
  setInterval(() => {
    const bot = bots[Math.floor(Math.random() * bots.length)];
    const texts = [
      "Lovely day in Lumbridge!",
      "Mind your belongings.",
      "Need any help?",
      "Fishing spot looks lively today.",
      "Mining is hard work.",
      "Fresh bread for sale!",
      "Magic is the key to everything."
    ];
    const text = texts[Math.floor(Math.random() * texts.length)];
    emitEvent({ type: "chat", channel: "public", from: bot, text, ts: now() });
  }, 4500 + Math.random() * 3500);
}

export class WebscapeServer {
  constructor() {
    startBots();
  }

  subscribe(handler) { return onEvent(handler); }

  // User lifecycle
  async login(username, world = "World1") {
    const user = putUser({ username, world });
    emitEvent({ type: "system", action: "login", username, world, ts: now() });
    await delay(50);
    return user;
  }
  async logout(username) {
    emitEvent({ type: "system", action: "logout", username, ts: now() });
  }

  // Presence polling (could be used for online/offline heuristics)
  listUsers() { return listUsers(); }

  // Chat
  async sendPublic(from, text) {
    emitEvent({ type: "chat", channel: "public", from, text, ts: now() });
  }
  async sendPrivate(from, to, text) {
    emitEvent({ type: "chat", channel: "private", from, to, text, ts: now() });
  }

  // Friends/Ignores
  async addFriend(owner, friend) {
    const user = getUser(owner) || { username: owner, friendList: [], ignoreList: [], world: "World1" };
    if (!user.friendList.includes(friend)) user.friendList.push(friend);
    putUser(user);
    emitEvent({ type: "friend", action: "add", owner, friend, ts: now() });
    return user;
  }
  async removeFriend(owner, friend) {
    const user = getUser(owner) || { username: owner, friendList: [], ignoreList: [], world: "World1" };
    user.friendList = user.friendList.filter((u) => u !== friend);
    putUser(user);
    emitEvent({ type: "friend", action: "remove", owner, friend, ts: now() });
    return user;
  }
  async addIgnore(owner, target) {
    const user = getUser(owner) || { username: owner, friendList: [], ignoreList: [], world: "World1" };
    if (!user.ignoreList.includes(target)) user.ignoreList.push(target);
    putUser(user);
    emitEvent({ type: "ignore", action: "add", owner, target, ts: now() });
    return user;
  }
  async removeIgnore(owner, target) {
    const user = getUser(owner) || { username: owner, friendList: [], ignoreList: [], world: "World1" };
    user.ignoreList = user.ignoreList.filter((u) => u !== target);
    putUser(user);
    emitEvent({ type: "ignore", action: "remove", owner, target, ts: now() });
    return user;
  }

  async setWorld(username, world) {
    setWorld(username, world);
    emitEvent({ type: "world", username, world, ts: now() });
  }

  getUser(username) { return getUser(username); }
}

