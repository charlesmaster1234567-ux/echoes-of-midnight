#!/usr/bin/env python3
# ═════════════════════════════════════════════════════════════════
#  AI_CLEANER.PY — Safe AI Removal Tool for Echoes of Midnight
#  ───────────────────────────────────────────────────────────────
#  This script SAFELY removes all AI integration from your game:
#
#  1. Creates timestamped backups of every modified file
#  2. Removes AI stub from index.html
#  3. Removes AI script tag from index.html
#  4. Removes AI initialization scripts from index.html
#  5. Removes AI status badge from index.html (HTML + CSS)
#  6. Removes AI.update() call from game.js
#  7. Removes AI.reset() call from game.js
#  8. Removes AI menu dialogue logic from game.js
#  9. Reverts canvas click handler in game.js
#  10. Deletes ai.js, server.js, package.json, etc.
#
#  SAFETY GUARANTEES:
#  • Every change is logged before applying
#  • Backups stored in ai_cleanup_backup_YYYYMMDD_HHMMSS/
#  • Dry-run mode shows changes without applying
#  • Asks for confirmation before deleting files
#  • Validates JS syntax balance (braces, parens) after edits
#  • Aborts cleanly on any error
# ═════════════════════════════════════════════════════════════════

import os
import sys
import shutil
import re
from pathlib import Path
from datetime import datetime

# ─── CONFIGURATION ───────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent.resolve()

# Files to modify (path → required to exist)
INDEX_HTML  = SCRIPT_DIR / "index.html"
GAME_JS     = SCRIPT_DIR / "game.js"

# Files to delete (path → optional, only deleted if exists)
FILES_TO_DELETE = [
    SCRIPT_DIR / "ai.js",
    SCRIPT_DIR / "server.js",
    SCRIPT_DIR / "package.json",
    SCRIPT_DIR / "package-lock.json",
    SCRIPT_DIR / ".env",
    SCRIPT_DIR / "thoughts.json",
]

# Folders to delete (only if they exist)
FOLDERS_TO_DELETE = [
    SCRIPT_DIR / "node_modules",
]

# ─── DRY RUN FLAG ────────────────────────────────────────────────
DRY_RUN = "--dry-run" in sys.argv or "-d" in sys.argv

# ─── COLORS (Windows-safe) ───────────────────────────────────────
class C:
    RED    = "\033[91m" if os.name != "nt" or os.environ.get("WT_SESSION") else ""
    GREEN  = "\033[92m" if os.name != "nt" or os.environ.get("WT_SESSION") else ""
    YELLOW = "\033[93m" if os.name != "nt" or os.environ.get("WT_SESSION") else ""
    BLUE   = "\033[94m" if os.name != "nt" or os.environ.get("WT_SESSION") else ""
    BOLD   = "\033[1m"  if os.name != "nt" or os.environ.get("WT_SESSION") else ""
    END    = "\033[0m"  if os.name != "nt" or os.environ.get("WT_SESSION") else ""


# ═════════════════════════════════════════════════════════════════
#  LOGGING HELPERS
# ═════════════════════════════════════════════════════════════════

def header(msg):
    print(f"\n{C.BOLD}{C.BLUE}{'═' * 65}{C.END}")
    print(f"{C.BOLD}{C.BLUE}  {msg}{C.END}")
    print(f"{C.BOLD}{C.BLUE}{'═' * 65}{C.END}\n")

def step(msg):
    print(f"{C.BLUE}▸{C.END} {msg}")

def ok(msg):
    print(f"  {C.GREEN}✓{C.END} {msg}")

def warn(msg):
    print(f"  {C.YELLOW}⚠{C.END} {msg}")

def err(msg):
    print(f"  {C.RED}✗{C.END} {msg}")

def info(msg):
    print(f"  {C.BLUE}ℹ{C.END} {msg}")


# ═════════════════════════════════════════════════════════════════
#  SAFETY: BACKUP CREATION
# ═════════════════════════════════════════════════════════════════

