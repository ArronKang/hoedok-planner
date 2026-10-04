# CLAUDE.md — 회독 플래너 (study-planner)

이 파일은 이 저장소에서 일하는 Claude가 **처음부터 끝까지 알아야 할 모든 것**을 적은 안내서다.
대화가 새로 시작되어도 이 파일만 읽으면 이어서 일할 수 있어야 한다. 바뀐 것이 생기면 **이 파일도 함께 고친다**.
마지막 정리: 2026-10-04 (베타 2.0 — 미리 보기에 올림, 실제 앱은 베타 1.1).

---

## 0. 한눈에

| 항목 | 내용 |
|---|---|
| 앱 | **회독 플래너** — 공부할 양을 날짜별로 나눠 주고, 체크하면 진도 칸이 저절로 채워지는 공부 플래너 |
| 형태 | 빌드 도구·외부 라이브러리 **없는** 설치형 웹앱(PWA). 손으로 만든 가상 DOM + 훅(`src/lib/ui.js`)과 htm 비슷한 `html` 템플릿(`src/lib/html.js`) |
| 사용자 | 한국 고등학생 1명(본인). 2022 개정 교육과정(내신 5등급). 컴퓨터·AI 진로. 한국어로 대화 |
| 기기 | **갤럭시 탭 S7 FE**(삼성 인터넷, 태블릿 화면) + **아이폰 17 Pro**(Safari, 홈 화면 앱). 개발 PC는 Windows 11 |
| 저장 | 기기 안 IndexedDB(로컬 우선) + 로그인하면 **Supabase**로 두 기기 동기화 |
| 배포 | GitHub `ArronKang/hoedok-planner` → GitHub Pages. 실제 앱 https://arronkang.github.io/hoedok-planner/ · 미리 보기 https://arronkang.github.io/hoedok-planner/preview/ |
| 지금 버전 | **베타 2.0** (`src/app/settings.js`의 `APP_VERSION`), 브랜치 `beta`, **미리 보기에만 올림**. 실제 앱(main)은 베타 1.1 (a42c0a7) |
| 다음에 할 일 | 사용자가 미리 보기(베타 2.0)를 기기에서 써 보고 **"올려 줘"** 하면 `beta`를 main에 합친다 (§9-3). 새 화면은 **[디자인-규칙](docs/디자인-규칙.md)·[움직임-규칙](docs/움직임-규칙.md)**을 따른다 |

---

## 1. 반드시 지킬 규칙 (사용자가 정한 것 — 어기지 말 것)

### 1-1. 일하는 순서
1. **계획짜기 → 검토 → 추가 → 검토 → 최종 검토 → 실행.** 큰 작업은 이 단계를 `docs/개발-계획.md`에 차수(1차, 2차 … 5차)로 적고 시작한다.
   - 검토 기준: `docs/설계-원칙.md` + "처음 쓰는 사람이 설명 없이 알아들을까?"
2. **누구나 쓰기 쉬운 앱.** "개발자만 알고 편하게 쓰는 앱이 아니라 모두가 쉽고 편하게 쓸 수 있는 앱."
3. **알맹이(베타부터).** 겉만 화려한 것이 아니라, 보이는 글자·칸·숫자 하나하나에 "왜 거기 있는지"가 있어야 한다. 사람 개발자처럼 만들고 → 브라우저로 다시 보고 → 이상하면 고치고 → 다시 본다. 기능을 늘리기보다 이미 있는 것이 정확하게 맞게.
   - 보이는 값 = 저장된 값. **말없이 무시하지 않기**(고쳤으면 한 줄로 알려 주기). 적어 둔 진도를 함부로 지우지 않기.
   - 기기 기본 동작(스크롤, 창 끌기, 탭 다시 누르기)은 흉내 내지 말고 그대로 쓰기.
4. **수정본은 언제나 미리 보기로 먼저 올린다.** `python tools/preview.py "무엇을 바꿨나" --push` → 미리 보기 주소 확인 → 링크와 함께 보고. 이것은 사용자가 준 **상시 허락**이다(main의 `preview/` 폴더만 바뀜).
5. **실제 앱(main 맨 위 파일)은 사용자가 "올려 줘"라고 할 때만** 바꾼다. 브랜치를 main에 합치는 것 = 공개 변경.
6. 버그를 보고받으면(녹화 영상 등) **장면마다 나눠 보고**(§11-5) 원인을 찾아 고친다. 기능 문제가 아니라 테스트 기준이 틀린 것이면 그렇게 말한다.

### 1-2. 앱의 고정 원칙 (인수인계 문서 + 설계 원칙)
- 플래너가 중심. **예측·추천 문구 금지**("끝난다/못 끝낸다" 같은 말 없음). 진도는 **사실 수치만** 보여 준다.
- **게임 요소 금지**: 연속 기록(스트릭), 배지, 점수 없음.
- **석차등급은 사용자가 적는다.** 앱이 계산하지 않는다.
- **열품타 연동은 짐작하지 않는다** — 필요하면 사용자에게 묻는다.
- 입력은 최소로: 한 번 누르기·밀기, 지우거나 옮긴 뒤에는 **되돌리기**.
- 겉은 단순하게, 들어갈수록 깊게(GoodNotes처럼). 꾸미기는 **미리 설계한 선택지**에서만 → 무엇을 골라도 예쁘게. "AI가 만든 것 같은" 남색 다크 UI 피하기. 개발자만 아는 말 피하기.
- 움직임은 알려 주려고만, 부드럽게, 끌 수 있게. **종류는 넷뿐**(창·다음으로·나타남·손에 붙는 것), 시간·곡선은 정해진 값만, 속도 설정 없음(켜기/끄기) — [docs/움직임-규칙.md](docs/움직임-규칙.md). 새 움직임은 `docs/움직임-버그-체크리스트.md`를 통과해야 한다.
- **디자인 규칙**([docs/디자인-규칙.md](docs/디자인-규칙.md)): 간격 4의 배수, 글자 4단계(굵기·진하기로 위계), 강조 색 하나, 단추 3종(주 하나·보조·글자), 누르는 칸 44px+, 단추 글자는 동사 2~6글자, 반투명 두 겹 글자 금지. "끊기고 세련되지 않을 거면 아예 하지 마"(사용자).

### 1-3. 개인정보·보안
- **사용자의 실제 성적은 저장소에 절대 넣지 않는다.** (실제 통합사회 점수 등 → 예시는 가짜 값 92.4/89.7/90.63 등으로)
- 개인 정보는 조심. 사용자의 개인 이메일은 신원 확인용일 뿐, 저장소·다른 서비스에 넣지 않는다 (**이 저장소는 공개**라서 이 파일에도 적지 않는다).
- git 커밋 작성자는 **`ArronKang` / `ArronKang@users.noreply.github.com`** (개인 이메일 금지). 저장소 git config에 이미 설정됨.
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (시스템이 지정한 줄을 따른다).
- **실제 비밀번호·자격 증명을 대신 입력하지 않는다. 계정을 대신 만들지 않는다.** localhost의 가짜 서버(`tools/fake_supabase.py`) 시험 계정만 예외.
- Supabase **secret / service_role 키와 비밀번호는 받지도, 쓰지도, 보내지도 않는다.** 앱에는 공개해도 되는 **Project URL + publishable 키**만 들어간다(`src/config.js`).
- 파일 내려받기는 동의를 받고. 새 도구 설치(툴체인)는 묻고 나서.

### 1-4. 사용자와 말하는 법
- **한국어로**, 단계별로, 표·목록 위주로. 방향이 정해지면 군더더기 없이 바로.
- 오래 작업할 때는 중간중간 "지금 무엇을 하는지" 짧게 알린다.
- 기술 용어는 쉬운 말로 (예: column-reverse → "창을 거꾸로 쌓는 방식").
- 보고 끝에는 기기에서 확인할 것과 다음 행동("올려 줘")을 적는다.

---

## 2. 개발 환경 (Windows 특이점 포함)

