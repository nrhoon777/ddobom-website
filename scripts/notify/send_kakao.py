#!/usr/bin/env python3
"""카카오톡 '나에게 보내기' — 내 카톡(나와의 채팅)으로 메시지를 보낸다.

카카오 메모 API(/v2/api/talk/memo/default/send)를 쓴다. 친구에게 보내기와 달리
'나에게 보내기'는 별도 권한 심사 없이 앱 소유자 본인 계정으로 바로 동작한다.

최초 1회:  python3 scripts/notify/kakao_auth.py

사용법:
  python3 scripts/notify/send_kakao.py "오늘 보도 3건 정리했습니다"
  python3 scripts/notify/send_kakao.py --file draft.md
  cat report.md | python3 scripts/notify/send_kakao.py -
  python3 scripts/notify/send_kakao.py "새 뉴스레터 초안" --link https://example.org/letter
옵션:
  --link URL       메시지 아래 버튼으로 붙일 주소
  --button 텍스트   버튼 이름 (기본: 자세히 보기)
  --dry-run        실제로 보내지 않고 전송될 내용만 출력
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import env  # noqa: E402

SEND = "https://kapi.kakao.com/v2/api/talk/memo/default/send"
TOKEN = "https://kauth.kakao.com/oauth/token"
CACHE = "kakao-token.json"
LIMIT = 185  # 텍스트 템플릿 상한 200자 - 페이지 표시 여유


def refresh_access_token(state):
    key = env.need("KAKAO_REST_API_KEY", ".env 에 REST API 키를 넣으세요")
    if not state.get("refresh_token"):
        env.die("리프레시 토큰이 없습니다. python3 scripts/notify/kakao_auth.py 를 다시 실행하세요.")
    data = {
        "grant_type": "refresh_token",
        "client_id": key,
        "refresh_token": state["refresh_token"],
    }
    secret = os.environ.get("KAKAO_CLIENT_SECRET")
    if secret:
        data["client_secret"] = secret
    status, payload = env.post(TOKEN, data=data)
    if status != 200 or not isinstance(payload, dict) or "access_token" not in payload:
        env.die(
            "토큰 갱신 실패 (HTTP %s): %s\n  → python3 scripts/notify/kakao_auth.py 로 다시 인증하세요."
            % (status, payload)
        )
    state["access_token"] = payload["access_token"]
    if payload.get("refresh_token"):  # 리프레시 토큰도 회전될 수 있다
        state["refresh_token"] = payload["refresh_token"]
    env.write_cache(CACHE, state)
    return state


def send_one(state, text, link, button, retried=False):
    template = {"object_type": "text", "text": text, "link": {}}
    if link:
        template["link"] = {"web_url": link, "mobile_web_url": link}
        template["button_title"] = button
    status, payload = env.post(
        SEND,
        data={"template_object": json.dumps(template, ensure_ascii=False)},
        headers={"Authorization": "Bearer %s" % state["access_token"]},
    )
    if status == 401 and not retried:
        return send_one(refresh_access_token(state), text, link, button, retried=True)
    if status != 200:
        env.die("전송 실패 (HTTP %s): %s" % (status, payload))
    return payload


def main():
    parser = argparse.ArgumentParser(description="카카오톡 나에게 보내기")
    parser.add_argument("text", nargs="*", help="보낼 내용 ('-' 이면 표준입력)")
    parser.add_argument("--file", help="파일 내용을 보낸다")
    parser.add_argument("--link", help="버튼으로 붙일 주소")
    parser.add_argument("--button", default="자세히 보기")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    env.load_env()
    message = env.read_message(args.text, args.file)
    parts = env.chunk(message, LIMIT)
    total = len(parts)
    if total > 1:
        parts = ["%s\n\n(%d/%d)" % (p, i + 1, total) for i, p in enumerate(parts)]

    if args.dry_run:
        for i, part in enumerate(parts, 1):
            print("--- %d/%d (%d자) ---\n%s" % (i, total, len(part), part))
        return

    state = env.read_cache(CACHE)
    if not state.get("access_token"):
        env.die("인증 정보가 없습니다. 먼저 실행하세요:\n  python3 scripts/notify/kakao_auth.py")

    for i, part in enumerate(parts, 1):
        send_one(state, part, args.link if i == total else None, args.button)
    print("카카오톡으로 보냈습니다 (%d개 메시지, %d자)." % (total, len(message)))


if __name__ == "__main__":
    main()
