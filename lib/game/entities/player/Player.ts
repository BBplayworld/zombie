import { Vector2 } from "../../utils/math";
import {
  SpriteAnimation,
  createFramesFromGrid,
} from "../../systems/SpriteAnimation";
import { ZoneMap } from "../../systems/ZoneMap";
import { getZoneConfig } from "../../config/zones";
import {
  EntityStats,
  ItemData,
  StatType,
  ItemType,
} from "../../config/types";
import { Item } from "../Item";
import { SkillManager } from "./Skills";
import { Inventory } from "../Inventory";
import {
  registerMoveAnimations,
  registerSpaceAnimations,
  registerSkillCharAnimations,
  registerSkillAnimations,
  registerDamageAnimations,
} from "./PlayerAnimations"

// ============================================================================
// Player.ts
//
// 〔담당 범위〕
//   - 위치·속도·HP·인벤토리 등 순수 상태 관리
//   - 이동/공격 요청 수신 → 속도 세팅 + 애니메이션 전환
//   - 렌더 (스프라이트 + HP 바)
//
// 〔담당하지 않는 것〕
//   - 이미지 등록 로직(fight/skill 이미지) → PlayerAnimations.ts
//   - 스킬 수치(쿨다운·범위·배율)         → Skills.ts
//   - 프레임별 입력·데미지 계산 조율       → PlayerManager.ts
// ============================================================================
export class Player {
  public position: Vector2;
  public velocity: Vector2;
  public width: number;
  public height: number;
  public speed: number;
  public angle: number;

  // ─── HP / Regen ──────────────────────────────────────────────────────────
  public hp: number = 100;
  public maxHp: number = 100;
  public hpRegen: number = 0;
  private hpRegenTimer: number = 0;

  // ─── 스탯 / 장비 ─────────────────────────────────────────────────────────
  public stats: EntityStats = {
    Vigor: 20,
    Spirit: 10,
    Might: 10,
    Agility: 10,
    Luck: 10,
  };
  public damage: number = 10;
  public critChance: number = 0;
  public inventory: Inventory = new Inventory();
  public equipment: Partial<Record<ItemType, Item>> = {};
  public isInventoryOpen: boolean = false;

  // ─── 전투 상태 ───────────────────────────────────────────────────────────
  public isAttacking: boolean = false;
  /** 현재 실행 중인 스킬 키 (undefined = 기본 평타) */
  public currentSkill: string | null = null;

  // 공격 비주얼 타이머 (범위 원 표시용)
  private attackVisualTimer: number = 0;
  private readonly ATTACK_VISUAL_DURATION = 0.3;

  // 피격 상태 플래그 (피격 애니메이션 진행 중 true)
  public isDamaged: boolean = false;

  // 스킬 매니저
  public skillManager?: SkillManager;

  // ─── 이동 방향 ───────────────────────────────────────────────────────────
  public isMoving: boolean = false;
  public direction: "idle" | "up" | "down" | "left" | "right" = "down";
  private lastDirX: number = 0;
  private lastDirY: number = 1;

  // ─── 스프라이트 / 이미지 ─────────────────────────────────────────────────
  /** Layer 1: 캐릭터 스프라이트 (action/ 디렉토리) */
  private spriteAnimation: SpriteAnimation;
  /** Layer 2: 이펙트 오버레이 (skills/ 디렉토리) */
  private effectAnimation: SpriteAnimation;
  /** Layer 3: 피격 애니메이션 (action/damage-*.png) */
  private damageAnimation: SpriteAnimation;

  /** Layer 1 이미지: action/move-left.png, action/move-right.png */
  private moveImageLeft: HTMLImageElement | null = null;
  private moveImageRight: HTMLImageElement | null = null;

  /** Layer 1 이미지: action/space-left.png, action/space-right.png */
  private spaceCharImageLeft: HTMLImageElement | null = null;
  private spaceCharImageRight: HTMLImageElement | null = null;

  /** Layer 1 이미지: action/skills-left.png, action/skills-right.png */
  private skillsCharImageLeft: HTMLImageElement | null = null;
  private skillsCharImageRight: HTMLImageElement | null = null;

  /** Layer 3 이미지: action/damage-left.png, action/damage-right.png */
  private damageImageLeft: HTMLImageElement | null = null;
  private damageImageRight: HTMLImageElement | null = null;

