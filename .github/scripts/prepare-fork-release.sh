#!/usr/bin/env bash
set -euo pipefail

upstream_sha=''
if [[ "${SYNC_UPSTREAM:-true}" == true ]]; then
  git remote add upstream https://github.com/pingdotgg/t3code.git
  git fetch --no-tags upstream main
  upstream_sha="$(git rev-parse FETCH_HEAD)"
  before="$(git rev-parse HEAD)"
  if [[ -f .github/fork-upstream.txt ]]; then
    previous_upstream="$(cat .github/fork-upstream.txt)"
    [[ "$previous_upstream" =~ ^[0-9a-f]{40}$ ]]
    git merge-base --is-ancestor "$previous_upstream" "$upstream_sha"
  else
    previous_upstream="$(git merge-base HEAD "$upstream_sha")"
  fi
  if [[ "$previous_upstream" != "$upstream_sha" ]]; then
    merge_output="$RUNNER_TEMP/fork-merge.txt"
    # Git 按上次官方快照做三方合并。提交仅以 fork 主线为父提交，
    # 不导入官方 workflow 历史，使用仓库自带令牌即可正常推送。
    if ! git merge-tree --write-tree --merge-base="$previous_upstream" HEAD "$upstream_sha" > "$merge_output"; then
      {
        echo '### 官方更新合并不通过'
        echo '以下文件存在冲突，本轮停止；未推送冲突代码，也未发布安装包。'
        echo '```'
        sed -n '/CONFLICT/p' "$merge_output"
        echo '```'
      } >> "$GITHUB_STEP_SUMMARY"
      exit 1
    fi
    merged_tree="$(head -n 1 "$merge_output")"
    git restore --source="$merged_tree" --staged --worktree .
    git restore --source="$before" --staged --worktree .github/workflows
    echo "$upstream_sha" > .github/fork-upstream.txt
    git add .github/fork-upstream.txt
    git commit -m "merge: sync official V2 snapshot $upstream_sha"
  fi
fi

source_sha="$(git rev-parse HEAD)"
latest_source="$(gh api "repos/$GITHUB_REPOSITORY/releases?per_page=30" --jq \
  '[.[] | select(.draft == false and (.body // "" | contains("fork-source: ")))] | .[0].body // ""' \
  | sed -n 's/^fork-source: \([0-9a-f]*\)$/\1/p')"
if [[ "${FORCE_RELEASE:-false}" != true && "$latest_source" == "$source_sha" ]]; then
  echo 'build=false' >> "$GITHUB_OUTPUT"
  echo '源码与已发布版本一致，本轮跳过构建。' >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi

base_version="$(node -p "require('./apps/desktop/package.json').version.split('-')[0]")"
release_number=$((1000000 + GITHUB_RUN_NUMBER))
version="${base_version}-nightly.$(TZ=Asia/Shanghai date +%Y%m%d).${release_number}"
{
  echo 'build=true'
  echo "version=$version"
  echo "sha=$source_sha"
  echo "upstream=$upstream_sha"
} >> "$GITHUB_OUTPUT"
echo "准备构建 ${version}；源码 ${source_sha}；官方 ${upstream_sha}。" >> "$GITHUB_STEP_SUMMARY"
