# Discord 카드뉴스 이미지 스펙

> 2026-03-11 확정

---

## 최종 스펙

| 항목 | 값 |
|------|-----|
| **HTML 설계 크기** | 960px × 자동(콘텐츠 높이) |
| **캡처 배율** | `--force-device-scale-factor=2` (2x 레티나) |
| **최종 PNG 크기** | 1920 × ~830px |
| **비율** | 약 2.3:1 (가로형) |
| **방향** | **가로형 필수** — 세로형은 Discord 높이 제한(~350px)으로 극소화됨 |
| **파일 형식** | PNG |

---

## 핵심 원칙

### 왜 가로형인가
Discord는 이미지 표시 시 **높이를 ~350px로 제한**함.
- 세로형(800×1800) → 표시 폭 ~150px → 글씨 판독 불가
- 가로형(1920×830) → 표시 폭 ~800px → 채팅창 꽉 채움

### 왜 2x 캡처인가
HTML 960px로 설계 → 2x 캡처 → 1920px PNG → Discord가 ~800px로 축소 표시
→ 실제 폰트 렌더링이 960×(800/960) = 83% 스케일로 선명하게 보임

---

## 생성 명령어

```bash
# 1. 캡처
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless=new --disable-gpu \
  --screenshot="output.png" \
  --window-size=960,1200 \
  --hide-scrollbars \
  --force-device-scale-factor=2 \
  "file://$(pwd)/input.html"

# 2. 자동 크롭 (빈 배경 제거)
python3 -c "
from PIL import Image
import numpy as np
img = Image.open('output.png')
arr = np.array(img)
bg = np.array([245, 244, 240])  # 배경색 HEX → RGB
rows = np.where(~np.all(np.abs(arr[:,:,:3].astype(int)-bg)<8, axis=(1,2)))[0]
img.crop((0,0,img.width,rows[-1]+56)).save('output.png')
"
```

---

## 공지 이미지 배포 플로우

```
HTML 수정
  → Chrome headless 캡처 (2x)
  → PIL 자동 크롭
  → Discord #공지 채널에 이미지 업로드
  → 이미지 아래 텍스트 블록 붙여넣기
```

---

## 공지용 텍스트 블록 템플릿

이미지 업로드 후 아래 텍스트를 같은 메시지 또는 바로 다음 메시지로 붙여넣기.

```
📌 **채널 바로가기**
<#1474087756144705607> → 자기소개 + 목표 선언
<#1473868708261658695> → 매주 인증 (`/인증` 명령어)

📋 **목표 제출 설문** → https://forms.gle/cKdoqzsTsa6zWJww5
📊 **제출 현황 확인** → https://docs.google.com/spreadsheets/d/18ye_Jyna8OVtsRYpweh706cn3AhbbfScl8h9VxF-R9M/edit?usp=sharing
🌐 **대시보드** → https://ggplab.github.io/content_designer_challenge/
```

---

## 채널 ID 참고

| 채널명 | ID |
|--------|-----|
| `#공지` | `1475135567044804751` |
| `#자기소개-목표-제출` | `1474087756144705607` |
| `#챌린지-인증` | `1473868708261658695` |
| `#웹앱-업데이트` | `1480426873963151501` |
