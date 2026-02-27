# Zombie MMORPG — CLAUDE.md

## ⛔ 절대 읽지 말 것

```
public/assets/**   ← 이미지 바이너리, .claudeignore 적용됨
node_modules/
.next/
```

에셋 경로·크기는 아래 "Assets" 섹션 텍스트 참조.

---

## 프로젝트

Canvas 기반 쿼터뷰 좀비 MMORPG. **Next.js 15 + React 19 + TypeScript + HTML5 Canvas 2D**

```
components/GameCanvas.tsx   ← React 래퍼 (게임 생명주기, 로딩 UI, 언어 선택)
lib/game/                   ← 전체 게임 로직
public/assets/              ← 이미지 에셋 (읽지 말 것)
scripts/                    ← 맵 데이터 생성 스크립트
```

---

## 아키텍처

```
GameCanvas (React)
  └─ GameEngine              ← 메인 루프 오케스트레이터
       ├─ PlayerManager      ← 입력→이동, 공격, 스킬, 아이템 줍기
       ├─ MonsterManager     ← 스폰, AI 업데이트, 리젠
       ├─ RenderManager      ← 렌더 파이프라인 조율
       ├─ InventoryManager   ← 인벤토리 UI + 클릭
       ├─ InterfaceManager   ← HUD (HP바, 스킬 아이콘)
       └─ CombatTextManager  ← 데미지 텍스트 이펙트
```

**게임 루프 순서:** Input → PlayerManager.update → MonsterManager.updateAll → Camera.follow → Render

---

## 핵심 파일

| 파일                                  | 역할                                  |
| ------------------------------------- | ------------------------------------- |
| `lib/game/core/GameEngine.ts`         | 루프, 존 전환, 입력 등록              |
| `lib/game/core/PlayerManager.ts`      | 이동/공격/스킬/아이템 줍기/반격 피해  |
| `lib/game/entities/player/Player.ts`  | 플레이어 스탯, 애니메이션, 렌더       |
| `lib/game/entities/player/Skills.ts`  | SkillManager (Q/W/E/R 쿨다운)         |
| `lib/game/entities/Monster.ts`        | AI 상태머신, 피격/반격, 렌더          |
| `lib/game/systems/ZoneMap.ts`         | 맵 렌더, walkability 판별             |
| `lib/game/systems/Camera.ts`          | 뷰포트, worldToScreen, follow         |
| `lib/game/systems/InputManager.ts`    | 키/마우스 이벤트                      |
| `lib/game/systems/SpriteAnimation.ts` | 프레임 애니메이션 엔진                |
| `lib/game/systems/ResourceLoader.ts`  | 이미지 로딩 (key→HTMLImageElement)    |
| `lib/game/config/zones.ts`            | 존별 맵·몬스터·아이템·에셋 설정       |
| `lib/game/config/types.ts`            | 공용 타입 정의                        |
| `lib/game/config/player.ts`           | PLAYER_ASSET_CONFIG (스프라이트 경로) |

---

## 좌표계 / 맵

- **원점 (0,0)** = 맵 이미지 중심
- **Zone 1** worldSize: 1360×768 px, walkableArea: `{minX:-680, maxX:680, minY:-384, maxY:384}`
- **이동 판별 (zone 모드):** AABB 경계 체크 → obstacleTiles 폴리곤 체크 → walkable
  (tiles 폴리곤은 contour 전용, ray-cast 미사용)
- `collisionYOffset: 80` — 발 위치 보정 (isWalkableAtWorld 호출 시 `y + 80`)
- 몬스터/플레이어 모두 `getZoneConfig(1)` 하드코딩 중

---

## 입력 키

| 키        | 동작                                       |
| --------- | ------------------------------------------ |
| ArrowKeys | 8방향 이동                                 |
| Space     | 평타 공격 (원형 250px)                     |
| Q         | 스킬 Q (대시+전방 직선 300px, 2.5× 데미지) |
| W / E / R | 스킬 W/E/R (추가 구현 예정)                |
| I         | 인벤토리 토글                              |

---

## 스프라이트 규격

**player.png / 몬스터 스프라이트:** 3열×3행 그리드 (frameWidth=341, frameHeight=341)

- row 0 = walk_down, row 1 = walk_left, row 2 = walk_right
- idle = 각 row 첫 프레임

**fight.png:** 2열×2행 그리드 → `attack_down/left/right/up` 4개 애니메이션

**Q 스킬:** `q-1.png ~ q-5.png` → 런타임에 가로 스프라이트시트로 스티칭, frameRate=14

---

## 전투 흐름

```
플레이어 Space/Q
  → PlayerManager.handleAttack(monsters, skillKey?)
  → 범위 내 Monster.takeDamage(amount)
     → hitStunTimer 설정 + 50% 확률 반격 트리거
  → Monster.tryCounterAttack() → 플레이어 피해
  → CombatTextManager.add() → 데미지 텍스트

autoAttack 몬스터 접근 시:
  COUNTER_RANGE(120px) 내 → 능동 공격 발동 (counterAttackTimer 쿨다운 2초)
```

---

## 스탯 파생

| 스탯    | 파생값                            |
| ------- | --------------------------------- |
| Vigor   | maxHp = 100 + Vigor×10            |
| Spirit  | hpRegen = Spirit×0.5 /초          |
| Might   | damage = 10 + Might×2             |
| Agility | speed = BASE_SPEED + Agility×0.08 |
| Luck    | critChance = Luck×0.01            |

---

## 아이템 / 인벤토리

- `ItemDrop` 물리 엔티티 → 몬스터 사망 시 생성, 50px 내 자동 줍기
- Rarity: Common(50%) / Uncommon(30%) / Rare(15%) / Epic(4%) / Legendary(1%)
- 장착 슬롯: ItemType별 1개, 자동 장착 (인벤토리 빈 슬롯)

---

## 존 전환

포탈 영역 진입 → fade out → `transitionToZone(id, x, y)` → 리소스 교체 → fade in
Zone 2 포탈: `{x:600, y:-200, w:80, h:400}` → Zone 2 이동

---

## 주요 상수

```typescript
Player.SIZE = 120 // 캐릭터 크기 (px)
Player.BASE_SPEED = 380 // 기본 이동 속도 (px/s)
Monster.COUNTER_RANGE = 120 // 반격 사거리
Monster.COUNTER_COOLDOWN = 2.0 // 반격 쿨다운 (초)
Monster.HIT_STUN_DURATION = 0.4
ZoneMap.STEP_GRID.enabled = false // 디버그 그리드 (true 시 FPS 저하)
```

---

## Assets 구조

_(직접 읽지 말고 이 섹션 참조)_

```
public/assets/
  main/player/
    player.png        ← 플레이어 이동 스프라이트 (3×3 그리드)
    fight.png         ← 공격 스프라이트 (2×2 그리드)
    interface/hp.png  ← HP UI 아이콘
    skills/q/         ← q-1.png ~ q-5.png (Q 스킬 프레임)
  zone-1/
    map/map.jpg       ← 배경 이미지 (1360×768)
    map/map-data.json ← walkable/obstacle 폴리곤 데이터
    map/debug/        ← 디버그 오버레이 (개발용)
    monster/          ← mon-1.png ~ mon-3.png (3×3 그리드)
```
