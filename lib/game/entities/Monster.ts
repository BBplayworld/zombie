import { Vector2 } from '../utils/math'
import { SpriteAnimation, createFramesFromGrid } from '../systems/SpriteAnimation'
import { TileMap } from '../systems/TileMap'
import { getChapterConfig } from '../config/chapters'
import type { MonsterDetailConfig, EntityStats } from '../config/types'

export class Monster {
    public position: Vector2
    public velocity: Vector2
    public width: number
    public height: number
    public speed: number
    public angle: number
    public id: string
    public hp: number
    public maxHp: number
    public stats: EntityStats

    // 상태
    public isMoving: boolean = false
    public isDead: boolean = false
    public direction: 'idle' | 'up' | 'down' | 'left' | 'right' = 'down'

    // AI 상태
    private state: 'wander' | 'chase' | 'idle' | 'return' | 'wait' | 'dying' = 'wander'
    private stateTimer: number = 0
    public spawnOrigin: Vector2
    private moveTarget: Vector2 | null = null

    // ── 피격/반격 상태 ──────────────────────────────────
    /** 피격 경직 타이머: 0보다 크면 이동 불가 */
    private hitStunTimer: number = 0
    private static readonly HIT_STUN_DURATION = 0.4  // 초

    /** 반격 관련 */
    private counterAttackTimer: number = 0    // 반격 쿨다운
    private isCounterAttacking: boolean = false
    private counterAttackDuration: number = 0
    public counterAttackDamage: number = 0   // 외부에서 읽음 (GameEngine)

    private static readonly COUNTER_COOLDOWN = 2.0  // 반격 최소 간격(초)
    private static readonly COUNTER_DURATION = 0.5  // 반격 애니메이션 지속(초)
    private static readonly COUNTER_RANGE = 120  // 반격 사거리(px)
    private static readonly COUNTER_DAMAGE_MUL = 0.6  // 공격력 × 이 비율 = 반격 데미지

    // 스프라이트 애니메이션
    private spriteAnimation: SpriteAnimation
    private spriteImage: HTMLImageElement | null = null
    private fightImage: HTMLImageElement | null = null   // 반격 스프라이트

    // 타일맵 참조
    private tileMap: TileMap | null = null

    // 상세 설정
    private config: MonsterDetailConfig

    private lastValidPosition: Vector2

    /** 쿼터뷰: 목표 지점으로 보간 이동 */
    private static readonly ARRIVAL_DISTANCE = 3

    constructor(id: string, x: number, y: number, config: MonsterDetailConfig) {
        this.id = id
        this.position = new Vector2(x, y)
        this.lastValidPosition = new Vector2(x, y)
        this.spawnOrigin = new Vector2(x, y)
        this.moveTarget = new Vector2(x, y)
        this.velocity = new Vector2(0, 0)

        this.stats = config.stats || { Vigor: 5, Spirit: 5, Might: 5, Agility: 5, Luck: 5 }
        const vigorHp = this.stats.Vigor * 20
        this.maxHp = config.hp || vigorHp || 100
        this.hp = this.maxHp
        this.config = config

        // 반격 데미지 계산 (Might 기반)
        this.counterAttackDamage = Math.max(5, Math.round((this.stats.Might ?? 5) * Monster.COUNTER_DAMAGE_MUL * 3))

        this.width = 110
        this.height = 110
        this.speed = config.moveSpeed
        this.angle = 0

        this.spriteAnimation = new SpriteAnimation()
        this.setupAnimations()
    }

