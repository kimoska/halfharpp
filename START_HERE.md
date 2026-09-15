# 하프하프 모하프 — 다음에 할 일

코드와 로컬 검증은 완료됐고 실제 게시만 잠겨 있습니다.

현재 준비된 항목:

- 공식 근거 3건과 검증된 정보형 기획안 1건
- 1080×1350 카드뉴스 6장
- Threads 단일 이미지·캐러셀 게시 코드
- 토스 토큰·상품·추적 링크 캐시 코드
- 08:10·13:10·19:40 Windows 예약 작업(비활성)
- 26개 자동 테스트와 광고·가격·간격·근거 품질 관문

사용자가 완료해야 하는 외부 항목:

1. Meta 앱에 `threads_keyword_search` 권한을 추가하고 토큰을 다시 승인합니다.
2. OpenAI API 키를 로컬 비밀 설정 파일에 넣습니다.
3. 선택적으로 네이버 검색 API와 YouTube Data API 키를 넣습니다.
4. 토스 쉐어링크 Open API 승인 후 Access Key, Secret Key, publisherId와 서버 출발지 IP를 설정합니다.
5. 첫 카드뉴스와 캡션을 직접 확인해 승인합니다.

확인 순서:

```powershell
npm run research:doctor
npm run research:cycle
npm run toss:doctor
npm test
npm run typecheck
npm run validate
npm run dry-run
```

모든 검사가 통과하고 게시할 초안을 승인한 뒤에만 실제 게시 잠금과 예약 작업을 활성화합니다. 자세한 내용은 `docs/AUTOMATION_PIPELINE.md`에 있습니다.
