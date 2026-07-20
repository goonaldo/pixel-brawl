// Random one-liners shown in a speech bubble above a player's head when
// they press T. Deliberately obnoxious.

export const TAUNTS = [
  'Is that all you got?',
  'My grandma hits harder.',
  'Skill issue.',
  "You're just mad you're bad.",
  'L + ratio.',
  'Ez clap.',
  'Uninstall.',
  'Did you forget how to fight?',
  'Certified bot move.',
  'Sit down.',
  'Not even trying.',
  'Free win, thanks!',
  'Ggs already lol',
  'This is embarrassing for you.',
  'Ping me when you learn to block.',
  'Free elo.',
  'Wow. Just wow.',
  "That's a skill diff.",
  'Wake up, champ.',
  "You're doing great! (lying)",
];

export function randomTaunt() {
  return TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
}
