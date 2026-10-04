#!/usr/bin/env bash
set -euo pipefail
tag="v$RELEASE_VERSION"

node --input-type=module <<'NODE'
import { writeFileSync } from 'node:fs';
writeFileSync('release/build-source.json', JSON.stringify({
  version: process.env.RELEASE_VERSION,
  sourceSha: process.env.SOURCE_SHA,
  upstreamSha: process.env.UPSTREAM_SHA || null,
  run: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  appleDeveloperSigned: process.env.signed === 'true',
}, null, 2) + '\n');
NODE

shopt -s nullglob
assets=(release/*.dmg release/*.zip release/build-source.json)
if [[ "${signed:-false}" == true ]]; then
  manifests=(release/nightly-mac.yml)
  [[ ${#manifests[@]} -eq 1 ]]
  assets+=("${manifests[@]}" release/*.blockmap)
fi
(cd release; shasum -a 256 *.dmg *.zip build-source.json > SHA256SUMS)
assets+=(release/SHA256SUMS)

# 只推送已经通过检查的源码。有人并行推进 main 时普通推送会拒绝，不能强推。
gh auth setup-git
git tag "$tag" "$SOURCE_SHA"
git push --atomic origin "$SOURCE_SHA:refs/heads/main" "refs/tags/$tag"

notes="$RUNNER_TEMP/fork-release-notes.md"
{
  echo 'T3 Code V2 中英文版，保留自定义 ACP 接入。'
  echo
  if [[ "${signed:-false}" == true ]]; then
    echo '本版带 Apple 开发者签名及自动更新清单。首次从本地临时签名版迁移仍需手动安装；自动安装尚需实机验收。'
  else
    echo '本版使用本地临时签名，请下载 arm64 DMG 安装。没有 Apple 开发者签名，应用内自动安装尚不可用。'
  fi
  echo
  echo "fork-source: $SOURCE_SHA"
  echo "官方合并提交：${UPSTREAM_SHA:-未执行官方合并}"
  echo "构建记录：${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
} > "$notes"

# 先上传到草稿，全部附件成功后才公开，避免发布半个安装包。
gh release create "$tag" --verify-tag --draft --prerelease --latest=false --title "T3 Code 中文版 $RELEASE_VERSION" --notes-file "$notes"
gh release upload "$tag" "${assets[@]}"
gh release edit "$tag" --draft=false
echo "通过：已发布 ${tag}；签名状态 ${signed:-false}。" >> "$GITHUB_STEP_SUMMARY"
