# 게임 초기화 시퀀스 가이드

## 📋 전체 흐름 개요

```
사용자 페이지 진입
    ↓
GameCanvas 컴포넌트 마운트
    ↓
[STEP 1] GameEngine 생성 (constructor)
    ↓
[STEP 2] 리소스 로딩 (loadResources)
    ↓
로딩 완료 → 'ready' 상태
    ↓
사용자 "게임 시작" 버튼 클릭
    ↓
[STEP 3] 게임 루프 시작 (start)
    ↓
게임 플레이 중
```

---

## 🎯 STEP 1: GameEngine 생성

**파일**: `lib/game/core/GameEngine.ts`  
**함수**: `constructor(canvas: HTMLCanvasElement)`

### 실행 순서:

1. Canvas Context 초기화
2. 줌 방지 설정
3. 챕터 설정 로드
4. 핵심 시스템 생성:
   - Camera
   - TileMap
   - Player
   - InputManager
   - ResourceLoader
5. 매니저 생성:
   - MonsterManager
   - RenderManager

### 로그 출력:

```
🎮 [STEP 1] GameEngine Constructor - Initializing core systems...
✅ [STEP 1] Core systems initialized
```

---

## 📦 STEP 2: 리소스 로딩

**파일**: `lib/game/core/GameEngine.ts`  
**함수**: `async loadResources(): Promise<void>`

### 실행 순서:

#### 2-1. 이미지 리소스 로드

- 챕터 에셋 이미지 로드
- 몬스터 이미지 추가
- 타일맵에 이미지 설정

#### 2-2. 맵 데이터 로드

- 외부 JSON 파일 시도
- 실패 시 기본 설정 사용

#### 2-3. 플레이어 초기화

- 타일맵 연결
- 스프라이트 이미지 설정
- 전투 이미지 설정

#### 2-4. 몬스터 초기 스폰

- `MonsterManager.spawnInitialMonsters()` 호출
- 설정된 개수만큼 몬스터 생성

#### 2-5. 게임 준비 완료

- 상태를 'ready'로 변경
- 카메라 초기 위치 설정
- 첫 렌더링 실행

### 로그 출력:

```
📦 [STEP 2] Loading game resources...
  📸 [STEP 2-1] Loading images...
  ✅ [STEP 2-1] Images loaded
  🗺️  [STEP 2-2] Loading map data...
  ✅ [STEP 2-2] Map data loaded
  🏃 [STEP 2-3] Initializing player...
  ✅ [STEP 2-3] Player initialized
  🎯 [STEP 2-5] Finalizing game setup...
  ✅ [STEP 2-5] Game setup complete
✅ [STEP 2] All resources loaded, game ready!
```

---

## 🚀 STEP 3: 게임 시작

**파일**: `lib/game/core/GameEngine.ts`  
**함수**: `start(): void`

### 실행 순서:

1. 상태 검증 (ready 상태인지 확인)
2. 상태를 'playing'으로 변경
3. 게임 루프 시작 (`gameLoop()` 호출)

### 로그 출력:

```
🚀 [STEP 3] Starting game loop...
✅ [STEP 3] Game loop started!
```

---

## 📁 파일 구조 및 역할

### 1. `components/GameCanvas.tsx`

**역할**: React 컴포넌트, 게임 초기화 시퀀스 시작점

**주요 함수**:

- `initializeGameSequence()` - 게임 초기화 시퀀스 실행
- `startGame()` - 사용자 버튼 클릭 시 게임 시작

**상태 관리**:

- `loading` → `ready` → `playing` / `paused`

---

### 2. `lib/game/core/GameEngine.ts`

**역할**: 게임 엔진 핵심, 모든 시스템 통합 관리

**주요 함수** (실행 순서대로):

1. `constructor()` - STEP 1: 시스템 초기화
2. `loadResources()` - STEP 2: 리소스 로딩
   - `loadImageResources()` - 2-1
   - `loadMapData()` - 2-2
   - `initializePlayer()` - 2-3
   - `finalizeGameSetup()` - 2-5
3. `start()` - STEP 3: 게임 루프 시작
4. `gameLoop()` - 매 프레임 실행
5. `update()` - 게임 상태 업데이트

**관리하는 시스템**:

- Camera
- Player
- TileMap
- InputManager
- ResourceLoader
- MonsterManager (위임)
- RenderManager (위임)

---

### 3. `lib/game/core/MonsterManager.ts`

**역할**: 몬스터 스폰 및 관리 전담

**주요 함수**:

- `spawnInitialMonsters()` - 초기 몬스터 스폰
- `handleRespawn()` - 몬스터 리젠 처리
- `removeDeadMonsters()` - 죽은 몬스터 제거
- `updateAll()` - 모든 몬스터 업데이트
- `executeMonsterSpawn()` - 실제 스폰 실행
- `generateSpawnPosition()` - 스폰 위치 생성
- `validateSpawnPosition()` - 스폰 위치 검증
- `createMonster()` - 몬스터 인스턴스 생성

