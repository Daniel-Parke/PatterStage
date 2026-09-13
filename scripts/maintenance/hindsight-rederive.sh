#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# hindsight-rederive.sh — One-time cleanup for the Hindsight corpus
# ═══════════════════════════════════════════════════════════════
#
# What this does:
#   1. Snapshots the current `hermes` bank into `hermes_archive`
#      (the archive is a frozen safety net — original facts are
#      compressed by Hindsight's LLM extraction into ~50-200 durable
#      nodes per weekly batch)
#   2. Asks Hindsight's reflect tool to produce a "golden set" of
#      ~30-60 durable facts, sampled from a 200-fact random slice
#      of the bank (small enough to be fast, large enough to
#      surface patterns)
#   3. Wipes the `hermes` bank and re-seeds it with just the
#      golden set
#   4. Verifies the new bank is the right size
#
# Prerequisites:
#   - Hindsight daemon running on http://127.0.0.1:9177
#   - Daemon's LLM path is healthy (ps-watchdog confirms this)
#   - The bank has been consolidated (daemon worker queue empty)
#
# Cost: ~30-90 seconds of LLM time on the reflect call.
#       (much faster than the full-corpus reflect that times out)
#
# Usage:
#   bash scripts/maintenance/hindsight-rederive.sh [--dry-run]
#
# History: 2026-06-13 — created after the corpus-flood incident
# showed that operational log-shaped observations (pid=, | When:,
# | Involving:) had grown the bank to 17k facts with 60-70% noise.
set -euo pipefail

BASE="${HINDSIGHT_API_URL:-http://127.0.0.1:9177}"
HERMES_BANK="hermes"
ARCHIVE_BANK="hermes_archive"
SAMPLE_SIZE=200
DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=true
fi

echo "=== Hindsight re-derive ==="
echo "  Base URL: $BASE"
echo "  Source:   $HERMES_BANK"
echo "  Archive:  $ARCHIVE_BANK"
echo "  Sample:   $SAMPLE_SIZE facts"
echo "  Mode:     $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'LIVE')"
echo

# ── 1. Health check ─────────────────────────────────────────
echo "--- Step 1: health check ---"
health=$(curl -sS --max-time 10 "$BASE/health")
echo "  $health"
status=$(echo "$health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
if [ "$status" != "healthy" ]; then
    echo "  ERROR: Hindsight daemon is not healthy. Aborting."
    exit 1
fi

# ── 2. Snapshot the current bank into the archive ──────────
echo
echo "--- Step 2: snapshot current bank into $ARCHIVE_BANK ---"
archive_count=$(curl -sS --max-time 10 "$BASE/v1/default/banks/$ARCHIVE_BANK/memories/list?limit=1" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))")
echo "  Archive currently has $archive_count facts"
if [ "$archive_count" -lt 100 ]; then
    echo "  WARNING: archive is nearly empty. Run this only after the"
    echo "  archive retain has completed (check ps-watchdog logs)."
    if [ "$DRY_RUN" = false ]; then
        read -p "  Continue anyway? (y/N) " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
    fi
fi

# ── 3. Snapshot the source bank size ────────────────────────
echo
echo "--- Step 3: source bank size ---"
src_count=$(curl -sS --max-time 10 "$BASE/v1/default/banks/$HERMES_BANK/memories/list?limit=1" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))")
echo "  $HERMES_BANK has $src_count facts"

# ── 4. Sample-and-reflect ───────────────────────────────────
echo
echo "--- Step 4: sample $SAMPLE_SIZE random facts ---"
python3 << PYEOF
import json, random, urllib.request
all_items = []
offset = 0
while True:
    r = json.loads(urllib.request.urlopen(
        f"$BASE/v1/default/banks/$HERMES_BANK/memories/list?limit=100&offset={offset}",
        timeout=30).read())
    items = r.get('items', [])
    if not items:
        break
    all_items.extend(items)
    offset += 100
    if len(all_items) >= r.get('total', 0):
        break
random.seed(42)
sample = random.sample(all_items, $SAMPLE_SIZE)
sample_doc = "\n\n---\n\n".join(
    (it.get("text","") or "")[:500] for it in sample
    if it.get("text")
)
print(f"  sample size: {len(sample)}")
print(f"  sample doc:  {len(sample_doc)} chars")
with open("/tmp/hindsight-rederive-sample.txt","w") as f:
    f.write(sample_doc)
print(f"  saved to /tmp/hindsight-rederive-sample.txt")
PYEOF