| 항목 | 내용 |
|---|---|
| OS·셸 | Windows 11, PowerShell 5.1 (`&&` 안 됨 → `;` 또는 `if ($?)`). Bash(Git Bash) 도구도 있음 |
| 작업 폴더 | `C:\Users\PC\OneDrive\바탕 화면\claud\study-planner` (상위 `claud\.claude\launch.json`에 개발 서버 설정) |
| Node | **설치 안 됨.** 테스트는 VS Code의 Electron을 Node처럼 실행: `powershell -ExecutionPolicy Bypass -File tools/node.ps1 tests/run-node.js` (Bash에서 직접 부르면 실행 정책 오류 → PowerShell로, 또는 `powershell.exe -ExecutionPolicy Bypass -File …`) |
| Python | 3.11 (+ OpenCV `cv2` 있음 → 영상 장면 뽑기에 씀) |
| git | Git for Windows + GCM. 푸시 전에 `$env:GIT_TERMINAL_PROMPT='1'; $env:GCM_INTERACTIVE='always'` (자격 증명은 캐시됨) |
| 콘솔 글자 | cp949. Python에서 한글·특수 글자 출력 시 오류 → `PYTHONIOENCODING=utf-8` 또는 파일로. `tools/preview.py`는 스스로 처리함 |
| 큰 텍스트 넣기 | Bash 도구는 긴 heredoc(약 85줄 이상)을 자른다 → 큰 코드는 **Write 도구로 스크래치 파일에 쓰고 python으로 끼워 넣기** |
| 줄바꿈(CRLF) | `src/app/*.js` 대부분이 CRLF. python으로 고칠 때 `open(p, encoding="utf-8", newline="")`로 **읽고 쓰기 둘 다** — 안 그러면 파일 전체가 LF로 바뀌어 diff가 통째로 바뀐다(베타 1.2에서 두 번 겪음). 고친 뒤 `git diff --stat`으로 줄 수 확인 |
| PowerShell 커밋 메시지 | here-string을 `-F -`로 넘기면 안 됨 → 메시지를 파일로 쓰고 `git commit -F 파일` |

### 2-1. 자주 쓰는 명령
```
python serve.py                        # http://localhost:5173 (개발 서버, 서비스 워커는 localhost에서 꺼짐)
python serve.py 5173 --lan             # 같은 와이파이 기기에서 접속
powershell -ExecutionPolicy Bypass -File tools/node.ps1 tests/run-node.js        # 노드 테스트 전부
powershell -ExecutionPolicy Bypass -File tools/node.ps1 tests/run-node.js 단위   # 이름 필터
python tools/bump_sw.py                # 앱 파일을 고친 뒤 반드시 (sw.js VERSION 갱신, 테스트가 확인)
python tools/preview.py "설명" --push  # 미리 보기 올리기 (main의 preview/ 폴더만)
python tools/preview.py "시험" --local # PC에서만 ./preview/ 만들기 (git 제외)
python tools/fake_supabase.py 54321 --dump --no-signup   # 동기화 시험용 가짜 서버
python tools/make_icons.py             # 아이콘 PNG 다시 만들기
```
- 브라우저 확인은 Claude 내장 브라우저: `preview_start {name: "planner"}` (설정은 상위 폴더 `.claude/launch.json`의 `planner`, `fake-supabase`).

---

## 3. 폴더와 파일

