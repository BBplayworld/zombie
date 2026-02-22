import { Vector2 } from '../utils/math'
import { SpriteAnimation, createFramesFromGrid } from '../systems/SpriteAnimation'
import { TileMap } from '../systems/TileMap'
import { getChapterConfig } from '../config/chapters'
import { EntityStats, ItemData, ItemStatValue, StatType, ItemType } from '../config/types'
import { Item } from './Item'
import { Inventory } from './Inventory'

/**
 * 플레이어 캐릭터 클래스
 */
export class Player {
  public position: Vector2
  public velocity: Vector2
  public width: number
  public height: number
  public speed: number
  public angle: number
  public hp: number = 100
  public maxHp: number = 100
  /** 초당 HP 자동 회복량 (Spirit 파생) */
  public hpRegen: number = 0
  /** HP 회복 누적 타이머 */
  private hpRegenTimer: number = 0

  // 능력치 및 아이템
  public stats: EntityStats = {
    Vigor: 20,
    Spirit: 10,
    Might: 10,
    Agility: 10,
    Luck: 10
  }
  public damage: number = 10
  public critChance: number = 0

  public inventory: Inventory = new Inventory()
  public equipment: Partial<Record<ItemType, Item>> = {}
  public isInventoryOpen: boolean = false

  // 공격 시각 효과
  private attackVisualTimer: number = 0
  private readonly ATTACK_VISUAL_DURATION = 0.3 // 0.3초 동안 범위 표시

  // 애니메이션 상태
  public isMoving: boolean = false
  public direction: 'idle' | 'up' | 'down' | 'left' | 'right' = 'down'

  // 전투 상태
  public isAttacking: boolean = false
  private fightImage: HTMLImageElement | null = null

  // 스프라이트 애니메이션
  private spriteAnimation: SpriteAnimation
  private spriteImage: HTMLImageElement | null = null
  private helmetImage: HTMLImageElement | null = null

  // UI State
  public inventoryMenu: { x: number, y: number, itemIndex: number } | null = null
  public hoveredItem: { item: Item, x: number, y: number } | null = null

  // 타일맵 참조 (이동 제한용)
  private tileMap: TileMap | null = null

  /** 4048 맵에서 칸 단위 이동용 캐릭터 크기 */
  static readonly RECOMMENDED_SIZE_4048 = 150
  /** 한 입력당 이동 거리 = width * 배수 */
  static readonly STEP_SIZE_MULTIPLIER = 2
  /** 이동 속도 (픽셀/초). 4048 맵에서 한 스텝을 약 0.3~0.5초에 이동 */
  static readonly BASE_SPEED = 380

  private moveTarget: Vector2 | null = null
  private static readonly ARRIVAL_DISTANCE = 4

  constructor(x: number = 0, y: number = 0) {
    this.position = new Vector2(x, y)
    this.velocity = new Vector2(0, 0)
    this.width = Player.RECOMMENDED_SIZE_4048
    this.height = Player.RECOMMENDED_SIZE_4048
    this.speed = 0
    this.angle = 0

    // 초기 능력치 기반 HP 설정
    this.updateStats()
    this.hp = this.maxHp

    // 스프라이트 애니메이션 초기화
    this.spriteAnimation = new SpriteAnimation()
    this.setupAnimations()
  }

  /**
   * 스프라이트 이미지 설정
   */
  setSpriteImage(image: HTMLImageElement): void {
    this.spriteImage = image
  }

  setFightImage(image: HTMLImageElement): void {
    this.fightImage = image

    // 전투 이미지를 로드하면 해당 이미지 크기에 맞춰 애니메이션 재설정 (5x5 그리드)
    const totalWidth = image.naturalWidth
    const totalHeight = image.naturalHeight
    const cols = 5
    const rows = 5

    const frameWidth = totalWidth / cols
    const frameHeight = totalHeight / rows

    // Attack animations
    // Row 0: Attack Down
    this.spriteAnimation.addAnimation({
      name: 'attack_down',
      frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 5, cols), // 5 frames
      frameRate: 12,
      loop: false
    })

