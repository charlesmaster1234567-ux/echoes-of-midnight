#!/usr/bin/env python3
# ═════════════════════════════════════════════════════════════════
#  ICON_GENERATOR.PY — Echoes of Midnight  PWA Icon Factory
#  Uses ImageMagick (magick) — no pip, no Pillow, nothing to install
#
#  Requirements:
#      ImageMagick installed (you already have it)
#
#  Usage:
#      python icon_generator.py
# ═════════════════════════════════════════════════════════════════

import os
import sys
import subprocess
import shutil
from pathlib import Path


# ═════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═════════════════════════════════════════════════════════════════

SOURCE_IMAGE = r"C:\Users\VIP Student\Downloads\skull-3d-icon-png-download-13228165-modified.png"

SCRIPT_DIR = Path(__file__).parent.resolve()
OUTPUT_DIR = SCRIPT_DIR / "icons"
SHOTS_DIR  = SCRIPT_DIR / "screenshots"

# ── Horror theme colours (ImageMagick hex) ───────────────────────
BG_COLOR       = "#130f0f"   # body background — exact match
GLOW_COLOR     = "#b41414"   # blood red glow
BORDER_COLOR   = "#501414"   # dark red border
MASKABLE_BG    = "#0d0a0a"   # slightly darker for maskable

# ── Standard PWA icon sizes ──────────────────────────────────────
ICON_SIZES = [
    16, 32, 48, 57, 60, 70, 72, 76, 96,
    114, 120, 128, 144, 150, 152, 167,
    180, 192, 256, 310, 384, 512
]

# ── Maskable icon sizes ──────────────────────────────────────────
MASKABLE_SIZES = [192, 512]

# ── Apple touch icon sizes ───────────────────────────────────────
APPLE_SIZES = [57, 60, 72, 76, 114, 120, 144, 152, 167, 180]

# ── Windows tile sizes (width, height) ──────────────────────────
WINDOWS_TILES = [
    (70,  70),
    (150, 150),
    (310, 150),
    (310, 310),
]

# ── Favicon sizes (bundled into one .ico) ───────────────────────
FAVICON_SIZES = [16, 32, 48]


# ═════════════════════════════════════════════════════════════════
#  IMAGEMAGICK RUNNER
# ═════════════════════════════════════════════════════════════════

def magick(*args, label=None):
    """
    Run an ImageMagick command.
    Always uses 'magick' (ImageMagick 7+).
    Prints the label, prints the command on failure.
    """
    cmd = ["magick"] + [str(a) for a in args]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"\n✗ ImageMagick failed:")
        print(f"  Command : {' '.join(cmd)}")
        print(f"  Error   : {result.stderr.strip()}")
        # Don't sys.exit — keep generating what we can
        return False

    if label:
        print(f"    ✓ {label}")

    return True


