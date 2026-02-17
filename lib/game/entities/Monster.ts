import { Vector2 } from '../utils/math'
import { SpriteAnimation, createFramesFromGrid } from '../systems/SpriteAnimation'
import { TileMap } from '../systems/TileMap'
import { getChapterConfig } from '../config/chapters'
import type { MonsterDetailConfig } from '../config/types'

export class Monster {
    public position: Vector2
    public velocity: Vector2
    public width: number
    public height: number
    public speed: number
    public angle: number
    public id: string

    // 상태
    public isMoving: boolean = false
    public isDead: boolean = false
    public direction: 'idle' | 'up' | 'down' | 'left' | 'right' = 'down'

    // AI 상태
    private state: 'wander' | 'chase' | 'idle' | 'return' | 'wait' = 'wander'
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

    constructor(id: string, x: number, y: number, config: MonsterDetailConfig) {
        this.id = id
        this.position = new Vector2(x, y)
        this.lastValidPosition = new Vector2(x, y) // Initialize
        this.spawnOrigin = new Vector2(x, y)
        this.moveTarget = new Vector2(x, y)
        this.velocity = new Vector2(0, 0)
        // 설정 저장
        this.config = config

        // 몬스터 크기는 플레이어보다 약간 작거나 같게 설정
        this.width = 150
        this.height = 150
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
            return // Skip this frame
        }

        // AI 업데이트 (State & Target decision)
        this.updateAI(deltaTime)

        // 위치 업데이트 & 이동 로직
        if (this.isMoving && this.moveTarget) {
            const dx = this.moveTarget.x - this.position.x
            const dy = this.moveTarget.y - this.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            // 2. 도착 체크
            if (dist < 5) {
                // 도착 완료
                this.position.x = this.moveTarget.x
                this.position.y = this.moveTarget.y
                this.velocity.x = 0
                this.velocity.y = 0
                this.isMoving = false
                this.stateTimer = 0 // AI가 즉시 다음 행동 결정하도록 (Wait or Return)
            } else {
                // 3. 이동 처리
                if (this.speed > 0) {
                    this.velocity.x = (dx / dist) * this.speed
                    this.velocity.y = (dy / dist) * this.speed
                }

                // 4. 플레이어 충돌 회피 (Repulsion)
                // Need access to player position. Currently Monster doesn't know about Player explicitly?
                // MonsterManager passes player position to update? No.
                // We might need to handle this in MonsterManager or pass player to update?
                // But `update` signature is fixed. 
                // Let's defer strict collision to MonsterManager or assumes simple overlapping check?
                // Wait, user asked to handle it here. 
                // We don't have player reference here.
                // We'll skip this part for now and implement it in MonsterManager.updateAll or similar, 
                // OR just inject player into Update if possible. 
                // Actually `GameEngine` calls `monsterManager.updateAll(dt)`. 
                // We can modify `updateAll` to pass player.
                // For now, let's stick to movement logic first.

                this.updateDirection(this.velocity.x, this.velocity.y)

                const timeScale = deltaTime * 60
                const moveX = this.velocity.x * timeScale
                const moveY = this.velocity.y * timeScale

                const config = getChapterConfig(1)
                const allowance = 0
                const offset = config.gameplayConfig.collisionYOffset

                let nextX = this.position.x + moveX
                let nextY = this.position.y + moveY

                // X축 이동 & 충돌 체크
                if (this.tileMap?.isWalkableAtWorld(nextX, this.position.y + offset, allowance)) {
                    this.position.x = nextX
                } else {
                    this.velocity.x = 0 // Blocked
                }

                // Y축 이동 & 충돌 체크
                if (this.tileMap?.isWalkableAtWorld(this.position.x, nextY + offset, allowance)) {
                    this.position.y = nextY
                } else {
                    this.velocity.y = 0 // Blocked
                }

                // 3. 맵 경계 강제 적용
                const walkableArea = config.openWorldMapConfig.walkableArea
                if (walkableArea) {
                    const BOUNDARY_MARGIN = 50
                    // Feet offset might be needed for boundary too? 
                    // Usually boundary rect covers the whole "walkable ground".
                    // Assuming position.y is sufficient or we should clamp feet? 
                    // Let's stick to simple clamp for now but ensure we don't clamp into void.

                    if (this.position.x < walkableArea.minX + BOUNDARY_MARGIN) this.position.x = walkableArea.minX + BOUNDARY_MARGIN
                    if (this.position.x > walkableArea.maxX - BOUNDARY_MARGIN) this.position.x = walkableArea.maxX - BOUNDARY_MARGIN
                    if (this.position.y < walkableArea.minY + BOUNDARY_MARGIN) this.position.y = walkableArea.minY + BOUNDARY_MARGIN
                    if (this.position.y > walkableArea.maxY - BOUNDARY_MARGIN) this.position.y = walkableArea.maxY - BOUNDARY_MARGIN
                }

                // 4. Stuck Check
                // If velocity was expected but we didn't move effectively?
                // Or simplified: If collision zeroed our velocity
                if (this.velocity.x === 0 && this.velocity.y === 0) {
                    // Blocked
                    this.stateTimer = 0
                    this.isMoving = false
                    this.state = 'idle' // Force idle
                }
            }
        }

        // Update Last Valid Position (Success)
        this.lastValidPosition.x = this.position.x
        this.lastValidPosition.y = this.position.y

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
            this.position.x += nx * force
            this.position.y += ny * force
            // Note: Use tileMap check here ideally, but for now simple push
        }
    }

    private updateDirection(vx: number, vy: number): void {
        if (Math.abs(vx) > Math.abs(vy)) {
            this.direction = vx > 0 ? 'right' : 'left'
        } else {
            this.direction = vy > 0 ? 'down' : 'up' // up은 left 애니메이션 사용
        }
    }

    render(ctx: CanvasRenderingContext2D, camera: any): void {
        if (this.isDead) return

        // 화면 좌표 계산 (Camera.worldToScreen과 동일하게)
        const screenX = this.position.x - camera.position.x
        const screenY = this.position.y - camera.position.y

        // 화면 밖이면 렌더링 스킵 (최적화)
        // 넉넉하게 200px 여유
        if (screenX < -200 || screenX > ctx.canvas.width + 200 ||
            screenY < -200 || screenY > ctx.canvas.height + 200) {
            return
        }

        ctx.save()
        ctx.translate(screenX, screenY)

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

        // Debug: Draw logical position (pivot)
        // const screenPos = camera.worldToScreen(this.position.x, this.position.y)
        // ctx.save()
        // ctx.fillStyle = 'red'
        // ctx.beginPath()
        // ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2)
        // ctx.fill()
        // ctx.restore()

        // Debug: Show coordinates above monster
        ctx.fillStyle = 'white'
        ctx.font = '12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`(${Math.floor(this.position.x)}, ${Math.floor(this.position.y)})`, 0, -this.height / 2 - 10)
    }
}
