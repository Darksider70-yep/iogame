const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const GameRoom = require('./GameRoom');
const { PLANE_CLASSES } = require('./planeConfig');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve public static assets
app.use(express.static(path.join(__dirname, '../public')));

// API endpoint for plane configurations and classes
app.get('/api/planes', (req, res) => {
  res.json(PLANE_CLASSES);
});

// Single active game room for instant matchmaking
const gameRoom = new GameRoom({
  worldWidth: 6000,
  worldHeight: 6000,
  maxBots: 14
});

const clients = new Map(); // ws -> { id, player }

wss.on('connection', (ws) => {
  const clientId = `pilot_${uuidv4().substring(0, 8)}`;
  clients.set(ws, { id: clientId, player: null });

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw);

      if (msg.type === 'join') {
        const playerName = (msg.name || 'Ace Pilot').trim().substring(0, 16);
        const starterClass = msg.planeClass || 'biplane_scout';
        const player = gameRoom.addPlayer(clientId, playerName, starterClass);
        clients.get(ws).player = player;

        ws.send(JSON.stringify({
          type: 'init',
          id: clientId,
          world: { width: gameRoom.worldWidth, height: gameRoom.worldHeight },
          clouds: gameRoom.clouds,
          islands: gameRoom.islands,
          planeConfig: PLANE_CLASSES
        }));
      } else if (msg.type === 'input') {
        gameRoom.handlePlayerInput(clientId, msg.data);
      } else if (msg.type === 'upgrade') {
        gameRoom.handleUpgradeRequest(clientId, msg.stat);
      } else if (msg.type === 'evolve') {
        gameRoom.handleEvolveRequest(clientId, msg.classKey);
      } else if (msg.type === 'respawn') {
        gameRoom.handleRespawnRequest(clientId, msg.planeClass || 'biplane_scout');
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', time: msg.time }));
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    gameRoom.removePlayer(clientId);
    clients.delete(ws);
  });

  ws.on('error', () => {
    gameRoom.removePlayer(clientId);
    clients.delete(ws);
  });
});

// Broadcast game state to connected clients ~30 times per second
const BROADCAST_INTERVAL = 1000 / 30;
setInterval(() => {
  for (let [ws, clientInfo] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN && clientInfo.id) {
      const state = gameRoom.getClientState(clientInfo.id);
      ws.send(JSON.stringify({
        type: 'state',
        data: state
      }));
    }
  }
  gameRoom.flushEvents();
}, BROADCAST_INTERVAL);

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Wings of War .io Server running!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`=========================================`);
});
