#!/usr/bin/env bash
# PreToolUse hook (Edit|Write): refuse edits to real secrets files. .env.example stays editable.
f=$(python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null) || exit 0
b=$(basename "$f")
case "$b" in
  .env.example) exit 0 ;;
  .env|.env.*|.dev.vars|.dev.vars.*)
    printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Secrets files are off-limits to agents. Add the variable NAME to .env.example and ask the owner to set the value."}}'
    ;;
esac
exit 0
