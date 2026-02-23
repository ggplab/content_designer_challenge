# Google Sheets 스키마 정의

## 시트 이름: `Challenge_Log`

### 헤더 구성 (1행에 입력)

| 열 | 헤더명 | 타입 | 예시 | 비고 |
|----|--------|------|------|------|
| A | 날짜 (Date) | DATE | 2026-02-19 | YYYY-MM-DD 형식 |
| B | 작성자 (Name) | TEXT | 임정 | Discord username |
| C | 플랫폼 (Platform) | TEXT | LinkedIn | LinkedIn/Instagram/Threads/YouTube/Blog |
| D | 콘텐츠 링크 (URL) | URL | https://... | 발행된 콘텐츠 원본 링크 |
| E | 회차 (Week) | TEXT | 1주차 | n주차 형식 |
| F | 콘텐츠 요약 (Summary) | TEXT | n8n 자동화 시스템 구축기 | AI 생성 한 문장 요약 |
| G | 공개 여부 (Visibility) | TEXT | private | `public` 또는 `private` |

### 설정 방법

1. [Google Sheets](https://sheets.google.com) 접속 → 새 스프레드시트 생성
2. 시트 탭 이름을 `Sheet1` → `Challenge_Log` 으로 변경
3. 1행에 위 헤더를 순서대로 입력
4. A열: 날짜 (Date)
5. B열: 작성자 (Name)
6. C열: 플랫폼 (Platform)
7. D열: 콘텐츠 링크 (URL)
8. E열: 회차 (Week)
9. F열: 콘텐츠 요약 (Summary)
10. G열: 공개 여부 (Visibility)
5. 스프레드시트 URL에서 Sheet ID 복사: `https://docs.google.com/spreadsheets/d/[여기가 SHEET_ID]/edit`
6. `.env` 파일의 `GOOGLE_SHEET_ID` 에 붙여넣기

### 권장 서식

- A열 (날짜): 날짜 형식 지정
- D열 (URL): 일반 텍스트 (자동 하이퍼링크)
- 1행 헤더: 배경색 적용, 텍스트 굵게, 행 고정(보기 > 행 고정 > 1행)

### 데이터 예시

```
날짜 (Date)  | 작성자 (Name) | 플랫폼 (Platform) | 콘텐츠 링크 (URL)       | 회차 (Week) | 콘텐츠 요약 (Summary)       | 공개 여부 (Visibility)
2026-02-19  | 임정          | LinkedIn          | https://linkedin.com/... | 1주차       | n8n 자동화 시스템 구축기     | private
2026-02-20  | 홍길동        | Instagram         | https://instagram.com/... | 1주차       | 데이터 분석 인사이트 공유     | public
```
