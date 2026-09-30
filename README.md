# 회독 플래너

공부할 양을 날짜별로 나눠 주고, 체크하면 진도 칸이 저절로 채워지는 공부 플래너입니다.
휴대폰·태블릿에서 홈 화면에 추가해 앱처럼 쓰는 웹앱(PWA)이고, 인터넷 없이도 열립니다.

- **쓰는 법 · 설치 · 동기화**: [docs/설치와-동기화.md](docs/설치와-동기화.md)
- **설계 원칙**: [docs/설계-원칙.md](docs/설계-원칙.md)
- **진행 상황**: [docs/진행상황.md](docs/진행상황.md)
- **화면 프로토타입**: [docs/mockups/prototype.html](docs/mockups/prototype.html)

빌드 도구와 외부 라이브러리 없이 동작합니다. 공부 기록은 각 기기와 본인의 Supabase에만 저장되고, 이 저장소에는 들어 있지 않습니다.

## 개발

```
python serve.py                                      # http://localhost:5173
powershell -File tools/node.ps1 tests/run-node.js    # 테스트
python tools/bump_sw.py                              # 앱 파일을 고친 뒤 (오프라인 버전 갱신)
```