def check_magick():
    """Verify ImageMagick is available and print version."""
    result = subprocess.run(
        ["magick", "--version"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("✗ ImageMagick not found.")
        print("  Download from: https://imagemagick.org/script/download.php")
        sys.exit(1)

    # Extract version line
    version_line = result.stdout.splitlines()[0] if result.stdout else "unknown"
    print(f"✓ {version_line}")


def check_source(path: str) -> Path:
    """Verify source image exists."""
    p = Path(path)
    if not p.exists():
        print(f"\n✗ SOURCE IMAGE NOT FOUND:\n  {path}")
        print("  Check the path and try again.")
        sys.exit(1)

    # Get image info via magick
    result = subprocess.run(
        ["magick", "identify", "-format", "%wx%h %m", str(p)],
        capture_output=True, text=True
    )
    info = result.stdout.strip() if result.returncode == 0 else "unknown"
    print(f"✓ Source loaded: {p.name}  ({info})")
    return p


def log(msg, indent=0):
    print("  " * indent + msg)


# ═════════════════════════════════════════════════════════════════
#  CORE MAGICK COMMANDS
#  Every icon style is built from these reusable command builders.
# ═════════════════════════════════════════════════════════════════

def horror_icon_cmd(src: Path, size: int, out: Path,
                    skull_pct: float = 0.78):
    """
    Build a horror-themed icon:
      - Dark background (#130f0f)
      - Blood red radial glow behind skull
      - Skull composited at skull_pct of canvas size
      - Dark vignette corners
    """
    skull_px = int(size * skull_pct)
    glow_r   = int(size * 0.42)
    blur_r   = max(2, size // 8)

    magick(
        # ── 1. Create background canvas ───────────────────────────
        "-size", f"{size}x{size}",
        f"xc:{BG_COLOR}",

        # ── 2. Create glow layer and composite onto bg ────────────
        "(",
            "-size", f"{size}x{size}",
            "xc:none",
            "-fill", GLOW_COLOR,
            "-draw", f"circle {size//2},{size//2} {size//2},{size//2 - glow_r}",
            "-blur", f"0x{blur_r}",
            "-level", "0%,100%,0.6",
        ")",
        "-compose", "Screen",
        "-composite",

        # ── 3. Resize skull and composite centre ──────────────────
        "(",
            str(src),
            "-resize", f"{skull_px}x{skull_px}",
            "-gravity", "Center",
        ")",
        "-gravity", "Center",
        "-compose", "Over",
        "-composite",

        # ── 4. Vignette ───────────────────────────────────────────
        "(",
            "-size", f"{size}x{size}",
            "xc:none",
            "-fill", "none",
            "-stroke", "black",
            "-strokewidth", str(max(2, size // 6)),
            "-draw", f"rectangle 0,0 {size},{size}",
            "-blur", f"0x{max(3, size // 5)}",
        ")",
        "-compose", "Multiply",
        "-composite",

        # ── 5. Output ─────────────────────────────────────────────
        "-type", "TrueColorAlpha",
        str(out),

        label=out.name
    )


def maskable_icon_cmd(src: Path, size: int, out: Path):
    """
    Maskable icon — skull must sit inside central 80% safe zone.
    Uses 72% skull size with a solid background so Android
    can clip it to any shape (circle, squircle, etc.)
    """
    skull_px = int(size * 0.72)
    glow_r   = int(size * 0.35)
    blur_r   = max(2, size // 9)

    magick(
        # Solid background (no transparency for maskable)
        "-size", f"{size}x{size}",
        f"xc:{MASKABLE_BG}",

        # Glow
        "(",
            "-size", f"{size}x{size}",
            "xc:none",
            "-fill", GLOW_COLOR,
            "-draw", f"circle {size//2},{size//2} {size//2},{size//2 - glow_r}",
            "-blur", f"0x{blur_r}",
            "-level", "0%,100%,0.5",
        ")",
        "-compose", "Screen",
        "-composite",

        # Skull — strictly inside safe zone
        "(",
            str(src),
            "-resize", f"{skull_px}x{skull_px}",
            "-gravity", "Center",
        ")",
        "-gravity", "Center",
        "-compose", "Over",
        "-composite",

        # Subtle dark border
        "-stroke", BORDER_COLOR,
        "-strokewidth", str(max(1, size // 64)),
        "-fill", "none",
        "-draw", f"rectangle 0,0 {size-1},{size-1}",

        # Flatten to remove any residual alpha
        "-flatten",
        str(out),

        label=out.name
    )


def apple_icon_cmd(src: Path, size: int, out: Path):
    """
    Apple touch icons — solid background, no transparency.
    Apple clips corners automatically so we export flat square.
    """
    skull_px = int(size * 0.76)
    glow_r   = int(size * 0.40)
    blur_r   = max(2, size // 8)

    magick(
        "-size", f"{size}x{size}",
        f"xc:{BG_COLOR}",

        # Glow
        "(",
            "-size", f"{size}x{size}",
            "xc:none",
            "-fill", GLOW_COLOR,
            "-draw", f"circle {size//2},{size//2} {size//2},{size//2 - glow_r}",
            "-blur", f"0x{blur_r}",
            "-level", "0%,100%,0.55",
        ")",
        "-compose", "Screen",
        "-composite",

        # Skull
        "(",
            str(src),
            "-resize", f"{skull_px}x{skull_px}",
        ")",
        "-gravity", "Center",
        "-compose", "Over",
        "-composite",

        # Flatten — Apple needs fully opaque
        "-flatten",
        str(out),

        label=out.name
    )


def wide_tile_cmd(src: Path, w: int, h: int, out: Path):
    """
    Windows wide/rectangular tile.
    Skull sits in the right half, text area implied on left.
    """
    sk   = min(w, h)
    blur = max(2, sk // 8)
    gr   = int(sk * 0.40)

    magick(
        "-size", f"{w}x{h}",
        f"xc:{BG_COLOR}",

        # Glow (centred in right half for wide, centred overall for square)
        "(",
            "-size", f"{w}x{h}",
            "xc:none",
            "-fill", GLOW_COLOR,
            "-draw", f"circle {w//2},{h//2} {w//2},{h//2 - gr}",
            "-blur", f"0x{blur}",
            "-level", "0%,100%,0.45",
        ")",
        "-compose", "Screen",
        "-composite",

        # Skull
        "(",
            str(src),
            "-resize", f"{sk}x{sk}",
        ")",
        "-gravity", "Center",
        "-compose", "Over",
        "-composite",

        "-flatten",
        str(out),

        label=out.name
    )


# ═════════════════════════════════════════════════════════════════
#  FAVICON.ICO — multi-resolution Windows favicon
# ═════════════════════════════════════════════════════════════════

def make_favicon(src: Path, out_dir: Path):
    log("Generating favicon.ico ...", 1)

    # Generate temp PNGs for each favicon size
    tmp_files = []
    for s in FAVICON_SIZES:
        tmp = out_dir / f"_tmp_favicon_{s}.png"
        horror_icon_cmd(src, s, tmp)
        tmp_files.append(str(tmp))

    # Bundle into one .ico
    out = out_dir / "favicon.ico"
    magick(*tmp_files, str(out), label="favicon.ico")

    # Clean up temp files
    for t in tmp_files:
        try: Path(t).unlink()
        except: pass


# ═════════════════════════════════════════════════════════════════
#  OPEN GRAPH IMAGE — 1200×630 social share
# ═════════════════════════════════════════════════════════════════

def make_og_image(src: Path, out_dir: Path):
    log("Generating Open Graph image ...", 1)

    w, h     = 1200, 630
    skull_sz = 480
    blur_r   = 60

    out_jpg = out_dir / "og-image.jpg"
    out_png = out_dir / "og-image.png"

    # Build the OG image
    magick(
        # Background
        "-size", f"{w}x{h}",
        f"xc:{BG_COLOR}",

        # Large glow right-of-centre
        "(",
            "-size", f"{w}x{h}",
            "xc:none",
            "-fill", GLOW_COLOR,
            "-draw", f"circle {w - skull_sz // 2 - 60},{h//2}"
                     f" {w - skull_sz // 2 - 60},{h//2 - 220}",
            "-blur", f"0x{blur_r}",
            "-level", "0%,100%,0.5",
        ")",
        "-compose", "Screen",
        "-composite",

        # Skull — right side
        "(",
            str(src),
            "-resize", f"{skull_sz}x{skull_sz}",
        ")",
        "-gravity", "East",
        "-geometry", f"+60+0",
        "-compose", "Over",
        "-composite",

        # Title text
        "-gravity", "West",
        "-font", "Georgia",
        "-pointsize", "72",
        "-fill", "#b49060",
        "-annotate", "+60-80", "ECHOES OF",
        "-fill", "#dc3232",
        "-annotate", "+60-0", "MIDNIGHT",
        "-pointsize", "28",
        "-fill", "#786050",
        "-annotate", "+62+80", "A Mystical Horror Thriller",
        "-pointsize", "22",
        "-fill", "#605040",
        "-annotate", "+62+120", "Find the seals. Survive the night.",
        "-annotate", "+62+150", "Break the loop — or become part of it.",

        # Vignette
        "(",
            "-size", f"{w}x{h}",
            "xc:none",
            "-fill", "none",
            "-stroke", "black",
            "-strokewidth", "120",
            "-draw", f"rectangle 0,0 {w},{h}",
            "-blur", "0x40",
        ")",
        "-compose", "Multiply",
        "-composite",

        "-flatten",
        "-quality", "92",
        str(out_jpg),

        label="og-image.jpg"
    )

    # PNG version
    magick(
        "-size", f"{w}x{h}",
        f"xc:{BG_COLOR}",
        "(",
            "-size", f"{w}x{h}",
            "xc:none",
            "-fill", GLOW_COLOR,
            "-draw", f"circle {w - skull_sz//2 - 60},{h//2}"
                     f" {w - skull_sz//2 - 60},{h//2 - 220}",
            "-blur", f"0x{blur_r}",
            "-level", "0%,100%,0.5",
        ")",
        "-compose", "Screen",
        "-composite",
        "(",
            str(src),
            "-resize", f"{skull_sz}x{skull_sz}",
        ")",
        "-gravity", "East",
        "-geometry", "+60+0",
        "-compose", "Over",
        "-composite",
        "-gravity", "West",
        "-font", "Georgia",
        "-pointsize", "72",
        "-fill", "#b49060",
        "-annotate", "+60-80", "ECHOES OF",
        "-fill", "#dc3232",
        "-annotate", "+60-0", "MIDNIGHT",
        "-pointsize", "28",
        "-fill", "#786050",
        "-annotate", "+62+80", "A Mystical Horror Thriller",
        str(out_png),

        label="og-image.png"
    )


# ═════════════════════════════════════════════════════════════════
#  SCREENSHOT PLACEHOLDERS
# ═════════════════════════════════════════════════════════════════

def make_screenshots(src: Path, shots_dir: Path):
    log("Generating screenshot placeholders ...", 1)
    shots_dir.mkdir(exist_ok=True)

    specs = [
        ("gameplay-wide.png",   1280, 720),
        ("gameplay-narrow.png", 750,  1334),
    ]

    for filename, w, h in specs:
        sk   = min(w, h) // 2
        out  = shots_dir / filename

        magick(
            "-size", f"{w}x{h}",
            f"xc:{BG_COLOR}",

            # Glow
            "(",
                "-size", f"{w}x{h}",
                "xc:none",
                "-fill", GLOW_COLOR,
                "-draw", f"circle {w//2},{h//2} {w//2},{h//2 - sk//2}",
                "-blur", f"0x{sk//4}",
                "-level", "0%,100%,0.4",
            ")",
            "-compose", "Screen",
            "-composite",

            # Skull
            "(",
                str(src),
                "-resize", f"{sk}x{sk}",
            ")",
            "-gravity", "Center",
            "-geometry", f"+0-{h//10}",
            "-compose", "Over",
            "-composite",

            # Text
            "-gravity", "South",
            "-font", "Georgia",
            "-pointsize", "32",
            "-fill", "#b49060",
            "-annotate", "+0+80", "ECHOES OF MIDNIGHT",
            "-pointsize", "18",
            "-fill", "#504030",
            "-annotate", "+0+45", "[ Replace with real gameplay screenshot ]",

            # Vignette
            "(",
                "-size", f"{w}x{h}",
                "xc:none",
                "-fill", "none",
                "-stroke", "black",
                "-strokewidth", str(max(30, min(w, h) // 8)),
                "-draw", f"rectangle 0,0 {w},{h}",
                "-blur", f"0x{max(10, min(w,h)//12)}",
            ")",
            "-compose", "Multiply",
            "-composite",

            "-flatten",
            str(out),

            label=filename
        )


# ═════════════════════════════════════════════════════════════════
#  ALL GENERATORS
# ═════════════════════════════════════════════════════════════════

def make_standard_icons(src: Path, out_dir: Path):
    log("Generating standard PWA icons ...", 1)
    for s in ICON_SIZES:
        out = out_dir / f"icon-{s}.png"
        horror_icon_cmd(src, s, out)


def make_maskable_icons(src: Path, out_dir: Path):
    log("Generating maskable icons ...", 1)
    for s in MASKABLE_SIZES:
        out = out_dir / f"icon-maskable-{s}.png"
        maskable_icon_cmd(src, s, out)


def make_apple_icons(src: Path, out_dir: Path):
    log("Generating Apple touch icons ...", 1)
    for s in APPLE_SIZES:
        out = out_dir / f"apple-touch-icon-{s}x{s}.png"
        apple_icon_cmd(src, s, out)
    # Default (no size suffix)
    apple_icon_cmd(src, 180, out_dir / "apple-touch-icon.png")


def make_windows_tiles(src: Path, out_dir: Path):
    log("Generating Windows tile icons ...", 1)
    for (w, h) in WINDOWS_TILES:
        out = out_dir / f"icon-{w}x{h}.png"
        wide_tile_cmd(src, w, h, out)


# ═════════════════════════════════════════════════════════════════
#  REPORT
# ═════════════════════════════════════════════════════════════════

def print_report(out_dir: Path, shots_dir: Path):
    all_files = list(out_dir.rglob("*.*")) + list(shots_dir.rglob("*.*"))
    total_kb  = sum(f.stat().st_size for f in all_files if f.exists()) / 1024
    total_mb  = total_kb / 1024

    print("\n" + "═" * 62)
    print("  GENERATION COMPLETE")
    print("═" * 62)
    print(f"  Files created : {len(all_files)}")
    print(f"  Total size    : {total_mb:.2f} MB  ({int(total_kb)} KB)")
    print(f"  Icons folder  : {out_dir}")
    print(f"  Screenshots   : {shots_dir}")
    print("═" * 62)

    print("\n  All files:")
    base = out_dir.parent
    for f in sorted(all_files):
        if not f.exists():
            continue
        kb  = f.stat().st_size / 1024
        rel = f.relative_to(base)
        print(f"    {str(rel):<50}  {kb:>7.1f} KB")

    print("\n  Paste into your index.html <head>:")
    print("  " + "─" * 58)
    print("""
  <!-- PWA -->
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#0b0b0b">

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon"       href="icons/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="icons/icon-16.png">

  <!-- Apple -->
  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon-180x180.png">
  <link rel="apple-touch-icon" sizes="167x167" href="icons/apple-touch-icon-167x167.png">
  <link rel="apple-touch-icon" sizes="152x152" href="icons/apple-touch-icon-152x152.png">

  <!-- Windows -->
  <meta name="msapplication-TileImage"           content="icons/icon-144.png">
  <meta name="msapplication-TileColor"           content="#130f0f">
  <meta name="msapplication-square70x70logo"     content="icons/icon-70x70.png">
  <meta name="msapplication-square150x150logo"   content="icons/icon-150x150.png">
  <meta name="msapplication-wide310x150logo"     content="icons/icon-310x150.png">
  <meta name="msapplication-square310x310logo"   content="icons/icon-310x310.png">

  <!-- Open Graph -->
  <meta property="og:image"        content="icons/og-image.jpg">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:title"        content="Echoes of Midnight">
  <meta property="og:description"  content="A mystical horror thriller. Find the seals. Break the loop.">
    """)


# ═════════════════════════════════════════════════════════════════
#  MAIN
# ═════════════════════════════════════════════════════════════════

def main():
    print("\n" + "═" * 62)
    print("  ECHOES OF MIDNIGHT — ImageMagick Icon Generator")
    print("═" * 62 + "\n")

    # ── Check tools ───────────────────────────────────────────────
    check_magick()
    src = check_source(SOURCE_IMAGE)
    print()

    # ── Prepare output folders ────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SHOTS_DIR.mkdir(parents=True, exist_ok=True)
    log(f"✓ icons/       → {OUTPUT_DIR}")
    log(f"✓ screenshots/ → {SHOTS_DIR}")
    print()

    # ── Generate ──────────────────────────────────────────────────
    make_standard_icons(src, OUTPUT_DIR)
    print()
    make_maskable_icons(src, OUTPUT_DIR)
    print()
    make_apple_icons(src, OUTPUT_DIR)
    print()
    make_windows_tiles(src, OUTPUT_DIR)
    print()
    make_favicon(src, OUTPUT_DIR)
    print()
    make_og_image(src, OUTPUT_DIR)
    print()
    make_screenshots(src, SHOTS_DIR)

    # ── Report ────────────────────────────────────────────────────
    print_report(OUTPUT_DIR, SHOTS_DIR)

    print("\n  ✓ Drop icons/ and screenshots/ into your game folder.")
    print("  ✓ Replace screenshot placeholders with real gameplay shots.")
    print("  ✓ Copy the <head> snippet above into your index.html.\n")


if __name__ == "__main__":
    main()