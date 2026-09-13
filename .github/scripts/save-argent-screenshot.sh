#!/bin/sh
# Save one full-resolution Chromium screenshot for the behavior-review
# artifact. Claude may invoke only this narrow Bash command; Argent remains
# the device-control boundary.
set -eu

device=${1:?usage: save-argent-screenshot.sh <device-id> <slug>}
slug=${2:?usage: save-argent-screenshot.sh <device-id> <slug>}

case "$device" in
  chromium-cdp-*)
    port=${device#chromium-cdp-}
    case "$port" in
      ''|*[!0-9]*)
        echo "device must be a Chromium id from Argent list-devices" >&2
        exit 2
        ;;
    esac
    ;;
  *)
    echo "device must be a Chromium id from Argent list-devices" >&2
    exit 2
    ;;
esac

case "$slug" in
  ''|*[!a-z0-9-]*|-*|*-|*--*)
    echo "slug must use lowercase letters, digits, and single hyphens" >&2
    exit 2
    ;;
esac

review_dir="${GITHUB_WORKSPACE:-$(pwd)}/artifacts/review"
mkdir -p "$review_dir"
target="$review_dir/$slug.png"

if [ ! -f "$target" ]; then
  count=$(find "$review_dir" -maxdepth 1 -type f -name '*.png' | wc -l | tr -d ' ')
  if [ "$count" -ge 6 ]; then
    echo "behavior review is limited to six screenshots" >&2
    exit 2
  fi
fi

argent run screenshot \
  --udid "$device" \
  --scale 1 \
  --includeImageInContext false \
  --out "$target"

echo "$target"
