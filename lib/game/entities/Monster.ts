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

    // 스프라이트 애니메이션
    private spriteAnimation: SpriteAnimation
    private spriteImage: HTMLImageElement | null = null

    // 타일맵 참조
    private tileMap: TileMap | null = null

    // 상세 설정
    private config: MonsterDetailConfig

    private lastValidPosition: Vector2

    /** 쿼터뷰: 목표 지점으로 보간 이동 (MoveTowards) */
    private static readonly ARRIVAL_DISTANCE = 3

    constructor(id: string, x: number, y: number, config: MonsterDetailConfig) {
        this.id = id
        this.position = new Vector2(x, y)
        this.lastValidPosition = new Vector2(x, y) // Initialize
        this.spawnOrigin = new Vector2(x, y)
        this.moveTarget = new Vector2(x, y)
        this.velocity = new Vector2(0, 0)

        // HP 설정
        this.stats = config.stats || { Vigor: 5, Spirit: 5, Might: 5, Agility: 5, Luck: 5 }
        const vigorHp = this.stats.Vigor * 20
        this.maxHp = config.hp || vigorHp || 100
        this.hp = this.maxHp
        // 설정 저장
        this.config = config

        // 몬스터 크기는 플레이어보다 약간 작거나 같게 설정
        this.width = 110
        this.height = 110
        this.speed = config.moveSpeed
        this.angle = 0

        this.spriteAnimation = new SpriteAnimation()
        this.setupAnimations()
    }

    // 플레이어와 동일한 스프라이트 구조 가정 (3x3)
    private setupAnimations(): void {
        const frameWidth = 341
        const frameHeight = 341

        this.spriteAnimation.addAnimation({
            name: 'walk_down',
            frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 3, 3),
            frameRate: 6
        })
        this.spriteAnimation.addAnimation({
            name: 'walk_left',
            frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3),
            frameRate: 6
        })
        const walkLeftFrames = createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3)
        // Map UP to LEFT
        this.spriteAnimation.addAnimation({
            name: 'walk_up',
            frames: walkLeftFrames,
            frameRate: 6
        })
        this.spriteAnimation.addAnimation({
            name: 'walk_right',
            frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 3, 3),
            frameRate: 6
        })

        // Idle Animations
        const idleDown = createFramesFromGrid(0, 0, frameWidth, frameHeight, 1, 3)[0]
        const idleLeft = createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 1, 3)[0]
        const idleRight = createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 1, 3)[0]

        this.spriteAnimation.addAnimation({ name: 'idle_down', frames: [idleDown], frameRate: 1 })
        this.spriteAnimation.addAnimation({ name: 'idle_left', frames: [idleLeft], frameRate: 1 })
        this.spriteAnimation.addAnimation({ name: 'idle_right', frames: [idleRight], frameRate: 1 })
        // Map UP to LEFT explicitly
        this.spriteAnimation.addAnimation({ name: 'idle_up', frames: [idleLeft], frameRate: 1 })
    }

    setSpriteImage(image: HTMLImageElement): void {
        this.spriteImage = image
    }

    setTileMap(tileMap: TileMap): void {
        this.tileMap = tileMap
    }

    update(deltaTime: number): void {
        if (this.isDead) return

        // 1. Safety Check: Position Validity (NaN reset to LAST KNOWN)
        if (isNaN(this.position.x) || isNaN(this.position.y)) {
            console.warn(`[Monster ${this.id}] NaN detected! Restoring to last valid: (${this.lastValidPosition.x}, ${this.lastValidPosition.y})`)
            this.position.x = this.lastValidPosition.x
            this.position.y = this.lastValidPosition.y
            this.velocity.x = 0
            this.velocity.y = 0
            this.isMoving = false
            this.isMoving = false
            return // Skip this frame
        }

        if (this.state === 'dying') {
            this.stateTimer -= deltaTime
            if (this.stateTimer <= 0) {
                this.isDead = true
            }
            return
        }

        // AI 업데이트 (State & Target decision)
        this.updateAI(deltaTime)

        // 위치 업데이트 & 이동 로직
        if (this.isMoving && this.moveTarget) {
            const dx = this.moveTarget.x - this.position.x
            const dy = this.moveTarget.y - this.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            // 도착 시 목표로 스냅 & 다음 AI 판단
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
                    const BOUNDARY_MARGIN = 50
                    if (this.position.x < walkableArea.minX + BOUNDARY_MARGIN) this.position.x = walkableArea.minX + BOUNDARY_MARGIN
                    if (this.position.x > walkableArea.maxX - BOUNDARY_MARGIN) this.position.x = walkableArea.maxX - BOUNDARY_MARGIN
                    if (this.position.y < walkableArea.minY + BOUNDARY_MARGIN) this.position.y = walkableArea.minY + BOUNDARY_MARGIN
                    if (this.position.y > walkableArea.maxY - BOUNDARY_MARGIN) this.position.y = walkableArea.maxY - BOUNDARY_MARGIN
                }

            }
        } else if (this.velocity.x !== 0 || this.velocity.y !== 0) {
            const cfg = getChapterConfig(1)
            const off = cfg.gameplayConfig.collisionYOffset
            const timeScale = deltaTime * 60
            const nextX = this.position.x + this.velocity.x * timeScale
            const nextY = this.position.y + this.velocity.y * timeScale
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

        // 5. 이동 가능 영역 이탈 방지: 어디서든 이동가능 영역 밖이면 마지막 유효 위치로 복귀
        const config = getChapterConfig(1)
        const offset = config.gameplayConfig?.collisionYOffset ?? 80
        if (this.tileMap && !this.tileMap.isWalkableAtWorld(this.position.x, this.position.y + offset, 0)) {
            this.position.x = this.lastValidPosition.x
            this.position.y = this.lastValidPosition.y
        } else {
            this.lastValidPosition.x = this.position.x
            this.lastValidPosition.y = this.position.y
        }

        // 애니메이션 업데이트
        if (this.isMoving) {
            const animName = `walk_${this.direction}`
            this.spriteAnimation.play(animName)
        } else {
            // Now we have idle_up, so we can just use direction
            const animName = `idle_${this.direction}`
            this.spriteAnimation.play(animName)
        }
        this.spriteAnimation.update(deltaTime)
    }

    // 5. Player Collision Check (Blocking)
    // Note: checking collision against player if passed
    // This is handled by external call or if we inject player. 
    // Since we can't easily change signature in this tool block without updating callers...
    // Wait, I will modify the signature in this step.
    // But for now, let's keep `update` simple and handle collision in a separate public method `checkPlayerCollision`
    // which GameEngine or MonsterManager calls.
    public checkPlayerCollision(playerX: number, playerY: number): void {
        const dx = this.position.x - playerX
        const dy = this.position.y - playerY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = 100

        if (dist < minDist && dist > 0) {
            this.collisionEach(dx, dy, minDist)
        }
    }

    public resolveMonsterCollision(other: Monster): void {
        const dx = this.position.x - other.position.x
        const dy = this.position.y - other.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = 80 // Minimum separation distance (Adjust based on size)

        if (dist < minDist && dist > 0) {
            this.collisionEach(dx, dy, minDist)
        }
    }

    private collisionEach(dx: number, dy: number, minDist: number): void {
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Push apart (Separation)
        const overlap = minDist - dist
        const nx = dx / dist
        const ny = dy / dist

        // Soft separation: adjust position slightly
        const separationFactor = 0.05 // Tune this for smoothness

        const moveX = nx * overlap * separationFactor
        const moveY = ny * overlap * separationFactor

        // Check if the pushed position is valid BEFORE applying
        const config = getChapterConfig(1)
        const offset = config.gameplayConfig.collisionYOffset || 80

        // Try X axis
        if (this.tileMap?.isWalkableAtWorld(this.position.x + moveX, this.position.y + offset, 0)) {
            this.position.x += moveX
        }

        // Try Y axis (using potentially updated X)
        if (this.tileMap?.isWalkableAtWorld(this.position.x, this.position.y + moveY + offset, 0)) {
            this.position.y += moveY
        }
    }

    private updateAI(dt: number): void {
        this.stateTimer -= dt

        // 상태 전환 로직: Idle -> Wander -> Wait -> Return -> (Loop)
        if (this.stateTimer <= 0) {
            if (this.state === 'idle') {
                // START WANDER
                this.state = 'wander'

                // 배회 목표 지점 설정
                const config = getChapterConfig(1)
                const walkableArea = config.openWorldMapConfig.walkableArea
                const WANDER_MARGIN = 150

                let tx = this.spawnOrigin.x
                let ty = this.spawnOrigin.y

                // Random point around Spawn
                const angle = Math.random() * Math.PI * 2
                const dist = 100 + Math.random() * 200 // 100~300px distance
                tx = this.spawnOrigin.x + Math.cos(angle) * dist
                ty = this.spawnOrigin.y + Math.sin(angle) * dist

                if (walkableArea) {
                    const safeMinX = walkableArea.minX + WANDER_MARGIN
                    const safeMaxX = walkableArea.maxX - WANDER_MARGIN
                    const safeMinY = walkableArea.minY + WANDER_MARGIN
                    const safeMaxY = walkableArea.maxY - WANDER_MARGIN

                    tx = Math.max(safeMinX, Math.min(safeMaxX, tx))
                    ty = Math.max(safeMinY, Math.min(safeMaxY, ty))
                }

                // Validate target walkability (use Feet offset)
                const offset = config.gameplayConfig.collisionYOffset || 80
                if (this.tileMap && !this.tileMap.isWalkableAtWorld(tx, ty + offset, 50)) {
                    this.state = 'idle' // Retry idle if invalid
                    this.stateTimer = 1
                    this.isMoving = false
                    return
                }

                if (!this.moveTarget) this.moveTarget = new Vector2(0, 0)
                this.moveTarget.x = tx
                this.moveTarget.y = ty

                this.stateTimer = 4 // Max wander time
                this.isMoving = true

            } else if (this.state === 'wander') {
                // Arrived or Timed out -> WAIT
                this.state = 'wait' // New temporary state implies 'Wait before return'
                this.stateTimer = 1 + Math.random() * 2 // Wait 1-3s
                this.isMoving = false

            } else if (this.state === 'wait') { // Fallback for wait
                // WAIT finished -> RETURN to Spawn
                this.state = 'return'

                if (!this.moveTarget) this.moveTarget = new Vector2(0, 0)
                this.moveTarget.x = this.spawnOrigin.x
                this.moveTarget.y = this.spawnOrigin.y

                this.stateTimer = 5 // Max return time
                this.isMoving = true

            } else if (this.state === 'return') {
                // Return finished -> IDLE
                this.state = 'idle'
                this.stateTimer = 2 + Math.random() * 3
                this.isMoving = false
            }
        }
    }

    // Public method to handle external collision/push
    public pushFrom(otherX: number, otherY: number, force: number): void {
        const dx = this.position.x - otherX
        const dy = this.position.y - otherY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 0) {
            const nx = dx / dist
            const ny = dy / dist

            // Try explicit movement with collision check
            const moveX = nx * force
            const moveY = ny * force
            const config = getChapterConfig(1)
            const offset = config.gameplayConfig.collisionYOffset || 80

            // X축 이동
            if (this.tileMap?.isWalkableAtWorld(this.position.x + moveX, this.position.y + offset, 0)) {
                this.position.x += moveX
            }

            // Y축 이동
            if (this.tileMap?.isWalkableAtWorld(this.position.x, this.position.y + moveY + offset, 0)) {
                this.position.y += moveY
            }
        }
    }

    private updateDirection(vx: number, vy: number): void {
        if (Math.abs(vx) > Math.abs(vy)) {
            this.direction = vx > 0 ? 'right' : 'left'
        } else {
            this.direction = vy > 0 ? 'down' : 'up' // up은 left 애니메이션 사용
        }
    }

    public takeDamage(amount: number): void {
        if (this.isDead || this.state === 'dying') return

        this.hp -= amount
        if (this.hp <= 0) {
            this.hp = 0
            this.state = 'dying'
            this.stateTimer = 0.5 // 0.5초 동안 사망 애니메이션 (페이드아웃/깜빡임 등)
            this.isMoving = false
            this.velocity.x = 0
            this.velocity.y = 0
        }
    }

    render(ctx: CanvasRenderingContext2D, camera: any): void {
        if (this.isDead) return

        // 화면 좌표: 반드시 camera.worldToScreen 사용 (scale 반영, 플레이어 움직임과 무관)
        const screenPos = camera.worldToScreen(this.position.x, this.position.y)
        const screenX = screenPos.x
        const screenY = screenPos.y

        // 화면 밖이면 렌더링 스킵 (최적화)
        if (screenX < -200 || screenX > ctx.canvas.width + 200 ||
            screenY < -200 || screenY > ctx.canvas.height + 200) {
            return
        }

        ctx.save()
        ctx.translate(screenX, screenY)

        // 1. Shadow (Natural connection with map)
        ctx.save()
        ctx.scale(1.2, 0.4) // Squashed ellipse
        ctx.beginPath()
        ctx.arc(0, (this.height / 2) * 0.9, 30, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.shadowBlur = 10
        ctx.shadowColor = 'black'
        ctx.fill()
        ctx.restore()

        // Dying effect: fade out or flash
        if (this.state === 'dying') {
            const alpha = Math.max(0, this.stateTimer / 0.5)
            ctx.globalAlpha = alpha
            // Optional: flash red
            if (Math.floor(Date.now() / 100) % 2 === 0) {
                ctx.filter = 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)' // Red tint
            }
        }

        if (this.spriteImage && this.spriteImage.complete) {
            const frame = this.spriteAnimation.getCurrentFrame()
            if (frame) {
                ctx.drawImage(
                    this.spriteImage,
                    frame.x, frame.y, frame.width, frame.height,
                    -this.width / 2, -this.height / 2, this.width, this.height
                )
            }
        } else {
            // Fallback: 녹색 원
            ctx.fillStyle = 'green'
            ctx.beginPath()
            ctx.arc(0, 0, 30, 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.restore()

        // Health Bar
        if (this.state !== 'dying') {
            const barWidth = 60
            const barHeight = 8
            const yOffset = -this.height / 2 - 20

            ctx.save()
            // Translate to top of monster
            ctx.translate(screenX, screenY)

            ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
            ctx.shadowBlur = 4
            ctx.shadowOffsetX = 2
            ctx.shadowOffsetY = 2

            // Background
            ctx.fillStyle = 'black'
            ctx.fillRect(-barWidth / 2, yOffset, barWidth, barHeight)

            // HP
            const hpPercent = Math.max(0, this.hp / this.maxHp)
            ctx.fillStyle = 'red'
            ctx.fillRect(-barWidth / 2 + 1, yOffset + 1, (barWidth - 2) * hpPercent, barHeight - 2)

            // Text
            ctx.fillStyle = 'white'
            ctx.font = 'bold 11px monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'alphabetic'
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
            ctx.shadowBlur = 4
            ctx.shadowOffsetX = 2
            ctx.shadowOffsetY = 2
            ctx.fillText(`${Math.ceil(this.hp)} / ${this.maxHp}`, 0, yOffset - 5)

            ctx.restore()
        }
    }
}
