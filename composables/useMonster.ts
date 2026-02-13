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
    private state: 'wander' | 'chase' | 'idle' = 'wander'
    private stateTimer: number = 0
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
            const allowance = 0
            const offset = config.gameplayConfig.collisionYOffset

            let nextX = this.position.x + moveX
            let nextY = this.position.y + moveY

            // 1. X축 이동 시도
            if (this.tileMap?.isWalkableAtWorld(nextX, this.position.y + offset, allowance)) {
                this.position.x = nextX
            } else {
                // X축 막힘 -> 멈추기
                this.velocity.x = 0
            }

            // 2. Y축 이동 시도
            if (this.tileMap?.isWalkableAtWorld(this.position.x, nextY + offset, allowance)) {
                this.position.y = nextY
            } else {
                // Y축 막힘 -> 멈추기
                this.velocity.y = 0
            }

            // 만약 둘 다 막혀서 움직이지 못했거나 velocity가 0이 되었다면 상태 전환
            if (this.velocity.x === 0 && this.velocity.y === 0) {
                this.stateTimer = 0
                this.state = 'idle'
                this.isMoving = false
            } else {
                // 화면 밖으로 나가는 것 방지 (안전 장치)
                if (this.tileMap && !this.tileMap.isInBounds(this.position.x, this.position.y)) {
                    // 강제로 멈춤
                    this.velocity.x = 0
                    this.velocity.y = 0
                    this.state = 'idle'
                    this.isMoving = false
                }
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
        if (this.stateTimer <= 0) {
            // 상태 전환
            if (this.state === 'idle') {
                this.state = 'wander'
                this.stateTimer = 2 + Math.random() * 2 // 2~4초 이동

                // 랜덤 방향 설정
                const angle = Math.random() * Math.PI * 2
                const speed = this.speed
                this.velocity.x = Math.cos(angle) * speed
                this.velocity.y = Math.sin(angle) * speed

                // 방향 설정
                this.updateDirection(this.velocity.x, this.velocity.y)
                this.isMoving = true
            } else {
                this.state = 'idle'
                this.stateTimer = 1 + Math.random() * 2 // 1~3초 대기
                this.velocity.x = 0
                this.velocity.y = 0
                this.isMoving = false
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

    render(ctx: CanvasRenderingContext2D, camera: any): void { // Camera type any 임시
        if (this.isDead) return

        // 화면 좌표 계산
        const screenX = this.position.x - camera.position.x + ctx.canvas.width / 2
        const screenY = this.position.y - camera.position.y + ctx.canvas.height / 2

        // 화면 밖이면 렌더링 스킵 (최적화)
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
