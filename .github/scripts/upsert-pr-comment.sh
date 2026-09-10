#!/bin/sh
# Create or update the single pull-request comment that starts with a marker.
#
#   .github/scripts/upsert-pr-comment.sh '<!-- argent-qa -->' artifacts/flows.md
#
# Needs GH_TOKEN (pull-requests: write), GH_REPO (owner/name), and PR_NUMBER.
# A PR keeps one comment per marker; every push edits it in place instead of
# adding another.
set -eu

marker=${1:?usage: upsert-pr-comment.sh <marker> <body-file>}
body=${2:?usage: upsert-pr-comment.sh <marker> <body-file>}
: "${GH_REPO:?GH_REPO is not set}"
: "${PR_NUMBER:?PR_NUMBER is not set}"

if [ "$(head -n 1 "$body")" != "$marker" ]; then
  echo "the first line of $body must be the marker $marker" >&2
  exit 2
fi

existing=$(gh api --paginate "repos/${GH_REPO}/issues/${PR_NUMBER}/comments" \
  --jq ".[] | select(.body | startswith(\"${marker}\")) | .id" | head -n 1)

if [ -n "$existing" ]; then
  gh api -X PATCH "repos/${GH_REPO}/issues/comments/${existing}" -F body=@"$body" >/dev/null
  echo "updated comment ${existing} on #${PR_NUMBER}"
else
  gh api -X POST "repos/${GH_REPO}/issues/${PR_NUMBER}/comments" -F body=@"$body" >/dev/null
  echo "created comment on #${PR_NUMBER}"
fi
