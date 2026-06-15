#!/usr/bin/env python3
"""
ECHOES OF MIDNIGHT — Sound Pack Downloader (yt-dlp edition)
Downloads real audio from YouTube using yt-dlp + ffmpeg
Auto-renames everything to exact required filenames
"""

import os
import time
import json
import subprocess
import sys
import shutil
from pathlib import Path

# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR          = Path("sounds")
DELAY             = 0.5     # polite seconds between downloads
AUDIO_QUALITY     = "128"
AUDIO_FORMAT      = "mp3"

# ============================================================
# AUTO-DETECT yt-dlp — works whether installed via
# winget, pip, or python -m yt_dlp
# ============================================================

def find_ytdlp():
    """
    Return the command list to invoke yt-dlp.
    Tries  (1) yt-dlp on PATH
           (2) python -m yt_dlp   (pip install yt-dlp)
    """
    # 1 — direct binary
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]

    # 2 — python module
    try:
        result = subprocess.run(
            [sys.executable, "-m", "yt_dlp", "--version"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return [sys.executable, "-m", "yt_dlp"]
    except Exception:
        pass

    return None          # not found anywhere

YT_DLP = find_ytdlp()   # resolved once at startup

# ============================================================
# FOLDER STRUCTURE
# ============================================================

FOLDERS = [
    "sounds/music",
    "sounds/ambience",
    "sounds/sfx",
    "sounds/voices",
]

# ============================================================
# SOUND MANIFEST
# Format: (output_filename, youtube_search_query)
# ============================================================

MUSIC = [
    (
        "menu_theme.mp3",
        "ytsearch1:dark horror piano loop ambient no copyright"
    ),
    (
        "foyer_piano.mp3",
        "ytsearch1:haunting ghost piano loop no copyright free use"
    ),
    (
        "library_piano.mp3",
        "ytsearch1:soft contemplative piano ambient loop no copyright"
    ),
    (
        "upstairs_strings.mp3",
        "ytsearch1:eerie strings slow horror ambient loop no copyright"
    ),
    (
        "basement_drone.mp3",
        "ytsearch1:deep dark drone horror ambient no melody no copyright"
    ),
    (
        "ritual_chants.mp3",
        "ytsearch1:ominous ritual chanting dark ambient no copyright"
    ),
    (
        "void_ambience.mp3",
        "ytsearch1:void darkness deep ambient horror loop no copyright"
    ),
    (
        "garden_melancholy.mp3",
        "ytsearch1:melancholy sad piano strings outdoor ambient no copyright"
    ),
    (
        "chapel_organ.mp3",
        "ytsearch1:slow church organ sacred horror ambient no copyright"
    ),
    (
        "combat_tension.mp3",
        "ytsearch1:tense combat strings fast horror music no copyright"
    ),
    (
        "ending_liberation.mp3",
        "ytsearch1:hopeful rising orchestral ending music no copyright"
    ),
    (
        "ending_dark.mp3",
        "ytsearch1:dark crushing orchestral ending horror no copyright"
    ),
    (
        "ending_dawn.mp3",
        "ytsearch1:triumphant beautiful dawn orchestral no copyright"
    ),
    (
        "ending_sacrifice.mp3",
        "ytsearch1:bittersweet peaceful piano ending no copyright"
    ),
]

AMBIENCE = [
    (
        "wind_inside.mp3",
        "ytsearch1:gentle indoor wind ambience loop no copyright"
    ),
    (
        "wind_outside.mp3",
        "ytsearch1:strong outdoor wind storm ambience loop no copyright"
    ),
    (
        "wind_howling.mp3",
        "ytsearch1:howling wind intense ambience loop no copyright"
    ),
    (
        "rain_light.mp3",
        "ytsearch1:light rain on window glass ambience loop no copyright"
    ),
    (
        "fire_crackling.mp3",
        "ytsearch1:fireplace crackling fire ambience loop no copyright"
    ),
    (
        "water_dripping.mp3",
        "ytsearch1:water dripping echo cave ambience loop no copyright"
    ),
    (
        "heartbeat_slow.mp3",
        "ytsearch1:slow deep heartbeat loop sound effect no copyright"
    ),
    (
        "crickets_night.mp3",
        "ytsearch1:night crickets outdoor ambience loop no copyright"
    ),
    (
        "owl_distant.mp3",
        "ytsearch1:distant owl hoot night ambience no copyright"
    ),
    (
        "water_lapping.mp3",
        "ytsearch1:water lapping stone shore ambience loop no copyright"
    ),
    (
        "deep_hum.mp3",
        "ytsearch1:low frequency deep hum drone ambient loop no copyright"
    ),
    (
        "void_pulse.mp3",
        "ytsearch1:dark pulsing void ambient horror loop no copyright"
    ),
    (
        "choir_distant.mp3",
        "ytsearch1:faint distant choir ambient loop no copyright"
    ),
    (
        "clock_ticking.mp3",
        "ytsearch1:grandfather clock ticking ambience loop no copyright"
    ),
    (
        "piano_distant.mp3",
        "ytsearch1:faint distant piano notes ambience loop no copyright"
    ),
    (
        "music_box.mp3",
        "ytsearch1:haunting music box melody loop no copyright"
    ),
]

SFX = [
    (
        "footstep_wood.mp3",
        "ytsearch1:single wood floor footstep sound effect no copyright"
    ),
    (
        "footstep_stone.mp3",
        "ytsearch1:single stone floor footstep sound effect no copyright"
    ),
    (
        "footstep_grass.mp3",
        "ytsearch1:single grass footstep crunch sound effect no copyright"
    ),
    (
        "door_open.mp3",
        "ytsearch1:slow old creaky door opening sound effect no copyright"
    ),
    (
        "door_slam.mp3",
        "ytsearch1:heavy door slam sound effect no copyright"
    ),
    (
        "door_creak.mp3",
        "ytsearch1:slow door hinge creak horror sound effect no copyright"
    ),
    (
        "door_lock.mp3",
        "ytsearch1:door lock click mechanism sound effect no copyright"
    ),
    (
        "item_pickup.mp3",
        "ytsearch1:item pickup soft chime sound effect game no copyright"
    ),
    (
        "item_use.mp3",
        "ytsearch1:item use interaction click sound effect no copyright"
    ),
    (
        "clock_chime.mp3",
        "ytsearch1:single clock bell chime sound effect no copyright"
    ),
    (
        "lock_unlock.mp3",
        "ytsearch1:lock unlocking mechanism click sound effect no copyright"
    ),
    (
        "glass_break.mp3",
        "ytsearch1:glass breaking shatter sound effect no copyright"
    ),
    (
        "chain_rattle.mp3",
        "ytsearch1:metal chain rattling clank sound effect no copyright"
    ),
    (
        "time_reset.mp3",
        "ytsearch1:time warp whoosh reverb sound effect no copyright"
    ),
    (
        "level_up.mp3",
        "ytsearch1:level up achievement chime game sound effect no copyright"
    ),
    (
        "book_open.mp3",
        "ytsearch1:old book opening pages sound effect no copyright"
    ),
    (
        "flashlight_click.mp3",
        "ytsearch1:flashlight switch click on off sound effect no copyright"
    ),
    (
        "flashlight_flicker.mp3",
        "ytsearch1:flashlight flicker electrical buzz sound effect no copyright"
    ),
    (
        "piano_key_single.mp3",
        "ytsearch1:single piano key press note sound effect no copyright"
    ),
    (
        "bell_toll.mp3",
        "ytsearch1:large church bell tolling deep sound effect no copyright"
    ),
    (
        "thunder_distant.mp3",
        "ytsearch1:distant thunder rumble sound effect no copyright"
    ),
    (
        "match_strike.mp3",
        "ytsearch1:match being struck ignite fire sound effect no copyright"
    ),
    (
        "candle_light.mp3",
        "ytsearch1:candle lighting flame sound effect no copyright"
    ),
    (
        "achievement_unlock.mp3",
        "ytsearch1:achievement unlock fanfare sound effect game no copyright"
    ),
    (
        "attack_swing.mp3",
        "ytsearch1:weapon sword swing whoosh attack sound effect no copyright"
    ),
    (
        "hit_enemy.mp3",
        "ytsearch1:hitting enemy impact thud sound effect no copyright"
    ),
    (
        "hit_player.mp3",
        "ytsearch1:player damage hit grunt sound effect no copyright"
    ),
    (
        "enemy_death.mp3",
        "ytsearch1:monster enemy death sound effect no copyright"
    ),
    (
        "boss_appear.mp3",
        "ytsearch1:boss entrance dramatic sting sound effect no copyright"
    ),
    (
        "seal_found.mp3",
        "ytsearch1:magical discovery chime seal found sound effect no copyright"
    ),
    (
        "seal_restore.mp3",
        "ytsearch1:magic power restore seal sound effect no copyright"
    ),
    (
        "rocking_horse.mp3",
        "ytsearch1:wooden rocking horse creak sound effect no copyright"
    ),
    (
        "gramophone_static.mp3",
        "ytsearch1:old gramophone vinyl static playing sound effect no copyright"
    ),
]

VOICES = [
    (
        "whisper_help.mp3",
        "ytsearch1:ghost whisper help voice sound effect horror no copyright"
    ),
    (
        "whisper_run.mp3",
        "ytsearch1:ghost whisper run away voice sound effect horror no copyright"
    ),
    (
        "whisper_find_me.mp3",
        "ytsearch1:ghost whisper find me voice sound effect horror no copyright"
    ),
    (
        "whisper_leave.mp3",
        "ytsearch1:ghost whisper leave voice sound effect horror no copyright"
    ),
    (
        "child_laugh.mp3",
        "ytsearch1:creepy child laughing horror sound effect no copyright"
    ),
    (
        "child_crying.mp3",
        "ytsearch1:child crying sobbing sad sound effect no copyright"
    ),
    (
        "child_giggle.mp3",
        "ytsearch1:child giggling playful horror sound effect no copyright"
    ),
    (
        "woman_moan.mp3",
        "ytsearch1:woman moaning pain ghost horror sound effect no copyright"
    ),
    (
        "woman_scream_distant.mp3",
        "ytsearch1:distant woman scream horror sound effect no copyright"
    ),
    (
        "man_groan.mp3",
        "ytsearch1:man groaning pain horror sound effect no copyright"
    ),
    (
        "breathing_close.mp3",
        "ytsearch1:close heavy breathing horror sound effect no copyright"
    ),
    (
        "breathing_distant.mp3",
        "ytsearch1:distant faint breathing sound effect horror no copyright"
    ),
    (
        "entity_growl.mp3",
        "ytsearch1:monster entity growl creature sound effect no copyright"
    ),
    (
        "entity_roar.mp3",
        "ytsearch1:monster entity roar loud sound effect no copyright"
    ),
    (
        "ghost_footsteps.mp3",
        "ytsearch1:ghost ethereal footsteps walking sound effect no copyright"
    ),
    (
        "scare_stab.mp3",
        "ytsearch1:jump scare horror sting stab sound effect no copyright"
    ),
]

# ============================================================
# PRE-FLIGHT CHECKS
# ============================================================

def check_ytdlp():
    if YT_DLP is None:
        print("   ✗ yt-dlp not found anywhere.")
        print("     Fix:  pip install yt-dlp")
        print("     Then reopen PowerShell and try again.")
        return False

    try:
        r = subprocess.run(
            YT_DLP + ["--version"],
            capture_output=True, text=True, timeout=10
        )
        print(f"   ✓ yt-dlp found via:  {' '.join(YT_DLP)}")
        print(f"   ✓ yt-dlp version:    {r.stdout.strip()}")
        return True
    except Exception as e:
        print(f"   ✗ yt-dlp check failed: {e}")
        return False

def check_ffmpeg():
    try:
        r = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True, text=True, timeout=10
        )
        first = r.stdout.splitlines()[0]
        print(f"   ✓ ffmpeg found:      {first}")
        return True
    except FileNotFoundError:
        print("   ✗ ffmpeg not found.")
        print("     Fix:  winget install ffmpeg")
        return False

# ============================================================
# DOWNLOADER
# ============================================================

def download_sound(query, output_path):
    """
    Search YouTube with yt-dlp and save the top result
    as an MP3 to output_path with the exact filename required.
    """
    output_path = Path(output_path)
    out_template = str(output_path.with_suffix("")) + ".%(ext)s"

    cmd = YT_DLP + [
        # ── source ──────────────────────────────────────────
        query,                           # "ytsearch1:..."

        # ── audio extraction ────────────────────────────────
        "--extract-audio",
        "--audio-format",    AUDIO_FORMAT,
        "--audio-quality",   AUDIO_QUALITY + "K",

        # ── output ──────────────────────────────────────────
        "--output",          out_template,

        # ── clean flags ─────────────────────────────────────
        "--no-playlist",
        "--no-warnings",
        "--quiet",
        "--progress",        # show a progress bar per file

        # ── embed metadata ──────────────────────────────────
        "--embed-metadata",

        # ── retries ─────────────────────────────────────────
        "--retries",         "3",
        "--fragment-retries","3",

        # ── throttle protection ─────────────────────────────
        "--sleep-interval",      "1",
        "--max-sleep-interval",  "3",
    ]

    try:
        result = subprocess.run(
            cmd,
            timeout=180,        # 3 min hard cap per file
            text=True,
        )

        if result.returncode == 0:
            if output_path.exists() and output_path.stat().st_size > 1000:
                kb = output_path.stat().st_size // 1024
                print(f"     ✓ Saved  ({kb} KB) → {output_path.name}")
                return True
            else:
                print(f"     ✗ File missing after download.")
                return False
        else:
            print(f"     ✗ yt-dlp exit code {result.returncode}")
            return False

    except subprocess.TimeoutExpired:
        print(f"     ✗ Timed out (180 s)")
        return False
    except Exception as e:
        print(f"     ✗ Error: {e}")
        return False

# ============================================================
# PLACEHOLDER GENERATOR  (silent MP3 so game never crashes)
# ============================================================

def create_placeholder(filepath):
    id3   = bytes([0x49,0x44,0x33,0x03,0x00,0x00,
                   0x00,0x00,0x00,0x00])
    frame = bytes([0xFF,0xFB,0x90,0x00]) + bytes(413)
    with open(filepath, "wb") as f:
        f.write(id3 + frame)
    print(f"     📄 Placeholder → {Path(filepath).name}")

# ============================================================
# CATEGORY PROCESSOR
# ============================================================

def process_category(cat_name, folder, sounds):
    real = placeholders = 0
    total = len(sounds)

    print(f"\n{'═'*62}")
    print(f"  📂  {cat_name}  ({total} files)")
    print(f"{'═'*62}")

    for idx, (filename, query) in enumerate(sounds, 1):
        dest = Path(folder) / filename

        print(f"\n  [{idx:02d}/{total:02d}]  {filename}")

        # ── already on disk? ─────────────────────────────────
        if dest.exists() and dest.stat().st_size > 5000:
            print(f"     ⏭  Already downloaded — skipping.")
            real += 1
            time.sleep(DELAY)
            continue

        # ── show search term ─────────────────────────────────
        readable = query.replace("ytsearch1:", "")
        print(f"     🔍  {readable}")

        # ── attempt download ──────────────────────────────────
        ok = download_sound(query, dest)

        if ok:
            real += 1
        else:
            create_placeholder(dest)
            placeholders += 1

        # ── polite delay ──────────────────────────────────────
        time.sleep(DELAY)

    return real, placeholders

# ============================================================
# SUPPORT FILES
# ============================================================

def write_manifest(all_categories):
    manifest = {}
    for cat_name, folder, sounds in all_categories:
        manifest[cat_name] = []
        for filename, query in sounds:
            fp = Path(folder) / filename
            exists = fp.exists()
            size   = fp.stat().st_size if exists else 0
            manifest[cat_name].append({
                "file":        filename,
                "exists":      exists,
                "size_kb":     round(size / 1024, 1),
                "placeholder": exists and size < 5000,
                "query":       query.replace("ytsearch1:", ""),
            })
    out = BASE_DIR / "manifest.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"   📋 manifest.json       → {out}")

def write_retry_script(all_categories):
    lines = [
        "#!/usr/bin/env python3",
        '"""Re-download only placeholder files."""',
        "import subprocess, sys, time, shutil",
        "from pathlib import Path",
        "",
        "def find_ytdlp():",
        "    import shutil",
        "    if shutil.which('yt-dlp'): return ['yt-dlp']",
        "    try:",
        "        import subprocess",
        "        r = subprocess.run([sys.executable,'-m','yt_dlp','--version'],",
        "            capture_output=True,timeout=10)",
        "        if r.returncode==0: return [sys.executable,'-m','yt_dlp']",
        "    except: pass",
        "    return None",
        "",
        "YT = find_ytdlp()",
        "if not YT: sys.exit('yt-dlp not found')",
        "",
        "QUEUE = [",
    ]

    for cat_name, folder, sounds in all_categories:
        for filename, query in sounds:
            fp = Path(folder) / filename
            if fp.exists() and fp.stat().st_size < 5000:
                lines.append(f"    ({repr(str(fp))}, {repr(query)}),")

    lines += [
        "]",
        "",
        "print(f'Retrying {len(QUEUE)} placeholder(s)...')",
        "for dest, query in QUEUE:",
        "    p = Path(dest)",
        "    out = str(p.with_suffix('')) + '.%(ext)s'",
        "    print(f'  → {p.name}')",
        "    subprocess.run(YT + [",
        "        query,",
        "        '--extract-audio','--audio-format','mp3',",
        "        '--audio-quality','128K',",
        "        '--output', out,",
        "        '--no-playlist','--quiet','--progress',",
        "    ])",
        "    time.sleep(0.5)",
    ]

    out_path = BASE_DIR / "retry_placeholders.py"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"   🔁 retry_placeholders.py → {out_path}")

