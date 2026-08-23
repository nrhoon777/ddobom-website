#!/usr/bin/env python3
"""텔레그램으로 보내기 — 봇이 내 텔레그램 채팅으로 메시지를 보낸다.

최초 1회 준비 (사람이 직접):
  1) 텔레그램에서 @BotFather 에게 /newbot → 봇 이름·아이디 정하면 토큰이 나온다
  2) .env 에 TELEGRAM_BOT_TOKEN=<토큰> 을 넣는다
  3) 만든 봇을 텔레그램에서 찾아 아무 말이나 한 번 보낸다 (봇이 먼저 말을 걸 수 없다)
  4) python3 scripts/notify/send_telegram.py --find-chat-id
     → 나온 chat_id 를 .env 의 TELEGRAM_CHAT_ID 에 넣는다

사용법:
  python3 scripts/notify/send_telegram.py "오늘 보도 3건 정리했습니다"
  python3 scripts/notify/send_telegram.py --file draft.md
  cat report.md | python3 scripts/notify/send_telegram.py -
옵션:
  --chat-id ID     .env 값 대신 이 대화로 보낸다 (그룹은 -100… 형식)
  --html           HTML 서식으로 보낸다 (<b>, <i>, <a href>)
  --preview        링크 미리보기를 켠다 (기본은 꺼짐)
  --dry-run        실제로 보내지 않고 전송될 내용만 출력
  --find-chat-id   봇에게 온 최근 메시지에서 chat_id 를 찾아 보여준다
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import env  # noqa: E402

API = "https://api.telegram.org/bot%s/%s"
LIMIT = 3900  # 상한 4096자 - 여유


def api_url(token, method):
    return API % (token, method)


def find_chat_id(token):
    status, payload = env.get(api_url(token, "getUpdates"))
    if status != 200 or not isinstance(payload, dict) or not payload.get("ok"):
        env.die("getUpdates 실패 (HTTP %s): %s" % (status, payload))
    seen = {}
    for update in payload.get("result", []):
        msg = update.get("message") or update.get("channel_post") or {}
        chat = msg.get("chat") or {}
        if chat.get("id"):
            name = chat.get("title") or " ".join(
                filter(None, [chat.get("first_name"), chat.get("last_name")])
            ) or chat.get("username") or ""
            seen[chat["id"]] = "%s (%s)" % (name, chat.get("type"))
    if not seen:
        env.die(
            "봇에게 온 메시지가 없습니다.\n"
            "  → 텔레그램에서 봇을 찾아 아무 메시지나 한 번 보낸 뒤 다시 실행하세요.\n"
            "  (getUpdates 는 최근 24시간 기록만 보여줍니다)"
        )
    print("찾은 대화:")
    for cid, label in seen.items():
        print("  %s  %s" % (cid, label))
    print("\n.env 에 넣으세요:  TELEGRAM_CHAT_ID=%s" % next(iter(seen)))


def send_one(token, chat_id, text, html, preview):
    body = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": not preview,
    }
    if html:
        body["parse_mode"] = "HTML"
    status, payload = env.post(api_url(token, "sendMessage"), json_body=body)
    if status != 200 or not (isinstance(payload, dict) and payload.get("ok")):
        env.die("전송 실패 (HTTP %s): %s" % (status, payload))
    return payload


def main():
    parser = argparse.ArgumentParser(description="텔레그램으로 보내기")
    parser.add_argument("text", nargs="*", help="보낼 내용 ('-' 이면 표준입력)")
    parser.add_argument("--file", help="파일 내용을 보낸다")
    parser.add_argument("--chat-id")
    parser.add_argument("--html", action="store_true")
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--find-chat-id", action="store_true")
    args = parser.parse_args()

    env.load_env()
    need_token = lambda: env.need(  # noqa: E731
        "TELEGRAM_BOT_TOKEN",
        "@BotFather 에서 봇을 만들고 .env 에 TELEGRAM_BOT_TOKEN=<토큰> 을 넣으세요 (.env.example 참고)",
    )

    if args.find_chat_id:
        find_chat_id(need_token())
        return

    message = env.read_message(args.text, args.file)
    parts = env.chunk(message, LIMIT)

    if args.dry_run:
        for i, part in enumerate(parts, 1):
            print("--- %d/%d (%d자) ---\n%s" % (i, len(parts), len(part), part))
        return

    token = need_token()
    chat_id = args.chat_id or env.need(
        "TELEGRAM_CHAT_ID",
        "python3 scripts/notify/send_telegram.py --find-chat-id 로 확인해 .env 에 넣으세요",
    )
    for part in parts:
        send_one(token, chat_id, part, args.html, args.preview)
    print("텔레그램으로 보냈습니다 (%d개 메시지, %d자)." % (len(parts), len(message)))


if __name__ == "__main__":
    main()
