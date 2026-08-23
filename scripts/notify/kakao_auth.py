#!/usr/bin/env python3
"""카카오톡 '나에게 보내기' 최초 1회 인증.

브라우저에서 카카오 로그인 → 동의 → 돌아온 인가 코드를 토큰으로 바꿔
.claude/channels/kakao-token.json 에 저장한다. 이후 send_kakao.py 가
리프레시 토큰으로 알아서 갱신하므로 다시 실행할 일은 거의 없다.

사전 준비 (최초 1회, 사람이 직접):
  1) https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가
  2) 앱 키 > REST API 키 를 .env 의 KAKAO_REST_API_KEY 에 넣는다
  3) 카카오 로그인 > 활성화 ON
  4) 카카오 로그인 > Redirect URI 에 http://localhost:5599/callback 등록
  5) 카카오 로그인 > 동의항목 > '카카오톡 메시지 전송(talk_message)' 사용 설정
     ('나에게 보내기'는 별도 권한 심사 없이 앱 소유자 본인 계정으로 바로 됩니다)

사용법:
  python3 scripts/notify/kakao_auth.py              # 로컬 콜백 서버로 자동 수신
  python3 scripts/notify/kakao_auth.py --port 5599
  python3 scripts/notify/kakao_auth.py --code <인가코드>   # 수동 입력
"""

import argparse
import os
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import env  # noqa: E402

AUTHORIZE = "https://kauth.kakao.com/oauth/authorize"
TOKEN = "https://kauth.kakao.com/oauth/token"
CACHE = "kakao-token.json"
SCOPE = "talk_message"

_received = {}
_done = threading.Event()


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        _received.update({k: v[0] for k, v in query.items()})
        _done.set()
        body = "받았습니다. 터미널로 돌아가세요." if "code" in _received else "인가 코드가 없습니다."
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(("<meta charset='utf-8'><h2>%s</h2>" % body).encode("utf-8"))

    def log_message(self, *_args):
        pass


def exchange(code, key, redirect_uri, secret=None):
    data = {
        "grant_type": "authorization_code",
        "client_id": key,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    if secret:
        data["client_secret"] = secret
    status, payload = env.post(TOKEN, data=data)
    if status != 200 or not isinstance(payload, dict) or "access_token" not in payload:
        env.die("토큰 교환 실패 (HTTP %s): %s" % (status, payload))
    return payload


def main():
    parser = argparse.ArgumentParser(description="카카오 '나에게 보내기' 인증")
    parser.add_argument("--port", type=int, default=int(os.environ.get("KAKAO_CALLBACK_PORT", 5599)))
    parser.add_argument("--code", help="브라우저에서 직접 복사한 인가 코드")
    parser.add_argument("--redirect-uri", help="카카오 콘솔에 등록한 Redirect URI")
    args = parser.parse_args()

    env.load_env()
    key = env.need(
        "KAKAO_REST_API_KEY",
        ".env 에 KAKAO_REST_API_KEY=<REST API 키> 를 넣으세요 (.env.example 참고)",
    )
    secret = os.environ.get("KAKAO_CLIENT_SECRET") or None
    redirect_uri = (
        args.redirect_uri
        or os.environ.get("KAKAO_REDIRECT_URI")
        or "http://localhost:%d/callback" % args.port
    )

    params = urllib.parse.urlencode(
        {
            "client_id": key,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPE,
        }
    )
    url = "%s?%s" % (AUTHORIZE, params)

    if args.code:
        token = exchange(args.code, key, redirect_uri, secret)
    else:
        server = HTTPServer(("127.0.0.1", args.port), _Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        print("아래 주소를 브라우저에서 열고 카카오 로그인 후 '동의하기'를 누르세요.\n")
        print("  %s\n" % url)
        print("(Redirect URI: %s — 카카오 콘솔에 같은 값이 등록돼 있어야 합니다)" % redirect_uri)
        print("대기 중… Ctrl+C 로 취소")
        try:
            if not _done.wait(timeout=300):
                env.die("5분 안에 응답이 없어 중단했습니다.")
        except KeyboardInterrupt:
            env.die("취소했습니다.")
        finally:
            server.shutdown()
        if "error" in _received:
            env.die("카카오가 거부했습니다: %s %s" % (_received.get("error"), _received.get("error_description", "")))
        token = exchange(_received["code"], key, redirect_uri, secret)

    saved = {
        "access_token": token["access_token"],
        "refresh_token": token.get("refresh_token", ""),
        "expires_in": token.get("expires_in"),
        "refresh_token_expires_in": token.get("refresh_token_expires_in"),
        "scope": token.get("scope", SCOPE),
        "redirect_uri": redirect_uri,
    }
    path = env.write_cache(CACHE, saved)
    print("\n인증 완료 — 토큰을 저장했습니다: %s" % path)
    print("리프레시 토큰 유효기간: 약 %s일" % (int(saved.get("refresh_token_expires_in") or 0) // 86400))
    print("\n이제 보낼 수 있습니다:\n  python3 scripts/notify/send_kakao.py \"테스트\"")


if __name__ == "__main__":
    main()
