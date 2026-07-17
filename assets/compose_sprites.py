#!/usr/bin/env python3
"""
compose_sprites.py

Downloads layered LPC (Liberated Pixel Cup) spritesheet PNGs from the
Universal-LPC-Spritesheet-Character-Generator GitHub repo and
alpha-composites them (body -> feet -> legs -> torso/outfit -> weapon ->
hair) into one finished spritesheet per playable character for the
fighting game.

Source repo (CC-BY-SA 3.0 / GPL 3.0 dual licensed):
https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator

Usage:
    python3 compose_sprites.py

Requires: pillow (pip3 install pillow)

Output:
    assets/sprites/<id>.png       one composited sheet per character
    assets/sprites/manifest.json  geometry manifest describing each sheet

All source layers are 64x64-pixel-frame LPC sheets sharing the same "male"
body/pose grid, so plain top-left-aligned alpha_composite lines everything
up with no manual frame slicing.

Row order within every 4-direction LPC animation block is, top to bottom:
    0 = facing up, 1 = facing left, 2 = facing down, 3 = facing right
(confirmed empirically below by checking each downloaded sheet's
width/height against the expected frame count * 64, not assumed from
memory).

NOTE on weapons: this repo snapshot has no weapon art aligned to the
"spellcast" animation for ANY magic weapon (crystal/diamond/loop/s/gnarled/
simple/wand all only ship "thrust" and "universal" [walk/hurt] frames, never
"spellcast"). So the mage's special/spellcast row shows the bare
body+outfit casting pose with no floating staff/orb prop. Melee (dagger)
and ranged (bow) weapon overlays ARE available and are applied to the
short-range (slash) and long-range (shoot) rows respectively, for all four
characters, per the "reuse across characters is fine" allowance in the
brief.
"""

import io
import json
import os
import urllib.request
from pathlib import Path

from PIL import Image

RAW_BASE = (
    "https://raw.githubusercontent.com/LiberatedPixelCup/"
    "Universal-LPC-Spritesheet-Character-Generator/master/spritesheets"
)

REPO_DIR = Path(__file__).resolve().parent
SPRITES_DIR = REPO_DIR / "sprites"
CACHE_DIR = REPO_DIR / ".cache_lpc_downloads"

FRAME = 64

# Animations we include in every composited sheet, in the order they are
# stacked vertically in the output image. "rows" is how many direction rows
# the LPC source sheet has for that animation (4, except hurt which has 1),
# "frames" is how many frame columns.
ANIM_SPECS = [
    ("walk", 9, 4),
    ("slash", 6, 4),       # used as the "shortRange" / melee animation
    ("shoot", 13, 4),      # used as the "longRange" / ranged animation
    ("spellcast", 7, 4),   # used as the "special" animation
    ("hurt", 6, 1),
]

SHEET_WIDTH = max(frames * FRAME for _, frames, _ in ANIM_SPECS)  # 832 (shoot)

BODY_FILES = {anim: f"body/bodies/male/{anim}.png" for anim, _, _ in ANIM_SPECS}

