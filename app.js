import { WebscapeServer } from "serverSim";
import { escapeHTML, hhmm } from "utils";

/*
  High-level client logic:
  - Login to simulated server
  - Render messages (public/private/system)
  - Maintain friend/ignore in real-time
  - Split chat toggle
  - Context menu on usernames
  - Modals for add/remove/message
  - Close UIs on outside click, iframe click, or ESC
*/

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const server = new WebscapeServer();

const state = {
  username: null,
  world: "World1",
  friendList: [],
  ignoreList: [],
  split: false
};

// Elements
const elWorld = $("#worldName");
const elDispUser = $("#displayUsername");
const elSplitToggle = $("#splitToggle");
const elChatCombined = $("#chatCombined");
const elChatPublic = $("#chatPublic");
const elChatPrivate = $("#chatPrivate");
const elMessageInput = $("#messageInput");
const elSendBtn = $("#sendBtn");
const elContext = $("#contextMenu");
const elContextList = $("#contextMenuList");

const elFriendsPanel = $("#friendsPanel");
const elIgnoresPanel = $("#ignoresPanel");
const elFriendsList = $("#friendsList");
const elIgnoreList = $("#ignoreList");
const elAddFriendBtn = $("#addFriendBtn");
const elAddIgnoreBtn = $("#addIgnoreBtn");

const elModalBackdrop = $("#modalBackdrop");
const elModalTitle = $("#modalTitle");
const elModalBody = $("#modalBody");
const elModalFooter = $("#modalFooter");
const elModalClose = $("#modalClose");
const elModalCancel = $("#modalCancel");
const elModalConfirm = $("#modalConfirm");

const elLoginBackdrop = $("#loginBackdrop");
const elLoginUsername = $("#loginUsername");
const elLoginWorld = $("#loginWorld");
const elLoginConfirm = $("#loginConfirm");

const elChatWindow = $("#chatWindow");
const elChatSplit = $("#chatSplit");

// Tabs
$(".panel-tabs").addEventListener("click", (e) => {
  if (e.target.classList.contains("tab")) {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active");
    const tab = e.target.dataset.tab;
    $("#friendsPanel").classList.toggle("active", tab === "friends");
    $("#ignoresPanel").classList.toggle("active", tab === "ignores");
  }
});

// Login
elLoginConfirm.addEventListener("click", async () => {
  const uname = (elLoginUsername.value || "").trim();
  const world = elLoginWorld.value || "World1";
  if (!uname) {
    elLoginUsername.focus();
    return;
  }
  await doLogin(uname, world);
});

elLoginUsername.addEventListener("keydown", (e) => {
  if (e.key === "Enter") elLoginConfirm.click();
});

async function doLogin(username, world) {
  state.username = username;
  state.world = world;
  elWorld.textContent = world;
  elDispUser.textContent = username;

  await server.login(username, world);
  const record = server.getUser(username);
  state.friendList = record.friendList || [];
  state.ignoreList = record.ignoreList || [];
  renderLists();

  elLoginBackdrop.classList.add("hidden");

  // Send a local system message
  addSystemMessage(`Welcome to Webscape, ${escapeHTML(username)}!`);

  // Subscribe to events
  server.subscribe(onServerEvent);

  // Focus input
  elMessageInput.focus();

  // Periodic presence refresh for online status heuristic
  refreshOnlineStatus();
  setInterval(refreshOnlineStatus, 5000);
}

// Event handling
function onServerEvent(evt) {
  switch (evt.type) {
    case "chat":
      if (evt.channel === "public") {
        if (shouldIgnore(evt.from)) return;
        addChatMessage({
          kind: "public",
          from: evt.from,
          text: evt.text,
          ts: evt.ts
        });
      } else if (evt.channel === "private") {
        // Show to sender (as confirmation) and recipient
        const isToMe = evt.to === state.username;
        const isFromMe = evt.from === state.username;
        if (!isToMe && !isFromMe) return;
        const other = isFromMe ? evt.to : evt.from;
        if (!isFromMe && shouldIgnore(evt.from)) return;
        addChatMessage({
          kind: "private",
          from: evt.from,
          to: evt.to,
          text: evt.text,
          ts: evt.ts
        });
      }
      break;

    case "system":
      if (evt.action === "login") {
        addSystemMessage(`${evt.username} has logged in.`);
      } else if (evt.action === "logout") {
        addSystemMessage(`${evt.username} has logged out.`);
      }
      break;

    case "friend":
      if (evt.owner === state.username) {
        if (evt.action === "add") {
          if (!state.friendList.includes(evt.friend)) state.friendList.push(evt.friend);
        } else {
          state.friendList = state.friendList.filter((u) => u !== evt.friend);
        }
        renderLists();
      }
      break;

    case "ignore":
      if (evt.owner === state.username) {
        if (evt.action === "add") {
          if (!state.ignoreList.includes(evt.target)) state.ignoreList.push(evt.target);
        } else {
          state.ignoreList = state.ignoreList.filter((u) => u !== evt.target);
        }
        renderLists();
      }
      break;

    case "world":
      // Could update presence indicators
      refreshOnlineStatus();
      break;
  }
}