**관리 데이터**:

- `monsters: Monster[]` - 활성 몬스터 목록
- `initialSpawnComplete` - 초기 스폰 완료 플래그
- `lastRegenCheckTime` - 마지막 리젠 체크 시간

---

### 4. `lib/game/core/RenderManager.ts`

**역할**: 렌더링 로직 전담

**주요 함수**:

- `render()` - 전체 렌더링 실행
- `updateFPS()` - FPS 계산
- `clearScreen()` - 화면 클리어
- `renderEntities()` - 엔티티 렌더링 (Y축 정렬)
- `renderUI()` - UI 렌더링
- `renderDebugInfo()` - 디버그 정보 표시
- `renderControls()` - 조작법 표시

**렌더링 순서**:

1. 화면 클리어
2. 타일맵 렌더링
3. 엔티티 렌더링 (Y축 정렬)
4. UI 렌더링

---

## 🔍 디버깅 가이드

### 콘솔 로그로 시퀀스 추적

게임 시작 시 다음과 같은 로그가 순서대로 출력됩니다:

```
🎬 [SEQUENCE START] GameCanvas mounted, starting initialization...
🎮 [SEQUENCE] Creating GameEngine instance...
🎮 [STEP 1] GameEngine Constructor - Initializing core systems...
✅ [STEP 1] Core systems initialized
📦 [SEQUENCE] Starting resource loading...
📦 [STEP 2] Loading game resources...
  📸 [STEP 2-1] Loading images...
📊 Loading progress: 0%
📊 Loading progress: 25%
📊 Loading progress: 50%
📊 Loading progress: 75%
  ✅ [STEP 2-1] Images loaded
  🗺️  [STEP 2-2] Loading map data...
  ✅ [STEP 2-2] Map data loaded
  🏃 [STEP 2-3] Initializing player...
  ✅ [STEP 2-3] Player initialized
Initial spawn: 5 monsters.
  🎯 [STEP 2-5] Finalizing game setup...
  ✅ [STEP 2-5] Game setup complete
✅ [STEP 2] All resources loaded, game ready!
✅ [SEQUENCE] Resources loaded, transitioning to READY state
⏸️  [SEQUENCE] Waiting for user to click "Start Game" button...
🚀 [SEQUENCE] User clicked START, launching game loop...
🚀 [STEP 3] Starting game loop...
✅ [STEP 3] Game loop started!
✅ [SEQUENCE COMPLETE] Game is now running!
```

### 문제 발생 시 체크포인트

1. **STEP 1에서 멈춤**: 시스템 초기화 실패
   - Canvas context 생성 확인
   - 챕터 설정 파일 확인

2. **STEP 2에서 멈춤**: 리소스 로딩 실패
   - 이미지 경로 확인
   - 맵 데이터 파일 확인
   - 네트워크 요청 확인

3. **STEP 3에서 멈춤**: 게임 루프 시작 실패
   - 상태가 'ready'인지 확인
   - 브라우저 콘솔 에러 확인

---

## 🎮 게임 루프 (STEP 3 이후)

### 매 프레임 실행 순서:

```
gameLoop()
  ↓
updateFPS()
  ↓
update()
  ├─ 입력 처리
  ├─ 플레이어 업데이트
  ├─ 몬스터 관리
  │   ├─ removeDeadMonsters()
  │   ├─ updateAll()
  │   └─ handleRespawn()
  └─ 카메라 업데이트
  ↓
render()
  ├─ clearScreen()
  ├─ 타일맵 렌더링
  ├─ 엔티티 렌더링
  └─ UI 렌더링
  ↓
requestAnimationFrame(gameLoop)
```

---

## 📊 상태 다이어그램

```
loading ──[리소스 로딩 완료]──> ready ──[게임 시작 버튼]──> playing
                                                                ↕
                                                              paused
```

---

## 🛠️ 확장 가이드

### 새로운 시스템 추가 시:

1. **STEP 1 (constructor)**에 시스템 초기화 추가
2. **STEP 2 (loadResources)**에 리소스 로딩 추가
3. **update()**에 업데이트 로직 추가
4. **render()**에 렌더링 로직 추가 (필요시)

### 예시: 사운드 시스템 추가

```typescript
// STEP 1: constructor
this.soundManager = new SoundManager()

// STEP 2: loadResources
await this.loadSoundResources(chapterConfig)

// update: 필요 시 사운드 재생
this.soundManager.update()
```

---

## 📝 요약

- **GameCanvas.tsx**: 초기화 시퀀스 시작점, UI 상태 관리
- **GameEngine.ts**: 핵심 엔진, 시스템 통합 관리
- **MonsterManager.ts**: 몬스터 전담 관리
- **RenderManager.ts**: 렌더링 전담 관리

모든 함수는 **실행 순서대로 배치**되어 있으며, **명확한 로그**로 추적 가능합니다.
