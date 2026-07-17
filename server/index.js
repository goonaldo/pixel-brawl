import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import { CHARACTERS } from '../shared/characters.js';
import { Match } from './match.js';
import { startGameLoop } from './gameLoop.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);
}

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

app.get('/api/host-info', (req, res) => {
  res.json({ port: PORT, addresses: getLanAddresses() });
});

const server = http.createServer(app);
const io = new Server(server);

const matches = new Map(); // matchId -> Match
const socketToMatch = new Map(); // socket.id -> matchId
let lobby = []; // socket ids waiting for an opponent
let matchCounter = 0;

function tryMatchmake() {
  lobby = lobby.filter((id) => io.sockets.sockets.has(id));
  while (lobby.length >= 2) {
    const idA = lobby.shift();
    const idB = lobby.shift();
    const matchId = `m${matchCounter++}`;
    const match = new Match(matchId, [idA, idB]);
    matches.set(matchId, match);
    socketToMatch.set(idA, matchId);
    socketToMatch.set(idB, matchId);

    const sockA = io.sockets.sockets.get(idA);
    const sockB = io.sockets.sockets.get(idB);
    sockA?.join(matchId);
    sockB?.join(matchId);

    io.to(matchId).emit('matchFound', { matchId, characters: CHARACTERS });
    sockA?.emit('youAre', { id: idA, opponentId: idB });
    sockB?.emit('youAre', { id: idB, opponentId: idA });
  }
}

function endMatchFor(socketId, notifyOpponent) {
  const matchId = socketToMatch.get(socketId);
  if (!matchId) return;
  const match = matches.get(matchId);
  socketToMatch.delete(socketId);
  if (match) {
    const opponent = match.getOpponent(socketId);
    if (opponent) {
      socketToMatch.delete(opponent.id);
      if (notifyOpponent) io.to(matchId).emit('opponentDisconnected');
    }
    matches.delete(matchId);
  }
}

io.on('connection', (socket) => {
  lobby.push(socket.id);
  socket.emit('waiting');
  tryMatchmake();

  socket.on('selectCharacter', ({ characterId } = {}) => {
    matches.get(socketToMatch.get(socket.id))?.selectCharacter(socket.id, characterId);
  });

  socket.on('move', ({ dir } = {}) => {
    matches.get(socketToMatch.get(socket.id))?.setMoveDir(socket.id, dir);
  });

  socket.on('jump', () => {
    matches.get(socketToMatch.get(socket.id))?.jump(socket.id);
  });

  socket.on('attack', ({ key } = {}) => {
    matches.get(socketToMatch.get(socket.id))?.startAttack(socket.id, key);
  });

  socket.on('rematch', () => {
    matches.get(socketToMatch.get(socket.id))?.requestRematch(socket.id);
  });

  socket.on('disconnect', () => {
    lobby = lobby.filter((id) => id !== socket.id);
    endMatchFor(socket.id, true);
  });
});

startGameLoop(io, matches);

server.listen(PORT, '0.0.0.0', () => {
  const addresses = getLanAddresses();

  console.log(`\nFighting game server running.`);
  console.log(`  This device: http://localhost:${PORT}`);
  for (const addr of addresses) {
    console.log(`  Same wifi:   http://${addr}:${PORT}`);
  }
  console.log('');
});
