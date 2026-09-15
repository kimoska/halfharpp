# Meta Threads API 연결

## 준비

1. Meta for Developers에서 앱을 만들고 Threads 사용 사례를 선택합니다.
2. Threads 앱 ID와 앱 시크릿을 확인합니다. 다른 Meta 앱 ID와 혼동하지 않습니다.
3. 개발 단계에서는 본인 Threads 계정을 앱의 Threads Tester로 초대하고 계정 설정에서 초대를 수락합니다.
4. `threads_basic`, `threads_content_publish`, `threads_manage_insights` 권한으로 사용자 승인을 받고 액세스 토큰을 발급합니다.
5. `.env`에 `THREADS_ACCESS_TOKEN`과 필요 시 `THREADS_USER_ID`를 입력합니다.

이미지 게시 시 Meta가 `image_url`에서 이미지를 직접 내려받으므로 로그인이나 방화벽 없이 접근 가능한 HTTPS URL이어야 합니다.

## 연결 확인 순서

```powershell
npm run validate
npm run seed
npm run render
npm run dry-run
```

드라이런의 문안과 이미지를 확인한 뒤에만 다음을 설정합니다.

```dotenv
LIVE_PUBLISH_ENABLED=true
```

실게시 테스트는 일반 정보 글 한 건으로 먼저 진행합니다. 성공 후 예약 작업을 설치합니다.

## 토큰 관리

- 토큰을 채팅, 문서, Git 저장소에 붙여넣지 않습니다.
- 토큰 만료·권한 취소 시 로그에 API 오류가 기록되고 최대 3회 후 `failed`가 됩니다.
- 실패 항목은 원인을 해결한 뒤 `data/queue.json`에서 상태를 `approved`, 시도 횟수를 0으로 되돌려 재시도할 수 있습니다.
