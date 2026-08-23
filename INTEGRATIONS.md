# 연동 구성 — k-skill · Slack · Notion · Discord · 카카오톡 · 텔레그램

또봄 홈페이지 저장소에 [NomaDamas/k-skill](https://github.com/NomaDamas/k-skill) 중
또봄 운영에 실제로 쓰이는 스킬 15개를 붙이고, Slack·Notion·Discord에서도 같은 스킬을
쓸 수 있도록 배선한 내용입니다. 결과물을 본인 카카오톡·텔레그램으로 보내는 경로도 함께 넣었습니다.

---

## 1. 붙인 스킬 (15개)

`.claude/skills/` 에 들어 있습니다. Claude Code가 자동으로 읽으므로 별도 설치·명령이 없고,
"맞춤법 봐줘" 처럼 평소 말투로 부르면 알아서 잡힙니다.

| 스킬 | 쓰임 | 관련 파일 |
|---|---|---|
| `korean-spell-check` | 맞춤법·띄어쓰기 교정 | 전 페이지, `NEWSLETTER.md` |
| `korean-character-count` | 글자수·바이트 정확 측정 (메타 설명, SNS 분량) | 메타 태그, 카드 요약 |
| `korean-humanizer` | 번역체·AI 상투어 제거, 목표 분량 맞춰 리라이팅 | 뉴스레터, 캠페인 카피 |
| `korean-privacy-terms` | 개인정보처리방침·이용약관·쿠키 배너 생성/점검 | [policy.html](policy.html) |
| `korean-law-search` | 법령·조문·판례 조회 (기부금품법, 비영리법인, 개인정보보호법) | [policy.html](policy.html), [donate.html](donate.html) |
| `naver-news-search` | 또봄 언론 보도 모니터링 | [news.html](news.html) |
| `naver-blog-research` | 블로그 본문·이미지 리서치 | 콘텐츠 기획 |
| `hwp` | 한글 문서 읽기·표 추출·마크다운→HWPX | 공고문, 보조금 서류 |
| `rhwp-edit` | 한글 문서 편집 (신청서 양식 채우기) | 사업계획서, 지원사업 신청 |
| `nts-business-registration` | 사업자등록 진위·휴폐업 조회 | 후원 기업 검증, 기부금영수증 |
| `kstartup-search` | 정부 지원사업 공고 검색 | 재원 확보 |
| `korean-holiday-calendar` | 공휴일·절기 조회 | 캠페인 일정 |
| `korean-scholarship-search` | 장학금 공고 검색 | 청년 암 경험자 학업 복귀 지원 |
| `nhis-care-checkup-search` | 건강검진·장기요양기관 조회 | 수혜자 안내 |
| `mfds-drug-safety` | 의약품 안전 정보 조회 (참고용) | 수혜자 안내 |

### 왜 저장소에 복사했는가

업스트림 `SKILL.md`는 `npx @nomadamas/k-skill instruct` 를 부르는 얇은 스텁이라,
Node.js가 없으면 아무것도 못 합니다. 그래서 `instruction.md` · `references/` · `scripts/` 를
통째로 받아 커밋했습니다. 덕분에

- 로컬 터미널, **Claude Code 웹/클라우드 세션, Claude in Slack** 어디서든 설치 없이 인식됩니다.
- Node.js 없이도 대부분 동작합니다.

각 `SKILL.md` 상단에 로컬 사본 안내를 끼워 넣었고, 영문 설명뿐이던 스킬에는
한국어 트리거 문구(`[또봄] …`)를 덧붙여 한국어로 말할 때 잘 잡히도록 했습니다.

### 업데이트

```bash
bash scripts/sync-k-skills.sh
```

저장소 tarball을 한 번만 받아 덮어씁니다. 스킬을 추가·제외하려면 스크립트 안의
`SKILLS` 배열만 고치면 됩니다. 나머지 135개가 필요하면 플러그인으로 통째 설치할 수도 있습니다
(단, 위 15개와 이름이 겹칩니다).

```bash
claude
# /plugin marketplace add NomaDamas/k-skill
# /plugin install k-skill@k-skill
```

라이선스: 업스트림 MIT (`.claude/skills/LICENSE.k-skill`).
`korean-privacy-terms` 만 Apache-2.0 (해당 폴더의 `NOTICE`, `LICENSE.upstream` 참고).

---

## 2. 실행 환경 — 확인된 사실

이 맥(macOS, python3.9, Node.js·Bun 미설치)에서 실제로 돌려본 결과입니다.

**바로 됨 (python3 / curl 만 필요)**
`naver-blog-research`(실검색 성공), `korean-holiday-calendar`(프록시 응답 확인),
`korean-law-search`, `naver-news-search`, `nhis-care-checkup-search`,
`nts-business-registration`, `kstartup-search`, `mfds-drug-safety`,
`korean-scholarship-search`, `korean-humanizer`(런타임 불필요)

프록시(`https://k-skill-proxy.nomadamas.org`)가 공공 API 키를 대신 물고 있어
**API 키 발급 없이** 조회됩니다.

**Node.js 18+ 설치 필요**
`korean-character-count`(스크립트가 `.js`), `hwp`(kordoc CLI),
`rhwp-edit`(k-skill-rhwp CLI), `korean-privacy-terms`(업스트림 npm 패키지)

```bash
brew install node
```

**알려진 제약 — `korean-spell-check`**
업스트림 나라인포테크 맞춤법 검사기(`nara-speller.co.kr`)가 현재 Cloudflare 봇 차단을
걸어두어 스크립트 직접 호출이 403으로 막힙니다. 이 저장소 문제가 아니라 대상 서비스 쪽
상태이고, 네트워크 환경에 따라 달라질 수 있습니다. 막혀 있는 동안에는 스킬의
`instruction.md`에 적힌 대체 경로를 쓰거나, 문체 교정은 `korean-humanizer`로 대신하면 됩니다.

---

## 3. 저장소에 함께 넣은 것

### `.gitignore` 수정 (중요)

기존에는 `.claude/` **전체**가 무시되고 있었습니다. 이러면 스킬·명령어를 넣어도 커밋이 안 되고,
웹/Slack 세션으로 전달되지 않습니다. 개인 설정과 자격증명만 무시하도록 좁혔습니다.

```
.claude/settings.local.json
.claude/*.local.json
.claude/channels/
.env
```

### 슬래시 명령어 4개 (`.claude/commands/`)

스킬 여러 개를 또봄 실무 흐름 하나로 묶어둔 것입니다. 어느 표면에서든 동일하게 동작합니다.

| 명령 | 하는 일 |
|---|---|
| `/보도모니터링` | 보도 검색 → 표로 정리 → Slack 공유안 · Notion 기록 · `news.html` 반영안 |
| `/카피검수` | 맞춤법 → 분량 → 문체 3단계 검수 + 또봄 문체 게이트(투병 클리셰·신원 노출 차단) |
| `/지원사업점검` | 공고 검색 → 자격 선별 → HWP 서류 준비 → Slack·Notion 공유 |
| `/보내기` | 직전 결과물을 내 카카오톡·텔레그램으로 전송 (확인 후) |

네 명령 모두 **외부 전송·파일 수정 전에 반드시 확인을 받도록** 작성했습니다.

### 자체 스킬 1개 (`.claude/skills/send-to-me/`)

k-skill 이 아니라 이 저장소에서 만든 스킬입니다. "카톡으로 보내줘" 같은 말투를 잡아
7절의 전송 스크립트로 연결합니다. `sync-k-skills.sh` 는 목록에 있는 15개만 덮어쓰므로
동기화해도 지워지지 않습니다.

---

## 4. Slack

두 가지가 각각 다른 일을 합니다. 둘 다 켜두면 됩니다.

### (a) Slack에서 Claude를 호출 — `@Claude`

Slack 채널에서 `@Claude` 를 멘션하면 이 저장소를 클론한 클라우드 세션이 뜹니다.
`.claude/skills/` 와 `.claude/commands/` 를 커밋해두었으므로, **Slack에서 부른 세션도
위 15개 스킬과 3개 명령어를 그대로 씁니다.** 추가 설정 없습니다.

> 예: `@Claude /보도모니터링 최근 2주`

전제 조건: 워크스페이스에 Claude 앱이 설치되어 있고, 저장소가 GitHub에 올라가 있어야 합니다.
현재 원격은 `github.com/nrhoon777/ddobom-website` 입니다.

### (b) Claude가 Slack을 읽고 쓰기 — MCP

저장소 루트 [.mcp.json](.mcp.json) 에 넣었습니다. 팀 전체가 공유하고 클라우드 세션에도 적용됩니다.

```json
{ "slack": { "type": "http", "url": "https://mcp.slack.com/mcp",
             "oauth": { "scopes": "channels:read chat:write search:read users:read" } } }
```

스코프를 필요한 만큼만 고정해두었습니다. 최초 1회 인증이 필요합니다.

```bash
claude
# /mcp  → slack 선택 → 브라우저에서 로그인
```

이미 claude.ai 커넥터로 Slack을 연결해 두었다면 도구가 두 벌 보일 수 있습니다.
그때는 `.claude/settings.local.json` 에 `{"disabledMcpjsonServers": ["slack"]}` 를 넣어
저장소 쪽을 끄면 됩니다.

---

## 5. Notion

[.mcp.json](.mcp.json) 에 공식 Notion MCP 서버를 넣었습니다.

```json
{ "notion": { "type": "http", "url": "https://mcp.notion.com/mcp" } }
```

인증은 Slack과 같습니다 (`/mcp` → notion → 브라우저 로그인).

연결하면 `/보도모니터링` 의 보도 아카이브, `/지원사업점검` 의 지원사업 트래커가
Notion DB에 바로 쌓입니다. **DB는 미리 만들어두세요** — 명령어는 기존 DB를 찾아 쓰고,
못 찾으면 사용자에게 묻습니다. 권장 스키마:

- **보도 아카이브** — 날짜 / 매체 / 제목 / 링크 / 분류 / 요약
- **지원사업 트래커** — 사업명 / 주관 / 마감일 / 지원규모 / 담당 / 상태

거꾸로 Notion 문서를 스킬 입력으로 쓰는 것도 됩니다 —
"Notion의 2026 가을 뉴스레터 초안 가져와서 `/카피검수` 돌려줘".

---

## 6. Discord

Discord는 MCP가 아니라 **채널(channels)** 로 붙입니다. 채널은 외부 메신저 메시지를
*실행 중인 로컬 세션*으로 밀어넣는 기능이라, 디스코드에서 말을 걸면 이 저장소의
스킬과 실제 HTML 파일에 접근한 채로 답이 옵니다.

> 참고: 채널은 리서치 프리뷰 기능입니다. Team/Enterprise 조직이라면 관리자가
> `channelsEnabled` 를 켜야 합니다. Pro/Max 개인 계정은 바로 됩니다.

### 준비 (최초 1회)

1. **Bun 설치** — 채널 플러그인이 Bun 스크립트입니다. https://bun.sh (현재 이 맥에 미설치)
2. **디스코드 봇 생성** — [개발자 포털](https://discord.com/developers/applications) →
   New Application → Bot → Reset Token 으로 토큰 복사 →
   Privileged Gateway Intents 에서 **Message Content Intent** 켜기 →
   OAuth2 > URL Generator 에서 `bot` 스코프 + View Channels / Send Messages /
   Send Messages in Threads / Read Message History / Attach Files / Add Reactions 로 서버 초대
3. **플러그인 설치** — Claude Code 세션에서

   ```
   /plugin marketplace add anthropics/claude-plugins-official
   /plugin install discord@claude-plugins-official
   /discord:configure <봇 토큰>
   ```

   설치 범위는 user 를 고르세요.

### 실행

```bash
bash scripts/claude-channels.sh
```

Bun 설치 여부를 확인하고 `claude --channels plugin:discord@claude-plugins-official` 로 띄웁니다.
Telegram·iMessage 도 인자로 넘길 수 있습니다 (`bash scripts/claude-channels.sh discord telegram`).

### 페어링과 잠금

봇에게 DM 을 보내면 페어링 코드가 옵니다. 세션에서

```
/discord:access pair <코드>
/discord:access policy allowlist
```

`allowlist` 를 꼭 거세요. 채널로 메시지를 보낼 수 있는 사람은 세션의 도구 실행 권한까지
승인할 수 있습니다. 신뢰하는 사람만 등록하세요.

---

## 7. 카카오톡 · 텔레그램 — 내게 보내기

작업 결과(보도 정리, 카피 검수 결과, 공고 요약, 뉴스레터 초안)를 **사용자 본인 메신저로**
밀어 넣는 경로입니다. Slack/Notion 이 팀 기록용이라면 이쪽은 "지금 폰으로 받아보기"용입니다.

> **현재 상태: 텔레그램만 동작합니다.** 카카오톡은 스크립트까지 만들어 뒀지만 설정을
> 끝내지 못했습니다 — 카카오 개발자 콘솔이 개편되면서 Web 플랫폼 · Redirect URI 등록
> 화면을 찾지 못했습니다(2026-08-24 기준, 앱 `1554499`). REST API 키는 `.env` 에 들어
> 있으니, 등록 위치만 확인되면 `kakao_auth.py` 한 번으로 이어서 끝낼 수 있습니다.

말투로 부르면 잡힙니다 — "이거 텔레그램으로 보내줘", "폰으로 보내줘".
명시적으로는 `/보내기` 명령을 씁니다.

```
/보내기 오늘 보도 3건 정리한 거
```

**전송 전에 반드시 본문과 채널을 보여주고 확인을 받습니다** (스킬·명령어에 못박아 두었습니다).
개인정보(수혜자 실명·연락처·병력)가 섞였는지도 전송 전에 짚습니다.

| 파일 | 하는 일 |
|---|---|
| [scripts/notify/send_kakao.py](scripts/notify/send_kakao.py) | 카카오톡 '나에게 보내기' 전송 (토큰 자동 갱신) |
| [scripts/notify/kakao_auth.py](scripts/notify/kakao_auth.py) | 카카오 최초 1회 인증 (브라우저 로그인) |
| [scripts/notify/send_telegram.py](scripts/notify/send_telegram.py) | 텔레그램 봇 전송, `--find-chat-id` |
| [scripts/notify/env.py](scripts/notify/env.py) | `.env` 로더 · 토큰 캐시 · HTTP 헬퍼 |
| [.claude/skills/send-to-me/SKILL.md](.claude/skills/send-to-me/SKILL.md) | 말투로 부를 때 잡히는 스킬 |
| [.claude/commands/보내기.md](.claude/commands/보내기.md) | `/보내기` 명령 |

전부 python3 표준 라이브러리만 씁니다. Node.js 없이 이 맥에서 바로 돕니다.

### 준비 — 공통

```bash
cp .env.example .env
```

`.env` 는 `.gitignore` 대상입니다. 토큰은 저장소에 들어가지 않습니다.
발급받은 토큰은 **본인이 직접** `.env` 에 붙여넣으세요.

### 준비 — 카카오톡 (나와의 채팅)

카카오는 개인 계정으로 남에게 보내려면 심사가 필요하지만, **'나에게 보내기'(메모 API)는
심사 없이** 앱 소유자 본인 계정으로 바로 됩니다. 그래서 이 경로를 씁니다.

1. [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → **애플리케이션 추가**
2. **앱 키 > REST API 키** 를 `.env` 의 `KAKAO_REST_API_KEY` 에 넣기
3. **카카오 로그인 > 활성화 ON**
4. **카카오 로그인 > Redirect URI** 에 `http://localhost:5599/callback` 등록
5. **카카오 로그인 > 동의항목 > 카카오톡 메시지 전송(`talk_message`)** 사용 설정
6. 인증 (브라우저가 한 번 열립니다)

   ```bash
   python3 scripts/notify/kakao_auth.py
   ```

   출력된 주소를 브라우저에서 열고 카카오 로그인 → 동의하기.
   토큰은 `.claude/channels/kakao-token.json` (권한 600, gitignore) 에 저장됩니다.

7. 보내보기

   ```bash
   python3 scripts/notify/send_kakao.py "또봄 알림 연결됐습니다"
   ```

   카카오톡 **'나와의 채팅'** 방으로 옵니다.

액세스 토큰은 6시간, 리프레시 토큰은 약 2개월입니다. 만료되면 스크립트가 알아서 갱신하고,
리프레시 토큰까지 만료되면 6번을 다시 한 번 돌리면 됩니다.

한 통 **200자 제한**이 있어 긴 글은 자동으로 나눠 `(1/3)` 을 붙여 보냅니다.
마크다운 표는 깨지므로 긴 보고서는 텔레그램을 쓰거나 링크(`--link`)로 넘기세요.

### 준비 — 텔레그램

1. 텔레그램에서 **@BotFather** 에게 `/newbot` → 이름·아이디를 정하면 토큰이 나옵니다
2. 토큰을 `.env` 의 `TELEGRAM_BOT_TOKEN` 에 넣기
3. 만든 봇을 검색해 **아무 메시지나 한 번 보내기** (봇이 먼저 말을 걸 수 없습니다)
4. chat_id 확인 → `.env` 의 `TELEGRAM_CHAT_ID` 에 넣기

   ```bash
   python3 scripts/notify/send_telegram.py --find-chat-id
   ```

5. 보내보기

   ```bash
   python3 scripts/notify/send_telegram.py "또봄 알림 연결됐습니다"
   ```

한 통 4,096자라 웬만한 보고서가 그대로 들어갑니다(3,900자 단위로 분할). `--html` 로 서식도 됩니다.

### 텔레그램은 양방향도 됩니다

위는 **보내기 전용**입니다. 텔레그램에서 Claude 를 *부르는* 것까지 하려면 6절의 채널 기능을
텔레그램으로 띄우면 됩니다 (Bun + 플러그인 설치 필요).

```bash
bash scripts/claude-channels.sh telegram
```

`/plugin install telegram@claude-plugins-official` 후 `/telegram:configure <봇 토큰>` 으로
설정하고, 페어링 뒤 `policy allowlist` 를 꼭 거세요. 이때는 위에서 만든 봇 토큰을 그대로 써도 됩니다.

카카오톡은 개인 계정용 수신 봇 API 가 없어 **보내기 전용**입니다 (채널 기능 대상 아님).

### 다른 업무에서도 쓰기 — 전역 설치

`.claude/skills` 와 `.claude/commands` 는 **그 폴더에서 Claude Code 를 열었을 때만** 잡힙니다.
또봄 홈페이지 말고 다른 일을 할 때도 맞춤법 검사나 `/보내기` 를 쓰려면 한 번 설치하세요.

```bash
bash scripts/install-global.sh
```

무엇이 어디로 가는지:

| 옮기는 것 | 도착지 |
|---|---|
| k-skill 15개 + `send-to-me` | `~/.claude/skills/` |
| `/보내기` 명령 | `~/.claude/commands/` |
| 전송 스크립트 4개 | `~/.claude/scripts/notify/` |
| `.env` (토큰) | `~/.claude/.env` — 저장소에서는 빠집니다 |
| 카카오 토큰 캐시 | `~/.claude/channels/` |

또봄 전용 명령어(`/보도모니터링` · `/카피검수` · `/지원사업점검`)는 이 저장소의 HTML·문서를
직접 건드리므로 옮기지 않습니다. 저장소 안의 사본도 그대로 남습니다 — Claude Code 웹과
Slack 세션은 저장소 사본을 쓰기 때문입니다. 같은 이름이 양쪽에 있으면 **프로젝트 쪽이 이깁니다.**

전역에서 부를 때는 경로를 붙입니다 (설치 스크립트가 알아서 바꿔 넣습니다).

```bash
python3 ~/.claude/scripts/notify/send_telegram.py "메시지"
```

`.env` 는 이 순서로 찾습니다. 앞의 것이 이깁니다.

1. `NOTIFY_ENV_FILE` 환경변수로 지정한 파일
2. 지금 작업 중인 폴더의 `.env` — 프로젝트마다 다른 봇을 쓰고 싶을 때
3. `~/.claude/.env` — 전역 기본값

스킬을 고치거나 `sync-k-skills.sh` 로 갱신한 뒤에는 `install-global.sh` 를 다시 돌리세요.

### 안 될 때

| 증상 | 원인 / 조치 |
|---|---|
| `KOE320` / 인가 코드 오류 | 코드는 1회용입니다. `kakao_auth.py` 를 다시 실행하세요 |
| `KOE006` | Redirect URI 불일치 — 콘솔 등록값과 `.env` 값을 맞추세요 |
| 카카오 401 지속 | 리프레시 토큰 만료 — `kakao_auth.py` 재실행 |
| `insufficient scope` | 동의항목에서 `talk_message` 사용 설정 후 재인증 |
| 텔레그램 `chat not found` | 봇에게 먼저 DM 을 보낸 적이 있어야 합니다 |
| `--find-chat-id` 가 비어 있음 | `getUpdates` 는 최근 24시간만 봅니다. 다시 DM 후 재실행 |

---

## 8. 표면별로 정리하면

| 표면 | 방식 | k-skill 15개 | 슬래시 명령어 | 준비물 |
|---|---|---|---|---|
| 로컬 터미널 | Claude Code | ✅ | ✅ | 없음 |
| Claude Code 웹/클라우드 | 저장소 클론 | ✅ | ✅ | GitHub 푸시 |
| **Slack** (`@Claude`) | 클라우드 세션 | ✅ | ✅ | Slack 앱 설치 + GitHub 푸시 |
| **Slack** (읽기/쓰기) | MCP | — | 연동 대상 | `/mcp` 인증 |
| **Notion** | MCP | — | 연동 대상 | `/mcp` 인증 + DB 생성 |
| **Discord** | 채널 플러그인 | ✅ | ✅ | Bun + 봇 토큰 + 페어링 |
| **카카오톡** (내게 보내기) | 메모 API 스크립트 | — | `/보내기` | 카카오 앱 + 1회 인증 |
| **텔레그램** (내게 보내기) | 봇 API 스크립트 | — | `/보내기` | 봇 토큰 + chat_id |
| **텔레그램** (양방향) | 채널 플러그인 | ✅ | ✅ | Bun + 봇 토큰 + 페어링 |
| **다른 업무 폴더** | 전역 설치 (`~/.claude/`) | ✅ | `/보내기` | `bash scripts/install-global.sh` |

**핵심은 커밋입니다.** `.claude/` 가 저장소에 들어가 있어야 웹·Slack 세션이 스킬을 봅니다.
Discord는 로컬 세션을 그대로 쓰므로 자동으로 따라옵니다.
