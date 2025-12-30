const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

/**
 * lobbyId -> {
 *   players: [{ id, nickname }]
 *   assignments: { fromId: toId }
 *   words: { targetId: word }
 * }
 */
const lobbies = {};

function generateLobbyId() {
  return Math.random().toString(36).substring(2, 8);
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

io.on("connection", (socket) => {

  socket.on("create_lobby", ({ nickname }) => {
    const lobbyId = generateLobbyId();

    lobbies[lobbyId] = {
      hostId: socket.id, // 👑 хост
      players: [{ id: socket.id, nickname }],
      assignments: {},
      words: {}
    };

    socket.join(lobbyId);
    socket.emit("lobby_created", { lobbyId });
    io.to(lobbyId).emit("lobby_update", lobbies[lobbyId]);
  });

  socket.on("join_lobby", ({ lobbyId, nickname }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    lobby.players.push({ id: socket.id, nickname });
    socket.join(lobbyId);
    io.to(lobbyId).emit("lobby_update", lobby);
  });

  socket.on("start_game", ({ lobbyId }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    if (socket.id !== lobby.hostId) {
      return; // ❌ не хост — запрещено
    }

    const shuffled = shuffle(lobby.players);

    lobby.assignments = {};
    lobby.words = {};

    for (let i = 0; i < shuffled.length; i++) {
      const from = shuffled[i].id;
      const to = shuffled[(i + 1) % shuffled.length].id;
      lobby.assignments[from] = to;
    }

    io.to(lobbyId).emit("game_started", lobby.assignments);
  });

  socket.on("set_word", ({ lobbyId, word }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    const targetId = lobby.assignments[socket.id];
    if (!targetId) return;

    lobby.words[targetId] = word;

    // Отправляем слова КАЖДОМУ игроку персонально
    lobby.players.forEach(player => {
      const visibleWords = {};

      for (const [ownerId, w] of Object.entries(lobby.words)) {
        // ❌ владелец слова его НЕ видит
        visibleWords[ownerId] =
          ownerId === player.id ? null : w;
      }

      io.to(player.id).emit("words_update", visibleWords);
    });
  });

  socket.on("restart_game", ({ lobbyId }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    // 🔒 только хост
    if (socket.id !== lobby.hostId) {
      return;
    }

    const shuffled = shuffle(lobby.players);

    lobby.assignments = {};
    lobby.words = {};

    for (let i = 0; i < shuffled.length; i++) {
      const from = shuffled[i].id;
      const to = shuffled[(i + 1) % shuffled.length].id;
      lobby.assignments[from] = to;
    }

    // сообщаем всем о новом раунде
    io.to(lobbyId).emit("game_restarted", lobby.assignments);
  });

  socket.on("disconnect", () => {
    for (const lobbyId in lobbies) {
      const lobby = lobbies[lobbyId];
      lobby.players = lobby.players.filter(p => p.id !== socket.id);

      if (lobby.players.length === 0) {
        delete lobbies[lobbyId];
      } else {
        io.to(lobbyId).emit("lobby_update", lobby);
      }
    }
  });
});

server.listen(4000, () => {
  console.log("Backend запущен на http://localhost:4000");
});
