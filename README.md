# 🧟 Zombie MMORPG

Canvas 기반 쿼터뷰 좀비 MMORPG 오픈 월드 게임

## 🎮 게임 소개

아이소메트릭 쿼터뷰 방식의 좀비 서바이벌 액션 게임입니다. HTML5 Canvas를 사용하여 구현되었으며, Next.js와 React를 기반으로 합니다.

## ✨ 주요 기능

- 🎯 **쿼터뷰 아이소메트릭 맵**: 다이아몬드 형태의 타일 기반 맵
- 🏃 **부드러운 캐릭터 이동**: WASD 또는 방향키로 8방향 이동
- 🧟 **몬스터 AI**: 배회, 추적, 복귀 등 다양한 AI 패턴
- 🗺️ **맵 경계 시스템**: 플레이어와 몬스터의 이동 범위 제한
- ⚔️ **전투 시스템**: 스페이스바로 공격
- 📦 **리소스 로딩**: 진행률 표시와 함께 게임 에셋 로드
- 🎨 **스프라이트 애니메이션**: 캐릭터와 몬스터의 부드러운 애니메이션

## 🚀 시작하기

### 필요 조건

- Node.js 18.0.0 이상
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/BBplayworld/zombie.git
cd zombie

# 의존성 설치
npm install
```

### 실행

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

개발 서버가 실행되면 브라우저에서 http://localhost:3000 으로 접속하세요.

## 🎮 조작법

- **이동**: `W` `A` `S` `D` 또는 방향키
- **공격**: `스페이스바`
- **일시정지**: `ESC`

## 🛠️ 기술 스택

### 프론트엔드

- **프레임워크**: Next.js 15.1.6 (App Router)
- **UI 라이브러리**: React 19.0.0
- **언어**: TypeScript 5.7.3
- **스타일링**: CSS Modules

### 게임 엔진

- **렌더링**: HTML5 Canvas API
- **아키텍처**: 프레임워크 독립적 게임 로직
- **애니메이션**: 커스텀 스프라이트 애니메이션 시스템

## 📂 프로젝트 구조

```
zombie/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 루트 레이아웃
│   ├── page.tsx           # 메인 페이지
│   └── globals.css        # 전역 스타일
├── components/            # React 컴포넌트
│   ├── GameCanvas.tsx     # 게임 캔버스 컴포넌트
│   └── GameCanvas.module.css
├── lib/                   # 게임 로직 및 유틸리티
│   └── game/             # 게임 엔진 (프레임워크 독립적)
│       ├── useGameEngine.ts      # 메인 게임 엔진
│       ├── usePlayer.ts          # 플레이어 클래스
│       ├── useMonster.ts         # 몬스터 클래스
│       ├── useTileMap.ts         # 타일맵 시스템
│       ├── useCamera.ts          # 카메라 시스템
│       ├── useInputManager.ts    # 입력 처리
│       ├── useResourceLoader.ts  # 리소스 로더
│       ├── useSpriteAnimation.ts # 스프라이트 애니메이션
│       ├── useGameMath.ts        # 게임 수학 유틸리티
│       └── useChapterConfig.ts   # 챕터 설정
├── public/               # 정적 파일
│   └── assets/          # 게임 에셋
│       └── chapter-1/   # 챕터 1 리소스
│           ├── map/     # 맵 이미지 및 데이터
│           ├── player/  # 플레이어 스프라이트
│           ├── monster/ # 몬스터 스프라이트
│           └── tile/    # 타일 이미지
├── next.config.mjs      # Next.js 설정
├── tsconfig.json        # TypeScript 설정
└── package.json         # 프로젝트 의존성
```

## 🎯 게임 시스템

### 1. 타일맵 시스템

- 아이소메트릭 다이아몬드 타일 렌더링
- 동적 타일 생성 및 최적화
- 맵 경계 및 충돌 감지

### 2. 캐릭터 시스템

- 8방향 이동 및 애니메이션
- 아이소메트릭 입력 변환
- 충돌 감지 및 경계 제한

### 3. 몬스터 AI

- **배회(Wander)**: 스폰 위치 주변을 랜덤하게 이동
- **복귀(Return)**: 스폰 위치로 돌아가기
- **대기(Idle)**: 일정 시간 정지
- 맵 경계 내에서만 이동

### 4. 카메라 시스템

- 플레이어 중심 카메라
- 부드러운 카메라 이동
- 월드-스크린 좌표 변환

### 5. 리소스 관리

- 비동기 이미지 로딩
- 로딩 진행률 표시
- 에셋 캐싱

## 🔧 개발

### 디버그 모드

게임 실행 시 다음 정보가 표시됩니다:

- 맵 경계 (빨간 네모)
- 이동 불가 영역 (반투명 빨강)
- FPS 및 성능 정보

### 챕터 설정

`lib/game/useChapterConfig.ts`에서 챕터별 설정을 관리합니다:

- 타일맵 설정
- 게임플레이 설정
- 몬스터 설정
- 에셋 경로

## 📝 마이그레이션 히스토리

이 프로젝트는 원래 Nuxt.js (Vue)로 개발되었으나, Next.js (React)로 마이그레이션되었습니다.

자세한 내용은 [MIGRATION-TO-NEXTJS.md](./MIGRATION-TO-NEXTJS.md)를 참조하세요.

## 🤝 기여

기여는 언제나 환영합니다! 이슈를 등록하거나 풀 리퀘스트를 보내주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 🔗 링크

- **GitHub**: https://github.com/BBplayworld/zombie
- **개발자**: BBplayworld

---

**Made with ❤️ using Next.js and Canvas**
