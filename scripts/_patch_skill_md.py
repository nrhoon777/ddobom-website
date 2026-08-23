#!/usr/bin/env python3
"""sync-k-skills.sh 보조 스크립트.

업스트림 SKILL.md 를 또봄 저장소용으로 손본다.
  1) frontmatter 의 description 에 한국어 트리거 문구를 덧붙인다.
     (업스트림 설명이 영문인 스킬이 많아, 한국어로 말할 때 스킬이 안 잡히는 걸 막는다)
  2) 본문 첫 제목 아래에 "로컬 사본을 읽어라" 안내를 끼워넣는다.
     (Node.js/npx 없는 환경에서도 instruction.md 로 동작하도록)

원본을 건드리지 않고 이 스크립트만 다시 돌리면 되도록 멱등하게 동작한다.
"""
import json
import pathlib
import re
import sys

# 또봄 실무에서 실제로 쓸 법한 말투로 트리거를 적는다.
KO_TRIGGERS = {
    "korean-spell-check": "맞춤법 검사, 띄어쓰기 교정, 오탈자 점검, 교정·교열, 홈페이지 카피·뉴스레터 문장 검수에 사용.",
    "korean-character-count": "글자수 세기, 자소·바이트 수 계산, 공백 포함/제외 글자수, SNS·공모전 분량 제한 확인에 사용.",
    "korean-privacy-terms": "개인정보처리방침, 이용약관, 쿠키 배너, 동의 모달 생성·점검에 사용.",
    "korean-law-search": "법령 검색, 조문 조회, 판례·법령해석례 찾기, 조례 확인 (기부금품법·비영리법인·개인정보보호법 등)에 사용.",
    "naver-news-search": "언론 보도 모니터링, 뉴스 검색, 기사 클리핑, 단체·캠페인 노출 현황 확인에 사용.",
    "naver-blog-research": "네이버 블로그 검색·본문 읽기·이미지 수집, 후기·레퍼런스 리서치에 사용.",
    "hwp": "한글 문서(HWP/HWPX) 읽기, 텍스트·표 추출, 서식 필드 추출, 마크다운→HWPX 변환에 사용.",
    "rhwp-edit": "한글 문서(HWP) 편집, 텍스트 삽입·삭제·일괄치환, 표 생성, 사업계획서·보조금 신청서 양식 채우기에 사용.",
    "nts-business-registration": "사업자등록번호 진위확인, 휴폐업 상태 조회, 후원 기업·거래처 검증, 기부금영수증 발행 전 확인에 사용.",
    "kstartup-search": "정부 지원사업 공고 검색, 창업·사업 공고 조회에 사용.",
    "korean-holiday-calendar": "공휴일·국경일·기념일·24절기 조회, 캠페인·행사 일정 잡을 때 사용.",
    "korean-scholarship-search": "장학금 검색 및 조회, 학비 지원 공고 찾기 (청년 암 경험자 학업 복귀 지원 안내)에 사용.",
    "nhis-care-checkup-search": "건강검진기관 조회, 장기요양기관 검색, 검진·요양 기관 안내에 사용.",
    "mfds-drug-safety": "의약품 안전 정보 조회, 복약 주의사항·병용금기 확인에 사용. 참고용이며 의료 상담을 대체하지 않는다.",
    "korean-humanizer": "",  # 업스트림 설명이 이미 한국어 + 트리거 문구를 충분히 담고 있다
}

LOCAL_NOTE_MARKER = "<!-- ddobom:local-first -->"
DESC_MARKER = "[또봄]"


def yaml_single_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def patch_description(front: str, name: str, skill_json: pathlib.Path) -> str:
    trigger = KO_TRIGGERS.get(name, "")
    if not trigger or DESC_MARKER in front:
        return front

    # skill.json 의 description 을 원본으로 삼는다 (JSON 이라 파싱이 안전하다).
    base = json.loads(skill_json.read_text(encoding="utf-8"))["description"]
    merged = f"{base} {DESC_MARKER} {trigger}"

    lines = front.split("\n")
    start = next(
        (i for i, l in enumerate(lines) if l.startswith("description:")), None
    )
    if start is None:
        raise SystemExit(f"description 키를 찾지 못했습니다: {name}")

    # 줄바꿈된 값(따옴표/블록 스칼라)을 모두 소비한다 — 다음 최상위 키 직전까지.
    end = start + 1
    while end < len(lines) and not re.match(r"^[A-Za-z_][\w-]*:", lines[end]):
        end += 1

    lines[start:end] = [f"description: {yaml_single_quote(merged)}"]
    return "\n".join(lines)


def patch_body(body: str, name: str) -> str:
    if LOCAL_NOTE_MARKER in body:
        return body
    note = f"""{LOCAL_NOTE_MARKER}
## 또봄 저장소 로컬 사본 안내 (먼저 읽을 것)

이 스킬은 `.claude/skills/{name}/` 에 통째로 복사되어 있다. Node.js/`npx` 가 없거나
네트워크가 막힌 환경이면 아래 CLI 대신 **같은 폴더의 `instruction.md` 를 읽고 그대로 따르면 된다.**
`references/`, `scripts/` 도 함께 들어 있다. 최신본 갱신은 `bash scripts/sync-k-skills.sh`.
"""
    lines = body.split("\n")
    for i, line in enumerate(lines):
        if line.startswith("# "):
            lines.insert(i + 1, "\n" + note)
            break
    else:
        lines.insert(0, note)
    return "\n".join(lines)


def main() -> None:
    path = pathlib.Path(sys.argv[1])
    name = sys.argv[2]
    text = path.read_text(encoding="utf-8")

    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        raise SystemExit(f"frontmatter 를 찾지 못했습니다: {path}")
    front, body = m.group(1), text[m.end():]

    front = patch_description(front, name, path.parent / "skill.json")
    body = patch_body(body, name)
    path.write_text(f"---\n{front}\n---\n{body}", encoding="utf-8")


if __name__ == "__main__":
    main()
