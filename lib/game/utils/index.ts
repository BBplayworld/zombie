/**
 * 유틸리티 모듈 통합 Export
 * 모든 유틸리티 함수를 한 곳에서 import 가능
 */

// 수학 유틸리티
export {
    Vector2,
    lerp,
    clamp,
    smoothStep,
    worldToScreen,
    screenToWorld,
    degToRad,
    radToDeg,
    angleBetween,
    randomInt,
    randomFloat,
    randomDirection
} from './math'

// 이동 및 충돌 유틸리티
export {
    isPositionWalkable,
    isWithinBoundary,
    clampToBoundary,
    processEntityMovement,
    getDirectionFromVelocity,
    getDistance,
    getDirectionVector,
    normalizeVector
} from './movement'

// 스폰 유틸리티
export {
    findSafeSpawnPosition,
    calculateWanderTarget,
    generateMonsterId,
    selectRandomMonsterConfig
} from './spawn'

// 애니메이션 유틸리티
export {
    setupBasicAnimations,
    playStateAnimation,
    playAttackAnimation
} from './animation'