function shouldIgnore(from) {
  return state.ignoreList.includes(from);
}

// Rendering messages
function addChatMessage({ kind, from, to, text, ts }) {
  const time = hhmm(new Date(ts || Date.now()));
  const safeText = escapeHTML(text);
  const senderHTML = `<span class="sender" data-username="${escapeHTML(from)}">${escapeHTML(from)}</span>`;
  const me = state.username;

  const el = document.createElement("div");
  el.className = `msg ${kind}${to === me ? " to-you" : ""}`;
  if (kind === "public") {
    el.innerHTML = `<span class="time">${time}</span>${senderHTML}: <span class="text">${safeText}</span>`;
    pushMsg(el, "public");
  } else if (kind === "private") {
    if (from === me) {
      el.innerHTML = `<span class="time">${time}</span>To ${wrapUsername(to)}: <span class="text">${safeText}</span>`;
    } else {
      el.innerHTML = `<span class="time">${time}</span>From ${senderHTML}: <span class="text">${safeText}</span>`;
    }
    pushMsg(el, "private");
  }
}

function addSystemMessage(text) {
  const time = hhmm();
  const el = document.createElement("div");
  el.className = "msg system";
  el.innerHTML = `<span class="time">${time}</span><span class="text">${escapeHTML(text)}</span>`;
  pushMsg(el, "system");
}

function wrapUsername(name) {
  return `<span class="sender" data-username="${escapeHTML(name)}">${escapeHTML(name)}</span>`;
}

function pushMsg(el, lane) {
  // Combined
  elChatCombined.appendChild(el.cloneNode(true));
  elChatCombined.scrollTop = elChatCombined.scrollHeight;

  // Split lanes
  if (lane === "private") {
    elChatPrivate.appendChild(el);
    elChatPrivate.scrollTop = elChatPrivate.scrollHeight;
  } else {
    elChatPublic.appendChild(el);
    elChatPublic.scrollTop = elChatPublic.scrollHeight;
  }
}

// Sending
elSendBtn.addEventListener("click", sendMessage);
elMessageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
  if (e.key === "Escape") closeTransientUI();
});

function sendMessage() {
  const raw = elMessageInput.value.trim();
  if (!raw) return;
  // Private message syntax: /msg username message
  // Or: ::pm username message (classic RS-ish command flavor)
  const pmMatch = raw.match(/^\/msg\s+(\S+)\s+([\s\S]+)$/i) || raw.match(/^::pm\s+(\S+)\s+([\s\S]+)$/i);
  if (pmMatch) {
    const [, to, text] = pmMatch;
    server.sendPrivate(state.username, to, text);
  } else {
    server.sendPublic(state.username, raw);
  }
  elMessageInput.value = "";
  elMessageInput.focus();
}

// Split toggle
elSplitToggle.addEventListener("change", () => {
  state.split = elSplitToggle.checked;
  elChatSplit.style.display = state.split ? "flex" : "none";
  elChatCombined.style.display = state.split ? "none" : "block";
});

// Context menu handling
document.addEventListener("click", (e) => {
  const sender = e.target.closest(".sender");
  if (sender) {
    const uname = sender.dataset.username;
    openContextMenu(uname, e.clientX, e.clientY);
  } else if (!e.target.closest("#contextMenu")) {
    closeContextMenu();
  }
});

function openContextMenu(username, x, y) {
  const isFriend = state.friendList.includes(username);
  const isSelf = username === state.username;

  const items = [];
  if (isSelf) {
    items.push({ label: "Cancel", action: () => {} });
  } else if (isFriend) {
    items.push({ label: "Message", action: () => openMessageModal(username) });
    items.push({ label: "Remove Friend", action: () => removeFriend(username) });
    items.push({ label: "Cancel", action: () => {} });
  } else {
    items.push({ label: "Add Friend", action: () => addFriend(username) });
    items.push({ label: "Add Ignore", action: () => addIgnore(username) });
    items.push({ label: "Cancel", action: () => {} });
  }

  elContextList.innerHTML = "";
  items.forEach((it) => {
    const li = document.createElement("li");
    li.textContent = it.label;
    li.addEventListener("click", () => {
      closeContextMenu();
      it.action();
    });
    elContextList.appendChild(li);
  });

  elContext.style.left = x + "px";
  elContext.style.top = y + "px";
  elContext.classList.remove("hidden");
}
function closeContextMenu() {
  elContext.classList.add("hidden");
}

// Friend/Ignore management
elAddFriendBtn.addEventListener("click", () => openAddModal("friend"));
elAddIgnoreBtn.addEventListener("click", () => openAddModal("ignore"));

async function addFriend(username) {
  await server.addFriend(state.username, username);
}
async function removeFriend(username) {
  openConfirmModal(`Remove friend '${username}'?`, async () => {
    await server.removeFriend(state.username, username);
  });
}
async function addIgnore(username) {
  await server.addIgnore(state.username, username);
}
async function removeIgnore(username) {
  openConfirmModal(`Remove '${username}' from ignore list?`, async () => {
    await server.removeIgnore(state.username, username);
  });
}

