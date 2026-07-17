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
  move(dir) {
    socket.emit('move', { dir });
  },
  jump() {
    socket.emit('jump');
  },
  attack(key) {
    socket.emit('attack', { key });
  },
  rematch() {
    socket.emit('rematch');
  },
  get id() {
    return socket.id;
  },
};
