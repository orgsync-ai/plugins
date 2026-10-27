#!/bin/sh
# D-195 capture worker (plan B2 §4.5 steps 3-8), started detached by codex/capture.sh or the Claude Code mod at session end:
# sh worker.sh <capture root>. Everything it starts runs with ORGSYNC_CAPTURE_CHILD=1, so no OrgSync hook runs inside its own
# extraction. With Node it runs capture-worker.mjs, which reads the job formats documented at its top. Without Node:
# - a Claude Code job arrives already redacted, with its prompt, from the mod; this script runs the extractor and leaves the
#   answer for the mod to gate at the next session (jobs/<id>.answered.json beside work/<id>/answer.txt);
# - a Codex job needs Node to redact and gate, so it is skipped with one line in notes.log.
# Files it writes are readable by this person only; anything older than 24 hours is deleted on every run.

root="$1"
[ -n "$root" ] && [ -d "$root/jobs" ] || exit 0
export ORGSYNC_CAPTURE_CHILD=1
umask 077
here=$(cd "$(dirname "$0")" && pwd) || exit 0
if command -v node >/dev/null 2>&1; then exec node "$here/capture-worker.mjs" "$root"; fi

note() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$root/notes.log" 2>/dev/null; }
mkdir -p "$root/locks" "$root/work" 2>/dev/null || exit 0
find "$root/spool" "$root/jobs" "$root/work" -mindepth 1 -maxdepth 1 -mmin +1440 -exec rm -rf {} + 2>/dev/null

for job in "$root"/jobs/cs1_*.json; do
  [ -f "$job" ] || continue
  id=$(basename "$job" .json)
  case "$id" in *.answered) continue ;; esac
  session=${id%%.*}
  if ! grep -q '"surface":"claude_code"' "$job"; then
    note "skip codex_needs_node"; rm -rf "$job" "$root/spool/$id.jsonl" "$root/work/$id"; continue
  fi
  if [ -f "$root/off/$session" ]; then rm -rf "$job" "$root/work/$id"; continue; fi
  mkdir "$root/locks/$session" 2>/dev/null || continue
  dir="$root/work/$id"
  if [ -f "$dir/prompt.txt" ] && [ -f "$dir/source.txt" ]; then
    model=$(sed -n 's/.*"model":"\([a-z0-9.-]*\)".*/\1/p' "$job" | head -n 1)
    if [ -n "$ORGSYNC_CAPTURE_EXTRACT_CMD" ]; then
      (cd "$dir" && ORGSYNC_CAPTURE_SURFACE=claude_code sh -c "$ORGSYNC_CAPTURE_EXTRACT_CMD" < prompt.txt > answer.txt 2>/dev/null)
    else
      (cd "$dir" && claude -p --safe-mode --strict-mcp-config --tools "" --no-session-persistence --max-turns 3 \
        --output-format json --model "${model:-sonnet}" < prompt.txt > answer.txt 2>/dev/null)
    fi
    # Off the record may have been set while the extractor ran; then nothing is kept.
    if [ $? -eq 0 ] && [ -s "$dir/answer.txt" ] && [ ! -f "$root/off/$session" ]; then mv "$job" "$root/jobs/$id.answered.json"
    else note "skip extract_failed"; rm -rf "$job" "$dir"; fi
  else
    note "skip job_incomplete"; rm -rf "$job" "$dir"
  fi
  rmdir "$root/locks/$session" 2>/dev/null
done
exit 0
