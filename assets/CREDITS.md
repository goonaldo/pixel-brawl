# Art credits

All character sprites in `assets/sprites/*.png` are composited from layered
pixel-art spritesheets published by the **Liberated Pixel Cup (LPC)**
project, sourced from the community-maintained
[Universal-LPC-Spritesheet-Character-Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
GitHub repository (`master` branch).

## License

The LPC spritesheet assets are dual-licensed:

- **CC-BY-SA 3.0** (Creative Commons Attribution-ShareAlike 3.0) — https://creativecommons.org/licenses/by-sa/3.0/
- **GPL 3.0** (GNU General Public License 3.0) — https://www.gnu.org/licenses/gpl-3.0.html

You may use either license at your option. Both require attribution to the
original artists/contributors and, for CC-BY-SA specifically, that derivative
works (like the composited sheets in this repo) also be shared under
CC-BY-SA (or GPL, per the dual-license terms LPC assets are released under).

This game's composited spritesheets are themselves an adaptation ("mashup")
of many individually-licensed LPC layers, per the standard LPC combination
practice. See the repository's own `CREDITS.csv` /
`Fully expanded set attributions.txt` files at
https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
for the complete list of the hundreds of individual contributing artists
across all assets in the generator; the specific files pulled for this
project are listed below.

**Attribution line to use when redistributing this game's art:**
> Character sprites adapted from the Liberated Pixel Cup (LPC) asset
> collection, https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator,
> licensed CC-BY-SA 3.0 / GPL 3.0.

## How the sheets were built

`assets/compose_sprites.py` downloads the raw layer PNGs listed below from
`raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets/...`
and alpha-composites them, bottom to top: **body -> feet -> legs ->
torso/outfit -> weapon -> hair**, for each of 5 shared animations (walk,
slash, shoot, spellcast, hurt), then stacks those animation blocks
vertically into one PNG per character. All layers share the LPC "male"
adult body/pose grid (64x64 frames) so no manual frame alignment was
needed — see `assets/sprites/manifest.json` for the resulting geometry.

## Per-character source files

All four characters share the same base body and weapon layers; only the
outfit (torso/legs/feet) and hairstyle differ per character, which is what
makes them visually distinct at a glance.

### Shared body layer (all characters)
- `spritesheets/body/bodies/male/walk.png`
- `spritesheets/body/bodies/male/slash.png`
- `spritesheets/body/bodies/male/shoot.png`
- `spritesheets/body/bodies/male/spellcast.png`
- `spritesheets/body/bodies/male/hurt.png`

### Shared weapon layers (all characters)
- Melee (short range, used on the slash row): `spritesheets/weapon/sword/dagger/slash/dagger.png`
- Ranged (long range, used on the shoot row): `spritesheets/weapon/ranged/bow/normal/universal/shoot/background.png` and `.../foreground.png`
- Special/spellcast row: **no weapon overlay** — see "Known deviations" below.

### warrior — "Sir Roland the Warrior" (`warrior.png`)
Full steel plate armor, buzzcut hair.
- Torso: `spritesheets/torso/armour/plate/male/{walk,slash,shoot,spellcast,hurt}.png`
- Legs: `spritesheets/legs/armour/plate/male/{walk,slash,shoot,spellcast,hurt}.png`
- Feet: `spritesheets/feet/armour/plate/male/{walk,slash,shoot,spellcast,hurt}.png`
- Hair: `spritesheets/hair/buzzcut/adult/{walk,slash,shoot,spellcast,hurt}.png`

### rogue — "Vex the Rogue" (`rogue.png`)
Brown leather armor, tousled "mop" hair.
- Torso: `spritesheets/torso/armour/leather/male/{walk,slash,shoot,spellcast,hurt}.png`
- Legs: `spritesheets/legs/pants/male/{walk,slash,shoot,spellcast,hurt}.png`
- Feet: `spritesheets/feet/boots/basic/male/{walk,slash,shoot,spellcast,hurt}.png`
- Hair: `spritesheets/hair/mop/adult/{walk,slash,shoot,spellcast,hurt}.png`

### archer — "Willow the Archer" (`archer.png`)
Forest-green vest, leggings, "messy1" hair.
- Torso: `spritesheets/torso/clothes/vest/male/{walk,slash,shoot,spellcast,hurt}/forest.png`
- Legs: `spritesheets/legs/leggings/male/{walk,slash,shoot,spellcast,hurt}.png`
- Feet: `spritesheets/feet/boots/basic/male/{walk,slash,shoot,spellcast,hurt}.png`
- Hair: `spritesheets/hair/messy1/adult/{walk,slash,shoot,spellcast,hurt}.png`

### mage — "Orin the Mage" (`mage.png`)
Purple collared jacket (stand-in for a robe — see deviations), pantaloons, long hair.
- Torso: `spritesheets/torso/jacket/collared/male/{walk,slash,shoot,spellcast,hurt}/purple.png`
- Legs: `spritesheets/legs/pantaloons/male/{walk,slash,shoot,spellcast,hurt}.png`
- Feet: `spritesheets/feet/boots/basic/male/{walk,slash,shoot,spellcast,hurt}.png`
- Hair: `spritesheets/hair/long/adult/{walk,slash,shoot,spellcast,hurt}.png`

## Known deviations from a "perfect" LPC mashup

- **No robe for the mage.** The `spritesheets/dress` and
  `spritesheets/torso/clothes/robe` directories only ship `female`-body
  variants in this repo snapshot, which don't align with the `male` body
  grid used for the other three characters. A purple `torso/jacket/collared`
  overlay was used instead as a "wizard's coat" stand-in so all four
  characters keep a matching body/pose base.
- **No spellcast-aligned weapon prop.** Every magic-weapon folder in this
  snapshot (`weapon/magic/{crystal,diamond,loop,s,gnarled,simple,wand}`)
  only ships `thrust` and `universal` (walk/hurt) frames — none of them
  include a frame set aligned to the `spellcast` animation. The mage's
  (and everyone's) `special` row therefore shows the bare body+outfit
  casting pose with no glowing staff/orb overlay. This was verified by
  listing every subfolder under `spritesheets/weapon/magic/`, not assumed.
- **Single flat color for skin/hair/armor pieces.** Body, hair, and the
  armor-style torso/legs/feet sets (`plate`, `leather`, `pants`,
  `leggings`, `pantaloons`, boots) in this repo are checked in as one
  pre-baked preview color each (no per-color subfolders), unlike a few
  clothing items (`torso/clothes/vest`, `torso/jacket/collared`) which do
  ship a `color.png` per animation. This is why all four characters have
  the same ginger hair color and similar pale trouser/boot tone — outfit
  *shape/type* and torso *color* are what differentiate them, not a
  full palette swap. This is a genuine limitation of the assets available
  in this snapshot, not an oversight in the compositing script.
- **Weapon reuse.** Per the brief's explicit allowance, the same dagger and
  bow overlays are reused across all four characters (only the outfit
  differs) rather than sourcing a unique weapon per character.
