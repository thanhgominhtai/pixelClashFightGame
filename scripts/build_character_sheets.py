"""Build compact browser-ready sheets from character-owned source assets.

The source folders remain untouched. Generated files are deterministic and live
under public/generated/characters/<character-id>/ so Phaser never has to load
hundreds of 512px frames or animated GIFs at runtime.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageSequence


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Character_platformer"
OUTPUT = ROOT / "public" / "generated" / "characters"


def natural_key(path: Path) -> list[object]:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", path.stem)]


def rgba(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def png_frames(folder: Path) -> list[Image.Image]:
    return [rgba(path) for path in sorted(folder.glob("*.png"), key=natural_key)]


def gif_frames(path: Path) -> list[Image.Image]:
    with Image.open(path) as image:
        return [frame.convert("RGBA") for frame in ImageSequence.Iterator(image)]


def fit_frame(frame: Image.Image, cell_w: int, cell_h: int, scale_to: tuple[int, int] | None = None) -> Image.Image:
    if scale_to:
        frame = frame.resize(scale_to, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    x = (cell_w - frame.width) // 2
    y = cell_h - frame.height
    canvas.alpha_composite(frame, (x, y))
    return canvas


def save_sheet(
    character: str,
    state: str,
    frames: Iterable[Image.Image],
    cell_w: int,
    cell_h: int,
    scale_to: tuple[int, int] | None = None,
) -> Path:
    normalized = [fit_frame(frame, cell_w, cell_h, scale_to) for frame in frames]
    if not normalized:
        raise ValueError(f"No frames for {character}.{state}")
    sheet = Image.new("RGBA", (cell_w * len(normalized), cell_h), (0, 0, 0, 0))
    for index, frame in enumerate(normalized):
        sheet.alpha_composite(frame, (index * cell_w, 0))
    target = OUTPUT / character / f"{state}.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, optimize=True)
    return target


def save_portrait(
    character: str,
    frame: Image.Image,
    canvas_size: tuple[int, int] = (144, 84),
    fit_size: tuple[int, int] = (126, 76),
) -> None:
    target = OUTPUT / character / "portrait.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    bbox = frame.getbbox()
    cropped = frame.crop(bbox) if bbox else frame
    max_w, max_h = fit_size
    scale = min(max_w / max(1, cropped.width), max_h / max(1, cropped.height))
    scaled = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.NEAREST,
    )
    canvas_w, canvas_h = canvas_size
    portrait = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    portrait.alpha_composite(scaled, ((canvas_w - scaled.width) // 2, canvas_h - scaled.height - 2))
    portrait.save(target, optimize=True)


def build_dark_ninja() -> None:
    root = SOURCE / "Pixel_DarkNinja_32px" / "Pixel_DarkNinja_32px" / "frames"
    states = {
        "idle": ("Idle", 64),
        "run": ("Move", 64),
        "jump": ("Jump", 64),
        "light": ("Attack1", 96),
        "light1": ("Attack1", 96),
        "light2": ("Attack2", 96),
        "light3": ("Attack3", 96),
        "special": ("Attack3", 96),
        "ability": ("Attack2", 96),
        "roll": ("Invisibility", 64),
        "block": ("Defend", 64),
        "hurt": ("Hurt", 64),
    }
    for state, (folder, width) in states.items():
        save_sheet("dark_ninja", state, png_frames(root / folder), width, 64)
    teleport = png_frames(root / "Teleport1") + png_frames(root / "Teleport2")
    save_sheet("dark_ninja", "teleport", teleport, 64, 64)
    save_portrait("dark_ninja", png_frames(root / "Idle")[0])


def build_raptor() -> None:
    root = SOURCE / "raptor" / "raptor" / "png" / "1x"
    mapping = {
        "idle": "raptor-idle",
        "run": "raptor-run",
        "jump": "raptor-jump",
        "fall": "raptor-falling",
        "light": "raptor-bite",
        "special": "raptor-pounced-attack",
        "ability": "raptor-roar",
        "roll": "raptor-ready-pounce",
        "teleport": "raptor-pounce",
        "hurt": "raptor-on-hit",
        "ko": "raptor-dead",
        "charge": "raptor-scanning",
    }
    for state, folder in mapping.items():
        save_sheet("raptor", state, png_frames(root / folder), 128, 64)
    save_portrait("raptor", fit_frame(png_frames(root / "raptor-idle")[0], 128, 64))


def build_stick_fighter() -> None:
    root = SOURCE / "Stick Figure Character Sprites 2D" / "Stick Figure Character Sprites 2D" / "Fighter sprites"
    mapping = {
        "idle": "fighter_Idle_*.png",
        "run": "fighter_run_*.png",
        "jump": "fighter_jump_*.png",
        "light": "fighter_combo_*.png",
        "special": "fighter_air_attack_*.png",
        "ability": "fighter_combo_*.png",
        "roll": "fighter_slide_*.png",
        "teleport": "fighter_dash_*.png",
        "hurt": "fighter_hit_*.png",
        "ko": "fighter_death_*.png",
        "block": "fighter_Idle_*.png",
    }
    for state, pattern in mapping.items():
        source_frames = [rgba(path) for path in sorted(root.glob(pattern), key=natural_key)]
        save_sheet("stick_fighter", state, source_frames, 128, 128, (128, 128))
    portrait_source = rgba(sorted(root.glob("fighter_Idle_*.png"), key=natural_key)[0]).resize((128, 128), Image.Resampling.NEAREST)
    save_portrait("stick_fighter", portrait_source)


def build_vagabond() -> None:
    root = SOURCE / "vagabond" / "vagabond" / "assets" / "gif" / "1x"
    mapping = {
        "idle": ("vagabond-idle.gif", 64),
        "run": ("vagabond-run.gif", 64),
        "jump": ("vagabond-jump.gif", 64),
        "fall": ("vagabond-jump.gif", 64),
        "light": ("vagabond-attack.gif", 128),
        "special": ("vagabond-heavy-attack.gif", 128),
        "ability": ("vagabond-jump-attack.gif", 128),
        "roll": ("vagabond-dash.gif", 64),
        "teleport": ("vagabond-air-dash.gif", 64),
        "block": ("vagabond-block.gif", 64),
        "hurt": ("vagabond-knockback.gif", 64),
        "ko": ("vagabond-death.gif", 64),
        "charge": ("vagabond-heavy-attack.gif", 128),
    }
    for state, (filename, width) in mapping.items():
        save_sheet("vagabond", state, gif_frames(root / filename), width, 64)
    save_portrait("vagabond", gif_frames(root / "vagabond-idle.gif")[0])


def source_sheet_frame(path: Path, cell_w: int, cell_h: int, index: int = 0) -> Image.Image:
    sheet = rgba(path)
    columns = max(1, sheet.width // cell_w)
    x = (index % columns) * cell_w
    y = (index // columns) * cell_h
    return sheet.crop((x, y, x + cell_w, y + cell_h))


def build_direct_portraits() -> None:
    save_portrait(
        "buck",
        source_sheet_frame(SOURCE / "Buck Borris" / "Buck Borris" / "idle.png", 121, 23),
        canvas_size=(96, 96),
        fit_size=(88, 88),
    )
    save_portrait(
        "rogue",
        source_sheet_frame(SOURCE / "Fantasy Rogue" / "Full" / "Rogue - Full.png", 64, 64),
        canvas_size=(96, 96),
        fit_size=(88, 88),
    )
    save_portrait(
        "soul_knight",
        source_sheet_frame(SOURCE / "2D_SL_Knight_v1.0" / "Idle.png", 128, 64),
    )
    save_portrait(
        "dragon_knight",
        source_sheet_frame(
            SOURCE / "dragon_knight" / "dragon_knight" / "spritesheets" / "1x" / "dragon_knight_idle.png",
            96,
            64,
        ),
    )
    save_portrait(
        "iron_sentinel",
        source_sheet_frame(
            SOURCE / "iron_sentinel" / "iron_sentinel" / "spritesheets" / "1x" / "iron_sentinel_idle.png",
            64,
            64,
        ),
    )
    save_portrait(
        "purple_battlemage",
        source_sheet_frame(
            SOURCE / "PurpleGirl" / "PurpleGirl" / "Battlemage Complete (Sprite Sheet)" / "Idle" / "Battlemage Idle.png",
            56,
            48,
        ),
    )


def main() -> None:
    build_dark_ninja()
    build_raptor()
    build_stick_fighter()
    build_vagabond()
    build_direct_portraits()
    print(f"Generated character sheets in {OUTPUT}")


if __name__ == "__main__":
    main()
