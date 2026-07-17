// Shared between server and client so both agree on the rules of the world.

export const TICK_RATE = 30; // simulation steps per second
export const TICK_MS = 1000 / TICK_RATE;

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 300;
export const GROUND_Y = 240; // y coordinate of the floor (feet position)
export const PLAYER_WIDTH = 48;
export const PLAYER_HEIGHT = 64;

export const GRAVITY = 1400; // px/s^2, pulls jumpY back toward 0
export const MOVE_SPEED = 220; // px/s
export const JUMP_SPEED = 560; // px/s upward velocity applied on jump

export const MAX_HEALTH = 100;
export const ROUND_TIME_SECONDS = 90;
export const HURT_MS = 300; // hit-stun duration after landing a hit on someone

// Player can't leave the arena horizontally.
export const MIN_X = PLAYER_WIDTH / 2;
export const MAX_X = ARENA_WIDTH - PLAYER_WIDTH / 2;
