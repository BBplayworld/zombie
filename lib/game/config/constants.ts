/**
 * 게임 설정 상수
 * 게임 전체에서 사용하는 고정 값들을 정의
 */

// ============================================================================
// 렌더링 상수
// ============================================================================

export const RENDERING = {
    // 화면 밖 렌더링 여유 공간 (최적화)
    OFFSCREEN_MARGIN: 200,

    // 엔티티 기본 크기
    PLAYER_WIDTH: 200,
    PLAYER_HEIGHT: 200,
    MONSTER_WIDTH: 150,
    MONSTER_HEIGHT: 150,
} as const

// ============================================================================
// 충돌 및 이동 상수
// ============================================================================

export const MOVEMENT = {
    // 충돌 감지 거리
    LOOK_AHEAD_DISTANCE: 20,

    // 경계 마진 (맵 경계에서 안쪽으로 얼마나 떨어져야 하는지)
    BOUNDARY_MARGIN: 50,

    // 스폰 마진 (몬스터 스폰 시 경계에서 안쪽으로)
    SPAWN_MARGIN: 100,

    // 플레이어 근처 스폰 방지 거리
    PLAYER_SAFE_DISTANCE: 500,

    // 목표 지점 도착 판정 거리
    ARRIVAL_THRESHOLD: 5,

    // 아이소메트릭 방향 벡터 성분
    ISO_X_COMPONENT: 2 / 2.236,  // ~0.894
    ISO_Y_COMPONENT: 1 / 2.236,  // ~0.447

    // 방향 감지 임계값
    DIRECTION_DOT_THRESHOLD: 0.2,
} as const

// ============================================================================
// 스프라이트 상수
// ============================================================================

export const SPRITE = {
    // 플레이어/몬스터 기본 스프라이트 (3x3 그리드)
    BASIC_FRAME_WIDTH: 341,
    BASIC_FRAME_HEIGHT: 341,
    BASIC_GRID_COLS: 3,
    BASIC_GRID_ROWS: 3,

    // 전투 스프라이트 (5x5 그리드)
    FIGHT_GRID_COLS: 5,
    FIGHT_GRID_ROWS: 5,

    // 애니메이션 프레임 레이트
    WALK_FRAME_RATE: 8,
    ATTACK_FRAME_RATE: 12,
    IDLE_FRAME_RATE: 1,
    MONSTER_WALK_FRAME_RATE: 6,
} as const

// ============================================================================
// AI 상수
// ============================================================================

export const AI = {
    // 몬스터 AI 상태 지속 시간
    IDLE_MIN_DURATION: 1,
    IDLE_MAX_DURATION: 3,
    WANDER_DURATION: 3,
    RETURN_DURATION: 5,

    // 몬스터 배회 범위
    WANDER_RADIUS: 300,
    WANDER_MARGIN: 150,

    // 복귀 판정 거리
    RETURN_DISTANCE_THRESHOLD: 100,
    RETURN_PROBABILITY: 0.6,
} as const

// ============================================================================
// 게임 루프 상수
// ============================================================================

export const GAME_LOOP = {
    // FPS 업데이트 주기 (밀리초)
    FPS_UPDATE_INTERVAL: 1000,

    // 델타 타임 스케일 (60fps 기준)
    DELTA_TIME_SCALE: 60,

    // 최대 스폰 시도 횟수 (무한 루프 방지)
    MAX_SPAWN_ATTEMPTS_MULTIPLIER: 50,
} as const

// ============================================================================
// UI 상수
// ============================================================================

export const UI = {
    // 디버그 패널 위치 및 크기
    DEBUG_PANEL_X: 10,
    DEBUG_PANEL_Y: 10,
    DEBUG_PANEL_WIDTH: 200,
    DEBUG_PANEL_HEIGHT: 120,

    // 조작법 패널 크기
    CONTROLS_PANEL_WIDTH: 250,
    CONTROLS_PANEL_HEIGHT: 70,
    CONTROLS_PANEL_MARGIN: 80,
} as const
