"""또봄 알림 스크립트 공용 유틸 — .env 로더, 토큰 캐시, HTTP 헬퍼.

표준 라이브러리만 쓴다 (이 맥에는 Node.js·requests 가 없다).
자격증명은 저장소에 커밋하지 않는다 — .env 와 .claude/channels/ 는 .gitignore 대상이다.
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HOME_CLAUDE = os.path.expanduser("~/.claude")
# 토큰 캐시는 계정 단위라 전역 한 곳에 둔다 (어느 프로젝트에서 부르든 같은 곳).
CACHE_DIR = os.path.join(HOME_CLAUDE, "channels")


def env_files():
    """.env 를 찾는 순서. 앞에 있는 파일의 값이 우선한다.

    1) NOTIFY_ENV_FILE 환경변수로 직접 지정한 파일
    2) 지금 작업 중인 폴더의 .env      — 프로젝트별로 다른 봇을 쓰고 싶을 때
    3) ~/.claude/.env                  — 전역 기본값 (보통 여기 하나면 된다)
    """
    paths = []
    override = os.environ.get("NOTIFY_ENV_FILE")
    if override:
        paths.append(os.path.expanduser(override))
    paths.append(os.path.join(os.getcwd(), ".env"))
    paths.append(os.path.join(HOME_CLAUDE, ".env"))
    seen, uniq = set(), []
    for path in paths:
        real = os.path.abspath(path)
        if real not in seen:
            seen.add(real)
            uniq.append(real)
    return uniq


def load_env():
    """찾은 .env 들을 순서대로 읽어 os.environ 에 채운다. 먼저 읽은 값이 이긴다."""
    for path in env_files():
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fp:
            for raw in fp:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def need(key, hint):
    val = os.environ.get(key)
    if not val:
        looked = "\n     ".join(env_files())
        die("%s 가 없습니다.\n  → %s\n  (찾아본 곳: %s)" % (key, hint, looked))
    return val


def die(msg, code=1):
    sys.stderr.write("오류: %s\n" % msg)
    raise SystemExit(code)


def cache_path(name):
    os.makedirs(CACHE_DIR, exist_ok=True)
    return os.path.join(CACHE_DIR, name)


def read_cache(name):
    path = cache_path(name)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as fp:
            return json.load(fp)
    except (ValueError, OSError):
        return {}


def write_cache(name, data):
    path = cache_path(name)
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
    os.chmod(path, 0o600)
    return path


def post(url, data=None, headers=None, json_body=None, timeout=20):
    """POST 후 (status, 파싱된 JSON 또는 원문) 반환. 4xx/5xx 도 예외 없이 돌려준다."""
    headers = dict(headers or {})
    if json_body is not None:
        body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
        headers.setdefault("Content-Type", "application/json; charset=utf-8")
    else:
        body = urllib.parse.urlencode(data or {}).encode("utf-8")
        headers.setdefault("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.getcode(), _parse(resp.read())
    except urllib.error.HTTPError as exc:
        return exc.code, _parse(exc.read())
    except urllib.error.URLError as exc:
        die("네트워크 오류: %s" % exc.reason)


def get(url, timeout=20):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.getcode(), _parse(resp.read())
    except urllib.error.HTTPError as exc:
        return exc.code, _parse(exc.read())
    except urllib.error.URLError as exc:
        die("네트워크 오류: %s" % exc.reason)


def _parse(raw):
    text = raw.decode("utf-8", "replace")
    try:
        return json.loads(text)
    except ValueError:
        return text


def read_message(args_text, file_opt):
    """본문을 인자 / --file / 표준입력 중 하나에서 읽는다."""
    if file_opt:
        with open(file_opt, encoding="utf-8") as fp:
            return fp.read().strip()
    joined = " ".join(args_text).strip()
    if joined and joined != "-":
        return joined
    if not sys.stdin.isatty():
        return sys.stdin.read().strip()
    die("보낼 내용이 없습니다. 인자로 주거나 --file, 또는 표준입력으로 넘기세요.")


def chunk(text, limit):
    """길이 제한에 맞춰 줄 단위로 쪼갠다 (문장 중간에서 끊지 않으려는 시도)."""
    if len(text) <= limit:
        return [text]
    parts, buf = [], ""
    for line in text.split("\n"):
        while len(line) > limit:
            if buf:
                parts.append(buf.rstrip("\n"))
                buf = ""
            parts.append(line[:limit])
            line = line[limit:]
        if len(buf) + len(line) + 1 > limit:
            parts.append(buf.rstrip("\n"))
            buf = ""
        buf += line + "\n"
    if buf.strip():
        parts.append(buf.rstrip("\n"))
    return parts