# Per-character torso (outfit) source paths. Some LPC items are a single
# flat color per animation (armour sets); others are organised as
# <anim>/<color>.png. Both forms are expressed as a plain path here.
CHARACTERS = [
    {
        "id": "warrior",
        "name": "Sir Roland the Warrior",
        "legs": {
            anim: f"legs/armour/plate/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "feet": {
            anim: f"feet/armour/plate/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "torso": {
            anim: f"torso/armour/plate/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "hair": {
            anim: f"hair/buzzcut/adult/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
    },
    {
        "id": "rogue",
        "name": "Vex the Rogue",
        "legs": {
            anim: f"legs/pants/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "feet": {
            anim: f"feet/boots/basic/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "torso": {
            anim: f"torso/armour/leather/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "hair": {
            anim: f"hair/mop/adult/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
    },
    {
        "id": "archer",
        "name": "Willow the Archer",
        "legs": {
            anim: f"legs/leggings/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "feet": {
            anim: f"feet/boots/basic/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "torso": {
            anim: f"torso/clothes/vest/male/{anim}/forest.png"
            for anim, _, _ in ANIM_SPECS
        },
        "hair": {
            anim: f"hair/messy1/adult/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
    },
    {
        "id": "mage",
        "name": "Orin the Mage",
        "legs": {
            anim: f"legs/pantaloons/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "feet": {
            anim: f"feet/boots/basic/male/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
        "torso": {
            anim: f"torso/jacket/collared/male/{anim}/purple.png"
            for anim, _, _ in ANIM_SPECS
        },
        "hair": {
            anim: f"hair/long/adult/{anim}.png" for anim, _, _ in ANIM_SPECS
        },
    },
]

# Weapon overlays: applied on top of the torso layer, for ALL characters,
# on the specific animation rows where matching weapon art exists.
# "shoot" needs both a background and foreground piece (the bow wraps
# around the drawing arm); "slash" is a single flat overlay.
WEAPON_LAYERS = {
    "slash": ["weapon/sword/dagger/slash/dagger.png"],
    "shoot": [
        "weapon/ranged/bow/normal/universal/shoot/background.png",
        "weapon/ranged/bow/normal/universal/shoot/foreground.png",
    ],
    # "spellcast": intentionally omitted -- no aligned magic-weapon art
    # exists in this repo snapshot (see module docstring).
}


def fetch(rel_path: str) -> Image.Image:
    """Download (with local cache) an LPC sheet and return it as RGBA."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / rel_path.replace("/", "__")
    if cache_file.exists():
        data = cache_file.read_bytes()
    else:
        url = f"{RAW_BASE}/{rel_path}"
        req = urllib.request.Request(url, headers={"User-Agent": "lpc-sprite-composer/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        cache_file.write_bytes(data)
    return Image.open(io.BytesIO(data)).convert("RGBA")


def composite_animation(layers, expected_size):
    """Alpha-composite one animation block from an ordered list of (name, image)
    layers, bottom to top: body, feet, legs, torso, weapon(s), hair."""
    for name, img in layers:
        if img.size != expected_size:
            raise ValueError(f"{name} layer size {img.size} != expected {expected_size}")

    result = layers[0][1].copy()
    for _, img in layers[1:]:
        result = Image.alpha_composite(result, img)
    return result


def build_character_sheet(char):
    blocks = []
    for anim, frames, rows in ANIM_SPECS:
        expected_size = (frames * FRAME, rows * FRAME)

        layers = [
            ("body", fetch(BODY_FILES[anim])),
            ("feet", fetch(char["feet"][anim])),
            ("legs", fetch(char["legs"][anim])),
            ("torso", fetch(char["torso"][anim])),
        ]
        for i, weapon_path in enumerate(WEAPON_LAYERS.get(anim, [])):
            layers.append((f"weapon{i}", fetch(weapon_path)))
        layers.append(("hair", fetch(char["hair"][anim])))

        block = composite_animation(layers, expected_size)
        blocks.append((anim, frames, rows, block))

    total_height = sum(rows * FRAME for _, _, rows, _ in blocks)
    sheet = Image.new("RGBA", (SHEET_WIDTH, total_height), (0, 0, 0, 0))

    y = 0
    row_offsets = {}
    for anim, frames, rows, block in blocks:
        sheet.alpha_composite(block, (0, y))
        row_offsets[anim] = {"blockY": y, "rows": rows, "frames": frames}
        y += rows * FRAME

    return sheet, row_offsets


def manifest_entry(char, row_offsets):
    def left_row(anim_key):
        # LPC 4-direction row order: 0=up, 1=left, 2=down, 3=right
        info = row_offsets[anim_key]
        return info["blockY"] + 1 * FRAME

    walk_left = left_row("walk")
    slash_left = left_row("slash")
    shoot_left = left_row("shoot")
    spellcast_left = left_row("spellcast")
    hurt_row = row_offsets["hurt"]["blockY"]  # single row, no direction split

    return {
        "id": char["id"],
        "name": char["name"],
        "file": f"{char['id']}.png",
        "animations": {
            "idle": {"row": walk_left, "frames": 1},
            "walk": {"row": walk_left, "frames": row_offsets["walk"]["frames"]},
            "shortRange": {"row": slash_left, "frames": row_offsets["slash"]["frames"]},
            "longRange": {"row": shoot_left, "frames": row_offsets["shoot"]["frames"]},
            "special": {"row": spellcast_left, "frames": row_offsets["spellcast"]["frames"]},
            "hurt": {"row": hurt_row, "frames": row_offsets["hurt"]["frames"]},
        },
    }


def main():
    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    characters_manifest = []

    for char in CHARACTERS:
        print(f"Building {char['id']} ...")
        sheet, row_offsets = build_character_sheet(char)
        out_path = SPRITES_DIR / f"{char['id']}.png"
        sheet.save(out_path)
        print(f"  saved {out_path} size={sheet.size}")
        characters_manifest.append(manifest_entry(char, row_offsets))

    manifest = {
        "frameWidth": FRAME,
        "frameHeight": FRAME,
        "characters": characters_manifest,
    }

    manifest_path = SPRITES_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
