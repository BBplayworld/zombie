import { Vector2 } from './useGameMath'
import { SpriteAnimation, createFramesFromGrid } from './useSpriteAnimation'
import { TileMap } from './useTileMap'
import { getChapterConfig } from './useChapterConfig'

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

  // 애니메이션 상태
  public isMoving: boolean = false
  public direction: 'idle' | 'up' | 'down' | 'left' | 'right' = 'down'

  // 스프라이트 애니메이션
  private spriteAnimation: SpriteAnimation
  private spriteImage: HTMLImageElement | null = null

  // 타일맵 참조 (이동 제한용)
  private tileMap: TileMap | null = null

  constructor(x: number = 0, y: number = 0) {
    this.position = new Vector2(x, y)
    this.velocity = new Vector2(0, 0)
    this.width = 200
    this.height = 200
    this.speed = 25
    this.angle = 0

    // 스프라이트 애니메이션 초기화
    this.spriteAnimation = new SpriteAnimation()
    this.setupAnimations()
  }

  /**
   * 스프라이트 애니메이션 설정
   * 3x3 그리드: 각 행은 방향(down, left, right), 각 열은 걷기 프레임
   */
  private setupAnimations(): void {
    const frameWidth = 341  // 1024 / 3
    const frameHeight = 341 // 1024 / 3

    // 아래 방향 (첫 번째 행)
    this.spriteAnimation.addAnimation({
      name: 'walk_down',
      frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 3, 3),
      frameRate: 8
    })

    // 왼쪽 방향 (두 번째 행)
    this.spriteAnimation.addAnimation({
      name: 'walk_left',
      frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3),
      frameRate: 8
    })

    // 오른쪽 방향 (세 번째 행)
    this.spriteAnimation.addAnimation({
      name: 'walk_right',
      frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 3, 3),
      frameRate: 8
    })

    // idle 애니메이션 (각 방향의 첫 프레임만 사용)
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

  /**
   * 스프라이트 이미지 설정
   */
  setSpriteImage(image: HTMLImageElement): void {
    this.spriteImage = image
  }

  /**
   * 타일맵 설정
   */
  setTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap
  }

  /**
   * 플레이어 이동 처리
   */
  move(moveX: number, moveY: number): void {
    // 챕터 설정에서 속도 가져오기
    const config = getChapterConfig(1)
    this.speed = config.gameplayConfig.baseSpeed || 15

    // 아이소메트릭 스마트 이동 (Context-Sensitive Blending)
    // 입력 벡터를 4개의 주 방향(TR, BR, BL, TL) 성분으로 분해하고,
    // 이동 가능한 방향의 성분만 합산하여 최종 이동 방향을 결정합니다.
    if (config.gameplayConfig.enableIsoInput) {
      if (Math.abs(moveX) > 0 || Math.abs(moveY) > 0) {
        // 1. 입력 정규화
        const inputMag = Math.sqrt(moveX * moveX + moveY * moveY)
        const nInputX = moveX / inputMag
        const nInputY = moveY / inputMag

        const lookAhead = 40
        const offset = config.gameplayConfig.collisionYOffset
        const allowance = config.gameplayConfig.collisionAllowance || 0

        // 4방향 벡터 (TR, BR, BL, TL) - Screen Space
        const X_COMP = 2 / 2.236 // ~0.894
        const Y_COMP = 1 / 2.236 // ~0.447

        const Dirs = [
          { name: 'TR', vx: X_COMP, vy: -Y_COMP },
          { name: 'BR', vx: X_COMP, vy: Y_COMP },
          { name: 'BL', vx: -X_COMP, vy: Y_COMP },
          { name: 'TL', vx: -X_COMP, vy: -Y_COMP }
        ]

        let resultX = 0
        let resultY = 0
        let possibleCount = 0

        for (const dir of Dirs) {
          const dot = nInputX * dir.vx + nInputY * dir.vy

          if (dot > 0.2) {
            const canGo = this.tileMap?.isWalkableAtWorld(
              this.position.x + dir.vx * lookAhead,
              this.position.y + dir.vy * lookAhead + offset,
              allowance
            )

            if (canGo) {
              const weight = dot
              resultX += dir.vx * weight
              resultY += dir.vy * weight
              possibleCount++
            }
          }
        }

        if (possibleCount > 0) {
          const resMag = Math.sqrt(resultX * resultX + resultY * resultY)
          if (resMag > 0) {
            moveX = resultX
            moveY = resultY
          }
        }
      }
    }

    if (moveX === 0 && moveY === 0) {
      this.isMoving = false
      this.velocity.x = 0
      this.velocity.y = 0
      return
    }

    this.isMoving = true

    // 대각선 이동시 속도 정규화
    const magnitude = Math.sqrt(moveX * moveX + moveY * moveY)
    if (magnitude > 0) {
      moveX /= magnitude
      moveY /= magnitude
    }

    this.velocity.x = moveX * this.speed
    this.velocity.y = moveY * this.speed

    // 이동 방향 업데이트
    this.angle = Math.atan2(moveY, moveX)

    // 8방향 방향 결정 (쿼터뷰용)
    this.updateDirection(moveX, moveY)
  }

  /**
   * 8방향 방향 업데이트
   */
  private updateDirection(moveX: number, moveY: number): void {
    // 위쪽 방향은 왼쪽 애니메이션 사용
    if (moveY < 0) {
      if (moveX < 0) this.direction = 'left'
      else if (moveX > 0) this.direction = 'right'
      else this.direction = 'left' // 위쪽도 왼쪽 애니메이션
    } else if (moveY > 0) {
      if (moveX < 0) this.direction = 'left'
      else if (moveX > 0) this.direction = 'right'
      else this.direction = 'down'
    } else {
      if (moveX < 0) this.direction = 'left'
      else if (moveX > 0) this.direction = 'right'
    }
  }

  /**
   * 플레이어 위치 업데이트
   */
  update(deltaTime: number = 0.016): void {
    // 이동 전 위치 저장
    const oldX = this.position.x
    const oldY = this.position.y

    // 타일맵이 있으면 이동 가능 여부 체크 (이동 가능한 타일만)
    if (this.tileMap) {
      // 챕터 설정에서 값 가져오기
      const config = getChapterConfig(1)
      const offset = config.gameplayConfig.collisionYOffset
      const allowance = config.gameplayConfig.collisionAllowance || 0

      // Delta Time 보정 (60fps 기준)
      // 프레임이 떨어져도 이동 거리를 보정하여 부드럽게 유지
      const timeScale = deltaTime * 60

      // X축 이동 시도 (벽 슬라이딩을 위해 축 분리)
      const moveX = this.velocity.x * timeScale
      const nextX = this.position.x + moveX

      // 현재 Y위치에서 X만 이동했을 때 가능한가? (allowance 적용)
      if (this.tileMap.isWalkableAtWorld(nextX, this.position.y + offset, allowance)) {
        this.position.x = nextX
      }

      // Y축 이동 시도 (X가 이미 이동했을 수 있음 - 자연스러운 슬라이딩)
      const moveY = this.velocity.y * timeScale
      const nextY = this.position.y + moveY

      // 현재 X위치(갱신됨)에서 Y만 이동했을 때 가능한가? (allowance 적용)
      if (this.tileMap.isWalkableAtWorld(this.position.x, nextY + offset, allowance)) {
        this.position.y = nextY
      }
    } else {
      // 타일맵이 없으면 자유롭게 이동 (Delta Time 적용)
      const timeScale = deltaTime * 60
      this.position.x += this.velocity.x * timeScale
      this.position.y += this.velocity.y * timeScale
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

  /**
   * 플레이어 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement | undefined,
    screenX: number,
    screenY: number
  ): void {
    ctx.save()
    ctx.translate(screenX, screenY)

    // 스프라이트 이미지가 있으면 애니메이션 렌더링
    if (this.spriteImage && this.spriteImage.complete && this.spriteImage.naturalWidth !== 0) {
      const frame = this.spriteAnimation.getCurrentFrame()

      if (frame) {
        ctx.drawImage(
          this.spriteImage,
          frame.x, frame.y, frame.width, frame.height,
          -this.width / 2, -this.height / 2, this.width, this.height
        )
      }
    }
    // Fallback: 기존 단일 이미지
    else if (image && image.complete && image.naturalWidth !== 0) {
      ctx.drawImage(
        image,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      )
    }
    // Fallback: 빨간 원
    else {
      ctx.fillStyle = '#ff4444'
      ctx.beginPath()
      ctx.arc(0, 0, 25, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()

      // 방향 표시
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(this.angle) * 30, Math.sin(this.angle) * 30)
      ctx.strokeStyle = 'yellow'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    ctx.restore()
  }
}
