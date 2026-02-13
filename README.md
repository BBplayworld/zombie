# 🧟 Zombie MMORPG - Open World Game

Canvas 기반 쿼터뷰 좀비 MMORPG 오픈월드 게임

## 🎮 게임 특징

- **쿼터뷰 방식**: 탑다운 시점의 액션 게임
- **무한 오픈월드**: 자연스럽게 연결되는 타일 기반 배경 시스템
- **부드러운 카메라**: 플레이어를 따라다니는 스무스 카메라
- **최적화된 렌더링**: 화면에 보이는 타일만 렌더링하는 컬링 시스템

## 🚀 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 3. 프로덕션 빌드

```bash
npm run build
npm run preview
```

## 🎯 조작법

- **이동**: 방향키 또는 WASD
- **일시정지**: ESC

## 📁 프로젝트 구조

```
game/
├── assets/
│   └── css/
│       └── main.css              # 전역 스타일
├── components/
│   └── GameCanvas.vue            # 메인 게임 컴포넌트
├── composables/
│   ├── useCamera.ts              # 카메라 시스템
│   ├── useGameEngine.ts          # 게임 엔진 메인
│   ├── useGameMath.ts            # 수학 유틸리티
│   ├── useInputManager.ts        # 입력 관리
│   ├── usePlayer.ts              # 플레이어 캐릭터
│   ├── useResourceLoader.ts      # 리소스 로더
│   └── useTileMap.ts             # 타일맵 시스템
├── pages/
│   └── index.vue                 # 메인 페이지
├── public/
│   └── zombie/
│       └── assets/               # 게임 에셋
│           ├── bg1.png          # 배경 타일 1
│           ├── bg2.png          # 배경 타일 2
│           └── player.png       # 플레이어 스프라이트
├── app.vue                       # 앱 루트
├── nuxt.config.ts               # Nuxt 설정
└── package.json

```

## 🎨 게임 시스템 설명

### 1. 타일맵 시스템 (`useTileMap.ts`)
- 체커보드 패턴의 무한 타일 생성
- 카메라 뷰포트 기반 동적 타일 생성/제거
- 효율적인 메모리 관리

### 2. 카메라 시스템 (`useCamera.ts`)
- 플레이어를 부드럽게 추적
- 월드 좌표 ↔ 스크린 좌표 변환
- 컬링을 위한 뷰포트 체크

### 3. 플레이어 시스템 (`usePlayer.ts`)
- 8방향 이동
- 대각선 이동시 속도 정규화
- 이동 방향에 따른 애니메이션 상태 관리

### 4. 입력 시스템 (`useInputManager.ts`)
- 키보드 입력 관리
- WASD + 방향키 지원
- 이벤트 기반 입력 처리

### 5. 리소스 관리 (`useResourceLoader.ts`)
- 비동기 이미지 로딩
- 로딩 진행률 추적
- 에러 핸들링

## 🛠 기술 스택

- **Nuxt 3**: Vue 3 기반 프레임워크
- **TypeScript**: 타입 안정성
- **Canvas API**: 2D 렌더링
- **Composables**: 재사용 가능한 게임 시스템

## 📝 에셋 준비

게임이 정상 작동하려면 다음 이미지를 준비해야 합니다:

1. `public/zombie/assets/bg1.png` - 배경 타일 1 (1024x1024 권장)
2. `public/zombie/assets/bg2.png` - 배경 타일 2 (1024x1024 권장)
3. `public/zombie/assets/player.png` - 플레이어 스프라이트 (권장 크기: 120x120)

에셋이 없으면 Fallback 그래픽(색상 블록, 빨간 원)이 표시됩니다.

## 🎯 향후 개발 계획

- [ ] 좀비 NPC 시스템
- [ ] 전투 시스템 (공격, 피격)
- [ ] 인벤토리 시스템
- [ ] 멀티플레이어 (WebSocket)
- [ ] 미니맵
- [ ] 사운드 시스템
- [ ] 파티클 효과
- [ ] 퀘스트 시스템
- [ ] 레벨/경험치 시스템

## 📄 라이센스

MIT License

---

**Made with ❤️ by a 10-year Canvas Game Dev Expert**
