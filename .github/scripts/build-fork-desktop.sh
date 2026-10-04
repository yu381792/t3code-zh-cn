#!/usr/bin/env bash
set -euo pipefail
args=(--platform mac --target dmg --arch arm64 --build-version "$RELEASE_VERSION" --output-dir release --verbose)

if [[ -n "${CSC_LINK:-}" && -n "${CSC_KEY_PASSWORD:-}" && -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${MACOS_PROVISIONING_PROFILE:-}" ]]; then
  key_path="$RUNNER_TEMP/AuthKey_${APPLE_API_KEY_ID}.p8"
  printf '%s' "$APPLE_API_KEY" > "$key_path"
  export APPLE_API_KEY="$key_path"
  profile_path="$RUNNER_TEMP/t3code.provisionprofile"
  printf '%s' "$MACOS_PROVISIONING_PROFILE" | base64 -D > "$profile_path"
  security cms -D -i "$profile_path" >/dev/null
  export T3CODE_APPLE_TEAM_ID="$APPLE_TEAM_ID"
  export T3CODE_MACOS_PROVISIONING_PROFILE="$profile_path"
  args+=(--signed)
  echo 'signed=true' >> "$GITHUB_ENV"
else
  echo 'signed=false' >> "$GITHUB_ENV"
  echo '未配置完整 Apple 开发者签名：本次提供 DMG 下载，不发布自动安装清单。' >> "$GITHUB_STEP_SUMMARY"
fi
node scripts/build-desktop-artifact.ts "${args[@]}"

shopt -s nullglob
dmgs=(release/*.dmg)
zips=(release/*.zip)
[[ ${#dmgs[@]} -eq 1 && ${#zips[@]} -eq 1 ]]
hdiutil verify "${dmgs[0]}"
unzip -tq "${zips[0]}"
