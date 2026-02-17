# 오픈 월드 맵 설정 가이드

## 📋 개요

챕터 1의 오픈 월드 맵은 **단일 이미지 파일**(`map-1_3072.png`)을 사용하며, 모든 설정은 `chapters.ts`의 `openWorldMapConfig`에서 관리됩니다.

---

## 🎯 핵심 개념

### 1. **worldSize** - 오픈 월드 전체 크기

전체 맵 이미지의 월드 좌표계 크기를 정의합니다.

```typescript
worldSize: {
    width: 3072,   // 전체 월드 너비 (픽셀)
    height: 3072   // 전체 월드 높이 (픽셀)
}
```

- 맵 이미지 `map-1_3072.png`의 실제 크기와 동일
- 월드 좌표 (0, 0)이 맵의 중앙
- 맵의 범위: X(-1536 ~ 1536), Y(-1536 ~ 1536)

---

### 2. **walkableArea** - 이동 가능 영역 (플레이 영역)

벽 안쪽의 실제 플레이 가능한 영역을 정의합니다.

```typescript
walkableArea: {
    minX: -1400,   // 왼쪽 벽 안쪽
    maxX: 1400,    // 오른쪽 벽 안쪽
    minY: -1400,   // 위쪽 벽 안쪽
    maxY: 1400     // 아래쪽 벽 안쪽
}
```

**용도**:

- ✅ 플레이어 이동 제한
- ✅ 몬스터 이동 제한
- ✅ 몬스터 스폰 영역 제한
- ✅ 벽 바깥쪽 접근 차단

**시각화**:

- 게임 화면에 **초록색 박스**로 표시됨
- 이 영역 밖으로는 플레이어/몬스터가 이동 불가

---

## 🗺️ 좌표 시스템

```
                    Y(-1536)
                       ↑
                       |
    X(-1536) ←─────────┼─────────→ X(1536)
                       |
                       ↓
                    Y(1536)
```

### 전체 맵 영역 (worldSize)

- 범위: X(-1536 ~ 1536), Y(-1536 ~ 1536)
- 크기: 3072 x 3072 픽셀
- 중심: (0, 0)

### 이동 가능 영역 (walkableArea)

- 범위: X(-1400 ~ 1400), Y(-1400 ~ 1400)
- 크기: 2800 x 2800 픽셀
- 벽 두께: 약 136픽셀 (양쪽 합 272픽셀)

---

## ⚙️ 설정 방법

### 📄 파일 위치

`lib/game/config/chapters.ts`

### 🔧 설정 예시

```typescript
openWorldMapConfig: {
    // 오픈 월드 전체 크기 (map-1_3072.png 이미지 크기)
    worldSize: {
        width: 3072,
        height: 3072
    },

    // 이동 가능 영역 (벽 안쪽, 실제 플레이 가능한 영역)
    walkableArea: {
        minX: -1400,   // 왼쪽 벽 안쪽
        maxX: 1400,    // 오른쪽 벽 안쪽
        minY: -1400,   // 위쪽 벽 안쪽
        maxY: 1400     // 아래쪽 벽 안쪽
    },

    // 배경 타일 설정 (카메라 바깥 검정 부분 채우기용)
    backgroundTile: {
        width: 128,              // 타일 렌더링 너비
        height: 64,              // 타일 렌더링 높이
        ySpacingMultiplier: 0.7  // Y축 간격 배율
    },

    // 렌더링 옵션
    visibleMargin: 20,
    enableDepthSorting: true
}
```

---

## 🎮 사용 사례

### 1. 오픈 월드 크기 변경

맵 이미지를 `4096x4096`으로 변경하는 경우:

```typescript
openWorldMapConfig: {
    worldSize: {
        width: 4096,
        height: 4096
    },
    walkableArea: {
        minX: -1900,  // 벽 두께 148px 유지
        maxX: 1900,
        minY: -1900,
        maxY: 1900
    },
    // ...
}
```

---

## 🐛 디버깅

### 시각적 확인

게임 실행 시 화면에 표시되는 박스:

- **초록색 박스** = `walkableArea` (이동 가능 영역)
- **빨간색 영역** = 이동 불가 타일 (벽, 장애물)

### 몬스터 스폰 문제

**증상**: 몬스터가 맵 바깥에 스폰됨

**해결**:

1. `walkableArea` 좌표 확인
2. `SPAWN_MARGIN` 값 확인 (기본 100px)
3. 콘솔 로그 확인:
   ```
   Initial spawn: 15 monsters.
   ```

---

## 📊 설정 비교표

| 항목          | worldSize        | walkableArea       |
| ------------- | ---------------- | ------------------ |
| **의미**      | 전체 맵 크기     | 플레이 가능 영역   |
| **용도**      | 맵 이미지 렌더링 | 이동/스폰 제한     |
| **시각화**    | (없음)           | 초록색 박스        |
| **필수 여부** | 필수             | 필수               |
| **기본값**    | 이미지 크기      | worldSize보다 작음 |

---

## 🚀 빠른 설정 가이드

### 새 맵 추가 시

1. **맵 이미지 준비** (`public/assets/chapter-X/map/`)
2. **worldSize 설정** (이미지 크기와 동일)
3. **walkableArea 계산** (벽 두께 측정)
4. **게임 실행 및 확인** (초록색 박스 위치)
5. **미세 조정** (필요 시 좌표 수정)

---

## 📚 관련 파일

- `lib/game/config/chapters.ts` - 맵 설정
- `lib/game/config/types.ts` - 타입 정의
- `lib/game/systems/TileMap.ts` - 맵 렌더링 및 충돌 처리
- `lib/game/core/MonsterManager.ts` - 몬스터 스폰 로직