  /** Layer 2 이미지: skills/{key}/*.png (스티칭 캔버스) */
  private effectImages: Partial<Record<string, HTMLImageElement | HTMLCanvasElement>> = {};
  private effectFrames: Record<string, number> = {};

  // ─── UI ──────────────────────────────────────────────────────────────────
  public inventoryMenu: { x: number; y: number; itemIndex: number } | null = null;
  public hoveredItem: { item: Item; x: number; y: number } | null = null;

  // ─── 맵 충돌 (zone 맵 기준) ──────────────────────────────────────────────
  private zoneMap: ZoneMap | null = null;

  // ─── 상수 ────────────────────────────────────────────────────────────────
  static readonly SIZE = 130;
  static readonly BASE_SPEED = 380;

  // =========================================================================
  constructor(x: number = 0, y: number = 0) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.width = Player.SIZE;
    this.height = Player.SIZE;
    this.speed = 0;
    this.angle = 0;

    this.updateStats();
    this.hp = this.maxHp;

    this.spriteAnimation = new SpriteAnimation();
    this.effectAnimation = new SpriteAnimation();
    this.damageAnimation = new SpriteAnimation();
  }

  // =========================================================================
  // 이미지 등록 (PlayerManager.initialize()에서 호출)
  // ─────────────────────────────────────────────────────
  // 이미지 교체 방법
  //   이동    : setMoveImages(left, right) — move/left.png, move/right.png
  //   평타    : setSpaceImages(left, right) — skills/space/left.png, right.png
  //   q스킬   : setSkillImage('q', canvas, 5) — stitchImageFrames 결과 전달
  // =========================================================================

  /**
   * [Layer 1] 이동 캐릭터 스프라이트 등록 (action/move-left.png, action/move-right.png)
   * → walk_{방향} / idle_{방향} 애니메이션 자동 등록
   */
  setMoveImages(left: HTMLImageElement, right: HTMLImageElement): void {
    this.moveImageLeft = left;
    this.moveImageRight = right;
    registerMoveAnimations(this.spriteAnimation, { left, right });
  }

  /**
   * [Layer 1] space 평타 캐릭터 동작 스프라이트 등록 (action/space-left.png, action/space-right.png)
   * → char_attack_{방향} 애니메이션 자동 등록
   */
  setSpaceImages(left: HTMLImageElement, right: HTMLImageElement): void {
    this.spaceCharImageLeft = left;
    this.spaceCharImageRight = right;
    registerSpaceAnimations(this.spriteAnimation, { left, right });
  }

  /**
   * [Layer 1] qwer 스킬 캐릭터 동작 스프라이트 등록 (action/skills-left.png, action/skills-right.png)
   * → char_skill_{방향} 애니메이션 자동 등록
   */
  setSkillCharImages(left: HTMLImageElement, right: HTMLImageElement): void {
    this.skillsCharImageLeft = left;
    this.skillsCharImageRight = right;
    registerSkillCharAnimations(this.spriteAnimation, { left, right });
  }

  /**
   * [Layer 3] 피격 캐릭터 애니메이션 등록 (action/damage-left.png, action/damage-right.png)
   * → char_damage_{방향} 애니메이션 자동 등록
   */
  setDamageImages(left: HTMLImageElement, right: HTMLImageElement): void {
    this.damageImageLeft = left;
    this.damageImageRight = right;
    registerDamageAnimations(this.damageAnimation, { left, right });
  }

  /**
   * [Layer 2] 스킬 이펙트 오버레이 등록 (skills/{key}/*.png → 스티칭 캔버스)
   * → effect_{key}_{방향} 애니메이션 자동 등록
   */
  setSkillImage(
    key: string,
    image: HTMLImageElement | HTMLCanvasElement,
    frameCount: number = 1,
    frameRate: number = 14,
  ): void {
    this.effectImages[key] = image;
    this.effectFrames[key] = frameCount;
    registerSkillAnimations(this.effectAnimation, key, image, frameCount, frameRate);
  }

  /** zone 맵 충돌·이동 경계 설정 */
  setZoneMap(ZoneMap: ZoneMap): void {
    this.zoneMap = ZoneMap;
  }

  // =========================================================================
  // 능력치 / 데미지
  // =========================================================================

  updateStats(): void {
    const baseStats: EntityStats = {
      Vigor: 10, Spirit: 10, Might: 10, Agility: 10, Luck: 10,
    };
    const totals: Record<StatType, number> = { ...baseStats };
    const percents: Record<StatType, number> = {
      Vigor: 0, Spirit: 0, Might: 0, Agility: 0, Luck: 0,
    };

    Object.values(this.equipment).forEach((item) => {
      if (!item) return;
      Object.entries(item.data.stats).forEach(([key, val]) => {
        const stat = key as StatType;
        if (val) {
          totals[stat] += val.flat;
          percents[stat] += val.percent;
        }
      });
    });

    this.stats.Vigor = Math.floor(totals.Vigor * (1 + percents.Vigor));
    this.stats.Spirit = Math.floor(totals.Spirit * (1 + percents.Spirit));
    this.stats.Might = Math.floor(totals.Might * (1 + percents.Might));
    this.stats.Agility = Math.floor(totals.Agility * (1 + percents.Agility));
    this.stats.Luck = Math.floor(totals.Luck * (1 + percents.Luck));

    this.maxHp = 100 + this.stats.Vigor * 10;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    this.speed = Player.BASE_SPEED + this.stats.Agility * 0.08;
    this.damage = 10 + this.stats.Might * 2;
    this.critChance = this.stats.Luck * 0.01;
    this.hpRegen = this.stats.Spirit * 0.5;
  }

  getDamage(): { amount: number; isCrit: boolean } {
    const isCrit = Math.random() < this.critChance;
    const multiplier = isCrit ? 2.0 : 1.0;
    const variance = Math.random() * 0.2 + 0.9;
    return { amount: Math.floor(this.damage * multiplier * variance), isCrit };
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    // 피격 애니메이션 시작 (현재 방향 기준 char_damage_{방향})
    const dir = this.direction === "up" ? "left" : this.direction;
    const animName = `char_damage_${dir}`;
    if (this.damageAnimation.getAnimation(animName)) {
      this.isDamaged = true;
      this.damageAnimation.playOnce(animName, () => {
        this.isDamaged = false;
      });
    }
  }

  // =========================================================================
  // 인벤토리 / 아이템
  // =========================================================================

  addItem(itemData: ItemData): void {
    const item = new Item(itemData);
    if (this.inventory.add(item)) {
      const type = item.data.type;
      if (item.isEquipment() && !this.equipment[type]) this.equipItem(item);
    }
  }

  equipItem(item: Item): void {
    const type = item.data.type;
    const current = this.equipment[type];
    if (current) this.inventory.add(current);
    this.equipment[type] = item;
    this.inventory.remove(item);
    this.updateStats();
  }

  unequipItem(slot: ItemType): void {
    const current = this.equipment[slot];
    if (current) {
      this.inventory.add(current);
      delete this.equipment[slot];
      this.updateStats();
    }
  }

  toggleInventory(): void {
    this.isInventoryOpen = !this.isInventoryOpen;
  }

  // =========================================================================
  // 이동
  // =========================================================================

  /**
   * 이동 입력 반영 (PlayerManager에서 매 프레임 호출)
   * moveX, moveY: 정규화되지 않은 방향값
   */
  move(moveX: number, moveY: number): void {
    if (this.isAttacking) return;

    if (moveX === 0 && moveY === 0) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      return;
    }

    const mag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (mag <= 0) return;
    const dirX = moveX / mag;
    const dirY = moveY / mag;

    this.velocity.x = dirX * this.speed;
    this.velocity.y = dirY * this.speed;
    this.angle = Math.atan2(dirY, dirX);
    this.lastDirX = dirX;
    this.lastDirY = dirY;
    this.updateDirection(dirX, dirY);
  }

  /** 플레이어가 바라보는 방향 벡터 (정규화) */
  getFacingVector(): Vector2 {
    let dx = this.lastDirX;
    let dy = this.lastDirY;
    if (dx === 0 && dy === 0) {
      if (this.direction === "left") dx = -1;
      else if (this.direction === "right") dx = 1;
      else if (this.direction === "up") dy = -1;
      else dy = 1;
    }
    const mag = Math.sqrt(dx * dx + dy * dy);
    return mag === 0 ? new Vector2(0, 1) : new Vector2(dx / mag, dy / mag);
  }

  // =========================================================================
  // 공격
  // =========================================================================

  /**
   * 공격 시작. PlayerManager.handleAttack()에서 호출.
   *
   * ┌─ 1. 상태 설정        : isAttacking = true, currentSkill 등록
   * ├─ 2. 애니메이션 시작  : Layer1(캐릭터) + Layer2(이펙트) 동시 재생
   * └─ 3. 대시 속도 적용  : 방향 벡터 × dashSpeed
   */
  attack(skillKey?: string, dashSpeed: number = 0): void {
    if (this.isAttacking) return;

    // ── 1. 상태 ────────────────────────────────────────────────────────────
    this.isAttacking = true;
    this.isMoving = false;
    this.currentSkill = skillKey ?? null;
    this.attackVisualTimer = this.ATTACK_VISUAL_DURATION;

    // ── 2. 애니메이션 ───────────────────────────────────────────────────────
    this.startAttackAnimations(skillKey);

    // ── 3. 대시 ────────────────────────────────────────────────────────────
    this.applyDash(dashSpeed);
  }

  /**
   * [attack 내부] Layer1 + Layer2 애니메이션을 동시에 시작.
   *
   * Layer 1 (캐릭터 스프라이트)
   *   - skill 존재 → char_skill_{방향}   (action/skills-*.png)
   *   - 없으면     → char_attack_{방향}  (action/space-*.png)
   *
   * Layer 2 (이펙트 오버레이)
   *   - skill 존재 → effect_{key}_{방향} (skills/{key}/*.png)
   *   - 없으면     → effect_space_{방향} (skills/space/*.png)
   */
  private startAttackAnimations(skillKey?: string): void {
    const dir = this.direction === "up" ? "left" : this.direction;

    // Layer 1: 캐릭터 동작 애니메이션
    const charAnim = skillKey ? `char_skill_${dir}` : `char_attack_${dir}`;
    this.spriteAnimation.playOnce(charAnim, () => {
      // 애니메이션 완료 후 상태 초기화
      this.isAttacking = false;
      this.currentSkill = null;
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.spriteAnimation.play(`idle_${dir}`);
    });

    // Layer 2: 이펙트 오버레이 애니메이션
    const effectKey = skillKey ?? "space";
    const effectAnim = `effect_${effectKey}_${dir}`;
    if (this.effectAnimation.getAnimation(effectAnim)) {
      this.effectAnimation.playOnce(effectAnim);
    }
  }

  /**
   * [attack 내부] 대시 속도를 현재 바라보는 방향으로 적용.
   * dashSpeed = 0 이면 기본값 1400 사용. (Skills.ts에서 직접 지정하는 것을 권장)
   */
  private applyDash(dashSpeed: number): void {
    const speed = dashSpeed > 0 ? dashSpeed : 1400;
    let dx = this.lastDirX;
    let dy = this.lastDirY;
    // 정지 상태라면 현재 방향 기반으로 벡터 보정
    if (dx === 0 && dy === 0) {
      if (this.direction === "left") dx = -1;
      else if (this.direction === "right") dx = 1;
      else if (this.direction === "up") dy = -1;
      else dy = 1;
    }
    this.velocity.x = dx * speed;
    this.velocity.y = dy * speed;
  }

  // =========================================================================
  // 매 프레임 업데이트
  // =========================================================================

  update(deltaTime: number = 0.016): void {
    // 피격 애니메이션 업데이트
    if (this.isDamaged) {
      this.damageAnimation.update(deltaTime);
    }

    // 대시 관성 감쇠: 공격 시작 0.15초 후 속도 0으로 리셋
    if (this.attackVisualTimer > 0) {
      this.attackVisualTimer -= deltaTime;
      if (this.attackVisualTimer <= this.ATTACK_VISUAL_DURATION - 0.15) {
        this.velocity.x = 0;
        this.velocity.y = 0;
      }
    }

    // HP 자동 회복
    if (!this.isAttacking && this.hpRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * deltaTime);
    }

    // 이동 (zone 맵 충돌 적용)
    this.applyMovement(deltaTime);

    // Layer 1 애니메이션 상태 결정 (공격 중에는 attack()이 이미 재생 중이므로 skip)
    this.updateAnimationState();

    this.spriteAnimation.update(deltaTime);
    this.effectAnimation.update(deltaTime);
  }

  /**
   * 매 프레임 Layer1 애니메이션 이름을 결정해 play().
   *
   * ┌─ 공격 중  → 아무것도 하지 않음 (attack()의 playOnce가 주도)
   * ├─ 이동 중  → walk_{방향}
   * └─ 정지 중  → idle_{방향}  (up 방향은 left 이미지 사용)
   */
  private updateAnimationState(): void {
    if (this.isAttacking) return;    // 공격 애니메이션은 attack()이 제어

    this.isMoving = this.velocity.x !== 0 || this.velocity.y !== 0;
    const dir = this.direction === "up" ? "left" : this.direction;
    const anim = this.isMoving ? `walk_${this.direction}` : `idle_${dir}`;
    this.spriteAnimation.play(anim);
  }

  // =========================================================================
  // 렌더
  // =========================================================================

  render(
    ctx: CanvasRenderingContext2D,
    _image: HTMLImageElement | undefined,
    screenX: number,
    screenY: number,
  ): void {
    ctx.save();
    ctx.translate(screenX, screenY);

    // ── 그림자 ──────────────────────────────────────────────────────────────
    ctx.save();
    ctx.scale(1.2, 0.4);
    ctx.beginPath();
    ctx.arc(0, (this.height / 2) * 1.8, 40, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "black";
    ctx.fill();
    ctx.restore();

    // ── 공격 범위 원 ────────────────────────────────────────────────────────
    if (this.attackVisualTimer > 0) {
      const ratio = this.attackVisualTimer / this.ATTACK_VISUAL_DURATION;
      const range = 250;
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 50, 50, ${ratio * 0.3})`;
      ctx.arc(0, 0, range, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(255, 100, 100, ${ratio * 0.8})`;
      ctx.stroke();
      ctx.restore();
    }

    // ── Layer 1: 캐릭터 스프라이트 ─────────────────────────────────────────
    if (!this.isDamaged) {
      this.renderCharacterSprite(ctx);
    }

    // ── Layer 2: 이펙트 오버레이 (공격/스킬 시에만) ─────────────────────────
    if (this.isAttacking) {
      this.renderEffectOverlay(ctx);
    }

    // ── Layer 3: 피격 애니메이션 (damage 이미지) ───────────────────────────
    if (this.isDamaged) {
      this.renderDamageSprite(ctx);
    }

    // ── HP 바 ───────────────────────────────────────────────────────────────
    this.renderHpBar(ctx);

    ctx.restore();
  }

  // =========================================================================
  // private helpers
  // =========================================================================

  /**
   * Layer 1 렌더: 캐릭터 스프라이트
   *
   * 상태           | 사용 이미지              | 애니메이션 이름
   * -------------- | ------------------------ | -------------------------
   * 이동/대기 중   | action/move-*.png        | walk_{방향} / idle_{방향}
   * space 공격 중  | action/space-*.png       | char_attack_{방향}
   * skill 공격 중  | action/skills-*.png      | char_skill_{방향}
   *
   * ※ spriteAnimation.getCurrentFrame() 이 현재 재생 중인 프레임을 반환
   */
  private renderCharacterSprite(ctx: CanvasRenderingContext2D): void {
    const img = this.resolveCharacterImage();
    const frame = this.spriteAnimation.getCurrentFrame();

    if (img && img.complete && img.naturalWidth !== 0 && frame) {
      ctx.save();
      ctx.drawImage(
        img,
        frame.x, frame.y, frame.width, frame.height,   // 소스 프레임
        -this.width / 2, -this.height / 2, this.width, this.height, // 화면 위치
      );
      ctx.restore();
    } else {
      // 이미지 미로드 폴백
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 현재 상태(이동/공격 종류)에 맞는 Layer1 이미지를 반환.
   * 이미지를 바꾸고 싶을 때 이 함수만 수정하면 됩니다.
   */
  private resolveCharacterImage(): HTMLImageElement | null {
    const isRight = this.direction === "right" || this.direction === "down";

    if (!this.isAttacking) {
      // 평상시(이동/대기)
      return isRight ? this.moveImageRight : this.moveImageLeft;
    }

    if (this.currentSkill) {
      // qwer 스킬 공격 중
      return isRight ? this.skillsCharImageRight : this.skillsCharImageLeft;
    }

    // space 평타 공격 중 (없으면 move 이미지로 폴백)
    return (isRight ? this.spaceCharImageRight : this.spaceCharImageLeft)
      ?? (isRight ? this.moveImageRight : this.moveImageLeft);
  }

  /**
   * Layer 2 렌더: 이펙트 오버레이 (공격 중에만 호출)
   *
   * effectAnimation.getCurrentFrame() 의 현재 프레임을 사용.
   *
   * 종류         | 위치/크기                  | 비고
   * ------------ | -------------------------- | --------------------
   * space 평타   | 플레이어 중심, 450×450px   | 회전 없음
   * qwer 스킬   | 플레이어 전방, 3.5× 배율   | 진행 방향으로 회전
   */
  private renderEffectOverlay(ctx: CanvasRenderingContext2D): void {
    const effectKey = this.currentSkill ?? "space";
    const effectImg = this.effectImages[effectKey];
    const effectFrame = this.effectAnimation.getCurrentFrame();

    if (!effectImg || !effectFrame) return;

    if (this.currentSkill) {
      this.renderSkillEffect(ctx, effectImg, effectFrame);
    } else {
      this.renderSpaceEffect(ctx, effectImg, effectFrame);
    }
  }

  /**
   * space 평타 이펙트 렌더.
   * 크기/위치를 조정하려면 effectSize 값을 변경하세요.
   */
  private renderSpaceEffect(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | HTMLCanvasElement,
    frame: { x: number; y: number; width: number; height: number },
  ): void {
    const effectSize = 450; // ← 크기 조정 포인트
    ctx.save();
    ctx.drawImage(
      img,
      frame.x, frame.y, frame.width, frame.height,
      -effectSize / 2, -effectSize / 2, effectSize, effectSize,
    );
    ctx.restore();
  }

  /**
   * qwer 스킬 이펙트 렌더.
   * 스케일·오프셋을 조정하려면 아래 두 상수를 변경하세요.
   */
  private renderSkillEffect(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | HTMLCanvasElement,
    frame: { x: number; y: number; width: number; height: number },
  ): void {
    const SCALE_FACTOR = 3.5; // ← 이펙트 크기 배율
    const FORWARD_SHIFT = 0.7; // ← 전방 이동 거리 (플레이어 width 기준 비율)

    const scale = (this.width * SCALE_FACTOR) / Math.max(frame.width, frame.height);
    const effectW = frame.width * scale;
    const effectH = frame.height * scale;
    const fDir = this.getFacingVector();
    const angle = Math.atan2(fDir.y, fDir.x);

    ctx.save();
    ctx.rotate(angle);
    ctx.translate(this.width * FORWARD_SHIFT, 0);
    ctx.drawImage(
      img,
      frame.x, frame.y, frame.width, frame.height,
      -effectW / 2, -effectH / 2, effectW, effectH,
    );
    ctx.restore();
  }

  /**
   * Layer 3 렌더: 피격 애니메이션 (action/damage-*.png)
   *
   * 상태     | 사용 이미지                | 애니메이션 이름
   * -------- | -------------------------- | -------------------------
   * 피격 중  | action/damage-left.png    | char_damage_{방향}
   *          | action/damage-right.png   |
   */
  private renderDamageSprite(ctx: CanvasRenderingContext2D): void {
    const isRight = this.direction === "right" || this.direction === "down";
    const damageImg = isRight ? this.damageImageRight : this.damageImageLeft;
    const frame = this.damageAnimation.getCurrentFrame();

    if (!damageImg || !damageImg.complete || damageImg.naturalWidth === 0 || !frame) return;

    ctx.save();
    ctx.drawImage(
      damageImg,
      frame.x, frame.y, frame.width, frame.height,
      -this.width / 2, -this.height / 2, this.width, this.height,
    );
    ctx.restore();
  }

  private renderHpBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 80;
    const barHeight = 10;
    const yOffset = -this.height / 2 - 30;

    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

    const pct = Math.max(0, this.hp / this.maxHp);
    const grad = ctx.createLinearGradient(-barWidth / 2, 0, barWidth / 2, 0);
    grad.addColorStop(0, "#c80000"); // 짙은 빨강
    grad.addColorStop(1, "#8b0000"); // 더 짙은 빨강
    ctx.fillStyle = grad;
    ctx.fillRect(-barWidth / 2 + 1, yOffset + 1, (barWidth - 2) * pct, barHeight - 2);

    ctx.fillStyle = "white";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${Math.ceil(this.hp)} / ${this.maxHp}`, 0, yOffset - 6);
  }

  /**
   * zone 맵 충돌을 적용한 이동.
   * zoneMap.isWalkableAtWorld()로 다음 위치를 검증 후 반영.
   *
   * 현재 위치 자체가 이동 불가 영역이면 8방향으로 탈출 시도 (끼임 방지).
   */
  private applyMovement(deltaTime: number): void {
    const vx = this.velocity.x * deltaTime;
    const vy = this.velocity.y * deltaTime;

    if (this.zoneMap) {
      const config = getZoneConfig(1);
      const offset = config.gameplayConfig.collisionYOffset;
      const walkableArea = config.openWorldMapConfig?.walkableArea;
      const MARGIN = 50;

      // ── 현재 위치 자체가 막혀 있으면 탈출 시도 (초기 끼임·순간이동 등) ──
      if (!this.zoneMap.isWalkableAtWorld(this.position.x, this.position.y + offset, 0)) {
        const ESCAPE_STEP = 20;
        const dirs = [
          { dx: 0, dy: -ESCAPE_STEP },
          { dx: 0, dy: ESCAPE_STEP },
          { dx: -ESCAPE_STEP, dy: 0 },
          { dx: ESCAPE_STEP, dy: 0 },
          { dx: -ESCAPE_STEP, dy: -ESCAPE_STEP },
          { dx: ESCAPE_STEP, dy: -ESCAPE_STEP },
          { dx: -ESCAPE_STEP, dy: ESCAPE_STEP },
          { dx: ESCAPE_STEP, dy: ESCAPE_STEP },
        ];
        for (const d of dirs) {
          const ex = this.position.x + d.dx;
          const ey = this.position.y + d.dy;
          if (this.zoneMap.isWalkableAtWorld(ex, ey + offset, 0)) {
            this.position.x = ex;
            this.position.y = ey;
            break;
          }
        }
      }

      if (vx !== 0 || vy !== 0) {
        const nx = this.position.x + vx;
        const ny = this.position.y + vy;
        if (this.zoneMap.isWalkableAtWorld(nx, ny + offset, 0)) {
          this.position.x = nx;
          this.position.y = ny;
        } else if (this.zoneMap.isWalkableAtWorld(nx, this.position.y + offset, 0)) {
          this.position.x = nx;
        } else if (this.zoneMap.isWalkableAtWorld(this.position.x, ny + offset, 0)) {
          this.position.y = ny;
        }
      }

      if (walkableArea) {
        this.position.x = Math.max(walkableArea.minX + MARGIN, Math.min(walkableArea.maxX - MARGIN, this.position.x));
        this.position.y = Math.max(walkableArea.minY + MARGIN, Math.min(walkableArea.maxY - MARGIN, this.position.y));
      }
    } else {
      this.position.x += vx;
      this.position.y += vy;
    }
  }


  private updateDirection(moveX: number, moveY: number): void {
    if (moveY < 0) {
      this.direction = moveX < 0 ? "left" : moveX > 0 ? "right" : "left";
    } else if (moveY > 0) {
      this.direction = moveX < 0 ? "left" : moveX > 0 ? "right" : "down";
    } else {
      if (moveX < 0) this.direction = "left";
      else if (moveX > 0) this.direction = "right";
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// ❗ 이미지 교체 가이드
// ─────────────────────────────────────────────────────────────────────────────
// [Layer 1 - 캐릭터 스프라이트]
//   이동        : public/assets/main/player/action/move-left.png, move-right.png
//   space 공격  : public/assets/main/player/action/space-left.png, space-right.png
//   qwer 스킬   : public/assets/main/player/action/skills-left.png, skills-right.png
//
// [Layer 2 - 이펙트 오버레이]
//   space 이펙트: public/assets/main/player/skills/space/q-1~5.png
//   q 스킬 이펙트: public/assets/main/player/skills/q/q-1~5.png
//   (프레임 수 변경 시 PlayerManager.ts SKILL_FRAME_URLS 수정)
// ─────────────────────────────────────────────────────────────────────────────
