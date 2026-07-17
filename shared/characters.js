// Gameplay stats for the 4 characters. Visuals (spritesheet + animation frames)
// live separately in assets/sprites/manifest.json, matched by `id`.
//
// Every attack has the same shape so combat.js can handle them generically:
//   damage        - HP removed on a landed hit
//   startupMs     - delay from input before the hit becomes active (telegraph)
//   activeMs      - window during which the hitbox can actually land
//   recoveryMs    - time after the active window before the player can act again
//   cooldownMs    - time before this specific attack can be used again
//   hitboxWidth/Height - melee: a box extending in front of the player
//                        ranged: the projectile's own size
//   projectileSpeed/lifetimeMs - only set for longRange/special attacks that spawn
//                        a traveling projectile instead of an instant melee box

export const CHARACTERS = [
  {
    id: 'warrior',
    name: 'Warrior',
    blurb: 'Heavy sword, high damage up close.',
    attacks: {
      shortRange: {
        name: 'Slash',
        damage: 12,
        startupMs: 120,
        activeMs: 100,
        recoveryMs: 220,
        cooldownMs: 300,
        hitboxWidth: 60,
        hitboxHeight: 50,
      },
      longRange: {
        name: 'Throwing Knife',
        damage: 6,
        startupMs: 150,
        activeMs: 50,
        recoveryMs: 300,
        cooldownMs: 900,
        hitboxWidth: 16,
        hitboxHeight: 10,
        projectileSpeed: 520,
        projectileLifetimeMs: 900,
      },
      special: {
        name: 'Power Strike',
        damage: 24,
        startupMs: 400,
        activeMs: 120,
        recoveryMs: 400,
        cooldownMs: 3500,
        hitboxWidth: 80,
        hitboxHeight: 60,
        knockback: 260,
      },
    },
  },
  {
    id: 'archer',
    name: 'Archer',
    blurb: 'Fast bow, strong at range.',
    attacks: {
      shortRange: {
        name: 'Dagger Jab',
        damage: 7,
        startupMs: 90,
        activeMs: 80,
        recoveryMs: 180,
        cooldownMs: 250,
        hitboxWidth: 44,
        hitboxHeight: 40,
      },
      longRange: {
        name: 'Arrow Shot',
        damage: 14,
        startupMs: 120,
        activeMs: 50,
        recoveryMs: 260,
        cooldownMs: 700,
        hitboxWidth: 20,
        hitboxHeight: 8,
        projectileSpeed: 700,
        projectileLifetimeMs: 800,
      },
      special: {
        name: 'Volley',
        damage: 9,
        startupMs: 300,
        activeMs: 50,
        recoveryMs: 350,
        cooldownMs: 3800,
        hitboxWidth: 20,
        hitboxHeight: 8,
        projectileSpeed: 640,
        projectileLifetimeMs: 800,
        projectileCount: 3,
        projectileSpreadMs: 90,
      },
    },
  },
  {
    id: 'mage',
    name: 'Mage',
    blurb: 'Slow but devastating magic.',
    attacks: {
      shortRange: {
        name: 'Staff Bash',
        damage: 8,
        startupMs: 150,
        activeMs: 100,
        recoveryMs: 260,
        cooldownMs: 350,
        hitboxWidth: 50,
        hitboxHeight: 46,
      },
      longRange: {
        name: 'Fireball',
        damage: 16,
        startupMs: 220,
        activeMs: 60,
        recoveryMs: 340,
        cooldownMs: 950,
        hitboxWidth: 26,
        hitboxHeight: 26,
        projectileSpeed: 380,
        projectileLifetimeMs: 1100,
      },
      special: {
        name: 'Arcane Nova',
        damage: 26,
        startupMs: 550,
        activeMs: 150,
        recoveryMs: 500,
        cooldownMs: 4200,
        hitboxWidth: 130,
        hitboxHeight: 90,
        knockback: 320,
      },
    },
  },
  {
    id: 'rogue',
    name: 'Rogue',
    blurb: 'Fast flurries and a deadly dash.',
    attacks: {
      shortRange: {
        name: 'Dagger Flurry',
        damage: 9,
        startupMs: 70,
        activeMs: 90,
        recoveryMs: 150,
        cooldownMs: 220,
        hitboxWidth: 46,
        hitboxHeight: 42,
      },
      longRange: {
        name: 'Throwing Dagger',
        damage: 8,
        startupMs: 100,
        activeMs: 50,
        recoveryMs: 220,
        cooldownMs: 650,
        hitboxWidth: 16,
        hitboxHeight: 8,
        projectileSpeed: 780,
        projectileLifetimeMs: 700,
      },
      special: {
        name: 'Dash Strike',
        damage: 20,
        startupMs: 180,
        activeMs: 120,
        recoveryMs: 300,
        cooldownMs: 3200,
        hitboxWidth: 60,
        hitboxHeight: 50,
        dashSpeed: 900,
        dashMs: 180,
      },
    },
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id);
}