function renderLists() {
  // Friends
  elFriendsList.innerHTML = "";
  const allUsers = server.listUsers();
  const onlineMap = new Map(allUsers.map(u => [u.username, u.world]));
  state.friendList.forEach((u) => {
    const row = document.createElement("div");
    row.className = "list-item";
    const online = onlineMap.has(u) && !!onlineMap.get(u);
    row.innerHTML = `
      <div class="item-left">
        <span class="status-dot ${online ? "status-online" : "status-offline"}"></span>
        <span class="name">${escapeHTML(u)}</span>
        ${online ? `<span class="world tag">(${escapeHTML(onlineMap.get(u))})</span>` : ""}
      </div>
      <div class="item-actions">
        <button class="btn" data-action="pm">Message</button>
        <button class="btn danger" data-action="remove">Remove</button>
      </div>
    `;
    row.querySelector('[data-action="pm"]').addEventListener("click", () => openMessageModal(u));
    row.querySelector('[data-action="remove"]').addEventListener("click", () => removeFriend(u));
    elFriendsList.appendChild(row);
  });

  // Ignores
  elIgnoreList.innerHTML = "";
  state.ignoreList.forEach((u) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <div class="item-left">
        <span class="status-dot status-offline"></span>
        <span class="name">${escapeHTML(u)}</span>
      </div>
      <div class="item-actions">
        <button class="btn danger" data-action="remove">Remove</button>
      </div>
    `;
    row.querySelector('[data-action="remove"]').addEventListener("click", () => removeIgnore(u));
    elIgnoreList.appendChild(row);
  });
}

function refreshOnlineStatus() {
  // Re-render to update world tags
  renderLists();
}

// Modals
let modalResolve = null;
function openAddModal(kind) {
  elModalTitle.textContent = kind === "friend" ? "Add Friend" : "Add Ignore";
  elModalBody.innerHTML = `
    <label class="label">Enter username:</label>
    <input id="modalName" class="input" placeholder="Username" maxlength="20" />
  `;
  showModal(async () => {
    const name = $("#modalName").value.trim();
    if (!name) return;
    if (kind === "friend") await addFriend(name);
    else await addIgnore(name);
  });
  $("#modalName").focus();
}
function openMessageModal(to) {
  elModalTitle.textContent = `Message ${to}`;
  elModalBody.innerHTML = `
    <label class="label">Enter message to ${escapeHTML(to)}:</label>
    <input id="modalMsg" class="input" placeholder="Hello!" />
  `;
  showModal(async () => {
    const text = $("#modalMsg").value.trim();
    if (!text) return;
    await server.sendPrivate(state.username, to, text);
  });
  $("#modalMsg").focus();
}
function openConfirmModal(title, onConfirm) {
  elModalTitle.textContent = title;
  elModalBody.innerHTML = `<div>Are you sure?</div>`;
  showModal(onConfirm);
}

function showModal(onConfirm) {
  elModalBackdrop.classList.remove("hidden");
  elModalBackdrop.setAttribute("aria-hidden", "false");
  modalResolve = onConfirm;
}
function closeModal() {
  elModalBackdrop.classList.add("hidden");
  elModalBackdrop.setAttribute("aria-hidden", "true");
  modalResolve = null;
}
elModalClose.addEventListener("click", closeModal);
elModalCancel.addEventListener("click", closeModal);
elModalConfirm.addEventListener("click", async () => {
  if (modalResolve) await modalResolve();
  closeModal();
});

// Close transient UIs (context menu, modals) on outside click / iframe click / ESC
function closeTransientUI() {
  closeContextMenu();
  closeModal();
  // Also blur the enter message input to mimic RS cancel
  elMessageInput.blur();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeTransientUI();
  }
});
document.addEventListener("mousedown", (e) => {
  const isMessageUI = e.target.closest(".enter-message");
  const isModal = e.target.closest(".modal");
  const isContext = e.target.closest("#contextMenu");
  if (!isMessageUI && !isModal && !isContext) {
    closeTransientUI();
  }
});
// If embedded iframe area is clicked (our own viewport iframe posts a message)
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "iframe-click") {
    closeTransientUI();
  }
});

// Clicking inside the viewport (outside UI)
$("#gameFrame").addEventListener("load", () => {
  // Already posting messages from srcdoc script
});

// Username interactions within chat
elChatWindow.addEventListener("click", (e) => {
  const sender = e.target.closest(".sender");
  if (!sender) return;
  // Handled globally in document click for context menu
});

// Helper: sanitize and guard against self-adding ignore/friend
async function safeAddFriend(name) {
  if (!name || name === state.username) return;
  await server.addFriend(state.username, name);
}
async function safeAddIgnore(name) {
  if (!name || name === state.username) return;
  await server.addIgnore(state.username, name);
}

// Ensure the chat shows combined by default
elChatCombined.style.display = "block";
elChatSplit.style.display = "none";

