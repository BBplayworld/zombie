## 현재 로직 자체의 순차적인 흐름과 애니메이션 이름 정리 종합

게임이 `requestAnimationFrame` 같은 루프 안에서 1초에 60번씩 어떤 흐름을 통해 애니메이션 그림을 그리는지에 대한 명시적 통합 가이드입니다!

### [애니메이션 이름 정의 총정리]

현재 시스템에 적용되는 캐릭터 애니메이션 이름들(키워드)은 모두 `player_` 접두사를 가지며 이렇게 4종류로 엄격히 구분됩니다.

- **이동 (walk/idle)**: `player_walk_left`, `player_walk_right`, `player_idle_left`, `player_idle_right`, `player_idle_up`, `player_idle_down`
- **공격/스킬 기본 모션 (action)**:
  - 기본 평타 (space): `player_skills_action_space_left`, `player_skills_action_space_right`
  - 스킬 (q~r): `player_skills_action_qwer_left`, `player_skills_action_qwer_right`
- **공격용 덧칠 이펙트 (effect overlay)**: `player_skills_effect_space_left`, `player_skills_effect_q_right` 등
- **피격 모션 (damage)**: `player_damage_left`, `player_damage_right`

---

### [프레임 당(1/60초) 순차적 흐름]

#### Step A. 이벤트 수신 및 물리/타이머 판정 (GameEngine.ts → PlayerManager.ts → Player.ts)

1. **입력 제어 (`player.move()`)**: 사용자가 방향키/WASD를 눌렀는지 파악하고 이동 벡터(`velocity`)와 바라보는 방향(`this.direction`) 상태를 갱신합니다.
2. **쿨타임 관리 (`skillManager.update()`)**: 사용한 스킬 쿨타임이 도는 중이면 `deltaTime`(0.016초) 단위로 대기 타이머를 줄입니다.
3. **평상시 애니메이션 갱신 (`player.updateAnimationState()`)**:
   - 현재 멈췄으면 `player_idle_{방향}`, 걷고 있으면 `player_walk_{방향}`을 이번 틱(프레임)에 그릴 이름으로 예약합니다.
   - 단, 캐릭터가 타격 중(`isAttacking == true`)일 경우에는 이동 애니메이션 덮어쓰기 로직이 통과하지 못합니다 (막혀 있음).

#### Step B. 공격 수행 시 특별 시퀀스 발생 (`PlayerManager.handleAttack()` → `player.attack()`)

만약 공격 버튼(Space 단축키, Q 스킬 등)을 눌러서 전투가 벌어지지면:

1. **상태 잠금**: `isAttacking = true`, `currentSkill = "q"` 로 캐릭터의 제어권을 강제로 뺏어서 묶어둡니다. 이동 제어 코드들이 입력을 무시하게 됩니다.
2. **2중 레이어 동시 재생 (`startAttackAnimations()`)**:
   - **Layer 1 (캐릭터 베이스)**: 스킬일 경우 `player_skills_action_qwer_{방향}` 모델을 꺼내서 1번만 순환(`playOnce`)하도록 동작시킵니다.
   - **Layer 2 (이펙트 모델)**: 타격 이펙트인 `player_skills_effect_{스킬이름}_{방향}`도 최하단 레이어 1의 진행과 똑같은 속도로 위에 동시 재생합니다.
3. **종료 후 해제 (콜백 함수)**: Layer 1 캐릭터 공격 모션 애니메이션이 마지막 프레임을 찍고 완전히 종료되면, 그 즉시 `isAttacking = false`로 공격 락을 풀면서 `player_idle_x` (제자리 서있기)를 호출하여 평소 흐름인 Step A 로 넘겨줍니다.

#### Step C.최종 화면 렌더링 시퀀스 (`player.render()`)

A, B 스텝에서 결정된 변수를 기반으로, 이 프레임 맨 마지막에 실제로 `ctx.drawImage`로 겹치기 구조를 쌓아 올립니다:

1. **바닥/배경**: 플레이어 발 밑의 반투명 둥근 그림자 배치 (`ctx.arc`)
2. **스킬 타격 범위 가이드선 (`renderHitArea()`)**: `hitArea` 변수에 담긴 종류에 따라 앞쪽 직사각형 사거리나 반원 범위를 그려냅니다.
3. **[Layer 1] 몸통 그리기 (`renderCharacterSprite()`)**: Step A 혹은 B에서 예약되었던 애니메이션 이름(`player_idle_{방향}` ~ `player_skills_action_..._{방향}`)에 매치되는 이미지 프레임을 도화지에 얹습니다.
4. **[Layer 2] 이펙트 그리기 (`renderEffectOverlay()`)**: 타격 중일 땐 Step B에서 정해진 최상단 이펙트 투명 스프라이트를 레이어 1보다 무조건 위로 우선해서 쌓습니다.
5. **피격 및 HUD**: 이번 턴에 내가 대미지를 입었으면 데미지 이미지(`renderDamageSprite`)를 추가 삽입하고, 본인 머리 위 HP바 렌더링 함수(`renderHpBar`)로 턴을 완벽하게 종료합니다.
