import { Vector2 } from './useGameMath'
import { SpriteAnimation, createFramesFromGrid } from './useSpriteAnimation'
import { TileMap } from './useTileMap'
import { getChapterConfig, type MonsterDetailConfig } from './useChapterConfig'

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
    private state: 'wander' | 'chase' | 'idle' | 'return' = 'wander'
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

    constructor(id: string, x: number, y: number, config: MonsterDetailConfig) {
        this.id = id
        this.position = new Vector2(x, y)
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
        this.spriteAnimation.addAnimation({
            name: 'walk_right',
            frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 3, 3),
            frameRate: 6
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
    }

    setSpriteImage(image: HTMLImageElement): void {
        this.spriteImage = image
    }

    setTileMap(tileMap: TileMap): void {
        this.tileMap = tileMap
    }

    update(deltaTime: number): void {
        if (this.isDead) return

        // AI 업데이트
        this.updateAI(deltaTime)

        // 위치 업데이트
        if (this.isMoving) {
            const timeScale = deltaTime * 60
            const moveX = this.velocity.x * timeScale
            const moveY = this.velocity.y * timeScale

            const config = getChapterConfig(1)
            // 몬스터는 allowance 없이 엄격하게 체크
            const allowance = 0
            const offset = config.gameplayConfig.collisionYOffset

            let nextX = this.position.x + moveX
            let nextY = this.position.y + moveY

            // 1. X축 이동 시도
            if (this.tileMap?.isWalkableAtWorld(nextX, this.position.y + offset, allowance)) {
                this.position.x = nextX
            } else {
                this.velocity.x = 0
            }

            // 2. Y축 이동 시도
            if (this.tileMap?.isWalkableAtWorld(this.position.x, nextY + offset, allowance)) {
                this.position.y = nextY
            } else {
                this.velocity.y = 0
            }

            // 3. 맵 경계 강제 적용 (빨간 네모 밖으로 절대 나가지 못하게)
            const boundary = config.tileMapConfig.mapBoundary
            if (boundary) {
                const BOUNDARY_MARGIN = 50 // 경계에서 50px 안쪽까지만 허용

                if (this.position.x < boundary.minX + BOUNDARY_MARGIN) {
                    this.position.x = boundary.minX + BOUNDARY_MARGIN
                    this.velocity.x = 0
                }
                if (this.position.x > boundary.maxX - BOUNDARY_MARGIN) {
                    this.position.x = boundary.maxX - BOUNDARY_MARGIN
                    this.velocity.x = 0
                }
                if (this.position.y < boundary.minY + BOUNDARY_MARGIN) {
                    this.position.y = boundary.minY + BOUNDARY_MARGIN
                    this.velocity.y = 0
                }
                if (this.position.y > boundary.maxY - BOUNDARY_MARGIN) {
                    this.position.y = boundary.maxY - BOUNDARY_MARGIN
                    this.velocity.y = 0
                }
            }

            // 막혔을 경우
            if (this.velocity.x === 0 && this.velocity.y === 0) {
                // 막히면 바로 상태 전환
                this.stateTimer = 0
                this.isMoving = false
            }
        }

        // 애니메이션 업데이트
        if (this.isMoving) {
            const animName = `walk_${this.direction}`
            this.spriteAnimation.play(animName)
        } else {
            const animName = `idle_${this.direction === 'up' ? 'left' : this.direction}`
            this.spriteAnimation.play(animName)
        }
        this.spriteAnimation.update(deltaTime)
    }

    private updateAI(dt: number): void {
        this.stateTimer -= dt

        // 상태 전환 로직
        if (this.stateTimer <= 0) {
            if (this.state === 'idle') {
                const distToSpawn = Math.sqrt(
                    Math.pow(this.position.x - this.spawnOrigin.x, 2) +
                    Math.pow(this.position.y - this.spawnOrigin.y, 2)
                )

                // 거리가 100px 이상이면 60% 확률로 복귀 시도, 아니면 랜덤 배회
                if (distToSpawn > 100 && Math.random() < 0.6) {
                    this.state = 'return'
                    if (!this.moveTarget) this.moveTarget = new Vector2(0, 0)
                    this.moveTarget.x = this.spawnOrigin.x
                    this.moveTarget.y = this.spawnOrigin.y

                    this.stateTimer = 5 // 복귀는 넉넉하게 5초
                } else {
                    this.state = 'wander'

                    // 배회 목표 지점 설정 (맵 경계 내에서만)
                    const config = getChapterConfig(1)
                    const boundary = config.tileMapConfig.mapBoundary
                    const WANDER_MARGIN = 150 // 경계에서 150px 안쪽

                    let tx = this.spawnOrigin.x
                    let ty = this.spawnOrigin.y

                    if (boundary) {
                        // 스폰 위치 주변 300px 반경 내 랜덤 타겟 (경계 제한 적용)
                        const angle = Math.random() * Math.PI * 2
                        const dist = Math.random() * 300
                        tx = this.spawnOrigin.x + Math.cos(angle) * dist
                        ty = this.spawnOrigin.y + Math.sin(angle) * dist

                        // 경계를 벗어나면 경계 내로 클램핑
                        const safeMinX = boundary.minX + WANDER_MARGIN
                        const safeMaxX = boundary.maxX - WANDER_MARGIN
                        const safeMinY = boundary.minY + WANDER_MARGIN
                        const safeMaxY = boundary.maxY - WANDER_MARGIN

                        tx = Math.max(safeMinX, Math.min(safeMaxX, tx))
                        ty = Math.max(safeMinY, Math.min(safeMaxY, ty))
                    } else {
                        // 경계가 없으면 기존 로직 사용
                        const angle = Math.random() * Math.PI * 2
                        const dist = Math.random() * 300
                        tx = this.spawnOrigin.x + Math.cos(angle) * dist
                        ty = this.spawnOrigin.y + Math.sin(angle) * dist
                    }

                    if (!this.moveTarget) this.moveTarget = new Vector2(0, 0)
                    this.moveTarget.x = tx
                    this.moveTarget.y = ty

                    this.stateTimer = 3 // 배회 이동은 3초 제한
                }
                this.isMoving = true
            } else {
                // Wander/Return 끝 -> Idle
                this.state = 'idle'
                this.stateTimer = 1 + Math.random() * 2 // 1~3초 대기
                this.velocity.x = 0
                this.velocity.y = 0
                this.isMoving = false
            }
        }

        // 이동 로직 (목표 지점으로 이동)
        if (this.isMoving && this.moveTarget) {
            const dx = this.moveTarget.x - this.position.x
            const dy = this.moveTarget.y - this.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            // 근접하면 도착 처리
            if (dist < 5) {
                this.position.x = this.moveTarget.x
                this.position.y = this.moveTarget.y
                this.velocity.x = 0
                this.velocity.y = 0
                this.stateTimer = 0 // 즉시 다음 상태(Idle)로 전환
                this.isMoving = false
            } else {
                if (this.speed > 0) {
                    this.velocity.x = (dx / dist) * this.speed
                    this.velocity.y = (dy / dist) * this.speed
                }
                this.updateDirection(this.velocity.x, this.velocity.y)
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

    render(ctx: CanvasRenderingContext2D, camera: any): void {
        if (this.isDead) return

        // 화면 좌표 계산
        const screenX = this.position.x - camera.position.x + ctx.canvas.width / 2
        const screenY = this.position.y - camera.position.y + ctx.canvas.height / 2

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
    }
}
