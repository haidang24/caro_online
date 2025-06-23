const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve CSS and JS files statically
app.use("/style.css", (req, res) => {
  res.setHeader("Content-Type", "text/css");
  fs.createReadStream(path.join(__dirname, "style.css")).pipe(res);
});

app.use("/script.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  fs.createReadStream(path.join(__dirname, "script.js")).pipe(res);
});

// Root route to render HTML
app.get("/", (req, res) => {
  fs.readFile(path.join(__dirname, "index.html"), "utf8", (err, data) => {
    if (err) {
      console.error("Error reading index.html:", err);
      return res.status(500).send("Error loading the game");
    }
    res.send(data);
  });
});

// Debug route to check if server is running
app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    connections: io.engine.clientsCount,
    rooms: Object.keys(rooms).length,
  });
});

// Game rooms and states
const rooms = {};
const DEFAULT_MOVE_TIME = 30; // Default time for each move in seconds

// Get all rooms info for the lobby
app.get("/api/rooms", (req, res) => {
  const publicRooms = {};

  for (const roomId in rooms) {
    const room = rooms[roomId];
    // Only include public rooms that aren't full
    if (room.isPublic && room.players.length < 2) {
      publicRooms[roomId] = {
        id: roomId,
        name: room.name,
        playerCount: room.players.length,
        boardSize: room.boardSize,
        moveTime: room.moveTime,
        blockTwoEnds: room.blockTwoEnds,
        createdBy: room.players[0]?.name || "Unknown",
      };
    }
  }

  res.json(publicRooms);
});

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  // Handle room creation
  socket.on(
    "createRoom",
    ({
      roomId,
      roomName,
      playerName,
      boardSize,
      moveTime,
      isPublic,
      blockTwoEnds,
    }) => {
      console.log("Create room request:", {
        roomId,
        roomName,
        playerName,
        blockTwoEnds,
      });

      // Validate if room already exists
      if (rooms[roomId]) {
        socket.emit("roomError", {
          message: "Phòng đã tồn tại, vui lòng chọn ID khác!",
        });
        return;
      }

      // Create new room
      rooms[roomId] = {
        id: roomId,
        name: roomName || `Phòng ${roomId}`,
        players: [],
        gameState: [],
        currentPlayer: "x",
        boardSize: parseInt(boardSize) || 15,
        moveTime: parseInt(moveTime) || DEFAULT_MOVE_TIME,
        gameActive: false, // Start as inactive until 2 players join
        isPublic: isPublic === undefined ? true : isPublic,
        blockTwoEnds: blockTwoEnds === true, // Store the block two ends setting
        timer: null,
        timeLeft: parseInt(moveTime) || DEFAULT_MOVE_TIME,
        soundEffects: true, // Default setting for sound effects
        lastWinner: null, // Track the last winner
      };

      console.log("Room created:", roomId);

      // Join the created room
      joinRoom(socket, roomId, playerName);
    }
  );

  // Handle user joining a room
  socket.on("joinRoom", ({ roomId, playerName }) => {
    console.log("Join room request:", { roomId, playerName });
    joinRoom(socket, roomId, playerName);
  });

  function joinRoom(socket, roomId, playerName) {
    console.log("Attempting to join room:", roomId);

    // Validate room exists
    if (!rooms[roomId]) {
      console.log("Room does not exist:", roomId);
      socket.emit("roomError", { message: "Phòng không tồn tại!" });
      return;
    }

    // Handle room joining logic
    const room = rooms[roomId];

    // If room is full
    if (room.players.length >= 2) {
      socket.emit("roomFull");
      return;
    }

    // Assign player symbol (x for first player, o for second)
    const symbol = room.players.length === 0 ? "x" : "o";

    // Add player to room
    const player = {
      id: socket.id,
      name: playerName,
      symbol: symbol,
    };

    room.players.push(player);
    socket.join(roomId);

    console.log(`Player ${playerName} (${symbol}) joined room ${roomId}`);

    // Send player info to client
    socket.emit("playerAssigned", {
      symbol,
      roomId,
      roomName: room.name,
      boardSize: room.boardSize,
      moveTime: room.moveTime,
      blockTwoEnds: room.blockTwoEnds,
      opponent: room.players.find((p) => p.id !== socket.id)?.name || null,
    });

    // Initialize game state if it's empty
    if (!room.gameState.length) {
      room.gameState = Array(room.boardSize)
        .fill()
        .map(() => Array(room.boardSize).fill(""));
    }

    // Notify room update
    io.to(roomId).emit("roomUpdate", {
      players: room.players,
      currentPlayer: room.currentPlayer,
      gameActive: room.gameActive,
      gameState: room.gameState,
      moveTime: room.moveTime,
      timeLeft: room.moveTime,
    });

    // If room is now full, start the game
    if (room.players.length === 2) {
      room.gameActive = true;
      room.timeLeft = room.moveTime;

      // Start the timer
      startTimer(roomId);

      console.log(`Game started in room ${roomId}`);

      io.to(roomId).emit("gameStart", {
        currentPlayer: room.currentPlayer,
        timeLeft: room.timeLeft,
      });
    }
  }

  // Handle player moves
  socket.on("makeMove", ({ roomId, row, col }) => {
    const room = rooms[roomId];

    if (!room || !room.gameActive) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Ensure it's the player's turn
    if (player.symbol !== room.currentPlayer) return;

    // Ensure cell is empty
    if (room.gameState[row][col] !== "") return;

    // Update game state
    room.gameState[row][col] = player.symbol;

    // Clear the current timer
    clearInterval(room.timer);

    // Check for win
    const win = checkWin(
      room.gameState,
      row,
      col,
      player.symbol,
      room.boardSize,
      room.blockTwoEnds
    );

    // Check for draw
    const draw = checkDraw(room.gameState);

    if (win) {
      room.gameActive = false;
      room.lastWinner = player.symbol; // Store the winner for the next game
      io.to(roomId).emit("gameEnd", {
        winner: player.symbol,
        gameState: room.gameState,
        winningMove: { row, col },
      });
    } else if (draw) {
      room.gameActive = false;
      io.to(roomId).emit("gameEnd", {
        draw: true,
        gameState: room.gameState,
      });
    } else {
      // Switch turns
      room.currentPlayer = room.currentPlayer === "x" ? "o" : "x";

      // Reset timer
      room.timeLeft = room.moveTime;
      startTimer(roomId);

      // Broadcast updated game state
      io.to(roomId).emit("gameUpdate", {
        gameState: room.gameState,
        currentPlayer: room.currentPlayer,
        lastMove: { row, col, player: player.symbol },
        timeLeft: room.timeLeft,
      });
    }
  });

  // Handle emoji reactions
  socket.on("sendEmoji", ({ roomId, emoji }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Broadcast emoji to all players in the room
    io.to(roomId).emit("emojiReceived", {
      emoji: emoji,
      player: player.symbol,
    });
  });

  // Start the move timer for a room
  function startTimer(roomId) {
    const room = rooms[roomId];
    if (!room || !room.gameActive) return;

    // Clear any existing timer
    if (room.timer) {
      clearInterval(room.timer);
    }

    room.timer = setInterval(() => {
      room.timeLeft -= 1;

      // Broadcast timer update
      io.to(roomId).emit("timerUpdate", { timeLeft: room.timeLeft });

      // Check if time is up
      if (room.timeLeft <= 0) {
        clearInterval(room.timer);

        // Handle timeout - the current player loses
        const timeoutPlayer = room.players.find(
          (p) => p.symbol === room.currentPlayer
        );
        const winner = room.players.find(
          (p) => p.symbol !== room.currentPlayer
        );

        if (timeoutPlayer && winner) {
          room.gameActive = false;
          room.lastWinner = winner.symbol; // Store the winner for the next game
          io.to(roomId).emit("gameEnd", {
            winner: winner.symbol,
            timeout: true,
            timeoutPlayer: timeoutPlayer.symbol,
            gameState: room.gameState,
          });
        }
      }
    }, 1000);
  }

  // Handle resetting the game
  socket.on("resetGame", ({ roomId }) => {
    const room = rooms[roomId];

    if (!room) return;

    // Clear any existing timer
    if (room.timer) {
      clearInterval(room.timer);
    }

    // Reset game state
    room.gameActive = true;

    // If there was a winner in the previous game, they go second (the other player goes first)
    if (room.lastWinner) {
      room.currentPlayer = room.lastWinner === "x" ? "o" : "x";
    } else {
      room.currentPlayer = "x"; // Default first player if no previous winner
    }

    room.timeLeft = room.moveTime;
    room.gameState = Array(room.boardSize)
      .fill()
      .map(() => Array(room.boardSize).fill(""));

    // Start the timer
    startTimer(roomId);

    // Broadcast reset
    io.to(roomId).emit("gameReset", {
      gameState: room.gameState,
      currentPlayer: room.currentPlayer,
      timeLeft: room.timeLeft,
    });
  });

  // Handle board size change
  socket.on("changeBoardSize", ({ roomId, size }) => {
    const room = rooms[roomId];

    if (!room) return;

    room.boardSize = size;
    room.gameState = Array(size)
      .fill()
      .map(() => Array(size).fill(""));

    io.to(roomId).emit("boardSizeChanged", {
      boardSize: size,
      gameState: room.gameState,
    });
  });

  // Handle move time change
  socket.on("changeMoveTime", ({ roomId, moveTime }) => {
    const room = rooms[roomId];

    if (!room) return;

    room.moveTime = moveTime;

    // Only update timeLeft if game is not active
    if (!room.gameActive) {
      room.timeLeft = moveTime;
    }

    io.to(roomId).emit("moveTimeChanged", {
      moveTime: moveTime,
    });
  });

  // Handle additional game settings
  socket.on("toggleSounds", ({ roomId, enabled }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.soundEffects = enabled;
    io.to(roomId).emit("soundsToggled", { enabled });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Find the room this player was in
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (!room || !room.players) continue; // Skip if room is invalid

      const playerIndex = room.players.findIndex((p) => p.id === socket.id);

      if (playerIndex !== -1) {
        // Get player info before removing
        const disconnectedPlayer = room.players[playerIndex];

        // Remove player from room
        room.players.splice(playerIndex, 1);

        // Stop game activity
        room.gameActive = false;
        if (room.timer) {
          clearInterval(room.timer);
        }

        // Notify remaining players that the room will be closed
        io.to(roomId).emit("playerDisconnected", {
          players: room.players,
          disconnectedPlayer: disconnectedPlayer,
        });

        // Schedule room deletion after a short delay to allow clients to process
        setTimeout(() => {
          delete rooms[roomId];
          console.log(`Room ${roomId} closed after player disconnect`);
        }, 5000);

        break;
      }
    }
  });
});