def write_credits():
    txt = (
        "ECHOES OF MIDNIGHT — Audio Credits\n"
        "=====================================\n"
        "Sounds sourced from YouTube via yt-dlp.\n\n"
        "Before shipping, verify each file's license.\n"
        "Prefer: No Copyright Music / CC0 / CC BY.\n\n"
        "Safe royalty-free sources:\n"
        "  https://freesound.org\n"
        "  https://pixabay.com/music\n"
        "  https://opengameart.org\n"
        "  https://incompetech.com\n"
    )
    out = BASE_DIR / "CREDITS.txt"
    with open(out, "w", encoding="utf-8") as f:
        f.write(txt)
    print(f"   📝 CREDITS.txt         → {out}")

# ============================================================
# SUMMARY
# ============================================================

def print_summary(results):
    print(f"\n{'═'*62}")
    print("  📊  FINAL SUMMARY")
    print(f"{'═'*62}")

    total_real = total_ph = 0
    for cat, real, ph in results:
        icon = "✅" if ph == 0 else "⚠️ "
        print(f"  {icon}  {cat:<12}  {real:2d} downloaded   {ph:2d} placeholder(s)")
        total_real += real
        total_ph   += ph

    grand = total_real + total_ph
    print(f"\n  Total   : {grand}")
    print(f"  Real    : {total_real}")
    print(f"  Missing : {total_ph}")

    if total_ph:
        print(f"\n  ⚠️  Run:  python sounds/retry_placeholders.py")
        print(f"      to retry the {total_ph} failed file(s).\n")
    else:
        print("\n  🎉  All 65 sounds downloaded — folder is ready!\n")