def make_backup_folder():
    """Create timestamped backup folder."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = SCRIPT_DIR / f"ai_cleanup_backup_{timestamp}"

    if DRY_RUN:
        info(f"[DRY RUN] Would create backup folder: {backup_dir.name}")
        return backup_dir

    backup_dir.mkdir(exist_ok=True)
    ok(f"Backup folder created: {backup_dir.name}")
    return backup_dir


def backup_file(file_path, backup_dir):
    """Copy a file to the backup folder, preserving structure."""
    if not file_path.exists():
        warn(f"Skipping backup — file doesn't exist: {file_path.name}")
        return False

    if DRY_RUN:
        info(f"[DRY RUN] Would back up: {file_path.name}")
        return True

    try:
        dest = backup_dir / file_path.name
        shutil.copy2(file_path, dest)
        ok(f"Backed up: {file_path.name}  →  {backup_dir.name}/{file_path.name}")
        return True
    except Exception as e:
        err(f"Backup failed for {file_path.name}: {e}")
        return False


# ═════════════════════════════════════════════════════════════════
#  VALIDATION: BRACE / PAREN BALANCE CHECK
# ═════════════════════════════════════════════════════════════════

def check_balance(content, file_name):
    """
    Verifies braces/parens/brackets are balanced.
    Skips counting inside strings and comments.
    """
    open_chars  = {"{": "}", "(": ")", "[": "]"}
    close_chars = {v: k for k, v in open_chars.items()}

    counts = {"{": 0, "(": 0, "[": 0}

    i = 0
    n = len(content)
    in_string = None     # quote char if inside a string
    in_line_comment = False
    in_block_comment = False

    while i < n:
        c = content[i]
        nxt = content[i + 1] if i + 1 < n else ""

        # Handle line/block comments
        if in_line_comment:
            if c == "\n":
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            if c == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        # Handle strings
        if in_string:
            if c == "\\":
                i += 2
                continue
            if c == in_string:
                in_string = None
            i += 1
            continue

        # Detect comment / string starts
        if c == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if c == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue
        if c in ('"', "'", "`"):
            in_string = c
            i += 1
            continue

        # Count braces
        if c in open_chars:
            counts[c] += 1
        elif c in close_chars:
            counts[close_chars[c]] -= 1

        i += 1

    problems = []
    for ch, count in counts.items():
        if count != 0:
            problems.append(f"{ch}/{open_chars[ch]} imbalance: {count:+d}")

    if problems:
        err(f"Syntax balance check FAILED for {file_name}:")
        for p in problems:
            err(f"  - {p}")
        return False
    return True


# ═════════════════════════════════════════════════════════════════
#  REGEX-SAFE STRING MANIPULATION
# ═════════════════════════════════════════════════════════════════

def remove_between_markers(text, start_marker, end_marker, label=""):
    """
    Remove text between two markers INCLUSIVE.
    Returns (new_text, removed_count).
    Safe — only removes if both markers found in sequence.
    """
    count = 0
    result = text

    while True:
        start_idx = result.find(start_marker)
        if start_idx == -1:
            break

        end_idx = result.find(end_marker, start_idx + len(start_marker))
        if end_idx == -1:
            warn(f"Found start marker but no end marker for: {label}")
            break

        end_idx += len(end_marker)

        # Also consume trailing newline if present
        if end_idx < len(result) and result[end_idx] == "\n":
            end_idx += 1

        result = result[:start_idx] + result[end_idx:]
        count += 1

    return result, count


def remove_lines_containing(text, patterns, label=""):
    """
    Remove any line containing ALL patterns in the list.
    Returns (new_text, removed_count).
    """
    lines = text.split("\n")
    kept  = []
    removed = 0

    for line in lines:
        if all(p in line for p in patterns):
            removed += 1
            continue
        kept.append(line)

    return "\n".join(kept), removed


# ═════════════════════════════════════════════════════════════════
#  INDEX.HTML CLEANUP
# ═════════════════════════════════════════════════════════════════

def clean_index_html(content):
    """Remove all AI-related blocks from index.html."""
    original_len = len(content)
    total_changes = 0

    # ── 1. Remove AI stub from head safety net ──────────────────
    # Match the entire `if (!window.AI)` block
    pattern = re.compile(
        r'\n\s*//\s*(?:──.*?)?AI\s*System(?:.*?Stub)?\s*(?:──.*?)?\n'
        r'\s*if\s*\(\s*!\s*window\.AI\s*\)\s*\{.*?^\s*\}\s*\n',
        re.DOTALL | re.MULTILINE
    )
    matches = pattern.findall(content)
    if matches:
        content = pattern.sub("\n", content)
        info(f"Removed {len(matches)} AI stub block(s)")
        total_changes += len(matches)
    else:
        # Try alternative regex without comment header
        pattern2 = re.compile(
            r'\n\s*if\s*\(\s*!\s*window\.AI\s*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\s*\n',
            re.DOTALL
        )
        matches2 = pattern2.findall(content)
        if matches2:
            content = pattern2.sub("\n", content)
            info(f"Removed {len(matches2)} AI stub block(s)")
            total_changes += len(matches2)

    # ── 2. Remove AI script tag ─────────────────────────────────
    content, n = remove_lines_containing(
        content,
        ['<script src="ai.js"'],
        "AI script tag"
    )
    if n: info(f"Removed {n} AI script tag(s)")
    total_changes += n

    # ── 3. Remove AI integration comment block above script tag ──
    content, n = remove_between_markers(
        content,
        "<!-- AI INTEGRATION",
        "-->",
        "AI integration comment"
    )
    if n: info(f"Removed {n} AI comment block(s)")
    total_changes += n

    # ── 4. Remove AI initialization <script> block ──────────────
    # The whole script block that calls AI.init()
    pattern_init = re.compile(
        r'<script>\s*(?://[^\n]*\n\s*)*\(function\(\)\s*\{[^}]*AI\.init.*?\}\)\(\);\s*</script>',
        re.DOTALL
    )
    matches = pattern_init.findall(content)
    if matches:
        content = pattern_init.sub("", content)
        info(f"Removed {len(matches)} AI init script block(s)")
        total_changes += len(matches)

    # ── 5. Remove AI status badge HTML ──────────────────────────
    content, n = remove_lines_containing(
        content,
        ['<div id="aiStatus"'],
        "AI status badge div"
    )
    if n: info(f"Removed {n} AI status badge(s)")
    total_changes += n

    # ── 6. Remove AI status CSS ─────────────────────────────────
    pattern_css = re.compile(
        r'\s*/\*\s*──\s*AI\s+Status\s+Indicator.*?\*/\s*'
        r'#aiStatus\s*\{[^}]*\}\s*'
        r'#aiStatus\.online\s*\{[^}]*\}\s*'
        r'#aiStatus\.offline\s*\{[^}]*\}',
        re.DOTALL | re.IGNORECASE
    )
    matches = pattern_css.findall(content)
    if matches:
        content = pattern_css.sub("", content)
        info(f"Removed {len(matches)} AI CSS block(s)")
        total_changes += len(matches)
    else:
        # Simpler fallback — just remove #aiStatus rules
        simple_css = re.compile(r'#aiStatus[^{]*\{[^}]*\}\s*', re.DOTALL)
        css_matches = simple_css.findall(content)
        if css_matches:
            content = simple_css.sub("", content)
            info(f"Removed {len(css_matches)} #aiStatus CSS rule(s)")
            total_changes += len(css_matches)

    # ── 7. Remove unhandled rejection handler (AI-related) ──────
    pattern_rej = re.compile(
        r'<script>\s*(?://[^\n]*\n\s*)*window\.addEventListener\("unhandledrejection"[^<]*</script>',
        re.DOTALL
    )
    matches = pattern_rej.findall(content)
    if matches:
        content = pattern_rej.sub("", content)
        info(f"Removed {len(matches)} unhandledrejection handler(s)")
        total_changes += len(matches)

    new_len = len(content)
    diff = original_len - new_len
    ok(f"index.html: {total_changes} edit(s), {diff} chars removed")

    return content, total_changes


# ═════════════════════════════════════════════════════════════════
#  GAME.JS CLEANUP
# ═════════════════════════════════════════════════════════════════

def clean_game_js(content):
    """Remove all AI-related code from game.js, restore originals."""
    original_len = len(content)
    total_changes = 0

    # ── 1. Remove AI.update() call ──────────────────────────────
    pattern = re.compile(
        r'\n\s*//\s*──\s*AI INTEGRATION.*?\n'
        r'\s*try\s*\{\s*if\s*\(\s*typeof\s+AI[^}]*AI\.update\(\)[^}]*\}\s*catch[^}]*\}\s*\n',
        re.DOTALL
    )
    matches = pattern.findall(content)
    if matches:
        content = pattern.sub("\n", content)
        info(f"Removed {len(matches)} AI.update() call(s)")
        total_changes += len(matches)
    else:
        # Fallback — remove just the line
        content, n = remove_lines_containing(
            content,
            ["typeof AI", "AI.update()"],
            "AI.update line"
        )
        if n:
            info(f"Removed {n} AI.update() line(s)")
            total_changes += n

    # ── 2. Remove AI.reset() call ───────────────────────────────
    pattern_reset = re.compile(
        r'\n\s*//\s*──\s*AI:\s*reset.*?\n'
        r'\s*if\s*\(\s*typeof\s+AI[^}]*AI\.reset\(\)[^}]*\}\s*catch[^}]*\}\s*\n',
        re.DOTALL
    )
    matches = pattern_reset.findall(content)
    if matches:
        content = pattern_reset.sub("\n", content)
        info(f"Removed {len(matches)} AI.reset() call(s)")
        total_changes += len(matches)
    else:
        content, n = remove_lines_containing(
            content,
            ["typeof AI", "AI.reset()"],
            "AI.reset line"
        )
        if n:
            info(f"Removed {n} AI.reset() line(s)")
            total_changes += n

    # ── 3. Remove AI menu dialogue blocks ───────────────────────
    # The big "AI PRE-MENU HORROR DIALOGUE" block in case "menu":
    pattern_menu = re.compile(
        r'\n\s*//\s*──\s*AI PRE-MENU HORROR DIALOGUE.*?'
        r'(?=\n\s*//\s*Normal menu input|\n\s*if\s*\(\s*keysJustPressed\["Enter"\]\s*\|\|\s*keysJustPressed\["Space"\]\)\s*\{\s*\n\s*_ensureAudio\(\);\s*\n\s*startNewGame\(\);)',
        re.DOTALL
    )
    matches = pattern_menu.findall(content)
    if matches:
        content = pattern_menu.sub("\n                ", content)
        info(f"Removed {len(matches)} AI pre-menu dialogue block(s)")
        total_changes += len(matches)

    # Remove window._menuDialogueStarted / Done lines
    content, n = remove_lines_containing(
        content,
        ["window._menuDialogueStarted"],
        "menuDialogueStarted line"
    )
    if n:
        info(f"Removed {n} menuDialogueStarted line(s)")
        total_changes += n

    content, n = remove_lines_containing(
        content,
        ["window._menuDialogueDone"],
        "menuDialogueDone line"
    )
    if n:
        info(f"Removed {n} menuDialogueDone line(s)")
        total_changes += n

    # ── 4. Revert canvas click handler ──────────────────────────
    # Find the AI-aware click handler and replace with simple version
    pattern_click = re.compile(
        r'canvas\.addEventListener\("click",\s*\(\)\s*=>\s*\{\s*\n'
        r'\s*_ensureAudio\(\);\s*\n'
        r'\s*\n?'
        r'\s*if\s*\(gameState\s*===\s*"menu"\)\s*\{[\s\S]*?'
        r'\}\s*\n'
        r'\s*else\s+if\s*\(gameState\s*===\s*"playing"\s*&&\s*dialogActive\)\s*\{\s*\n'
        r'\s*advanceDialog\(\);\s*\n'
        r'\s*\}\s*\n'
        r'\s*else\s+if\s*\(gameState\s*===\s*"ending"\)\s*\{[\s\S]*?'
        r'\}\s*\n'
        r'\}\);',
        re.MULTILINE
    )

    simple_click = '''canvas.addEventListener("click", () => {
    _ensureAudio();
    if (gameState === "menu")                         startNewGame();
    else if (gameState === "playing" && dialogActive)  advanceDialog();
    else if (gameState === "ending")                   gameState = "menu";
});'''

    if pattern_click.search(content):
        content = pattern_click.sub(simple_click, content)
        info("Reverted canvas click handler to original simple form")
        total_changes += 1

    # ── 5. Remove AI debug overlay lines ────────────────────────
    content, n = remove_lines_containing(
        content,
        ["AI Mode:", "aiMode"],
        "AI debug overlay line"
    )
    if n:
        info(f"Removed {n} AI debug overlay line(s)")
        total_changes += n

    content, n = remove_lines_containing(
        content,
        ["AI Cache:", "aiCache"],
        "AI cache debug line"
    )
    if n:
        info(f"Removed {n} AI cache debug line(s)")
        total_changes += n

    # Remove the const aiMode/aiCache declarations
    content, n = remove_lines_containing(
        content,
        ["const aiMode"],
        "aiMode const"
    )
    if n:
        info(f"Removed {n} aiMode const declaration(s)")
        total_changes += n

    content, n = remove_lines_containing(
        content,
        ["const aiCache"],
        "aiCache const"
    )
    if n:
        info(f"Removed {n} aiCache const declaration(s)")
        total_changes += n

    new_len = len(content)
    diff = original_len - new_len
    ok(f"game.js: {total_changes} edit(s), {diff} chars removed")

    return content, total_changes


# ═════════════════════════════════════════════════════════════════
#  FILE OPERATIONS
# ═════════════════════════════════════════════════════════════════

def process_file(file_path, cleaner_fn, backup_dir):
    """Read, backup, clean, validate, write a file."""
    if not file_path.exists():
        err(f"File not found: {file_path}")
        return False

    # Read original
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            original = f.read()
    except Exception as e:
        err(f"Read failed for {file_path.name}: {e}")
        return False

    info(f"Original size: {len(original):,} chars")

    # Backup first
    if not backup_file(file_path, backup_dir):
        err("Backup failed — aborting this file")
        return False

    # Apply cleaning
    cleaned, changes = cleaner_fn(original)

    if changes == 0:
        warn(f"No AI traces found in {file_path.name} — file already clean")
        return True

    # Validate JS balance for .js files
    if file_path.suffix == ".js":
        if not check_balance(cleaned, file_path.name):
            err("Balance check failed — NOT writing changes")
            err("Original file is preserved. Backup is in:")
            err(f"  {backup_dir}")
            return False
        ok("Brace/paren balance OK")

    # Write
    if DRY_RUN:
        info(f"[DRY RUN] Would write {len(cleaned):,} chars to {file_path.name}")
    else:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(cleaned)
            ok(f"Saved: {file_path.name}")
        except Exception as e:
            err(f"Write failed for {file_path.name}: {e}")
            err(f"Restore from backup: {backup_dir}/{file_path.name}")
            return False

    return True


def delete_files_safely(backup_dir):
    """Delete AI-only files after confirmation."""
    existing = [f for f in FILES_TO_DELETE if f.exists()]

    if not existing:
        info("No AI-only files to delete")
        return

    print()
    step("Files to delete:")
    for f in existing:
        size = f.stat().st_size
        print(f"    • {f.name}  ({size:,} bytes)")

    print()
    if DRY_RUN:
        info("[DRY RUN] Would delete the files above")
        return

    response = input(f"  {C.YELLOW}Delete these files? They will be backed up first. [y/N]: {C.END}").strip().lower()
    if response != "y":
        warn("Skipped file deletion")
        return

    for f in existing:
        # Backup before delete
        if backup_file(f, backup_dir):
            try:
                f.unlink()
                ok(f"Deleted: {f.name}")
            except Exception as e:
                err(f"Delete failed for {f.name}: {e}")


def delete_folders_safely():
    """Delete AI-only folders after confirmation."""
    existing = [d for d in FOLDERS_TO_DELETE if d.exists() and d.is_dir()]

    if not existing:
        return

    print()
    step("Folders to delete:")
    for d in existing:
        try:
            file_count = sum(1 for _ in d.rglob("*"))
            print(f"    • {d.name}/  ({file_count} items)")
        except:
            print(f"    • {d.name}/")

    print()
    if DRY_RUN:
        info("[DRY RUN] Would delete the folders above")
        return

    response = input(f"  {C.YELLOW}Delete these folders? They will NOT be backed up (too large). [y/N]: {C.END}").strip().lower()
    if response != "y":
        warn("Skipped folder deletion")
        return

    for d in existing:
        try:
            shutil.rmtree(d)
            ok(f"Deleted folder: {d.name}/")
        except Exception as e:
            err(f"Delete failed for {d.name}/: {e}")


# ═════════════════════════════════════════════════════════════════
#  MAIN
# ═════════════════════════════════════════════════════════════════

def main():
    header("AI CLEANUP TOOL — Echoes of Midnight")

    if DRY_RUN:
        warn("DRY RUN MODE — no files will be modified or deleted")
        print()

    # Verify required files exist
    step("Verifying required files...")
    missing = []
    for f in [INDEX_HTML, GAME_JS]:
        if not f.exists():
            missing.append(f)
            err(f"Missing required file: {f.name}")
        else:
            ok(f"Found: {f.name}")

    if missing:
        print()
        err("Cannot proceed — required files missing.")
        err("Run this script from your game folder.")
        sys.exit(1)

    print()
    step("Working directory:")
    print(f"    {SCRIPT_DIR}")

    # Confirm intent
    print()
    if not DRY_RUN:
        print(f"  {C.YELLOW}This will modify index.html, game.js, and delete AI files.{C.END}")
        print(f"  {C.YELLOW}Backups will be created automatically.{C.END}")
        response = input(f"\n  {C.BOLD}Proceed? [y/N]: {C.END}").strip().lower()
        if response != "y":
            warn("Aborted by user")
            sys.exit(0)
        print()

    # Create backup folder
    backup_dir = make_backup_folder()

    # Process files
    print()
    header("PHASE 1 — INDEX.HTML")
    success_html = process_file(INDEX_HTML, clean_index_html, backup_dir)

    print()
    header("PHASE 2 — GAME.JS")
    success_js = process_file(GAME_JS, clean_game_js, backup_dir)

    # Delete files
    print()
    header("PHASE 3 — DELETE AI FILES")
    delete_files_safely(backup_dir)

    # Delete folders
    delete_folders_safely()

    # Summary
    print()
    header("CLEANUP COMPLETE")

    if success_html and success_js:
        ok("All files processed successfully")
    else:
        warn("Some files had issues — check the log above")

    if not DRY_RUN:
        print(f"  {C.BLUE}ℹ{C.END} Backups stored in:")
        print(f"      {backup_dir}")
        print()
        print(f"  {C.BLUE}ℹ{C.END} If anything broke, restore with:")
        print(f"      copy \"{backup_dir}\\index.html\" \"{INDEX_HTML}\"")
        print(f"      copy \"{backup_dir}\\game.js\" \"{GAME_JS}\"")

    print()
    ok("Done. Your game is now AI-free.")
    print()
    print(f"  {C.GREEN}Next steps:{C.END}")
    print(f"    1. Test the game in your browser")
    print(f"    2. If working: git add . && git commit -m \"Remove AI integration\"")
    print(f"    3. If broken:  restore from backup folder above")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{C.YELLOW}⚠ Aborted by user (Ctrl+C){C.END}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n{C.RED}✗ Unexpected error: {e}{C.END}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)