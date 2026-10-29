#!/usr/bin/env bash
# Send a curated-items JSON file to POST <base-url>/api/curated.
#
#   GRWIRE_CURATED_SECRET=... scripts/send-curated.sh <base-url> <file.json>
#   e.g. scripts/send-curated.sh https://www.grwire.com /workspace/knowledge/grwire/curated/telco-2026-10-29.json
#
# The secret (the server's CURATED_INGEST_SECRET) is read from the environment variable
# GRWIRE_CURATED_SECRET only. It is never printed, never put on the curl command line (so it is
# not in `ps` output) and never written to a file: the Authorization header goes to curl through
# a pipe. The server's JSON answer is printed; the exit code is 0 only for an HTTP 200.
#
# Re-sending the same file is safe: items are deduplicated by URL and come back as "duplicates".
set -euo pipefail

usage() {
  echo "usage: GRWIRE_CURATED_SECRET=... $0 <base-url> <file.json>" >&2
  exit 2
}

[ "$#" -eq 2 ] || usage
base="${1%/}"
file="$2"

[ -n "${GRWIRE_CURATED_SECRET:-}" ] || { echo "GRWIRE_CURATED_SECRET is not set" >&2; exit 2; }
[ -f "$file" ] && [ -s "$file" ] || { echo "not a readable, non-empty file: $file" >&2; exit 2; }
case "$base" in
  https://*|http://localhost|http://localhost:*|http://127.0.0.1|http://127.0.0.1:*) ;;
  *) echo "base url must be https:// (http:// is allowed only for localhost): $base" >&2; exit 2 ;;
esac

body="$(mktemp)"
trap 'rm -f "$body"' EXIT

# Header via a process-substitution pipe: the secret never appears in curl's own arguments.
status="$(curl --silent --show-error --max-time 60 \
  --request POST "$base/api/curated" \
  --header "Content-Type: application/json" \
  --header @<(printf 'Authorization: Bearer %s\n' "$GRWIRE_CURATED_SECRET") \
  --data-binary "@$file" \
  --output "$body" --write-out '%{http_code}')" || { echo "request failed (could not reach $base)" >&2; exit 1; }

cat "$body"
echo
echo "HTTP $status" >&2
[ "$status" = "200" ]