    // Row 1: Attack Left
    this.spriteAnimation.addAnimation({
      name: 'attack_left',
      frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 5, cols),
      frameRate: 12,
      loop: false
    })

    // Row 2: Attack Right
    this.spriteAnimation.addAnimation({
      name: 'attack_right',
      frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 5, cols),
      frameRate: 12,
      loop: false
    })

    // Row 3: Attack Up
    this.spriteAnimation.addAnimation({
      name: 'attack_up',
      frames: createFramesFromGrid(0, frameHeight * 3, frameWidth, frameHeight, 5, cols),
      frameRate: 12,
      loop: false
    })
  }

  setHelmetImage(image: HTMLImageElement): void {
    this.helmetImage = image
  }

  /**
   * 타일맵 설정
   */
  setTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap
  }

  /**
   * 능력치 업데이트 (아이템 장착/해제 시 호출)
   */
  updateStats(): void {
    // 1. 초기화 (기본 스탯)
    const baseStats: EntityStats = {
      Vigor: 10,
      Spirit: 10,
      Might: 10,
      Agility: 10,
      Luck: 10
    }

    const totals: Record<StatType, number> = { ...baseStats }
    const percents: Record<StatType, number> = {
      Vigor: 0, Spirit: 0, Might: 0, Agility: 0, Luck: 0
    }

    // 2. 아이템 옵션 합산
    Object.values(this.equipment).forEach(item => {
      if (!item) return
      Object.entries(item.data.stats).forEach(([key, val]) => {
        const stat = key as StatType
        if (val) {
          totals[stat] += val.flat
          percents[stat] += val.percent
        }
      })
    })

    // 3. 최종 스탯 반영 (퍼센트 적용)
    // Formula: Stat = (Base + Flat) * (1 + Percent)
    this.stats.Vigor = Math.floor(totals.Vigor * (1 + percents.Vigor))
    this.stats.Spirit = Math.floor(totals.Spirit * (1 + percents.Spirit))
    this.stats.Might = Math.floor(totals.Might * (1 + percents.Might))
    this.stats.Agility = Math.floor(totals.Agility * (1 + percents.Agility))
    this.stats.Luck = Math.floor(totals.Luck * (1 + percents.Luck))

    // 4. 파생 능력치 계산 (Derived Stats)

    // Max HP = Base 100 + Vigor * 10
    this.maxHp = 100 + this.stats.Vigor * 10
    if (this.hp > this.maxHp) this.hp = this.maxHp

    this.speed = Player.BASE_SPEED + this.stats.Agility * 0.08

    // Damage = Base 10 + Might * 2
    this.damage = 10 + this.stats.Might * 2

    // Crit Chance = Luck * 0.01 (1%)
    this.critChance = this.stats.Luck * 0.01

    // HP Regen = Spirit * 0.5 (초당 회복량)
    this.hpRegen = this.stats.Spirit * 0.5

    console.log('Updated Stats:', this.stats)
    console.log(`Derived: HP ${this.maxHp}, DMG ${this.damage}, SPD ${this.speed}, CRIT ${this.critChance.toFixed(2)}, Regen ${this.hpRegen.toFixed(1)}/s`)
  }

  getDamage(): { amount: number, isCrit: boolean } {
    const isCrit = Math.random() < this.critChance
    const multiplier = isCrit ? 2.0 : 1.0
    const variance = (Math.random() * 0.2) + 0.9
    const amount = Math.floor(this.damage * multiplier * variance)
    return { amount, isCrit }
  }

  /**
   * 몬스터 반격 등 외부 데미지 수신
   */
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
  }

  /**
   * 아이템 획득 (인벤토리 추가)
   */
  addItem(itemData: ItemData): void {
    const item = new Item(itemData)
    if (this.inventory.add(item)) {
      console.log(`Added to inventory: ${item.data.name}`)

      // Auto-equip if slot is empty (optional feature, good for testing)
      const type = item.data.type
      if (item.isEquipment() && !this.equipment[type]) {
        this.equipItem(item)
      }
    } else {
      console.log('Inventory Full')
    }
  }

  /**
   * 아이템 착용
   */
  equipItem(item: Item): void {
    const type = item.data.type
    const current = this.equipment[type]

    // Swap or Set
    if (current) {
      this.inventory.add(current) // Unequip current
    }

    this.equipment[type] = item

    // Remove from inventory
    this.inventory.remove(item)

    console.log(`Equipped: ${item.data.name}`)
    this.updateStats()
  }

  unequipItem(slot: ItemType): void {
    const current = this.equipment[slot]
    if (current) {
      this.inventory.add(current)
      delete this.equipment[slot]
      console.log(`Unequipped: ${current.data.name}`)
      this.updateStats()
    }
  }

  toggleInventory(): void {
    this.isInventoryOpen = !this.isInventoryOpen
  }

  attack(): void {
    if (this.isAttacking) return

    this.isAttacking = true
    this.isMoving = false
    this.velocity.x = 0
    this.velocity.y = 0

    let dir = this.direction
    if (dir === 'up') dir = 'up'

    const animName = `attack_${dir}`
    this.spriteAnimation.playOnce(animName, () => {
      this.isAttacking = false
      const idleAnim = `idle_${this.direction === 'up' ? 'left' : this.direction}`
      this.spriteAnimation.play(idleAnim)
    })

    this.attackVisualTimer = this.ATTACK_VISUAL_DURATION
  }

  update(deltaTime: number = 0.016): void {
    if (this.attackVisualTimer > 0) {
      this.attackVisualTimer -= deltaTime
    }

    // HP 자동 회복 (전투 중 제외)
    if (!this.isAttacking && this.hpRegen > 0 && this.hp < this.maxHp) {
      this.hpRegenTimer += deltaTime
      // 1초마다 회복 (또는 누적량이 1 이상이면 즉시)
      const regenAmount = this.hpRegen * deltaTime
      this.hp = Math.min(this.maxHp, this.hp + regenAmount)
    }

    if (this.isAttacking) {
      this.spriteAnimation.update(deltaTime)
      return
    }

    if (this.tileMap) {
      const config = getChapterConfig(1)
      const offset = config.gameplayConfig.collisionYOffset
      const walkableArea = config.openWorldMapConfig?.walkableArea
      const BOUNDARY_MARGIN = 50

      const vx = this.velocity.x * deltaTime
      const vy = this.velocity.y * deltaTime
      if (vx !== 0 || vy !== 0) {
        const nextX = this.position.x + vx
        const nextY = this.position.y + vy
        if (this.tileMap.isWalkableAtWorld(nextX, nextY + offset, 0)) {
          this.position.x = nextX
          this.position.y = nextY
        } else if (this.tileMap.isWalkableAtWorld(nextX, this.position.y + offset, 0)) {
          this.position.x = nextX
        } else if (this.tileMap.isWalkableAtWorld(this.position.x, nextY + offset, 0)) {
          this.position.y = nextY
        }
      }

      if (walkableArea) {
        if (this.position.x < walkableArea.minX + BOUNDARY_MARGIN) this.position.x = walkableArea.minX + BOUNDARY_MARGIN
        if (this.position.x > walkableArea.maxX - BOUNDARY_MARGIN) this.position.x = walkableArea.maxX - BOUNDARY_MARGIN
        if (this.position.y < walkableArea.minY + BOUNDARY_MARGIN) this.position.y = walkableArea.minY + BOUNDARY_MARGIN
        if (this.position.y > walkableArea.maxY - BOUNDARY_MARGIN) this.position.y = walkableArea.maxY - BOUNDARY_MARGIN
      }
    } else {
      this.position.x += this.velocity.x * deltaTime
      this.position.y += this.velocity.y * deltaTime
    }

    this.isMoving = this.velocity.x !== 0 || this.velocity.y !== 0
    if (this.isMoving) {
      this.spriteAnimation.play(`walk_${this.direction}`)
    } else {
      this.spriteAnimation.play(`idle_${this.direction === 'up' ? 'left' : this.direction}`)
    }
    this.spriteAnimation.update(deltaTime)
  }

  /**
   * 플레이어 이동 처리. 속도 기반으로 매 프레임 입력을 그대로 반영해 상하·대각선이 부드럽게 동작.
   */
  move(moveX: number, moveY: number): void {
    if (moveX === 0 && moveY === 0) {
      this.velocity.x = 0
      this.velocity.y = 0
      this.moveTarget = null
      return
    }

    const magnitude = Math.sqrt(moveX * moveX + moveY * moveY)
    if (magnitude <= 0) return
    const dirX = moveX / magnitude
    const dirY = moveY / magnitude

    this.velocity.x = dirX * this.speed
    this.velocity.y = dirY * this.speed
    this.angle = Math.atan2(dirY, dirX)
    this.updateDirection(dirX, dirY)
  }

  private updateDirection(moveX: number, moveY: number): void {
    if (moveY < 0) {
      if (moveX < 0) this.direction = 'left'
      else if (moveX > 0) this.direction = 'right'
      else this.direction = 'left'
    } else if (moveY > 0) {
      if (moveX < 0) this.direction = 'left'
      else if (moveX > 0) this.direction = 'right'
      else this.direction = 'down'
    } else {
      if (moveX < 0) this.direction = 'left'
      else if (moveX > 0) this.direction = 'right'
    }
  }

  private setupAnimations(): void {
    const frameWidth = 341
    const frameHeight = 341

    this.spriteAnimation.addAnimation({
      name: 'walk_down',
      frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 3, 3),
      frameRate: 8
    })
    this.spriteAnimation.addAnimation({
      name: 'walk_left',
      frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3),
      frameRate: 8
    })
    this.spriteAnimation.addAnimation({
      name: 'walk_right',
      frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 3, 3),
      frameRate: 8
    })

    this.spriteAnimation.addAnimation({
      name: 'idle_down',
      frames: [createFramesFromGrid(0, 0, frameWidth, frameHeight, 1, 3)[0]],
      frameRate: 1
    })
    this.spriteAnimation.addAnimation({
      name: 'idle_left',
      frames: [createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 1, 3)[0]],
      frameRate: 1
    })
    this.spriteAnimation.addAnimation({
      name: 'idle_right',
      frames: [createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 1, 3)[0]],
      frameRate: 1
    })

    this.spriteAnimation.addAnimation({
      name: 'attack_down',
      frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 3, 3),
      frameRate: 12,
      loop: false
    })
    this.spriteAnimation.addAnimation({
      name: 'attack_left',
      frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3),
      frameRate: 12,
      loop: false
    })
    this.spriteAnimation.addAnimation({
      name: 'attack_right',
      frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 3, 3),
      frameRate: 12,
      loop: false
    })
  }

  render(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement | undefined,
    screenX: number,
    screenY: number
  ): void {
    ctx.save()
    ctx.translate(screenX, screenY)

    // 1. Shadow (Natural connection with map)
    ctx.save()
    ctx.scale(1.2, 0.4) // Squashed ellipse
    ctx.beginPath()
    ctx.arc(0, (this.height / 2) * 1.8, 40, 0, Math.PI * 2) // Adjust Y based on feet position
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.shadowBlur = 10
    ctx.shadowColor = 'black'
    ctx.fill()
    ctx.restore()

    const currentImage = (this.isAttacking && this.fightImage) ? this.fightImage : (this.spriteImage || image)

    if (this.attackVisualTimer > 0) {
      const remainingRatio = this.attackVisualTimer / this.ATTACK_VISUAL_DURATION
      const range = 250
      ctx.save()
      ctx.beginPath()
      ctx.fillStyle = `rgba(255, 50, 50, ${remainingRatio * 0.3})`
      ctx.arc(0, 0, range, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = `rgba(255, 100, 100, ${remainingRatio * 0.8})`
      ctx.stroke()
      ctx.restore()
    }

    if (currentImage && currentImage.complete && currentImage.naturalWidth !== 0) {
      const frame = this.spriteAnimation.getCurrentFrame()

      if (frame) {
        ctx.drawImage(
          currentImage,
          frame.x, frame.y, frame.width, frame.height,
          -this.width / 2, -this.height / 2, this.width, this.height
        )
      }
    } else {
      ctx.fillStyle = '#ff4444'
      ctx.beginPath()
      ctx.arc(0, 0, 25, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(this.angle) * 30, Math.sin(this.angle) * 30)
      ctx.strokeStyle = 'yellow'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // 3. Health Bar (Point #4)
    const barWidth = 80
    const barHeight = 10
    const yOffset = -this.height / 2 - 30

    // Shadow for text/bar (User pointed #2 effect)
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(-barWidth / 2, yOffset, barWidth, barHeight)

    // HP Fill (Gradient or solid)
    const hpPercent = Math.max(0, this.hp / this.maxHp)
    const grad = ctx.createLinearGradient(-barWidth / 2, 0, barWidth / 2, 0)
    grad.addColorStop(0, '#2ecc71')
    grad.addColorStop(1, '#27ae60')
    ctx.fillStyle = grad
    ctx.fillRect(-barWidth / 2 + 1, yOffset + 1, (barWidth - 2) * hpPercent, barHeight - 2)

    // HP Text
    ctx.fillStyle = 'white'
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`${Math.ceil(this.hp)} / ${this.maxHp}`, 0, yOffset - 6)

    ctx.restore()
  }
}
