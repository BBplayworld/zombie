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

  // 전투 상태
  public isAttacking: boolean = false
  private fightImage: HTMLImageElement | null = null

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

        const lookAhead = 20
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

  private setupAnimations(): void {
    const frameWidth = 341
    const frameHeight = 341

    // Walk animations
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

    // Idle animations
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

    // Attack animations (assuming same grid layout for fight.png)
    this.spriteAnimation.addAnimation({
      name: 'attack_down',
      frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 3, 3), // Using 3 frames for attack
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

    // Row 3: Attack Up (if available, otherwise re-use Left/Right or specific logic)
    // Assuming standard 4-dir might use row 3 for UP if 5 rows exist?
    // Let's assume Row 3 is UP.
    this.spriteAnimation.addAnimation({
      name: 'attack_up',
      frames: createFramesFromGrid(0, frameHeight * 3, frameWidth, frameHeight, 5, cols),
      frameRate: 12,
      loop: false
    })
  }

  // ... existing code ...

  attack(): void {
    if (this.isAttacking) return

    this.isAttacking = true
    this.isMoving = false // Stop moving when attacking
    this.velocity.x = 0
    this.velocity.y = 0

    // Up might use a dedicated row if we configured it, otherwise fallback
    let dir = this.direction
    if (dir === 'up') dir = 'up' // use explicit up animation

    // If we didn't add 'attack_up' to animations list (which I did in previous step), 
    // we need to make sure we use it.
    // However, setupAnimations() added 'attack_down', 'attack_left', 'attack_right'.
    // setFightImage() added 'attack_up'.

    // If fight image is not loaded yet, we might crash if we try to play 'attack_up'. 
    // But attack() checks isAttacking logic.

    const animName = `attack_${dir}`
    this.spriteAnimation.playOnce(animName, () => {
      this.isAttacking = false
      // Return to idle animation
      const idleAnim = `idle_${this.direction === 'up' ? 'left' : this.direction}`
      this.spriteAnimation.play(idleAnim)
    })
  }

  update(deltaTime: number = 0.016): void {
    // Attack state update
    if (this.isAttacking) {
      this.spriteAnimation.update(deltaTime)
      return
    }

    // ... existing movement logic ...
    const oldX = this.position.x
    const oldY = this.position.y

    if (this.tileMap) {
      const config = getChapterConfig(1)
      const offset = config.gameplayConfig.collisionYOffset
      const allowance = config.gameplayConfig.collisionAllowance || 0
      const timeScale = deltaTime * 60

      const moveX = this.velocity.x * timeScale
      const nextX = this.position.x + moveX

      if (this.tileMap.isWalkableAtWorld(nextX, this.position.y + offset, allowance)) {
        this.position.x = nextX
      }

      const moveY = this.velocity.y * timeScale
      const nextY = this.position.y + moveY

      if (this.tileMap.isWalkableAtWorld(this.position.x, nextY + offset, allowance)) {
        this.position.y = nextY
      }

      // 맵 경계 강제 적용 (빨간 네모 밖으로 절대 나가지 못하게)
      const boundary = config.tileMapConfig.mapBoundary
      if (boundary) {
        const BOUNDARY_MARGIN = 50 // 경계에서 50px 안쪽까지만 허용

        if (this.position.x < boundary.minX + BOUNDARY_MARGIN) {
          this.position.x = boundary.minX + BOUNDARY_MARGIN
        }
        if (this.position.x > boundary.maxX - BOUNDARY_MARGIN) {
          this.position.x = boundary.maxX - BOUNDARY_MARGIN
        }
        if (this.position.y < boundary.minY + BOUNDARY_MARGIN) {
          this.position.y = boundary.minY + BOUNDARY_MARGIN
        }
        if (this.position.y > boundary.maxY - BOUNDARY_MARGIN) {
          this.position.y = boundary.maxY - BOUNDARY_MARGIN
        }
      }
    } else {
      const timeScale = deltaTime * 60
      this.position.x += this.velocity.x * timeScale
      this.position.y += this.velocity.y * timeScale
    }

    if (this.isMoving) {
      const animName = `walk_${this.direction}`
      this.spriteAnimation.play(animName)
    } else {
      const animName = `idle_${this.direction === 'up' ? 'left' : this.direction}`
      this.spriteAnimation.play(animName)
    }

    this.spriteAnimation.update(deltaTime)
  }

  render(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement | undefined,
    screenX: number,
    screenY: number
  ): void {
    ctx.save()
    ctx.translate(screenX, screenY)

    // Use fight image if attacking, otherwise normal sprite image
    const currentImage = (this.isAttacking && this.fightImage) ? this.fightImage : (this.spriteImage || image)

    if (currentImage && currentImage.complete && currentImage.naturalWidth !== 0) {
      const frame = this.spriteAnimation.getCurrentFrame()

      if (frame) {
        ctx.drawImage(
          currentImage,
          frame.x, frame.y, frame.width, frame.height,
          -this.width / 2, -this.height / 2, this.width, this.height
        )
      }
    }
    // Fallback: 빨간 원
    else {
      ctx.fillStyle = '#ff4444'
      // ... existing fallback ...
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

    ctx.restore()
  }
}