# ── 5. Reflect call ─────────────────────────────────────────
echo
echo "--- Step 5: reflect (budget=high, structured output) ---"
reflect_prompt=$(cat << 'PROMPT'
Below are 200 facts randomly sampled from a memory bank of ~17,000. Many are operational log-shaped observations (process pids, signal numbers, exit codes, debugging trails, pipeline stats). The bank has been polluted by a flood of these. Some are durable knowledge worth keeping (user preferences, project context, architecture decisions, resolved bugs with root cause, recurring rituals, non-obvious lessons).

Your job: produce a JSON list of the durable facts worth keeping. Apply these criteria:

KEEP if the fact is about:
- User preferences (working style, communication, project priorities)
- Project context (repo ownership, deployment topology, CI conventions)
- Architecture decisions and their rationale
- Environment facts (ports, hosts, paths, non-secret config)
- Resolved bugs with root cause
- Recurring rituals
- Non-obvious lessons

REJECT (do not include):
- Process pids, file descriptors, port numbers in /health contexts
- Exit codes, signals, debugging trails
- Pipeline-internal stats ("X facts stored", "Y MB used")
- Observations about the memory system itself
- Boilerplate suffixes "| When: YYYY-MM-DD ..." or "| Involving: hermes (assistant) | Operational state check"
- Duplicate facts (>80% semantic similarity to a previously kept fact)

Aim for 30-60 kept facts. Be aggressive about rejecting log-shaped observations; be conservative about preserving user preferences and architecture decisions.

SAMPLE TO REVIEW:
PROMPT
)
sample_text=$(cat /tmp/hindsight-rederive-sample.txt)
full_query="${reflect_prompt}

\`\`\`
${sample_text}
\`\`\`"

schema='{"type":"object","properties":{"facts":{"type":"array","items":{"type":"object","properties":{"text":{"type":"string"},"category":{"type":"string","enum":["user-preference","project-context","architecture-decision","environment-fact","resolved-bug","ritual","lesson-learned","other"]},"confidence":{"type":"string","enum":["high","medium","low"]}},"required":["text","category","confidence"]}},"rejection_summary":{"type":"string"}},"required":["facts","rejection_summary"]}'

if [ "$DRY_RUN" = true ]; then
    echo "  DRY RUN: would call reflect now with $(( ${#full_query} / 4 ))-token query"
    echo "  Skipping the actual call. Pass no --dry-run to execute."
    exit 0
fi

# Call reflect — this is the slow part (30-90s)
echo "  Calling reflect (may take 30-90 seconds)..."
python3 << PYEOF
import json, urllib.request
query = """${full_query}"""
schema = json.loads('${schema}')
body = json.dumps({
    "query": query,
    "budget": "high",
    "response_schema": schema,
    "max_tokens": 8000,
}).encode()
req = urllib.request.Request(
    "$BASE/v1/default/banks/$HERMES_BANK/reflect",
    data=body, method="POST",
    headers={"Content-Type": "application/json"},
)
r = json.loads(urllib.request.urlopen(req, timeout=300).read())
structured = r.get("structured_output") or {}
facts = structured.get("facts", [])
with open("/tmp/hindsight-derived-facts.json","w") as f:
    json.dump({"facts": facts, "rejection_summary": structured.get("rejection_summary","")}, f, indent=2)
print(f"  derived {len(facts)} facts")
print(f"  rejection summary: {structured.get('rejection_summary','')}")
PYEOF

# ── 6. Wipe and re-seed the source bank ─────────────────────
echo
echo "--- Step 6: wipe and re-seed $HERMES_BANK ---"
derived_count=$(python3 -c "import json; print(len(json.load(open('/tmp/hindsight-derived-facts.json'))['facts']))")
echo "  derived facts: $derived_count"
if [ "$derived_count" -lt 5 ] || [ "$derived_count" -gt 500 ]; then
    echo "  WARNING: derived count is $derived_count (expected 30-60)."
    read -p "  Wipe and re-seed anyway? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# Wipe
echo "  Wiping $HERMES_BANK..."
curl -sS -X DELETE "$BASE/v1/default/banks/$HERMES_BANK/memories" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ', d)"

# Re-seed
echo "  Re-seeding with $derived_count facts..."
python3 << PYEOF
import json, urllib.request
derived = json.load(open('/tmp/hindsight-derived-facts.json'))['facts']
items = [{"content": f["text"], "context": f"rederive-2026-06-13 category={f['category']} confidence={f['confidence']}"} for f in derived]
# Send in chunks of 25
for i in range(0, len(items), 25):
    chunk = items[i:i+25]
    body = json.dumps({"items": chunk, "async": True}).encode()
    req = urllib.request.Request(
        "$BASE/v1/default/banks/$HERMES_BANK/memories",
        data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    r = json.loads(urllib.request.urlopen(req, timeout=120).read())
    print(f"  chunk {i//25+1}: success={r.get('success')} items={r.get('items_count')}")
print(f"  Re-seeded {len(items)} facts")
PYEOF

# ── 7. Verify ───────────────────────────────────────────────
echo
echo "--- Step 7: verify ---"
sleep 5
new_count=$(curl -sS --max-time 10 "$BASE/v1/default/banks/$HERMES_BANK/memories/list?limit=1" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))")
echo "  $HERMES_BANK new count: $new_count (was $src_count)"
echo "  Reduction: $(echo "scale=1; ($src_count - $new_count) * 100 / $src_count" | bc)%"

echo
echo "=== Done ==="
echo "Archive (frozen, original): $BASE/v1/default/banks/$ARCHIVE_BANK"
echo "Re-derived bank:            $BASE/v1/default/banks/$HERMES_BANK"
