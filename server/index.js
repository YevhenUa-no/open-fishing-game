import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { nanoid } from "nanoid";

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.get("/", (_req, res) => res.send("Open Fishing Game server is running."));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// ---- Game data ----------------------------------------------------------

const FISH_SPECIES = [
  { id: "sardine", name: "Sardine", rarity: "common", minSize: 10, maxSize: 20, weight: 60 },
  { id: "bass", name: "Sea Bass", rarity: "common", minSize: 20, maxSize: 45, weight: 45 },
  { id: "tuna", name: "Bluefin Tuna", rarity: "uncommon", minSize: 60, maxSize: 150, weight: 20 },
  { id: "swordfish", name: "Swordfish", rarity: "rare", minSize: 100, maxSize: 250, weight: 8 },
  { id: "kraken_spawn", name: "Kraken Spawn", rarity: "legendary", minSize: 30, maxSize: 60, weight: 1 },
];

function pickSpecies() {
  const totalWeight = FISH_SPECIES.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * totalWeight;
  for (const f of FISH_SPECIES) {
    if (r < f.weight) return f;
    r -= f.weight;
  }
  return FISH_SPECIES[0];
}

// World is a simple bounded area; positions are 0-1000 in both axes.
const WORLD_SIZE = 1000;

/** players: id -> { id, name, x, y, color, isFishing, catches } */
const players = new Map();

function publicPlayer(p) {
  const { id, name, x, y, color, isFishing } = p;
  return { id, name, x, y, color, isFishing };
}

function broadcastPlayerList() {
  io.emit("players:update", Array.from(players.values()).map(publicPlayer));
}

const COLORS = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#1a936f", "#f4a259", "#a06cd5", "#5390d9"];

io.on("connection", (socket) => {
  socket.on("player:join", (name) => {
    const safeName = (name || "Angler").toString().slice(0, 16);
    const player = {
      id: socket.id,
      name: safeName,
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      isFishing: false,
      catches: [],
    };
    players.set(socket.id, player);

    socket.emit("world:init", {
      selfId: socket.id,
      worldSize: WORLD_SIZE,
      players: Array.from(players.values()).map(publicPlayer),
      leaderboard: getLeaderboard(),
    });

    broadcastPlayerList();
    io.emit("chat:system", `${safeName} joined the waters.`);
  });

  socket.on("player:move", (pos) => {
    const p = players.get(socket.id);
    if (!p) return;
    if (typeof pos?.x !== "number" || typeof pos?.y !== "number") return;
    p.x = Math.max(0, Math.min(WORLD_SIZE, pos.x));
    p.y = Math.max(0, Math.min(WORLD_SIZE, pos.y));
    socket.broadcast.emit("player:moved", { id: socket.id, x: p.x, y: p.y });
  });

  socket.on("fish:cast", () => {
    const p = players.get(socket.id);
    if (!p) return;
    p.isFishing = true;
    io.emit("fish:casting", { id: socket.id });
  });

  // Client sends result of the local timing minigame (0..1 accuracy).
  // Server is authoritative about *what* fish you get, based on that accuracy.
  socket.on("fish:reel", (accuracy) => {
    const p = players.get(socket.id);
    if (!p) return;
    p.isFishing = false;

    const clamped = Math.max(0, Math.min(1, Number(accuracy) || 0));
    const success = clamped > 0.35; // must hit at least a decent timing accuracy

    if (!success) {
      socket.emit("fish:result", { success: false });
      io.emit("fish:done", { id: socket.id });
      return;
    }

    const species = pickSpecies();
    const size = Math.round(
      species.minSize + (species.maxSize - species.minSize) * clamped
    );
    const catchRecord = { speciesId: species.id, name: species.name, rarity: species.rarity, size, ts: Date.now() };
    p.catches.push(catchRecord);

    socket.emit("fish:result", { success: true, catch: catchRecord });
    io.emit("chat:system", `${p.name} caught a ${size}cm ${species.name}!`);
    io.emit("fish:done", { id: socket.id });
    io.emit("leaderboard:update", getLeaderboard());
  });

  socket.on("chat:message", (text) => {
    const p = players.get(socket.id);
    if (!p || !text) return;
    io.emit("chat:message", { name: p.name, text: text.toString().slice(0, 200) });
  });

  socket.on("disconnect", () => {
    const p = players.get(socket.id);
    players.delete(socket.id);
    if (p) {
      io.emit("chat:system", `${p.name} left the waters.`);
      io.emit("player:left", { id: socket.id });
      broadcastPlayerList();
    }
  });
});

function getLeaderboard() {
  return Array.from(players.values())
    .map((p) => ({
      name: p.name,
      totalCatches: p.catches.length,
      biggest: p.catches.reduce((max, c) => Math.max(max, c.size), 0),
    }))
    .sort((a, b) => b.biggest - a.biggest)
    .slice(0, 10);
}

server.listen(PORT, () => {
  console.log(`Open Fishing Game server listening on :${PORT}`);
});
