#!/usr/bin/env bash
# Grimoire v3 migration extraction — deterministic, repeatable (MIG-10).
# Source of record: commit ad5e26814170fb4dbb2b4fa4667e730b0f61c63a.
# Output contains no timestamps, no randomness, and uses fixed (C-locale) ordering:
# running this script twice against the same commit MUST produce byte-identical output.
#
# Usage: bash scripts/migration-extract.sh {files|stats|projects|urls|patchversions|all}

set -euo pipefail
export LC_ALL=C

SOURCE_COMMIT="ad5e26814170fb4dbb2b4fa4667e730b0f61c63a"

# Fixed source-file list (18 files delivered at SOURCE_COMMIT; git tree order).
SOURCE_FILES="
GPTavern.md
Grimoire.md
Interludes.md
Part1.md
Part2.md
Part3.md
Part4_AllLessons.md
Part5.md
Part6.md
Part7.md
Part8.md
Part9.md
PatchNotes.md
Projects.md
Readme.md
RecommendedTools.md
ReplitDeployInstructions.md
grimoire
"

# Content files that carry project numbers (order = canonical source order).
PROJECT_FILES="
Part1.md
Interludes.md
Part2.md
Part3.md
Part4_AllLessons.md
Part5.md
Part6.md
Part7.md
Part8.md
Part9.md
Projects.md
"

cmd_files() {
  echo "## files (source commit $SOURCE_COMMIT)"
  for f in $SOURCE_FILES; do echo "$f"; done
}

cmd_stats() {
  echo "## stats: file bytes content_lines sha256"
  for f in $SOURCE_FILES; do
    bytes=$(wc -c < "$f" | tr -d ' ')
    lines=$(grep -c '' "$f")
    hash=$(sha256sum "$f" | cut -d' ' -f1)
    echo "$f $bytes $lines $hash"
  done
}

cmd_projects() {
  echo "## project numbers by content file (line-anchored extraction)"
  for f in $PROJECT_FILES; do
    # Matches "NN: Title" at line start and Part1's "Project 0: Title".
    grep -nE "^([Pp]roject )?[0-9]+:" "$f" | while IFS= read -r line; do
      num=$(printf '%s' "$line" | grep -oE "^([0-9]+:)?([Pp]roject )?[0-9]+" | grep -oE "[0-9]+" | tail -1)
      echo "$f:$num"
    done
  done
}

cmd_project_numbers_sorted() {
  echo "## distinct project numbers (ascending)"
  for f in $PROJECT_FILES; do
    grep -oE "^([Pp]roject )?[0-9]+:" "$f" | grep -oE "[0-9]+"
  done | sort -n -u
}

cmd_urls() {
  echo "## unique urls"
  grep -hoE 'https?://[^ )>"]+' $SOURCE_FILES | sed 's/[.,]$//' | sort -u
}

cmd_patchversions() {
  echo "## patch note version-entry headers (file order preserved)"
  grep -nE "^#+ *(v? *[0-9]|\.1-2)" PatchNotes.md
  grep -A1 "^##$" PatchNotes.md | grep -E "^[0-9]" || true
}

case "${1:-all}" in
  files)   cmd_files ;;
  stats)   cmd_stats ;;
  projects) cmd_projects ;;
  numbers) cmd_project_numbers_sorted ;;
  urls)    cmd_urls ;;
  patchversions) cmd_patchversions ;;
  all)
    cmd_files
    cmd_stats
    cmd_project_numbers_sorted
    cmd_urls
    ;;
  *)
    echo "usage: $0 {files|stats|projects|numbers|urls|patchversions|all}" >&2
    exit 2
    ;;
esac
