// Selectable platform layouts. `height` is expressed in the same unit as
// player.jumpY (px above the ground), not absolute canvas y — so "standing
// on a platform" is just jumpY === platform.height, and every place that
// already derives screen position from GROUND_Y - jumpY keeps working
// unchanged whether the player is on the floor or a platform.
//
// `floor` is the ground layer, expressed the same way as `platforms`
// (height 0). It's a list rather than one infinite strip so a stage can
// leave gaps in it — walking or getting knocked into a gap means falling
// with nothing underneath, an instant round loss (see server/match.js's
// fall-death check). Stages with a single -Infinity..Infinity segment have
// no gaps and are the "safe" stages.

const SIDE_LEDGES = [
  { id: 'left', x1: 190, x2: 390, height: 140 },
  { id: 'right', x1: 710, x2: 910, height: 140 },
];

export const STAGE_LAYOUTS = [
  {
    id: 'twin-ledges',
    name: 'Twin Ledges',
    blurb: 'Two side platforms. Simple and fast — solid ground, no pits.',
    platforms: SIDE_LEDGES,
    floor: [{ id: 'floor', x1: -Infinity, x2: Infinity, height: 0 }],
  },
  {
    id: 'three-tier',
    name: 'Three Tier',
    blurb: 'Side ledges plus a high center platform — mind the pit below it.',
    platforms: [
      ...SIDE_LEDGES,
      { id: 'center', x1: 460, x2: 640, height: 260 },
    ],
    floor: [
      { id: 'floor-a', x1: -Infinity, x2: 480, height: 0 },
      { id: 'floor-b', x1: 620, x2: Infinity, height: 0 },
    ],
  },
  {
    id: 'sky-temple',
    name: 'Sky Temple',
    blurb: 'A full vertical gauntlet — five platforms, three tiers, two pits.',
    platforms: [
      { id: 'low-left', x1: 110, x2: 300, height: 120 },
      { id: 'low-right', x1: 800, x2: 990, height: 120 },
      { id: 'mid-left', x1: 300, x2: 470, height: 260 },
      { id: 'mid-right', x1: 630, x2: 800, height: 260 },
      { id: 'top-center', x1: 470, x2: 630, height: 360 },
    ],
    // Players always spawn at x=150 / ARENA_WIDTH-150 (see match.js), so
    // both pits are kept well clear of those points — otherwise a fighter
    // could tip into a pit within their very first step.
    floor: [
      { id: 'floor-a', x1: -Infinity, x2: 250, height: 0 },
      { id: 'floor-b', x1: 360, x2: 790, height: 0 },
      { id: 'floor-c', x1: 860, x2: Infinity, height: 0 },
    ],
  },
  {
    id: 'the-abyss',
    name: 'The Abyss',
    blurb: 'No ground at all — just floating platforms over a bottomless drop.',
    // The two spawn platforms are sized to keep a wide margin around the
    // fixed spawn points (x=150 / ARENA_WIDTH-150) so nobody starts on an
    // edge. `floor` is intentionally empty — there is no safe ground
    // anywhere on this stage, so missing every platform means falling.
    platforms: [
      { id: 'spawn-left', x1: 60, x2: 260, height: 70 },
      { id: 'spawn-right', x1: 840, x2: 1040, height: 70 },
      { id: 'step-left', x1: 300, x2: 410, height: 190 },
      { id: 'step-right', x1: 690, x2: 800, height: 190 },
      { id: 'isle-low', x1: 470, x2: 630, height: 60 },
      { id: 'isle-high', x1: 500, x2: 600, height: 320 },
      { id: 'perch-left', x1: 140, x2: 240, height: 280 },
      { id: 'perch-right', x1: 860, x2: 960, height: 280 },
    ],
    floor: [],
  },
];

export function getStageLayout(id) {
  return STAGE_LAYOUTS.find((s) => s.id === id) || STAGE_LAYOUTS[0];
}
