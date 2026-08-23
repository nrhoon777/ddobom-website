#!/usr/bin/env bash
# Discord / Telegram / iMessage 채널을 붙여 Claude Code 를 띄운다.
#
# 채널(channels)은 외부 메신저의 메시지를 "실행 중인 로컬 세션"으로 밀어넣는 기능이다.
# 즉 이 저장소를 연 세션에 디스코드에서 말을 걸면, .claude/skills 의 k-skill 들과
# 실제 홈페이지 파일에 접근한 채로 답이 돌아온다.
#
# 사전 준비 (최초 1회):
#   1) Bun 설치 — https://bun.sh   (채널 플러그인이 Bun 스크립트다)
#   2) Claude Code 에서:
#        /plugin marketplace add anthropics/claude-plugins-official
#        /plugin install discord@claude-plugins-official     # 설치 범위는 user 선택
#        /discord:configure <봇 토큰>
#   3) 디스코드 개발자 포털에서 봇 생성 → Message Content Intent 활성화 →
#      bot 스코프로 서버 초대 (View Channels / Send Messages / Read Message History 등)
#
# 사용법:
#   bash scripts/claude-channels.sh              # discord (기본)
#   bash scripts/claude-channels.sh telegram
#   bash scripts/claude-channels.sh discord telegram
#
# 최초 실행 후 봇에게 DM 을 보내면 페어링 코드가 오고, 세션에서 아래로 승인한다:
#   /discord:access pair <코드>
#   /discord:access policy allowlist     # 본인만 보낼 수 있도록 잠근다

set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v bun >/dev/null 2>&1 || {
  echo "Bun 이 필요합니다. https://bun.sh 에서 설치한 뒤 다시 실행하세요." >&2
  exit 1
}

CHANNELS=("${@:-discord}")
ARGS=()
for c in "${CHANNELS[@]}"; do
  ARGS+=("plugin:${c}@claude-plugins-official")
done

echo "채널 연결: ${ARGS[*]}"
exec claude --channels "${ARGS[@]}"
