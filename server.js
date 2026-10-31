const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "RUSH Multiplayer" }));

const players = new Map();
const rooms = new Map();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcastRoom(room, data) {
  for (const id of room.players) {
    const p = players.get(id);
    if (p) send(p.ws, data);
  }
}
function snapshot(room) {
  const list = [];
  for (const id of room.players) {
    const p = players.get(id);
    if (p) list.push({ id: p.id, name: p.name, x: p.x, y: p.y, color: p.color, finished: p.finished });
  }
  return list;
}
function roomCode(input) {
  return String(input || "RUSH").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "RUSH";
}

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2, 10);
  const player = {
    id, ws, name: "Runner", roomCode: null,
    x: 70, y: 400, color: ["#ff5263", "#5bd8ff", "#b7ff67", "#c79bff"][Math.floor(Math.random()*4)],
    finished: false, lastMove: 0
  };
  players.set(id, player);
  send(ws, { type: "welcome", id, color: player.color });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "join") {
      const code = roomCode(msg.room);
      if (player.roomCode && rooms.has(player.roomCode)) {
        const old = rooms.get(player.roomCode);
        old.players.delete(id);
        broadcastRoom(old, { type: "players", players: snapshot(old) });
      }
      if (!rooms.has(code)) rooms.set(code, { code, players: new Set(), startAt: Date.now() });
      const room = rooms.get(code);
      player.roomCode = code;
      player.name = String(msg.name || "Runner").trim().slice(0, 14) || "Runner";
      player.x = 70; player.y = 400; player.finished = false;
      room.players.add(id);
      send(ws, { type: "joined", room: code, id, color: player.color });
      broadcastRoom(room, { type: "players", players: snapshot(room) });
      return;
    }
    if (!player.roomCode || !rooms.has(player.roomCode)) return;
    const room = rooms.get(player.roomCode);
    if (msg.type === "move") {
      // Server clamps movement to keep players inside the course.
      const now = Date.now();
      if (now - player.lastMove < 25) return;
      player.lastMove = now;
      player.x = clamp(Number(msg.x) || player.x, 30, 2200);
      player.y = clamp(Number(msg.y) || player.y, 60, 470);
      player.finished = Boolean(msg.finished);
      broadcastRoom(room, { type: "players", players: snapshot(room) });
    } else if (msg.type === "reset") {
      player.x = 70; player.y = 400; player.finished = false;
      broadcastRoom(room, { type: "players", players: snapshot(room) });
    } else if (msg.type === "ping") {
      send(ws, { type: "pong", at: msg.at });
    }
  });

  ws.on("close", () => {
    const p = players.get(id);
    if (p && p.roomCode && rooms.has(p.roomCode)) {
      const room = rooms.get(p.roomCode);
      room.players.delete(id);
      broadcastRoom(room, { type: "players", players: snapshot(room) });
      if (room.players.size === 0) rooms.delete(p.roomCode);
    }
    players.delete(id);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    broadcastRoom(room, { type: "players", players: snapshot(room) });
  }
}, 150);

server.listen(PORT, "0.0.0.0", () => console.log(`RUSH Multiplayer running on port ${PORT}`));
