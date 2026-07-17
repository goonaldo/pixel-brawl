# Pixel Brawl

A 2D, 8-bit-style local-network fighting game. One device hosts the game
server; two players connect from browsers on the same wifi and fight.

## Requirements

- [Node.js](https://nodejs.org/) (already installed on this machine)

## Run it

```bash
npm install   # first time only
npm start
```

The server prints two URLs:

```
Fighting game server running.
  This device: http://localhost:3000
  Same wifi:   http://192.168.x.x:3000
```

- **This device**: open `http://localhost:3000` in a browser for player 1.
- **Second device**: on any phone/laptop connected to the *same wifi/router*,
  open the "Same wifi" URL (e.g. `http://192.168.x.x:3000`) for player 2.

The first two browsers to connect are automatically matched into a game.
Extra connections wait in a queue for the next open match.

## Controls

| Action       | Key |
|--------------|-----|
| Move         | A / D (or Left/Right arrows) |
| Jump         | W (or Up arrow / Space) |
| Short-range attack | J |
| Long-range attack  | K |
| Special attack     | L |

## How a match works

1. Both players connect and each picks one of 4 characters (Warrior, Archer,
   Mage, Rogue) — every character has a different short-range, long-range,
   and special attack.
2. Fight until one player's health hits 0, or the 90-second clock runs out
   (whoever has more health wins; equal health is a draw).
3. Both players click **Rematch** to return to character select and go again.

## Project layout

- `server/` — authoritative Node.js game server (Express + Socket.IO). Runs
  the actual physics/combat simulation; browsers just send input and render
  whatever the server says happened.
- `public/` — browser client (HTML5 Canvas, no build step).
- `shared/` — game constants and character stats, imported by both the
  server and the client so they can never disagree about the rules.
- `assets/sprites/` — character spritesheets, adapted from the Liberated
  Pixel Cup (LPC) project. See `assets/CREDITS.md` for full attribution and
  license details (CC-BY-SA 3.0 / GPL 3.0) — keep that file if you fork or
  redistribute this project.

## Troubleshooting

- **Second device can't connect:** make sure both devices are on the same
  wifi network (not one on wifi and one on cellular data), and that no
  firewall is blocking incoming connections to port 3000 on the host device.
- **Port already in use:** stop whatever's already running on port 3000, or
  start with a different port: `PORT=3001 npm start`.
