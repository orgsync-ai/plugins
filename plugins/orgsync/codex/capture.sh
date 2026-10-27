#!/bin/sh
# D-195 capture in Codex (plan B2 §4.5 steps 1-3): the PreCompact and SessionEnd command hook. POSIX sh only, no Node or jq,
# because Codex gives SessionEnd 1 s. It hard-links the session's transcript into a private spool, writes one job file and
# detaches ../worker/worker.sh, which does the rest. Usage: sh capture.sh pre_compact|session_end, the hook's JSON on stdin.
# It prints nothing and exits 0 whatever happens; a skip leaves one line in capture/notes.log. It starts as few programs as it
# can (each costs milliseconds): gate G9 asks 300 ms at p95.
#
# Off the record (D-195, sticky for the whole session): the capture marker capture/off/<session>, or the steering ledger's
# "captureOff":true or "off":true in orgsync/sessions/<id>.json (local/budget.js recordMarker). Then nothing from the session
# leaves: its jobs, spool and unsent items are deleted, and if anything was already sent a forget entry asks OrgSync to erase it.

[ -n "$ORGSYNC_CAPTURE_CHILD" ] && exit 0
# Until a courier run is proved to reach OrgSync with the person's own Codex sign-in (spike S1 left it open), Codex hooks capture
# nothing: extracting items that cannot be delivered would spend the person's usage for nothing. The OrgSync skill captures at
# decision moments meanwhile. ORGSYNC_CAPTURE_COURIER=1 turns both the hooks and the courier on together.
[ "$ORGSYNC_CAPTURE_COURIER" = "1" ] || exit 0
trigger="$1"
case "$trigger" in pre_compact|session_end) ;; *) exit 0 ;; esac
data="${PLUGIN_DATA:-$CLAUDE_PLUGIN_DATA}"
[ -n "$data" ] || exit 0
root="$data/orgsync/capture"
umask 077
case "$0" in */*) here=${0%/*} ;; *) here=. ;; esac
# One date call: the job's time, its file stamp and the clock in seconds.
set -- $(date -u '+%Y-%m-%dT%H:%M:%SZ %Y%m%dT%H%M%SZ %s')
now=$1 stamp=$2 epoch=$3

note() { printf '%s %s\n' "$now" "$1" >> "$root/notes.log" 2>/dev/null; }

# session_id and transcript_path from the hook's JSON in one pass; a value with a quote or backslash is not read. The echo ends
# the last line, which BSD sed would otherwise print without its newline.
sid="" transcript=""
fields=$({ head -c 65536; echo; } | sed -n -e 'h' \
  -e 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"\\]*\)".*/S\1/p' -e 'g' \
  -e 's/.*"transcript_path"[[:space:]]*:[[:space:]]*"\([^"\\]*\)".*/T\1/p')
while IFS= read -r value; do
  case "$value" in S*) [ -n "$sid" ] || sid=${value#S} ;; T*) [ -n "$transcript" ] || transcript=${value#T} ;; esac
done <<EOF
$fields
EOF
[ -n "$sid" ] || exit 0
[ -d "$root/outbox" ] || mkdir -p "$root/jobs" "$root/spool" "$root/off" "$root/ledger" "$root/outbox" 2>/dev/null || exit 0

if command -v sha256sum >/dev/null 2>&1; then digest=$(printf 'orgsync-capture-session:v1:%s' "$sid" | sha256sum)
elif command -v shasum >/dev/null 2>&1; then digest=$(printf 'orgsync-capture-session:v1:%s' "$sid" | shasum -a 256)
elif command -v openssl >/dev/null 2>&1; then digest=$(printf 'orgsync-capture-session:v1:%s' "$sid" | openssl dgst -sha256 -r)
fi
digest=${digest%% *}
[ "${#digest}" -eq 64 ] || { note "skip no_sha256_tool"; exit 0; }
session="cs1_$digest"
# The steering ledger's name, as codex/steer.mjs makes it: letters, digits, _ and - only, at most 80 characters.
case "$sid" in *[!A-Za-z0-9_-]*) name=$(printf '%s' "$sid" | tr -cd 'A-Za-z0-9_-' | cut -c1-80) ;; *) name=$sid ;; esac
[ "${#name}" -le 80 ] || name=$(printf '%s' "$name" | cut -c1-80)
steering="$data/orgsync/sessions/$name.json"

if [ -f "$root/off/$session" ] || { [ -f "$steering" ] && grep -q -e '"captureOff":true' -e '"off":true' "$steering"; }; then
  : > "$root/off/$session"
  rm -rf "$root/jobs/$session".* "$root/spool/$session".* "$root/work/$session".* 2>/dev/null
  for entry in "$root/outbox/$session".*.json; do [ "$entry" = "$root/outbox/$session.forget.json" ] || rm -f "$entry"; done
  if grep -q '"sent":true' "$root/ledger/$session.json" 2>/dev/null && [ ! -f "$root/outbox/$session.forget.json" ]; then
    printf '{"version":1,"kind":"forget","surface":"codex","session":"%s","createdAt":"%s"}\n' "$session" "$now" > "$root/outbox/$session.forget.json"
  fi
  exit 0
fi
# A local pause holds its end in seconds since 1970.
paused=""
[ -f "$root/paused" ] && read -r paused < "$root/paused"
case "$paused" in ''|*[!0-9]*) ;; *) [ "$paused" -gt "$epoch" ] && exit 0 ;; esac
[ -n "$transcript" ] && [ -f "$transcript" ] || exit 0

offset=""
[ -f "$root/ledger/$session.json" ] && offset=$(sed -n 's/.*"offset":\([0-9]*\).*/\1/p' "$root/ledger/$session.json")
case "$offset" in ''|*[!0-9]*) offset=0 ;; esac
id="$session.$stamp.$$"
# One system call; the link keeps the data if Codex deletes or rotates the file first. Another filesystem refuses a link, and
# then the worker copies the file instead.
if ln "$transcript" "$root/spool/$id.jsonl" 2>/dev/null; then linked=true source=""
else
  linked=false source=$transcript
  case "$source" in *\\*|*\"*) exit 0 ;; esac
fi
printf '{"version":1,"surface":"codex","session":"%s","trigger":"%s","offset":%s,"linked":%s,"source":"%s","steering":"%s","createdAt":"%s"}\n' \
  "$session" "$trigger" "$offset" "$linked" "$source" "$name.json" "$now" > "$root/jobs/.$id.tmp" && mv "$root/jobs/.$id.tmp" "$root/jobs/$id.json" || exit 0
# Detached twice over: the subshell exits at once, so the worker belongs to no hook process and outlives Codex.
( nohup sh "$here/../worker/worker.sh" "$root" >/dev/null 2>&1 </dev/null & ) >/dev/null 2>&1
exit 0
