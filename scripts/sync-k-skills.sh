#!/usr/bin/env bash
# 또봄 홈페이지 — k-skill 큐레이션 동기화 스크립트
#
# NomaDamas/k-skill (https://github.com/NomaDamas/k-skill, MIT) 에서 또봄 운영에
# 실제로 쓰이는 스킬만 골라 .claude/skills/ 로 내려받는다.
#
# 왜 저장소에 복사(벤더링)하는가:
#   - .claude/skills/ 에 커밋해두면 로컬 터미널·Claude Code 웹/클라우드 세션·
#     Claude in Slack 어디서든 별도 설치 없이 곧바로 인식된다.
#   - 업스트림 SKILL.md 는 `npx @nomadamas/k-skill instruct` 를 호출하는 스텁이라
#     Node.js 가 없는 환경에서는 동작하지 않는다. 이 스크립트가 instruction.md 를
#     함께 받아두고, SKILL.md 에 "로컬 사본을 읽어라" 안내와 한국어 트리거를 덧붙인다.
#
# 사용법:   bash scripts/sync-k-skills.sh
# 특정 태그: K_SKILL_REF=v1.2.3 bash scripts/sync-k-skills.sh
#
# 저장소 tarball 을 한 번만 받으므로 GitHub API 레이트리밋에 걸리지 않는다.

set -euo pipefail

REPO="NomaDamas/k-skill"
REF="${K_SKILL_REF:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/.claude/skills"

# 또봄(한국청년암협회) 운영에 연동한 스킬 목록.
# 추가/제외하려면 이 배열만 고치고 다시 실행하면 된다.
SKILLS=(
  # 콘텐츠·카피 — 홈페이지 / 뉴스레터 / SNS
  korean-spell-check
  korean-character-count
  korean-humanizer
  # 법무·정책 — policy.html, 기부금·개인정보 관련
  korean-privacy-terms
  korean-law-search
  # 홍보·리서치 — news.html 보도 모니터링
  naver-news-search
  naver-blog-research
  # 비영리 행정 — 보조금·지원사업·후원기업 검증
  hwp
  rhwp-edit
  nts-business-registration
  kstartup-search
  korean-holiday-calendar
  # 수혜자 지원 정보 — 청년 암 경험자 안내용 (참고 자료)
  korean-scholarship-search
  nhis-care-checkup-search
  mfds-drug-safety
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "k-skill@$REF 내려받는 중…"
curl -fsSL -m 300 "https://codeload.github.com/$REPO/tar.gz/refs/heads/$REF" \
  -o "$TMP/k-skill.tar.gz" \
  || curl -fsSL -m 300 "https://codeload.github.com/$REPO/tar.gz/refs/tags/$REF" \
       -o "$TMP/k-skill.tar.gz"

tar -xzf "$TMP/k-skill.tar.gz" -C "$TMP"
SRC="$(find "$TMP" -maxdepth 1 -type d -name 'k-skill-*' | head -1)"
[ -n "$SRC" ] || { echo "압축 해제 실패"; exit 1; }

mkdir -p "$DEST"
for s in "${SKILLS[@]}"; do
  if [ ! -f "$SRC/$s/SKILL.md" ]; then
    echo "  !! $s — 업스트림에 없음(이름이 바뀌었을 수 있음), 건너뜁니다"
    continue
  fi
  printf '  → %s\n' "$s"
  rm -rf "${DEST:?}/$s"
  cp -R "$SRC/$s" "$DEST/$s"
  python3 "$ROOT/scripts/_patch_skill_md.py" "$DEST/$s/SKILL.md" "$s"
done

# 업스트림 라이선스를 함께 보관한다 (MIT — 저작권 고지 유지 의무).
cp "$SRC/LICENSE" "$DEST/LICENSE.k-skill"

printf '\n완료: %s 에 동기화했습니다.\n' "${DEST#$ROOT/}"