// Helper functions for game logic
function checkWin(board, row, col, player, boardSize, blockTwoEnds) {
  const directions = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal down
    [1, -1], // diagonal up
  ];

  return directions.some(([dx, dy]) => {
    const count =
      checkDirection(board, row, col, dx, dy, player, boardSize) +
      checkDirection(board, row, col, -dx, -dy, player, boardSize) -
      1;

    if (count >= 5) {
      // Chỉ kiểm tra chặn 2 đầu nếu luật này được bật
      if (blockTwoEnds) {
        const isBlocked = checkBlockedEnds(
          board,
          row,
          col,
          dx,
          dy,
          player,
          boardSize
        );
        return !isBlocked; // Chỉ thắng nếu KHÔNG bị chặn 2 đầu
      } else {
        return true; // Thắng ngay khi có 5 quân liên tiếp (luật cơ bản)
      }
    }
    return false;
  });
}

function checkDirection(board, row, col, dx, dy, player, boardSize) {
  let count = 0;
  let r = row;
  let c = col;

  while (
    r >= 0 &&
    r < boardSize &&
    c >= 0 &&
    c < boardSize &&
    board[r][c] === player &&
    count < 6
  ) {
    count++;
    r += dx;
    c += dy;
  }

  return count;
}

function checkBlockedEnds(board, row, col, dx, dy, player, boardSize) {
  // Tìm điểm đầu và cuối của dãy quân
  let startRow = row;
  let startCol = col;
  let endRow = row;
  let endCol = col;

  // Tìm điểm đầu
  while (
    startRow - dx >= 0 &&
    startRow - dx < boardSize &&
    startCol - dy >= 0 &&
    startCol - dy < boardSize &&
    board[startRow - dx][startCol - dy] === player
  ) {
    startRow -= dx;
    startCol -= dy;
  }

  // Tìm điểm cuối
  while (
    endRow + dx >= 0 &&
    endRow + dx < boardSize &&
    endCol + dy >= 0 &&
    endCol + dy < boardSize &&
    board[endRow + dx][endCol + dy] === player
  ) {
    endRow += dx;
    endCol += dy;
  }

  // Kiểm tra ô trước điểm đầu
  const startBlocked =
    startRow - dx < 0 ||
    startRow - dx >= boardSize ||
    startCol - dy < 0 ||
    startCol - dy >= boardSize ||
    board[startRow - dx][startCol - dy] === (player === "x" ? "o" : "x");

  // Kiểm tra ô sau điểm cuối
  const endBlocked =
    endRow + dx < 0 ||
    endRow + dx >= boardSize ||
    endCol + dy < 0 ||
    endCol + dy >= boardSize ||
    board[endRow + dx][endCol + dy] === (player === "x" ? "o" : "x");

  // Trả về true nếu cả hai đầu đều bị chặn
  return startBlocked && endBlocked;
}

function checkDraw(board) {
  return board.every((row) => row.every((cell) => cell !== ""));
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