| 위치 | 내용 |
|---|---|
| `index.html` | 앱 입구. 첫 색 칠하기 스크립트(지난 배경색·시작 화면 색·움직임 단계), **시작 화면(#splash) 마크업**, `src/app/main.js` 모듈 |
| `manifest.webmanifest` / `manifest-preview.webmanifest` | 설치 정보 (실제 = 초록 아이콘 '회독 플래너', 미리 보기 = 주황 아이콘 '미리 보기') |
| `sw.js` | 서비스 워커. `FILES` 미리 받기 목록 + `VERSION`(파일 내용 해시, `bump_sw.py`). 글꼴 호스트는 처음 쓸 때 저장 |
| `preview-sw.js` | 미리 보기 폴더 전용 서비스 워커(아무것도 저장 안 함, 실제 앱 SW가 미리 보기를 가로채지 않게) |
| `styles/app.css` | 모든 화면 모양 (한 파일, 약 1,000줄+). 뒤쪽에 차수별 덧붙임 묶음(3차·4차·베타 1.0·베타 1.1·베타 1.2) — 같은 선택자를 나중 묶음이 덮어쓴다 |
| `icons/start-*.png` | 아이폰 홈 화면 앱 **시작 이미지**(종이색 한 장, 아이폰 15·16·17·Air·Pro Max). 없으면 흰 화면이 먼저 보였다. `python tools/make_icons.py --startup`이 만들고 index.html에 넣을 태그를 찍어 준다 |
| `src/app/` | 화면과 동작 (§4) |
| `docs/디자인-규칙.md`, `docs/움직임-규칙.md` | 베타 2.0부터 모든 화면이 따르는 규칙 (읽은 글과 출처 포함) |
| `src/lib/ui.js`, `html.js` | 가상 DOM·훅 런타임 / html 템플릿 태그 |
| `src/core/` | `date.js`(날짜·논리적 오늘), `num.js`, `id.js`, `calc/naesin.js`(내신 계산) |
| `src/data/` | `db.js`(메모리 + IndexedDB, 동기화 대기열·톰스톤), `idb.js`, `attachments.js`(사진) |
| `src/sync/` | `sync.js`(엔진), `supabase.js`(fetch로 REST·인증), `state.js`, `settings.js`, `secure-store.js` |
| `src/config.js` | Supabase **Project URL·publishable 키**(공개 값, 커밋해도 됨) |
| `src/env.js` | 미리 보기 판별(`PREVIEW`), 저장 이름 접두어 `ns()`(`preview.`), 서버 기록 공간 `SPACE`(`preview:`) |
| `supabase/schema.sql` | 서버 SQL (records 표 + RLS + `sync_push` RPC + 사진 버킷). 여러 번 실행해도 됨 |
| `tests/` | 노드·브라우저 테스트, 화면 전수 점검, 움직임 점검 (§8) |
| `tools/` | `bump_sw.py`, `preview.py`, `fake_supabase.py`, `make_icons.py`, `node.ps1` |
| `docs/` | 문서 (§10) |
| `docs/mockups/` | 프로토타입 v3(원본, **읽기 전용·고치지 않음**), v4, v5, `prototype.html` 목록 |
| `archive/v1-ui/` | 옛 화면 (안 씀) |
| `preview/` | `preview.py --local`이 만드는 PC 시험용 (git 제외). 실제 미리 보기는 main 브랜치의 `preview/` 폴더 |

---

## 4. 앱 구조 (`src/app/`)

| 파일 | 하는 일 |
|---|---|
| `main.js` | 앱 틀. 휴대폰(한 화면) / 태블릿·PC(두 칸) — **둘 다 같은 유리 막대 `Dock`**(아래 가운데, `useTabSlide`: 누르면 방울이 떠오르고 밀면 따라옴). 창(시트) 목록 `SHEETS`, 사라지는 움직임(`useExits`), 뒤로 가기(`initBack`), 시작(`boot`), 시작 화면 걷기(`hideSplash`), 주소창 색(`syncChrome`), 첫 동기화 알림 |
| `core.js` | **상태·계산·동작 전부** (DOM·저장소 없이 돌아감 → 테스트 대상). 단위, 진도 %, 나누기(`planSubject`), 체크·일부만, 반복, 시험 정리, 예시 자료(`loadDemo`) |
| `store.js` | core의 한 덩어리 자료 ↔ IndexedDB 레코드. 바뀐 레코드만 저장, 다른 기기 변경 반영(`onDb` → `reconcile`) |
| `kit.js` | 공통 조각: `Icon`, `Check`, `StageBar`(진도 막대), `Seg`, `Switch`, `Stepper`, **`NumField`·`RangeField`·`DateField`**, **`Sheet`**, `Swipe`, `Toast`, `useCross`, `glassBar`, `buzz` |
| `motion.js` | 움직임: 속도 단계, `play`, 사라지는 복사본(`capture`/`release`, 클래스 `m-ghost`), 창 열고 닫기, **겹쳐 바뀜**(`crossfade`, `.m-view`), `skipExit` |
| `today.js` | 오늘 화면, 할 일 줄, 요약, 알림 줄, 할 일 창(일부만·더 보기), 할 일 추가(당겨 오기), 하루 마감, 달력, 돌아보기, 나눠 주기 |
| `progress.js` | 진도 목록, 과목 화면, 칸 격자(`CellGrid`), 단계 적기(`RecordSheet`), 교재 편집(`BookEditor`·`UnitPick`), 단원 이름(`LabelsSheet`), 교재 넣기·고치기·순서·색 |
| `grades.js` | 성적: 시험 목록, 시험 리포트(공부한 것 ↔ 결과), 학기 성적, 과목 내신 계산, 모의고사, 틀린 이유, 내신 흐름 |
| `cycle.js` | 시험이 끝난 뒤 흐름: 결과 적기 → 다음 시험 → 범위 → 시작 |
| `settings.js` | 설정(애플 설정처럼), 백업, 정보. `APP_VERSION`·`APP_DATE` |
| `account.js` | 계정·동기화 화면 (앱에 서버가 들어 있으면 이메일·비밀번호·로그인만) |
| `onboarding.js` | 처음 설정(베타 2.0): 환영(Hero 그림) → 로그인(`AccountPage ob`) → 시험(카드) → 학년·학기 → 과목과 교과서(출판사·범위) → 시작. 단계 넘김은 가로 페이드 |
| `curriculum.js` | 학년별 과목(2022 개정: 고1 공통과목 …1/…2, 고2·3 일반선택), 고1 출판사 목록·**확인한 목차만** 단원 이름(출처 `src`), 없으면 교육과정 큰 단원·'1단원…'. `recommend`, `publishers`, `units`, `scopeGuess`(중간=앞 절반·기말=뒤 절반), `makeSubject`(교과서=단원 칸 교재) |
| `glass.js` | 크롬 계열(윈도우·삼성 인터넷)에서 유리 막대·방울이 뒤를 굴절하는 SVG 필터(`fitGlass`, 크기 바뀌면 다시). 사파리는 CSS만 |
| `fonts.js` | 한글 글꼴 8개 (프리텐다드·기기 글꼴·본고딕·나눔고딕·고운돋움·함렛·고운바탕·개구), Google Fonts에서 필요할 때만 |
| `pwa.js` | 서비스 워커 등록·새 버전 알림, 홈 화면에 추가, `platform()`(ios/samsung/android/desktop), 저장 공간 지키기 |
| `photos.js` | 할 일 사진 (이 기기에만, 동기화 시 첨부) |

### 4-1. 화면 층 (점진적 공개)
| 층 | 휴대폰 | 태블릿 |
|---|---|---|
| 0 (겉) | 오늘 · 진도 · 성적 탭 + 설정 단추 | 왼쪽 막대 + 오늘 옆에 진도(또는 달력) |
| 1 | 할 일 자세히, 과목 진도(막대·숫자 4개·단계·칸 격자), 시험 결과 | 목록 + 자세히 두 칸 |
| 2 | 할 일 더 보기(메모·시각·마감·반복·사진), 기록 더 보기(최근 2주·구간·앞으로), 교재와 단계 고치기, 단원 이름, 내신 계산 | 같음 |
| 3 (설정) | 계정 카드 → 화면 및 밝기 · 글자 · 탭 막대와 배치 · 움직임 → 오늘 화면 · 진도 화면 · 달력과 시각 → 공부(시험·과목·공부 가능 시간) → 홈 화면에 추가 · 기록 관리 · 정보 | 탭 막대 대신 태블릿 화면 나누기 |
- 겉에 새로 뜨는 것은 **그 상황일 때만 한 줄**(알림 줄 묶음 한 장): 시험 날, 다음 시험 미정, 다가오는 마감, 지난 날 못 끝낸 일, 예시 보는 중, 홈 화면에 추가(브라우저일 때, 닫으면 다시 안 뜸), 설정 단추의 점(로그인 풀림·12시간 넘게 못 맞춤).

### 4-2. 화면 엔진(`src/lib/ui.js`) 알아둘 점
- 상태 변경은 **마이크로태스크**에서 모아 다시 그림 → blur 다음 click 사이에 이미 다시 그려진다.
- 이벤트는 프록시로 최신 함수를 부름. `onFocus`·`onBlur`·`onScroll` 등 직접 붙음. **passive 지정 불가** → 스크롤을 막으면 안 되는 터치 리스너는 `useEffect`에서 직접 `addEventListener(…, { passive: true })`.
- `value`·`checked`는 자식(옵션) 뒤에 설정 → `<select value=…>` 동작함. `defaultValue`는 처음 한 번만.
- 컴포넌트가 배열을 반환하면 `display:contents` div로 감쌈.

---

## 5. 자료 모델 (`core.js`)

### 5-1. 상태 `store`
```
{ v, data: { onboarded, demo, exam, lastExam, school{grade, sem, pubs{과목: 출판사 id}}, subjects[], tasks[], pastExams[], semesters[], repeats[] },
  prefs: { …화면 설정(기기마다) + 공부 설정(기기끼리 공유) },
  ui: { tab, day, stacks{today,progress,grades}, sheet, ob, open{}, toast, dev('phone'|'pad'), lastSub } }
```
- `DEVICE_PREFS`(이 기기 localStorage에만): theme, mode, size, font, density, hand, group, doneBottom, show, legend, lowest, recent, padAside, listWidth, motion, motionView, **accent, bold, tabStyle, tabLabels, startTab, lastTab, weekStart, clock, ddayStyle, pctStyle, rowEst, doneMode, haptic**.
- `STUDY_PREFS`(meta 레코드로 동기화): avail(요일별 공부 가능 분), rest(쉬는 요일), dayStart(하루가 바뀌는 시각 0/2/4/6), pace(쪽당 분), dayMin(날짜별 바꾼 시간).
- **`LOOK_PREFS`**(베타 2.0, meta 레코드의 `look`으로 계정 동기화): theme, mode, size, font, bold, motion, group, doneMode, show… — 태블릿 칸 배치·마지막 탭은 빼서 기기마다. `migratePrefs`: 예전 테마(paper→warm, crisp→ink, soft→base, 강조 색→가까운 테마)·속도(slow/fast→normal)·글꼴(→pretendard)을 읽을 때 바꿈. meta에는 `school`도.
- `commit()` = 자료가 바뀌었다고 알림(v+1) → store.js가 저장. `withUndo(msg, fn)` = 바꾸기 전 통째 스냅샷 + 되돌리기 알림.
- 오늘 = `logicalToday(dayStart)` (새벽 4시 전이면 어제).

### 5-2. 과목·교재·단계
```
subject = { id, name, h(색상 hue), books[], stages[], routine('mine'|'each'|'twice'), log{날짜:개수}, logk{날짜:{단위:개수}}, pace?(예전), unit?('passage' 예전) }
book    = { id, name, kind('개념'|'문제'), unit('page'|'psg'|'q'|'lec'|'set'|'ch'), from, to, labels?[], pace? }
stage   = { id, name('1회독 · 자습서'), bookId, from, to, upto(쪽: 어디까지 | null), marks?[](칸: 채운 번호) }
```
- **단위는 교재마다** (`UNITS`): 쪽(page, 어디까지) · 지문(psg) · 문제(q) · 강(lec) · 회(set) · 단원(ch, 이름 붙이기 가능). 쪽만 `upto`, 나머지는 `marks`(칸).
- 단원 이름: `book.labels` — 번호 u는 늘 from…to 정수, 이름은 `labels[u-1]`. 단원으로 바꾸면 from=1, to=개수.
- **예전 기록 해석**: 교재에 `unit`이 없으면 과목의 `sub.unit === 'passage'` → 지문, 아니면 쪽. 기록을 고쳐 쓰지 않고 읽을 때 해석(`bookUnit`). `buildStages(books, routine, legacyPsg)`.
- 주요 함수: `bookUnit`, `isCell`, `stageUnit`, `unitsUsed`, `soleUnit`, `itemName`/`itemShort`, `rangeText`(할 일 범위: p.3–10 / 지문 4, 7 / 3–5강 / 1-1 ~ 1-3), `spanText`(단계 범위), `amountText`(12쪽 / 단원 3개), `unitShort`, `tally`/`tallyText`(단위마다 합 "120쪽 · 14지문"), `totU`/`dnU`, `taskTally`.
- 교재 편집: `setBookRange`(**단계 범위도 함께**, 한 진도는 범위 안이면 남김), `setBookUnit`(쪽↔칸 진도 옮김, 단원 아니면 labels 삭제, pace 초기화), `setBookLabels`(채운 칸을 **이름으로** 따라감), `setStageRange`, `fitRange`(시작>끝이면 같은 길이만큼 함께 옮김), `genLabels(start,big,small)`, `parseLabels`('1-1~1-4, L1~L3' 펼침), `labelsText`(되돌리기), `labelsShape`, `newBook(name, unit)`(이름으로 단위 짐작: 인강→강 등), `presetBook`(영어 교과서=단원 1-1…2-3, 변형문제=지문), `bookFor`, `suggestBooks(과목)`(과목에 맞는 교재 제안 — 국어에 쎈 권하지 않음), `PACE_OPTS`.
- **진도 %** (`pct`, `overall`): 단위가 하나면 개수 비율, **섞이면 걸리는 시간(`paceOfBook`)으로 무게**. `facts`: 단위 하나면 그 단위, 섞이면 남은 분량은 단위마다·하루 몫은 분.
- `paceOfBook`: 교재 pace → (예전) 과목 pace(같은 단위일 때) → 단위 기본값(쪽은 설정 pace=3, 지문 10, 문제 3, 강 40, 회 60, 단원 30).
- 가장 적게 본 곳: 기준 교재(첫 개념책)가 칸 교재면 칸 이름, 쪽이면 5구간(`PARTS`).

### 5-3. 할 일
```
task(진도) = { id, kind:'track', subjectId, stageId, from, to, units?[](건너뛴 번호), date, status('todo'|'done'|'dropped'), moves[{from,to,reason}], examId, manual?, hist?(지난 시험), closed?, prevUpto/prevMarks, doneDay, est?, actual?, pri?, at?, due?, memo?, photos? }
task(자유) = { id, kind:'free', title, … reps?/repDone?, rep?(규칙 id), repDay?, gen? }
repeat     = { id, subjectId, title, days[요일], start, skip[], est?, pri?, at?, reps? }
```
- **나누기** `planSubject`: 오늘~시험 전날(끝낼 날은 그날)까지, 그날 남는 시간(공부 가능 − 직접 넣은 일·반복) 비율로. **칸마다 시간 무게**(`paceOfBook`): 무게가 모두 같으면 예전과 똑같이 개수로(`Math.round(n*acc/W)`), 다르면 누적 시간이 목표에 가장 가까운 곳까지. 단계 경계의 3칸 미만 자투리는 다음 날로. 직접 넣은 일·끝낸 일·지난 시험 기록은 안 건드림.
- `toggleTask`(체크 → 단계 upto/marks 올림, 진도 % 알림), `partialTask(id, upto, rest, picked)`(**칸 교재는 picked 번호 목록**), `moveTask`, `dropTask`, `recordStage`, `toggleCell`(범위가 다 채워진 할 일 자동 체크), `parseLink`(글에서 진도 찾기: 교재 이름·단위 말·단원 이름 우선; 단독 숫자 '3강'은 교재 이름이 있을 때만), `reconcile`(다른 기기에서 끝낸 할 일 → 진도 칸 채우기).
- 반복: 2주 앞까지만 만들어 둠. id = `규칙id.날짜`(두 기기가 따로 만들어도 하나), 저절로 만든 것은 처음 저장 시 약한 시각(updatedAt=1) → 다른 기기 편집이 이김. 반복은 밀리지 않음(못 끝낸 일 알림에서 빠짐).
- 시험: `exam = { id, name, kind('mid'|'final'|'mock'|'goal'), date, start }`. `closeExam`(기록을 시험에 고정, 점수→성적, 남은 진도 할 일 치움), `nextGuess`, `shiftScopes`(쪽·문제·강·회는 다음 범위, 지문은 1번부터, 단원은 큰 번호 넘김), `startNext`.
- 성적: `semesters[{id:'2026-1', label, records[{subject, credits, category, elements[{kind:'exam'|'perf', name, weight, max, score, avg}], final{rankGrade, rank, enrolled, achievement, avg}}]}]`, `pastExams[{…study, snap, ranks, wrong, note, mock}]`.
- 예시 자료 `loadDemo()`: `data.demo = true`(동기화 멈춤), 고정 id `ex-now`, `ex-final1`(예전 예시 알아보기 `looksLikeDemo`). 영어는 교과서 본문(단원 1-1…2-4) + 부교재 지문(1–16).

### 5-4. 저장·동기화
- IndexedDB 표 7개: subjects, tasks, exams, semesters, meta, attachments, repeats (`db.js`, DB 이름 `ns('hoedok-planner')`, 버전 2). 쓰기는 마이크로태스크로 묶음 → outbox. 삭제는 톰스톤.
- 서버(Supabase): `records(user_id, tbl, id, data, deleted, client_updated_at, rev)` 한 표. **나중에 고친 쪽이 이김**(client_updated_at). `sync_push` RPC로 올리고 rev 커서로 받음(겹쳐 읽기 50). 45초마다 + 앱을 열 때. RLS로 본인 것만.
- 미리 보기는 같은 계정이어도 표 이름 앞에 **`preview:`** (실제 앱은 `tbl not like preview:*`만 받음). 사진은 `preview/` 폴더.
- 예시인 동안은 아무것도 올리거나 받지 않음. 예시 기기에서 로그인하면 "예시 지우고 로그인".
- 로그인하면 이 기기 기록을 모두 다시 올림(`requeueAll`). 다른 계정 기록이 있으면 지우고 로그인 확인. 처음 로그인 시 합치기/계정 기록만 쓰기를 물음.
- `needsAttention`: 로그인 풀림 또는 12시간 넘게 못 맞춤 → 설정 단추에 점.
- 서버 상태(2026-10-03 확인): 새 가입 막힘(`disable_signup: true`), 이메일 로그인 켜짐, 로그인 안 한 요청은 읽기 401·sync_push 42501. 계정은 사용자가 대시보드 Authentication › Users에서 직접 만든 1개. 실제 두 기기 동기화는 사용자가 확인할 차례.
- 점검 목록: `docs/동기화-체크리스트.md`(가짜 서버, 기기 A = localhost, 기기 B = 127.0.0.1, 시험하는 동안만 config.js에 가짜 값 — **커밋 금지**).

---

## 6. 화면·디자인 체계

### 6-1. 기기 틀
- **테마(베타 2.0)**: 모양은 하나, 색만 6가지 `data-theme` = base 기본 · warm 종이 · forest 숲 · ocean 바다 · lavender 라벤더 · ink 먹(각각 밝게·어둡게). 예전 paper/crisp/soft 규칙이 CSS에 남아 있지만 새 이름이라 걸리지 않음. 강조 색은 테마가 정함(`data-accent`는 늘 theme).
- `.device` 속성: `phone|pad`, `data-theme`, `data-mode`(light/dark), `data-size`(sm/md/lg/xl → --base 14/15/16.5/18px), `data-font`, `data-density`(compact/normal/relaxed), `data-hand`, `data-motion`, **`data-bar`(glass/classic)**, **`data-accent`**, **`data-bold`**.
- `detectDev`: 화면의 짧은 변 ≥ 600px → pad. 갤럭시 탭은 pad, 아이폰은 phone.
- 디자인 토큰: --bg, --surf, --sunk, --line, --ink(-2,-3), --accent(-soft), --on-accent, --flag, --r, --sat/--lit(과목 색 채도·밝기), --num(숫자 글꼴: 종이 Newsreader / 선명 JetBrains Mono / 부드러움 Space Grotesk).
- 과목 색은 **hue만 저장**(`HUES`), 채도·밝기는 디자인이 정함 → `.hue { --sc, --sc-soft, --sc-hl }`.
- 강조 색: 디자인 색 + 초록·청록·파랑·남색·보라·분홍·주황·먹색. 디자인마다 `--as`/`--al`(채도·밝기), 색마다 `--ah`/`--ao`. 흰 글자 대비를 위해 밝기 조정.
- 굵은 글씨: 본문 550, 굵은 글자 800, 숫자 650.

### 6-2. 아래 막대
- **(베타 2.1) 이 앱만의 막대**: 애플 유리 방울 흉내를 버림(사용자: 똑같이 못 만들 거면 너만의 색깔로). 단정한 반투명 판 + 고른 탭은 강조 색으로 채운 칸(`.lens` + 아래 채움 줄 `::after`), `motion.js slide`(용수철 가로 이동, 늘어남 조금). 굴절 필터(glass.js)·방울(.lens-glass) 없앰. ＋는 강조 색 둥근 네모, 위쪽 단추는 선 있는 둥근 네모.
- **(베타 2.0) 모든 기기에서 유리 막대 하나**(`glassBar()`는 늘 true, 기본 막대·탭 모양 설정 없앰). 태블릿·PC는 너비 520 이하로 아래 가운데. 아이폰 기본 글래스(`-apple-visual-effect`)는 애플 앱 전용이라 웹에서 못 씀 → 직접: 크롬 계열은 `glass.js` 굴절 필터, 사파리는 흐림·채도·위쪽 반사광(`::before`)·가는 테. 누르는 순간 방울이 떠올라 손가락 밑으로(`glide(...hold, to)`), 밀면 따라오고, 놓으면 용수철. 막대 움직임 시간은 늘 같다(끄기만 따름).
- (예전) 유리 — `prefs.tabStyle`: auto / glass / classic.
  - `.dock`(화면 위에 떠 있음, 아래 `max(10px, safe-area − 8px)`) 안에 `.tabbar.glass`(흰 유리 캡슐 62px) + `.dock-add`(흰 유리 원 ＋, 모든 탭에서 할 일 추가, 과목 화면이면 그 과목 골라 둠).
  - 쉴 때: 고른 탭 뒤 회색 알약 `.lens`. 탭을 바꾸는 동안만 `.lens-glass`(막대보다 큰 투명 유리 방울: 흰 테두리·그림자·가장자리 파랑/빨강 옅은 빛)가 떠올라 옮겨 가고 알약으로 내려앉음.
  - **용수철 움직임**(베타 1.2, `motion.js spring·lensFrames·glide`): 빠르게 출발해 부드럽게 멈추고 5% 안쪽으로 지나쳤다 돌아옴, 빠를수록 진행 방향으로 늘어남. 키프레임을 1/60초마다 계산해 넣고 easing은 linear. 알약도 같은 길로. 예전(베타 1.1)은 키프레임 4개라 같은 속도로 보였다 — 사용자: "속도가 일정해, 슬라이드 느낌이 없음".
  - **밀기**(`main.js useTabSlide`): 막대를 누른 채 옆으로 7px 넘게 밀면 방울이 손가락을 따라오고(`style.transform` 직접), 놓으면 가까운 탭(튕기면 90ms만큼 더)으로 `glide(..., lifted)`. 탭 셋 밖(설정 칸)은 고무줄. 놓은 직후 500ms 안의 click 한 번은 삼킨다. 세로 움직임이면 밀기 아님. `.tabbar.glass { touch-action: none }`.
  - 유리일 때 위쪽 `.ib`(…)·D-day·뒤로·창 닫기도 유리 원/캡슐. 본문 아래 여백은 막대만큼.
  - 브라우저가 유리를 못 그리면 불투명.
- **기본(classic)**: 화면 아래 붙음, 높이 ≈ 아이폰 기본(6px + 아이콘 28 + 글자 + safe-area). ＋(`.fab`)는 오늘 화면에서만, **막대 바로 위 16px**(예전엔 막대 높이를 두 번 더해 혼자 높이 떠 있었음). 왼손/오른손.
- 탭 이름 끄기(`tabLabels`), 지금 탭 다시 누르면 처음 화면 → 이미 처음이면 맨 위로(`tapTab`).
- 태블릿: 왼쪽 막대(`.side`).

### 6-3. 창(시트) — `kit.js Sheet`
- **휴대폰 + 손가락(`pointer: coarse`)**: 창을 **기기 스크롤**로 움직임. `.sheet-sc`(스크롤 상자, **column-reverse** — 처음부터 맨 아래=열린 자리, 위치를 옮기는 코드 없음) 안에 `.sheet` + `.sheet-gap`(높이 = 화면 높이 px로 지정, 누르면 닫힘). scroll-snap으로 열림/닫힘 자리. 끝까지 끌어내리면(끌어낸 정도 ≥ 0.995) `M.skipExit()` + 닫기(복사본 없이). 배경 어둡기는 끈 만큼. 창 안 내용이 맨 위일 때 아래로 끌면 창이 함께 내려감(`overscroll-behavior-y: auto`).
  - 거꾸로 쌓은 상자는 위로 갈수록 scrollTop이 **음수**.
  - 예전 방식(scrollTop을 열자마자 맨 아래로)은 아이폰이 한 박자 늦게 그려 **창이 위쪽에 튀어 보였다** → 베타 1.1에서 column-reverse로 고침.
  - 예전 `.sheet.tall { top: 14px }` 규칙이 새 창에도 걸려 14px 밀렸던 것 → `.sheet-sc .sheet { top: auto }`로 끔.
- 태블릿·PC: 가운데 창. 휴대폰 크기 PC 창(마우스)은 손잡이 줄 끌기.
- 열림: 휴대폰은 아래에서 끝까지 올라옴(`EASE_SHEET`, 400ms), 태블릿은 살짝 커지며. 닫힘: 복사본이 아래로 내려감.
  - **기기 스크롤 창은 `.sheet-sc`(스크롤 상자)째 창 높이(px)만큼 움직인다** (`motion.js rise`, 닫힘은 `sheetOut`의 `g.h`). 안의 `.sheet`에 transform을 걸면 아이폰이 움직이는 동안 스크롤 범위를 다시 계산해서 창이 제자리를 지나 화면 위로 올라갔다가 끝나는 순간 뚝 떨어졌다(베타 1.1 영상, 베타 1.2에서 고침).
- 창을 위로 잡아당겨도 아래가 비지 않게 `.sheet-sc .sheet`의 box-shadow로 창 바탕을 아래로 이어 둠(베타 2.0).
- 창→창: 배경 그대로. 휴대폰은 앞 창 복사본이 **불투명한 채** 아래로 내려가고(z 32) 새 창이 그 뒤에서 올라옴. 태블릿은 앞 창이 120ms에 지워지고 새 창은 40% 지점부터 나타남. 반투명 두 겹 글자 금지(베타 1.1 영상).
- 창 종류 키 `sheetKey`: type + id/stage + pickFor + name + rec + book.

### 6-4. 움직임 (`motion.js`)
- **(베타 2.0) 켜기/끄기만**: `T`(시간)·`E`(곡선) 상수만 씀. 고른 적 없으면 기기 '동작 줄이기'. 화면이 안 보일 때는 움직이지 않음. **다음으로**(`axis`, `useCross(ref, key, dir, z)`): 옛 것 복사본(pin) 0.13초에 흐려지며 24px 반대쪽, 새 것은 30%까지 투명 후 24px에서 들어옴 — 처음 설정·설정 쪽(창 안쪽 칸 `.sheet-b` 자체를 움직임)·창 단계(`Sheet step`)·탭(방향=탭 순서, 같은 탭 안쪽으로 들어가면 1)·태블릿 오른쪽 칸(0).
- (예전) 단계: 느긋하게 ×1.45 / 보통 / 빠르게 ×0.6 / 끄기.
- 나타남 = 새로 생길 때 한 번(WAAPI). 사라짐 = **복사본(`m-ghost`)** 을 흐리게 지움(실제 화면은 바로 바뀌고 누를 수 있음). 이름 `ghost`는 `.btn.ghost`와 겹쳐서 쓰지 않음(4차 버그).
- `capture(el, pin)`: pin이면 원래 자리 rect로 고정. `release(g, parts, base, z, easing)`: 애니메이션이 멈춰도 `d+200ms` 뒤 반드시 지움.
- **겹쳐 바뀜**(`useCross`, Pad의 직접 처리): 탭·과목·날짜가 바뀌면 옛 화면 복사본(`.m-view`, z 4)이 흐려지는 동안 새 화면이 나타남 → 빈 순간(깜빡임) 없음. '화면을 옮길 때도 부드럽게'(motionView)를 따름.
- 설정 쪽 넘기기(`motion.js pageCapture·pagePush`, 아이폰 설정처럼): 옛 쪽을 복사해 창 안쪽 칸 크기의 상자(`.m-ghost.m-page`, `.sheet`에 붙임, overflow hidden)에 가둔다. 앞으로: 새 쪽이 z 2·불투명 배경(+옆 여백까지 덮는 그림자)으로 오른쪽에서 덮으며 들어오고, 옛 쪽은 z 1에서 왼쪽 30%로 밀림. 뒤로: 복사본 상자가 z 3·불투명으로 오른쪽으로 걷히고 앞 쪽이 왼쪽 30%에서 옴. 뒤로 가면 앞 쪽의 스크롤 자리를 기억해 둔 값으로(`mem`).
- 체크: 동그라미 채움 + 제목 형광펜. 막대 너비 transition(예외로 허용).
- **시작 화면**(베타 2.0): 설치 후 처음 한 번만 `sp-intro`(localStorage `hoedok.intro` 없을 때) — 할 일 카드 3줄이 체크될 때마다 진도 칸이 채워짐 → 이름 → 한 줄, 약 3.4초. 그다음부터 짧은 것 약 1.25초. 걷힐 때 `.splash.out`: 글자 먼저(0.14초) → 바탕(0.3초), 앱에 따로 움직임 없음.
- (예전 설명) **시작 화면**(`index.html #splash` + CSS + `hideSplash`): 진도 칸 4개 테두리 그리기 → 3개 차례로 채움 → '회독 플래너'가 왼쪽부터 써지듯(clip-path) → 약 1.3초 뒤 흐려지며 앱이 떠오름. 누르면 바로, 움직임 끄면 없음(`sp-still`), 속도는 `--sp-f`. 색은 지난번 `hoedok.bg/ink/ac`(localStorage, 미리 보기는 `preview.` 접두어). 그 앞의 아이폰 시작 이미지(`icons/start-*.png`)도 같은 종이색 → 흰 번쩍임 없음(이미 설치한 홈 화면 앱은 다시 추가해야 바뀔 수 있음).

### 6-5. 숫자·날짜 칸 (`NumField`·`RangeField`·`DateField`)
- 치는 동안은 **범위로 고치지 않음**. 칸을 떠나거나 완료를 누를 때 확인. 누르기만 하고 떠나면 아무것도 바꾸지 않음(`dirty`). 누르면 전체 선택. 칸을 보고 있지 않을 때만 실제 값으로 다시 맞춤.
- 범위 밖이면 가까운 값으로 맞추고 칸 아래 한 줄("60쪽까지라서 60쪽으로 맞췄어요", 조사는 `ro()`).
- `RangeField`: 시작 > 끝이면 끝이 같은 길이만큼 따라감(알림 한 줄).
- `DateField`: 고를 수 없는 날(min 전)이면 되돌리고 알림.
- 범위: 모의고사 등급 1–9, 백분위 0–100, 원점수 0–100(한국사·통합사회·통합과학 0–50), 시험 점수 0–100, 석차·수강자 1–2000, 받은 점수 0–만점, 반영 비율 0.5–100, 만점 1–1000.
- 새 숫자 입력을 만들 때는 **반드시 이 칸들을 쓴다** (raw `<input inputmode>` 금지).

### 6-6. 앱처럼
- 확대 끔: viewport `maximum-scale=1, user-scalable=no`, `touch-action: manipulation`, `gesturestart/gesturechange` preventDefault. 입력 칸 글자 ≥16px(아이폰 확대 방지).
- 단추·탭에는 글자 고르기·확대경 없음(`user-select: none; -webkit-touch-callout: none`), 입력 칸·메모는 그대로.
- 마우스 올림 모양은 `@media (hover: hover)` 안에만.
- 진동: 체크할 때 8ms (`navigator.vibrate`, 아이폰은 없음 → 설정에서 숨김).

### 6-7. 오늘·진도 화면의 결정들
- 오늘: 할 일은 한 장(과목은 제목줄로 구분), 알림 줄도 한 장(`.banners`). 휴대폰에는 목록 끝 점선 '할 일 추가' 없음(＋가 있으므로), 태블릿만.
- 할 일이 없을 때: 이유에 맞춰 다음 행동 하나 — 과목 넣기 / ○○ 교재 넣기 / 시험까지 나눠 주기 / 시험 정하기 + '할 일 직접 넣기'.
- 끝낸 일: 그 자리에 / 아래로 / 숨기기(맨 아래 '끝낸 일 N개 보기').
- 할 일 추가: 과목의 **다음 잡힌 진도 할 일을 그날로 당겨 오기**(겹치는 할 일을 새로 만들지 않음). 없으면 지금 단계에서 이어서. 적는 예시는 지금 단계 교재·단위로.
- 진도 목록: 교재를 넣은 과목만 카드, 안 넣은 과목은 아래 '교재를 아직 안 넣은 과목' 칩 한 줄. 위쪽 "전 과목 · 쪽 376/842 · 지문 10/32 · 단원 11/16".
- 진도 막대: **채움만**(한 만큼 과목 색, 안 한 곳은 옅은 같은 색). 밑줄·테두리 없음. 아래 이름은 '1회독'처럼 짧게(지금 단계 굵게).
- 과목 화면: 지금 단계 단추(쪽 = 몇 쪽까지 적기 / 칸 = 칸 채우기), 숫자 4개, 가장 적게 본 곳, 단계 목록, 칸 교재마다 격자(30칸 넘으면 앞 20칸 + 모두 보기), 기록 더 보기.
- 교재와 단계 고치기: 범위·단위가 바뀌면 "남은 날에 다시 나누기" 단추(자동으로 다시 나누지 않음 — 사용자가 옮겨 둔 것을 지키려고).

---

## 7. 설정 (`settings.js`) — 애플 설정처럼
| 쪽(key) | 내용 |
|---|---|
| 첫 화면 (베타 2.0) | (예시면) 예시 끝내고 시작하기 · 계정 카드 · **공부**[학년과 과목 · 시험 · 공부 시간 · 하루가 바뀌는 시각] · **화면**[테마 · 글자 크기 · 움직임(스위치)] · [홈 화면에 추가 · 기록 관리 · 정보]. 강조 색·글꼴·간격·탭 막대·D-day 모양·예상 시간·달력 첫 요일·시각 표시 UI는 뺌(기본값으로) |
| school 학년과 과목 | 학년·학기 Seg, 과목마다 교과서(출판사) select — 바꾸면 `setBookLabels`+`setBookRange`(되돌리기), 그 학년에 있는데 안 넣은 과목 칩, '과목 순서와 색'(subjects) |
| theme 테마 | 색 6 견본 + 밝기(기기 따라/밝게/어둡게) |
| text 글자 크기 · dayStart 하루가 바뀌는 시각 | |
| display 화면 및 밝기 | 견본(Sample) · 디자인 3 · 밝기(기기 따라/밝게/어둡게) · 강조 색 9 |
| text 글자 | 견본 · 글꼴(→ font) · 굵은 글씨 · 글자 크기('가' 크기로) · 간격 |
| layout 탭 막대와 배치 | 아래 탭 막대 모양(자동/유리/기본) · ＋ 위치(기본 막대일 때) · 탭 이름 · 앱을 열면(오늘/진도/성적/마지막 화면) · 태블릿: 오늘 옆에 보일 것 · 목록 너비 |
| motion 움직임 | 속도 4단계 · 화면을 옮길 때도 부드럽게 · 체크할 때 진동(되는 기기만) |
| todayView 오늘 화면 (`views` 별칭) | 보는 방법(과목별/마감순/시간순) · 끝낸 일 · D-day와 모양(D-11 / 11일 남음) · 요약 막대 · 할 일 줄에 예상 시간 · 알림 줄(못 끝낸 일·다가오는 마감) |
| progressView 진도 화면 | 과목 줄의 숫자(퍼센트/분량 — 단위 하나인 과목만) · 단계 이름 · 가장 적게 본 곳 · 최근 2주 |
| calTime 달력과 시각 | 달력 첫 요일(일/월) · 시각 표시(24시간/오전·오후, `clock()`) · 하루가 바뀌는 시각(공부 설정, 동기화) |
| time 공부 가능 시간 | 요일별 Stepper·쉬기 · 날짜마다 바꾼 시간 · 쪽당 기본 시간 |
| exam, subjects, account, data(내보내기·불러오기·모두 지우기), about(버전·쓰는 법·기록은 어디에) | |
- (베타 2.0) 화면 설정도 공부 설정도 로그인하면 기기끼리 맞춘다(LOOK_PREFS). 오늘·진도 화면 보기 설정은 각 화면의 … 메뉴 › 보기 설정.

---

## 8. 테스트·점검 (고친 뒤 반드시)

| 무엇 | 어떻게 | 기준(베타 2.0) |
|---|---|---|
| 노드 테스트 | `powershell -ExecutionPolicy Bypass -File tools/node.ps1 tests/run-node.js` | **102개 전부 통과** (curriculum.test.js 추가). 목록 `tests/list.js` (UNIT: html·calc·app / NODE: sw·motion·sync / DOM: ui) |
| 서비스 워커 | 위에 포함. 파일을 고쳤으면 먼저 `python tools/bump_sw.py` | VERSION이 내용과 맞음, FILES 목록과 실제 import가 일치 |
| 화면 전수 점검 | 앱을 연 브라우저에서 `const L = await import('/tests/layout-check.js'); await L.run({ sizes: ['md','xl'] })` (기본: 글꼴 프리텐다드, 테마 6) | 넘침·두 줄 꺾임·못 누르는 단추 **0** — 휴대폰 360px 648 · 태블릿 648 (처음 화면 6단계 포함). 휴대폰 360/390px(유리·기본), 태블릿 800×1280·1280×800 |
| 움직임 점검 | `(await import('/tests/motion-check.js')).runAll()` | 켜기·끄기 두 단계: 휴대폰 144·112, 태블릿 113·84 전부 통과 |
| 브라우저 테스트 | `tests/index.html` | |
| 동기화 | `docs/동기화-체크리스트.md` | |
- 화면 전수 점검 화면 목록: 오늘, 진도, 과목, 과목(칸), 칸 채우기, 쪽 적기, 교재 고치기, 단원 이름, 과목 추가 › 교재, 성적, 시험 결과, 설정 + 쪽마다(화면·글자·글꼴·탭 막대·움직임·오늘·진도·달력·공부 시간·기록 관리·정보·계정), 할 일, 할 일 › 더 보기, 할 일 추가, 다시 나누기, 돌아보기, 달력, 홈 화면에 추가. 아주 크게는 굵은 글씨 함께. 떠 있는 `.dock`·`.fab`·`.toast`가 덮는 것과 가장자리 2px에 걸친 것은 제외.
- 테스트가 **요일에 따라 달라지지 않게** 쓴다 (예: 나누기 균형은 그날 공부 시간 비례로 확인). 예전에 요일 때문에 실패한 적 있음.

### 8-1. 내장 브라우저(Claude Browser)로 확인할 때의 함정
- 창이 가려져 있으면 **rAF·스크롤 이벤트가 안 오고 애니메이션이 아주 느림** → 점검 도구는 '넘기기'(finish) 방식, 스크롤은 `dispatchEvent(new Event('scroll'))`로 직접. `ready` 같은 표시를 rAF에 의존하지 말 것.
- 오래 걸리는 점검은 `window.__lr = …`로 백그라운드 실행 후 나눠서 확인(도구 한 번 45초 제한).
- 창이 가려져 있으면(`document.hidden` true) **스크린샷이 예전 장면을 보여 주고**, 멈춰 둔(paused) WAAPI 애니메이션도 그려지지 않는다. 또 `M.on()`이 false라 움직임 자체가 안 돈다 → `Object.defineProperty(document, 'hidden', { get: () => false })`로 켜고, 중간 장면은 `a.pause(); a.currentTime = t` 뒤 `getBoundingClientRect`·`getComputedStyle`(zIndex·opacity·배경)로 **숫자로** 확인. 사라지는 복사본은 `release`의 안전 타이머(d+200ms)나 애니메이션 취소로 지워지므로 중간을 오래 보려면 그 동안 `setTimeout`을 늦춘다.
- 스크린샷은 **390×844 에뮬레이션**에서 가장 잘 나옴(375×812 등은 2배 잘림·네 칸 반복). 애니메이션 중간이 찍히면 움직임을 잠깐 끄고(`setPrefs({motion:'off'})`) 다시 찍는다. 끝나면 viewport를 desktop으로 되돌리고 테스트용 prefs(motion·mode·tabStyle)도 원래대로.
- 휴대폰 에뮬레이션은 `pointer: coarse` → 기기 스크롤 창 경로가 켜짐.
- 처음 설정 화면 단계(`ui.ob`)는 새로 고치면 0으로 돌아감.
- 개발 서버가 꺼져 있으면 `preview_start {name: "planner"}`.

---

## 9. 배포 절차

### 9-1. 브랜치
- `main` = 폰에서 쓰는 실제 앱(+ `preview/` 폴더). 새 작업은 브랜치에서: **`beta`** (main과 같은 지점에서 이어감).
- 지난 브랜치: `features-2`, `design-motion`(3차, main에 합침 18f907b), `real-use`(4차, beta를 거쳐 main에 합침).
- 예전 규칙: 프로토타입은 v3를 원본으로 두고 v4, v5… 복사본(저장 이름 `hoedok-proto-N`). 실제 앱이 공개된 뒤로는 브랜치가 복사본 역할.

### 9-2. 미리 보기 올리기 (상시 허락)
1. 작업 브랜치에 커밋 (`python tools/bump_sw.py` 먼저, 테스트 통과).
2. `$env:GIT_TERMINAL_PROMPT='1'; $env:GCM_INTERACTIVE='always'; python tools/preview.py "날짜·내용" --push` → main에 "미리 보기: …" 커밋(preview/ 폴더만).
3. `git push origin beta`(백업).
4. 1~2분 뒤 `fetch('index.html')`로 `data-preview` 글이 새것인지 확인.
- 미리 보기 특징: 저장 이름 `preview.` 접두어(실제 기록과 안 섞임), 동기화는 같은 계정·서버 공간 `preview:`, 맨 위 주황 줄(만든 때·내용, 브라우저면 '홈 화면에 추가'), 홈 화면 '미리 보기'(주황 아이콘)로 따로 설치, `preview-sw.js`.
- `preview.py`는 index.html에서 정해진 글자를 찾아 바꾼다(`<html lang="ko">`, 제목, manifest·아이콘 경로, `content="회독 플래너" />`, `localStorage.getItem('hoedok.bg')`). **이 글자들을 index.html에서 지우거나 바꾸면 preview.py가 멈춤.**

### 9-3. "올려 줘"를 받으면 (실제 앱 바꾸기)
1. `git checkout main; git merge beta` (충돌 시 preview/ 폴더는 main 것을 유지).
2. `python tools/bump_sw.py` → 테스트 전부 통과 확인.
3. 커밋 → `git push origin main`.
4. 실제 앱 주소에서 새 버전 확인. 폰에는 '새 버전이 준비됐어요 · 새로 고침' 알림이 뜬다.
5. `docs/변경기록.md`, `docs/진행상황.md`, 이 파일의 "지금 버전" 고치기.
- 다음 합치기에는 베타 1.2가 들어간다 (4차·베타 1.0·1.1은 2026-10-04 a42c0a7로 이미 main).

---

## 10. 문서 (`docs/`) — 고칠 때 함께 고친다
| 문서 | 내용 |
|---|---|
| `개발-계획.md` | 차수별 계획(계획→검토→추가→검토→최종 검토→실행). 1차~5차(베타 1.0) |
| `변경기록.md` | 무엇이 왜 바뀌었는지, 최근 것이 위 (베타 1.2, 실제 앱에 올림, 베타 1.1, 베타 1.0, 4차 …) |
| `설계-원칙.md` | 원칙 1~9, 화면 층 표, 버전·미리 보기 규칙, 핵심 흐름 |
| `디자인-규칙.md` | (베타 2.0) 간격·글자·색·모양·단추·배치·말 — 읽은 글(람스·HIG·Refactoring UI·Laws of UX·머티리얼) |
| `움직임-규칙.md` | (베타 2.0) 움직임 4종류·시간·곡선·규칙 |
| `움직임-버그-체크리스트.md` | A~L(기존) + M 겹쳐 바뀜, N 휴대폰 창, O 유리 막대, P 설정 쪽 넘기기, 기록 표 |
| `동기화-체크리스트.md` | 로그인·예시·미리 보기 공간·두 기기 시험 |
| `설치와-동기화.md` | 사용자용: 홈 화면에 추가, Supabase 만들기·SQL·계정·가입 막기 |
| `진행상황.md` | 지금 상태 한눈에, 실행 방법, 폴더 |
- 원본 요구 문서: `C:\Users\PC\Downloads\공부계획플래너_인수인계보고서.md` (spec of record).

---

## 11. 지금까지의 흐름 (요약 연대기)
| 날짜 | 무엇 |
|---|---|
| 2026-09-28 | 인수인계 문서로 시작. 사용자 잠든 동안 자율 개발. 의존성 없는 PWA·로컬 우선·Supabase REST 결정 |
| 09-29 | UI 먼저: 프로토타입 v3(원본) — 3탭(오늘·진도·성적)+설정, 점진적 공개, 쉬운 말 |
| 09-30 | v4(시험 주기·지문·틀린 이유·할 일 필드·성적 구조), v5(날짜별 시간·예상/실제·내신 흐름·백업·사진) → 실제 앱 `src/app/`. GitHub·Pages 공개. 움직임 허락(부드러운 페이드) |
| 10-01 | 2차(반복·마감·돌아보기 기간), 3차(디자인·움직임), 미리 보기 체계 |
| 10-02 | "올려 줘" → 2·3차 main 합침. 4차 `real-use`: 로그인하면 동기화, 예시 격리, 미리 보기 서버 공간, 설정 점, 한글 글꼴 8, 앱처럼 열기, `.ghost`→`m-ghost` 버그 |
| 10-03 | 사용자가 Supabase 프로젝트 만들고 URL·publishable 키 전달 → `config.js`. 서버 점검 통과. 미리 보기 dc92b10 |
| 10-04 오전 | **베타 1.0** (`beta` 90412d5): 숫자 칸 버그(시작 쪽≠1이면 못 침·말없이 무시·범위가 단계에 안 감), 교재마다 단위·칸 채우기·단원 이름, 막대 채움만, 당겨 오기, 아이폰 창 기기 스크롤, 유리 막대, ＋·막대 높이, 겹쳐 바뀜, 애플 설정처럼 + 새 화면 설정, 확대 끔, 뒤로 가기 기록 어긋남 버그 |
| 10-04 11시 | **베타 1.1** (`beta` 20e4e80, 미리 보기 "10/4 11:23"): 사용자 녹화 3개 분석 → 창 튐 버그(column-reverse), 키 큰 창 14px 밀림, **전화 앱 같은 리퀴드 글래스**(회색 알약 + 떠오르는 유리 방울, 흰 유리 ＋·위쪽 단추), **시작 화면**(비블레시아 참고), 빈 화면 다음 행동, 교재 없는 과목 한 줄 |
| 10-04 오후 | **"올려 줘"** → `beta`를 main에 합침(a42c0a7): 4차 + 베타 1.0·1.1이 실제 앱에 반영 |
| 10-04 저녁 | **베타 1.2** (`beta`, 미리 보기): 실제 앱 영상(54초) 분석 → 창이 열릴 때 위로 튀던 버그(스크롤 상자째 움직임), 창→창·설정 쪽 넘기기의 두 겹 글자(불투명하게 덮기), **막대 렌즈 용수철 + 손가락으로 밀기**, 시작할 때 흰 화면(시작 이미지), '할 일 0/6 · 단원 0/2', 계정 카드 이메일 두 번, 처음 설정에서 알림이 칸을 가림, 설정 뒤로 가면 스크롤 자리 기억 |
| 10-04 밤 | **베타 2.0** (`beta`, 미리 보기): 사용자 요청(실제로 쓸 앱) → 디자인·움직임 규칙 문서, 움직임 켜기/끄기만·가로 페이드, 설정 쪽 걸림·창 아래 잘림 고침, **모든 기기 같은 리퀴드 글래스**(크롬은 굴절), 처음 한 번 소개 움직임, **로그인부터 시작하는 처음 화면 · 학년 → 과목 → 교과서 단원(2022 개정 고1)**, 설정 정리·계정 동기화, 테마 6, 문구('공부 기록') |

### 11-1. 사용자가 남긴 피드백 원문 요지 (잊지 말 것)
- "겉으로는 화려하나 실질적인 알맹이가 없다. 난해하고 사용하기 힘들다. 굳이 써야 하나 싶다." → 알맹이 원칙.
- "기능을 시작 화면부터 때려 박지 말고 들어갈수록 기능이 많은 앱."
- "설정은 애플 설정처럼, 보여지는 화면을 꾸미는 옵션이 많아야."
- "리퀴드 글래스는 아이폰 내장 디자인(전화 앱)."
- "오픈할 때 애니메이션 (비블레시아처럼 세련되게)."
- "아직 사용하기에는 불편하다, 직관성이 떨어진다." → 계속 개선 중.
- 아이폰에서 창을 끌 때 프레임이 낮다, ＋가 혼자 높이 떠 있다, 아래 막대가 높다, 과목 바꿀 때 깜빡여 눈이 아프다, 두 번 누르면 확대된다 (모두 베타에서 처리).

### 11-2. 남은 것·확인할 것
- 사용자 기기에서만 확인 가능: 창이 열릴 때 위로 튀지 않는지(베타 1.2), 막대 방울의 미끄러지는 느낌·밀기, 시작할 때 흰 화면(홈 화면 앱 다시 추가), 아이폰 창 끌기 느낌, 확대 안 됨, 갤럭시 진동, 두 기기 실제 동기화.
- 다른 기기가 옛 버전일 때 새 필드(book.unit/labels/pace, sub.logk)는 무시되지만 칸 기록(marks)은 읽힘 → 두 기기 모두 업데이트 권장.
- 웹에서 못 하는 것(정직하게 말할 것): **아이폰 기본 리퀴드 글래스**(`-apple-visual-effect`는 애플 앱 전용 — 웹·PWA 불가, 진짜로 쓰려면 Mac+Xcode로 네이티브 앱), 사파리에서 유리 굴절(크롬 계열만), iOS 진동, 120Hz JS 애니메이션.
- 교과서 단원: 확인 못 한 출판사(공통국어 대부분, 공통영어 동아·천재·비상·지학사, 과학탐구실험)는 '1단원…' — 사용자가 교과서 목차를 알려 주면 `curriculum.js`에 넣는다. 고2·3 선택과목 단원은 아직 없음.
- 앞으로 직관성 개선 후보: 처음 설정에서 교재를 건너뛴 사람 안내, 할 일 추가의 진도 연결을 더 눈에 띄게, 설정과 … 메뉴의 겹침 정리.

### 11-3. 자주 생긴 실수 (다시 하지 말 것)
- 움직임 클래스 이름이 기존 단추 이름과 겹침(`.ghost`) → 누를 수 없게 됨.
- 세로로 쌓는 flex 상자에 `flex-wrap: wrap` → 줄 너비가 가장 긴 줄로 늘어 화면 밖으로 넘침(교재 고치기).
- 예전 CSS 규칙(`.ed .input { width:auto }`, `.sheet.tall { top }`)이 새 구조에 걸림 → 덧붙인 묶음에서 더 강한 선택자로 끄기.
- 테스트가 오늘 요일에 따라 달라짐.
- 화면 높이 퍼센트(`height:100%`)를 스크롤 상자 안에서 믿지 말 것 → px로.
- **스크롤 상자 안의 요소에 transform 움직임 걸기**(아이폰이 스크롤 범위를 다시 계산해 위치가 어긋남) → 상자째 움직인다.
- 사라지는 복사본을 새 것 **위에서 반투명하게** 지우기 → 두 겹 글자. 위에 오는 쪽은 불투명하게, 움직임은 위치로.
- 키프레임 몇 개를 linear로 잇기 → 등속(기계 같음). 손으로 만지는 것은 용수철.
- 새 점검을 끝에 붙일 때 앞에서 띄운 알림의 타이머가 도중에 끝나 복사본이 세어짐 → 점검 앞에서 알림을 치운다.
- 열자마자 scrollTop 옮기기(아이폰에서 늦게 그려짐).
- 뒤로 가기 기록을 횟수로 세기(되돌리기가 취소되면 숫자가 남음) → 도착 깊이로 판단.

### 11-4. 메모리
- Claude 자동 메모리: `C:\Users\PC\.claude\projects\C--Users-PC-OneDrive-------claud\memory\` (user-profile, feedback-dev-process, feedback-preview-first, feedback-substance, study-planner-project). 이 파일과 내용이 겹치면 이 파일이 더 자세하다. 바뀌면 둘 다 고친다.

### 11-5. 녹화 영상으로 버그를 받았을 때
```
python - <<EOF   # cv2로 0.5초마다 장면 뽑기 → 6×2 모아 보기 이미지 → Read로 보기
```
- 영상을 스크래치 폴더로 복사(한글 경로는 cv2가 못 읽을 수 있음) → `cv2.VideoCapture` → 프레임 저장 → `numpy.hstack/vstack`으로 모아 보기. 순간적인 버그는 처음 몇 초를 3프레임마다 촘촘히. 막대 같은 부분은 잘라서 확대.