    private setupAnimations(): void {
        const frameWidth = 341
        const frameHeight = 341

        // ── 이동 애니메이션 (3×3 그리드) ─────────────────
        this.spriteAnimation.addAnimation({
            name: 'walk_down', frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 3, 3), frameRate: 6
        })
        this.spriteAnimation.addAnimation({
            name: 'walk_left', frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3), frameRate: 6
        })
        this.spriteAnimation.addAnimation({
            name: 'walk_up', frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3), frameRate: 6
        })
        this.spriteAnimation.addAnimation({
            name: 'walk_right', frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 3, 3), frameRate: 6
        })

        // ── Idle 애니메이션 ──────────────────────────────
        const idleDown = createFramesFromGrid(0, 0, frameWidth, frameHeight, 1, 3)[0]
        const idleLeft = createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 1, 3)[0]
        const idleRight = createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 1, 3)[0]

        this.spriteAnimation.addAnimation({ name: 'idle_down', frames: [idleDown], frameRate: 1 })
        this.spriteAnimation.addAnimation({ name: 'idle_left', frames: [idleLeft], frameRate: 1 })
        this.spriteAnimation.addAnimation({ name: 'idle_right', frames: [idleRight], frameRate: 1 })
        this.spriteAnimation.addAnimation({ name: 'idle_up', frames: [idleLeft], frameRate: 1 })

        // ── 반격 애니메이션 — fight.png 5×5 그리드 ───────
        // fight.png 는 플레이어 fight 스프라이트를 공유: 5열 × 5행
        const fw = 205   // fight.png 프레임 폭 (1025 / 5)
        const fh = 205   // fight.png 프레임 높이 (1025 / 5)
        // 4행 사용 (DOWN 방향 위주로 반격 표현)
        this.spriteAnimation.addAnimation({
            name: 'counter_attack',
            frames: createFramesFromGrid(0, fh * 3, fw, fh, 5, 5),
            frameRate: 12
        })
    }

    setSpriteImage(image: HTMLImageElement): void {
        this.spriteImage = image
    }

    setFightImage(image: HTMLImageElement): void {
        this.fightImage = image
    }

    setTileMap(tileMap: TileMap): void {
        this.tileMap = tileMap
    }

    update(deltaTime: number): void {
        if (this.isDead) return

        // NaN 안전망
        if (isNaN(this.position.x) || isNaN(this.position.y)) {
            this.position.x = this.lastValidPosition.x
            this.position.y = this.lastValidPosition.y
            this.velocity.x = 0
            this.velocity.y = 0
            this.isMoving = false
            return
        }

        if (this.state === 'dying') {
            this.stateTimer -= deltaTime
            if (this.stateTimer <= 0) this.isDead = true
            return
        }

        // ── 피격 경직 타이머 ────────────────────────────
        if (this.hitStunTimer > 0) {
            this.hitStunTimer -= deltaTime
            this.isMoving = false
            this.velocity.x = 0
            this.velocity.y = 0
            // 피격 중에도 반격 카운터 갱신
            this.updateCounterCooldown(deltaTime)
            this.spriteAnimation.update(deltaTime)
            return
        }

        // ── 반격 애니메이션 진행 중 ──────────────────────
        if (this.isCounterAttacking) {
            this.counterAttackDuration -= deltaTime
            if (this.counterAttackDuration <= 0) {
                this.isCounterAttacking = false
            }
            this.isMoving = false
            this.spriteAnimation.play('counter_attack')
            this.spriteAnimation.update(deltaTime)
            return
        }

        // AI 업데이트
        this.updateAI(deltaTime)
        this.updateCounterCooldown(deltaTime)

        // 이동 로직
        if (this.isMoving && this.moveTarget) {
            const dx = this.moveTarget.x - this.position.x
            const dy = this.moveTarget.y - this.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist <= Monster.ARRIVAL_DISTANCE) {
                this.position.x = this.moveTarget.x
                this.position.y = this.moveTarget.y
                this.moveTarget = null
                this.velocity.x = 0
                this.velocity.y = 0
                this.stateTimer = 0
            } else {
                const moveBy = Math.min(this.speed * deltaTime * 60, dist)
                if (moveBy > 0) {
                    this.velocity.x = (dx / dist) * this.speed
                    this.velocity.y = (dy / dist) * this.speed
                    this.updateDirection(this.velocity.x, this.velocity.y)
                    this.position.x += (dx / dist) * moveBy
                    this.position.y += (dy / dist) * moveBy
                }
                const config = getChapterConfig(1)
                const walkableArea = config.openWorldMapConfig.walkableArea
                if (walkableArea) {
                    const M = 50
                    if (this.position.x < walkableArea.minX + M) this.position.x = walkableArea.minX + M
                    if (this.position.x > walkableArea.maxX - M) this.position.x = walkableArea.maxX - M
                    if (this.position.y < walkableArea.minY + M) this.position.y = walkableArea.minY + M
                    if (this.position.y > walkableArea.maxY - M) this.position.y = walkableArea.maxY - M
                }
            }
        } else if (this.velocity.x !== 0 || this.velocity.y !== 0) {
            const cfg = getChapterConfig(1)
            const off = cfg.gameplayConfig.collisionYOffset
            const ts = deltaTime * 60
            const nextX = this.position.x + this.velocity.x * ts
            const nextY = this.position.y + this.velocity.y * ts
            if (this.tileMap?.isWalkableAtWorld(nextX, this.position.y + off, 0)) this.position.x = nextX
            else this.velocity.x = 0
            if (this.tileMap?.isWalkableAtWorld(this.position.x, nextY + off, 0)) this.position.y = nextY
            else this.velocity.y = 0
            const wa = cfg.openWorldMapConfig.walkableArea
            if (wa) {
                const M = 50
                if (this.position.x < wa.minX + M) this.position.x = wa.minX + M
                if (this.position.x > wa.maxX - M) this.position.x = wa.maxX - M
                if (this.position.y < wa.minY + M) this.position.y = wa.minY + M
                if (this.position.y > wa.maxY - M) this.position.y = wa.maxY - M
            }
        }

        if (this.velocity.x === 0 && this.velocity.y === 0 && !this.moveTarget) {
            this.stateTimer = 0
            this.isMoving = false
            this.state = 'idle'
        }

        // 이탈 방지
        const config = getChapterConfig(1)
        const offset = config.gameplayConfig?.collisionYOffset ?? 80
        if (this.tileMap && !this.tileMap.isWalkableAtWorld(this.position.x, this.position.y + offset, 0)) {
            this.position.x = this.lastValidPosition.x
            this.position.y = this.lastValidPosition.y
        } else {
            this.lastValidPosition.x = this.position.x
            this.lastValidPosition.y = this.position.y
        }

        // 애니메이션
        const animName = this.isMoving ? `walk_${this.direction}` : `idle_${this.direction}`
        this.spriteAnimation.play(animName)
        this.spriteAnimation.update(deltaTime)
    }

    private updateCounterCooldown(deltaTime: number): void {
        if (this.counterAttackTimer > 0) this.counterAttackTimer -= deltaTime
    }

    /**
     * 피격 처리 — 경직 + 반격 트리거
     * @returns 반격이 발동됐으면 true
     */
    public takeDamage(amount: number): boolean {
        if (this.isDead || this.state === 'dying') return false

        this.hp -= amount
        if (this.hp <= 0) {
            this.hp = 0
            this.state = 'dying'
            this.stateTimer = 0.5
            this.isMoving = false
            this.velocity.x = 0
            this.velocity.y = 0
            return false
        }

        // 피격 경직 — 이동 중지
        this.hitStunTimer = Monster.HIT_STUN_DURATION
        this.isMoving = false
        this.velocity.x = 0
        this.velocity.y = 0
        this.moveTarget = null

        // 반격 판정 (쿨다운 없으면 50% 확률로 반격)
        if (this.counterAttackTimer <= 0 && Math.random() < 0.5) {
            this.isCounterAttacking = true
            this.counterAttackDuration = Monster.COUNTER_DURATION
            this.counterAttackTimer = Monster.COUNTER_COOLDOWN
            return true   // 반격 발동
        }
        return false
    }

    /**
     * 현재 플레이어 위치가 반격 사거리 내에 있으면 반격 데미지 반환
     * GameEngine 에서 isCounterAttacking && counterAttackTimer 타이밍에 호출
     */
    public tryCounterAttack(playerX: number, playerY: number): number {
        if (!this.isCounterAttacking) return 0
        const dx = playerX - this.position.x
        const dy = playerY - this.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        return dist <= Monster.COUNTER_RANGE ? this.counterAttackDamage : 0
    }

    public checkPlayerCollision(playerX: number, playerY: number): void {
        const dx = this.position.x - playerX
        const dy = this.position.y - playerY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 100 && dist > 0) this.collisionEach(dx, dy, 100)
    }

    public resolveMonsterCollision(other: Monster): void {
        const dx = this.position.x - other.position.x
        const dy = this.position.y - other.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 80 && dist > 0) this.collisionEach(dx, dy, 80)
    }

    private collisionEach(dx: number, dy: number, minDist: number): void {
        const dist = Math.sqrt(dx * dx + dy * dy)
        const overlap = minDist - dist
        const nx = dx / dist
        const ny = dy / dist
        const sf = 0.05
        const moveX = nx * overlap * sf
        const moveY = ny * overlap * sf
        const config = getChapterConfig(1)
        const offset = config.gameplayConfig.collisionYOffset || 80
        if (this.tileMap?.isWalkableAtWorld(this.position.x + moveX, this.position.y + offset, 0))
            this.position.x += moveX
        if (this.tileMap?.isWalkableAtWorld(this.position.x, this.position.y + moveY + offset, 0))
            this.position.y += moveY
    }

    private updateAI(dt: number): void {
        this.stateTimer -= dt
        if (this.stateTimer > 0) return

        if (this.state === 'idle') {
            this.state = 'wander'
            const config = getChapterConfig(1)
            const walkableArea = config.openWorldMapConfig.walkableArea
            const angle = Math.random() * Math.PI * 2
            const dist = 100 + Math.random() * 200
            let tx = this.spawnOrigin.x + Math.cos(angle) * dist
            let ty = this.spawnOrigin.y + Math.sin(angle) * dist
            if (walkableArea) {
                const M = 150
                tx = Math.max(walkableArea.minX + M, Math.min(walkableArea.maxX - M, tx))
                ty = Math.max(walkableArea.minY + M, Math.min(walkableArea.maxY - M, ty))
            }
            const offset = config.gameplayConfig.collisionYOffset || 80
            if (this.tileMap && !this.tileMap.isWalkableAtWorld(tx, ty + offset, 50)) {
                this.state = 'idle'
                this.stateTimer = 1
                this.isMoving = false
                return
            }
            if (!this.moveTarget) this.moveTarget = new Vector2(0, 0)
            this.moveTarget.x = tx
            this.moveTarget.y = ty
            this.stateTimer = 4
            this.isMoving = true

        } else if (this.state === 'wander') {
            this.state = 'wait'
            this.stateTimer = 1 + Math.random() * 2
            this.isMoving = false

        } else if (this.state === 'wait') {
            this.state = 'return'
            if (!this.moveTarget) this.moveTarget = new Vector2(0, 0)
            this.moveTarget.x = this.spawnOrigin.x
            this.moveTarget.y = this.spawnOrigin.y
            this.stateTimer = 5
            this.isMoving = true

        } else if (this.state === 'return') {
            this.state = 'idle'
            this.stateTimer = 2 + Math.random() * 3
            this.isMoving = false
        }
    }

    public pushFrom(otherX: number, otherY: number, force: number): void {
        const dx = this.position.x - otherX
        const dy = this.position.y - otherY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= 0) return
        const nx = dx / dist
        const ny = dy / dist
        const config = getChapterConfig(1)
        const offset = config.gameplayConfig.collisionYOffset || 80
        if (this.tileMap?.isWalkableAtWorld(this.position.x + nx * force, this.position.y + offset, 0))
            this.position.x += nx * force
        if (this.tileMap?.isWalkableAtWorld(this.position.x, this.position.y + ny * force + offset, 0))
            this.position.y += ny * force
    }

    private updateDirection(vx: number, vy: number): void {
        if (Math.abs(vx) > Math.abs(vy)) {
            this.direction = vx > 0 ? 'right' : 'left'
        } else {
            this.direction = vy > 0 ? 'down' : 'up'
        }
    }

    render(ctx: CanvasRenderingContext2D, camera: any): void {
        if (this.isDead) return

        const screenPos = camera.worldToScreen(this.position.x, this.position.y)
        const screenX = screenPos.x
        const screenY = screenPos.y

        if (screenX < -200 || screenX > ctx.canvas.width + 200 ||
            screenY < -200 || screenY > ctx.canvas.height + 200) return

        ctx.save()
        ctx.translate(screenX, screenY)

        // 그림자
        ctx.save()
        ctx.scale(1.2, 0.4)
        ctx.beginPath()
        ctx.arc(0, (this.height / 2) * 0.9, 30, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.shadowBlur = 10
        ctx.shadowColor = 'black'
        ctx.fill()
        ctx.restore()

        // 사망 페이드
        if (this.state === 'dying') {
            ctx.globalAlpha = Math.max(0, this.stateTimer / 0.5)
            if (Math.floor(Date.now() / 100) % 2 === 0)
                ctx.filter = 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)'
        }

        // ── 피격 경직 중 빨간 플래시 ────────────────────
        if (this.hitStunTimer > 0) {
            ctx.filter = 'brightness(3) sepia(1) hue-rotate(-50deg) saturate(8)'
        }

        // ── 반격 중 노란 발광 ────────────────────────────
        if (this.isCounterAttacking) {
            ctx.shadowColor = 'rgba(255, 200, 0, 0.9)'
            ctx.shadowBlur = 24
        }

        // 스프라이트 선택 (반격 중이면 fight.png 사용)
        const useImage = (this.isCounterAttacking && this.fightImage?.complete)
            ? this.fightImage
            : this.spriteImage

        if (useImage?.complete) {
            const frame = this.spriteAnimation.getCurrentFrame()
            if (frame) {
                ctx.drawImage(
                    useImage,
                    frame.x, frame.y, frame.width, frame.height,
                    -this.width / 2, -this.height / 2, this.width, this.height
                )
            }
        } else {
            ctx.fillStyle = 'green'
            ctx.beginPath()
            ctx.arc(0, 0, 30, 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.restore()

        // HP 바
        if (this.state !== 'dying') {
            const barW = 60
            const barH = 8
            const yOff = -this.height / 2 - 20

            ctx.save()
            ctx.translate(screenX, screenY)
            ctx.shadowColor = 'rgba(0,0,0,0.8)'
            ctx.shadowBlur = 4
            ctx.shadowOffsetX = 2
            ctx.shadowOffsetY = 2

            ctx.fillStyle = 'black'
            ctx.fillRect(-barW / 2, yOff, barW, barH)
            const hpPct = Math.max(0, this.hp / this.maxHp)

            // 반격 중이면 노란 테두리 강조
            if (this.isCounterAttacking) {
                ctx.strokeStyle = 'rgba(255,220,0,0.9)'
                ctx.lineWidth = 1.5
                ctx.strokeRect(-barW / 2, yOff, barW, barH)
            }

            ctx.fillStyle = this.hitStunTimer > 0 ? '#ff4444'
                : this.isCounterAttacking ? '#ffcc00'
                    : 'red'
            ctx.fillRect(-barW / 2 + 1, yOff + 1, (barW - 2) * hpPct, barH - 2)

            ctx.fillStyle = 'white'
            ctx.font = 'bold 11px monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'alphabetic'
            ctx.fillText(`${Math.ceil(this.hp)} / ${this.maxHp}`, 0, yOff - 5)

            // 반격 중 아이콘
            if (this.isCounterAttacking) {
                ctx.fillStyle = 'rgba(255,220,50,0.95)'
                ctx.font = 'bold 12px monospace'
                ctx.fillText('⚔', 0, yOff - 18)
            }

            ctx.restore()
        }
    }
}
