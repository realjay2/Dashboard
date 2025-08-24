const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");

const config = require("./config.json");
const PORT = config.server.port || 3000;
const STORAGE_FILE = path.join(__dirname, "storage", "users.json");

if (!fs.existsSync(path.dirname(STORAGE_FILE))) {
  fs.mkdirSync(path.dirname(STORAGE_FILE), { recursive: true });
}
if (!fs.existsSync(STORAGE_FILE)) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify({ users: {} }, null, 2));
}

function readStorage() {
  return JSON.parse(fs.readFileSync(STORAGE_FILE, "utf8"));
}
function writeStorage(data) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(bodyParser.json());
app.use(session({
  secret: config.server.sessionSecret,
  resave: false,
  saveUninitialized: true
}));

app.post("/api/link", (req, res) => {
  const { discordId, username, avatar } = req.body;
  if (!discordId || !username) {
    return res.status(400).json({ error: "Missing discordId or username" });
  }
  const storage = readStorage();
  if (!storage.users[discordId]) {
    storage.users[discordId] = {
      username,
      avatar: avatar || null,
      stats: { games: 0, wins: 0, losses: 0 },
      offers: []
    };
  } else {
    storage.users[discordId].username = username;
    storage.users[discordId].avatar = avatar || storage.users[discordId].avatar;
  }
  writeStorage(storage);
  res.json({ success: true, user: storage.users[discordId] });
});

app.get("/api/stats/:discordId", (req, res) => {
  const { discordId } = req.params;
  const storage = readStorage();
  const user = storage.users[discordId];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user.stats);
});

app.post("/api/stats/:discordId", (req, res) => {
  const { discordId } = req.params;
  const { games, wins, losses } = req.body;
  const storage = readStorage();
  const user = storage.users[discordId];
  if (!user) return res.status(404).json({ error: "User not found" });
  if (games !== undefined) user.stats.games = games;
  if (wins !== undefined) user.stats.wins = wins;
  if (losses !== undefined) user.stats.losses = losses;
  writeStorage(storage);
  res.json({ success: true, stats: user.stats });
});

app.get("/api/offers/:discordId", (req, res) => {
  const { discordId } = req.params;
  const storage = readStorage();
  const user = storage.users[discordId];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user.offers);
});

app.post("/api/offers/:discordId", (req, res) => {
  const { discordId } = req.params;
  const { status } = req.body;
  const storage = readStorage();
  const user = storage.users[discordId];
  if (!user) return res.status(404).json({ error: "User not found" });
  const newOffer = { id: Date.now(), status: status || "Pending" };
  user.offers.push(newOffer);
  writeStorage(storage);
  res.json({ success: true, offers: user.offers });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});