// Thin wrapper around the Socket.IO client (loaded globally via
// /socket.io/socket.io.js in index.html).

const socket = io();

export const network = {
  on(event, cb) {
    socket.on(event, cb);
  },
  selectCharacter(characterId) {
    socket.emit('selectCharacter', { characterId });
  },
  selectStage(stageId) {
    socket.emit('selectStage', { stageId });
  },
  move(dir) {
    socket.emit('move', { dir });
  },
  jump() {
    socket.emit('jump');
  },
  duck(active) {
    socket.emit('duck', { active });
  },
  sprint(active) {
    socket.emit('sprint', { active });
  },
  attack(key) {
    socket.emit('attack', { key });
  },
  rematch() {
    socket.emit('rematch');
  },
  taunt() {
    socket.emit('taunt');
  },
  get id() {
    return socket.id;
  },
};
