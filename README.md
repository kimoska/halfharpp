# 하프하프 모하프 Threads 자동화

생활비 자료를 수집하고 근거를 확인한 뒤 5~6장 카드뉴스를 만들고, 승인된 글만 Threads에 게시하는 로컬 자동화입니다. 토스쇼핑 Open API가 승인되면 상품·최신 가격·추적 링크도 자동 동기화합니다.

## 안전 기본값

- 모든 새 콘텐츠는 `draft`로 만들어져 자동 게시되지 않습니다.
- 실제 게시는 `LIVE_PUBLISH_ENABLED=true`와 `dryRunByDefault=false` 두 조건이 모두 필요합니다.
- 제휴 글은 광고·수수료 고지, 실제 추적 링크, 24시간 이내 가격 확인이 없으면 차단됩니다.
- 제휴 글 사이에는 일반 글 3개 이상이 필요합니다.
- 구형 저품질 단문 시드와 40개 초안은 `data/archive`로 격리했습니다.
- 캐릭터 이미지는 다리 없음, 둥근 앞지느러미 2개, 양 볼 수염 2가닥 규칙을 적용합니다.

## 검증된 실행 흐름

```powershell
npm install
npm run secrets:init
npm run research:cycle
npm run research:validate
npm run toss:doctor
npm test
npm run typecheck
npm run validate
```

`research:cycle`은 수집 → 중복 제거 → 점수화 → 근거 검사 → 기획 → 6장 렌더링 → 검토 대기열 등록 순서로 동작합니다. 외부 키가 없으면 가능한 단계까지만 완료하고 해당 출처를 건너뜁니다.

## 주요 명령

```powershell
npm run research:doctor
npm run research:collect
npm run research:cycle
npm run research:plan
npm run start -- research-render <기획안ID>
npm run start -- research-queue <기획안ID>
npm run toss:doctor
npm run toss:sync
npm run start -- approve <게시물ID>
npm run dry-run
npm run start -- run
```

## 비밀 설정

토큰과 키는 OneDrive 밖의 다음 파일에만 둡니다.

`C:\Users\김관영\AppData\Local\MoharpAutomation\secrets.env`

필요 항목은 Threads 토큰, GitHub 공개 이미지 저장소 토큰, OpenAI API 키, 선택적 네이버·YouTube 키, 승인 후 토스 Access Key·Secret Key·publisherId입니다.

## 자동 실행

`MoharpThreadsAutomation` 예약 작업은 08:10, 13:10, 19:40에 실행되도록 설치되어 있으며 현재 비활성입니다. 모든 외부 연결과 드라이런이 통과한 뒤에만 아래 명령으로 활성화합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\enable-scheduled-task.ps1
```

상세 구조와 장애 처리 방법은 [자동화 운영 안내](docs/AUTOMATION_PIPELINE.md)를 확인하세요.

## 파일 구조

- `assets/moharp`: 모하프 포즈와 레거시 템플릿
- `config/research.json`: 검색어·출처·선별 기준
- `data/research`: 수집 소재·기획안·실행 기록
- `data/toss`: 토스 상품 및 추적 링크 캐시
- `data/queue.json`: 검토·예약·게시 상태
- `public/generated/briefs`: 1080×1350 캐러셀 카드
- `src/research`: 수집·점수화·근거 검사·기획·렌더링
- `src/toss`: 토큰·상품·추적 링크 연동
- `tests`: 정책·API·캐러셀 회귀 검사
