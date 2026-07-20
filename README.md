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
| Duck         | S (or Down arrow) |
| Sprint       | Shift (hold) |
| Short-range attack | J |
| Long-range attack  | K |
| Special attack     | L |
| Taunt              | T |

A few moves are combos on the keys above rather than their own key, the same
way every other input is server-resolved from your held state:

| Move | Combo |
|------|-------|
| Ground Smash (fast fall + AoE landing hit) | Duck + J, while airborne |
| Spin Kick (wide hit on both sides) | Sprint + J, while grounded |
| Throw (unblockable grab, close range) | Duck + K, while grounded |
| Launcher Kick (pops the opponent upward) | L, while airborne |

## How a match works

1. Both players connect and each picks one of 4 characters (Warrior, Archer,
   Mage, Rogue) — every character has a different short-range, long-range,
   and special attack.
2. Fight until one player's health hits 0, or the 90-second clock runs out
   (whoever has more health wins; equal health is a draw). Landing hits
   builds a combo counter and score — chained hits within 1.5s are worth
   progressively more.
   - The **Three Tier** and **Sky Temple** stages have bottomless pits in
     the floor, and **The Abyss** has no floor at all — just platforms over
     a bottomless drop. Fall into one and you instantly lose the round, same
     as health hitting 0. **Twin Ledges** has solid ground throughout and is
     always safe.
3. Press **T** to taunt — pops an obnoxious speech bubble above your
   fighter's head (rate-limited so it can't be spammed).
4. Both players click **Rematch** to return to character select and go again.

## Audio

- Everything — sound effects (jumps, swings, impacts, taunts, victory/defeat
  fanfares, UI blips) **and** the background music — is synthesized live in
  the browser with the Web Audio API. No sound asset files to manage.
- The match music is a small original step-sequenced loop (kick/snare/hihat
  beat, bassline, riff stabs) built from the same oscillator/noise primitives
  as the sound effects. It plays during the fight and stops when the round
  ends. Use the speaker button in the HUD to mute — mute silences music and
  SFX together, instantly.

## Project layout

- `server/` — authoritative Node.js game server (Express + Socket.IO). Runs
  the actual physics/combat simulation; browsers just send input and render
  whatever the server says happened.
- `public/` — browser client (HTML5 Canvas, no build step). Fighters are
  drawn procedurally from rotated primitives each frame (no spritesheets or
  asset pipeline) — see `public/src/renderer.js`.
- `shared/` — game constants, character stats, stage layouts, and taunt
  lines, imported by both the server and the client so they can never
  disagree about the rules.

## Troubleshooting

- **Second device can't connect:** make sure both devices are on the same
  wifi network (not one on wifi and one on cellular data), and that no
  firewall is blocking incoming connections to port 3000 on the host device.
- **Port already in use:** stop whatever's already running on port 3000, or
  start with a different port: `PORT=3001 npm start`.