# ============================================================
# MAIN
# ============================================================

def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║        ECHOES OF MIDNIGHT — yt-dlp Sound Downloader        ║
║              Auto-Rename Edition  •  0.5 s polite          ║
╚══════════════════════════════════════════════════════════════╝
""")

    # ── pre-flight ───────────────────────────────────────────
    print("🔧  Pre-flight checks")
    ok_ytdlp  = check_ytdlp()
    ok_ffmpeg = check_ffmpeg()

    if not ok_ytdlp or not ok_ffmpeg:
        print("\n❌  Fix the missing tools above, then re-run.\n")
        sys.exit(1)

    print("\n✅  All tools found — starting downloads.\n")

    # ── folders ──────────────────────────────────────────────
    print("📁  Creating folder structure...")
    for folder in FOLDERS:
        Path(folder).mkdir(parents=True, exist_ok=True)
        print(f"   ✓  {folder}/")

    # ── categories ───────────────────────────────────────────
    all_categories = [
        ("MUSIC",    "sounds/music",    MUSIC),
        ("AMBIENCE", "sounds/ambience", AMBIENCE),
        ("SFX",      "sounds/sfx",      SFX),
        ("VOICES",   "sounds/voices",   VOICES),
    ]

    results = []
    for cat_name, folder, sounds in all_categories:
        real, ph = process_category(cat_name, folder, sounds)
        results.append((cat_name, real, ph))

    # ── support files ────────────────────────────────────────
    print(f"\n{'═'*62}")
    print("  📝  Writing support files...")
    write_credits()
    write_manifest(all_categories)
    write_retry_script(all_categories)

    # ── done ─────────────────────────────────────────────────
    print_summary(results)

if __name__ == "__main__":
    main()