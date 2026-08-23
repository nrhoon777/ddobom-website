#!/usr/bin/env bash
# 또봄 저장소의 스킬·명령어·전송 스크립트를 ~/.claude/ 에 설치한다.
#
# 왜 하는가:
#   .claude/skills 와 .claude/commands 는 "그 폴더에서 Claude Code 를 열었을 때"만 잡힌다.
#   또봄 홈페이지 말고 다른 업무를 할 때도 맞춤법 검사나 /보내기 를 쓰려면 전역에 둬야 한다.
#
# 무엇을 옮기는가:
#   ~/.claude/skills/          k-skill 15개 + send-to-me
#   ~/.claude/commands/보내기.md
#   ~/.claude/scripts/notify/  카톡·텔레그램 전송 스크립트
#   ~/.claude/.env             토큰 (저장소에 있으면 옮겨온다)
#
# 또봄 전용 명령어(/보도모니터링 · /카피검수 · /지원사업점검)는 이 저장소의 파일을
# 직접 건드리므로 전역으로 옮기지 않는다. 저장소 안의 사본도 그대로 남는다
# (Claude Code 웹·Slack 세션이 저장소 사본을 쓰기 때문).
#
# 사용법:  bash scripts/install-global.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HOME/.claude"

mkdir -p "$DEST/skills" "$DEST/commands" "$DEST/scripts/notify" "$DEST/channels"
chmod 700 "$DEST/channels"

echo "스킬 설치 → $DEST/skills"
for dir in "$ROOT"/.claude/skills/*/; do
  name="$(basename "$dir")"
  rm -rf "${DEST:?}/skills/$name"
  cp -R "$dir" "$DEST/skills/$name"
  printf '  → %s\n' "$name"
done
cp "$ROOT/.claude/skills/LICENSE.k-skill" "$DEST/skills/LICENSE.k-skill" 2>/dev/null || true

echo "전송 스크립트 설치 → $DEST/scripts/notify"
cp "$ROOT"/scripts/notify/*.py "$DEST/scripts/notify/"

# 전역에서는 상대경로(scripts/notify/...)가 통하지 않으므로 절대경로로 바꿔 넣는다.
echo "명령어·스킬 경로 보정"
fix_paths() {
  sed 's|python3 scripts/notify/|python3 ~/.claude/scripts/notify/|g' "$1" > "$2"
}
fix_paths "$ROOT/.claude/commands/보내기.md" "$DEST/commands/보내기.md"
fix_paths "$ROOT/.claude/skills/send-to-me/SKILL.md" "$DEST/skills/send-to-me/SKILL.md"

# 토큰은 전역 한 곳에 모은다.
if [ -f "$ROOT/.env" ] && [ ! -f "$DEST/.env" ]; then
  mv "$ROOT/.env" "$DEST/.env"
  chmod 600 "$DEST/.env"
  echo "토큰 이동 → $DEST/.env (저장소에서는 제거됨)"
elif [ -f "$ROOT/.env" ]; then
  echo "알림: $DEST/.env 가 이미 있어 저장소 .env 는 그대로 뒀습니다."
  echo "      같은 폴더에서 작업할 때는 저장소 .env 가 우선합니다."
else
  echo "토큰: $DEST/.env $( [ -f "$DEST/.env" ] && echo '사용' || echo '없음 — .env.example 을 복사해 채우세요' )"
fi

printf '\n설치 완료. 이제 어느 폴더에서 Claude Code 를 열든 스킬과 /보내기 가 잡힙니다.\n'
printf '갱신하려면 이 저장소에서 다시 실행하세요:  bash scripts/install-global.sh\n'
