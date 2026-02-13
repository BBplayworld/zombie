import { Camera } from './useCamera'
import { Player } from './usePlayer'
import { TileMap } from './useTileMap'
import { InputManager } from './useInputManager'
import { ResourceLoader } from './useResourceLoader'
import { getChapterConfig } from './useChapterConfig'

/**
 * 게임 엔진 클래스
 * 모든 게임 시스템을 통합 관리
 */
export class GameEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private camera: Camera
  private player: Player
  private tileMap: TileMap
  private inputManager: InputManager
  public resourceLoader: ResourceLoader

  // 게임 상태
  public state: 'loading' | 'ready' | 'playing' | 'paused' = 'loading'

  // 게임 루프
  private animationFrameId: number | null = null
  private lastFrameTime: number = 0
  private deltaTime: number = 0

  // FPS 추적
  private fps: number = 0
  private frameCount: number = 0
  private fpsUpdateTime: number = 0

  // 챕터 설정
  private currentChapter: number = 1

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D context')
    }
    this.ctx = ctx

    // 챕터 설정 로드
    const chapterConfig = getChapterConfig(this.currentChapter)

    // 시스템 초기화 (챕터 설정 사용)
    this.camera = new Camera(canvas.width, canvas.height)
    this.tileMap = new TileMap(chapterConfig.tileMapConfig)

    // 플레이어 시작 위치를 그리드 좌표에서 월드 좌표로 변환
    const startPos = this.tileMap.getWorldPosition(
      chapterConfig.mapData.startPosition.x,
      chapterConfig.mapData.startPosition.y
    )
    this.player = new Player(startPos.x, startPos.y)

    this.inputManager = new InputManager()
    this.resourceLoader = new ResourceLoader()
  }

  /**
   * 게임 리소스 로드
   */
  async loadResources(): Promise<void> {
    this.state = 'loading'

    const imageMap = {
      baseTile: '/zombie/assets/base-tile.png',        // 이동 가능한 길
      backgroundTile: '/zombie/assets/base-tile2.png', // 배경 타일
      player: '/zombie/assets/player.png',
    }

    await this.resourceLoader.loadImages(imageMap)

    // 챕터 설정 로드
    const chapterConfig = getChapterConfig(this.currentChapter)

    // 이미지를 타일맵에 설정
    this.tileMap.setImages(this.resourceLoader.getImages())
    this.tileMap.setBaseTile('baseTile')

    // 맵 데이터 로드
    this.tileMap.loadMapData(
      chapterConfig.mapData.tiles,
      chapterConfig.mapData.width,
      chapterConfig.mapData.height
    )

    // 플레이어에게 타일맵 설정
    this.player.setTileMap(this.tileMap)

    // 플레이어 스프라이트 이미지 설정
    const playerSprite = this.resourceLoader.getImage('player')
    if (playerSprite) {
      this.player.setSpriteImage(playerSprite)
    }

    console.log('All resources loaded!')
    console.log(`Chapter ${this.currentChapter}: ${chapterConfig.name}`)
    console.log(`Map size: ${chapterConfig.mapData.width}x${chapterConfig.mapData.height}`)
    this.state = 'ready'

    // 초기 카메라 위치 설정 및 렌더링 (ready 상태에서도 캐릭터 보이도록)
    this.camera.follow(this.player.position, true)
    this.tileMap.updateVisibleTiles(this.camera)
    this.player.update(0) // 초기 애니메이션 상태 설정
    this.render()
  }

  /**
   * 게임 시작
   */
  start(): void {
    if (this.state === 'ready') {
      this.state = 'playing'
      this.lastFrameTime = performance.now()
      this.gameLoop(this.lastFrameTime)
    }
  }

  /**
   * 게임 루프
   */
  private gameLoop = (currentTime: number): void => {
    if (this.state !== 'playing') return

    // Delta time 계산
    this.deltaTime = (currentTime - this.lastFrameTime) / 1000
    this.lastFrameTime = currentTime

    // FPS 계산
    this.frameCount++
    if (currentTime - this.fpsUpdateTime >= 1000) {
      this.fps = this.frameCount
      this.frameCount = 0
      this.fpsUpdateTime = currentTime
    }

    // 업데이트 & 렌더링
    this.update()
    this.render()

    requestAnimationFrame(this.gameLoop)
  }

  /**
   * 게임 상태 업데이트
   */
  private update(): void {
    // 입력 처리
    const input = this.inputManager.getMovementInput()
    this.player.move(input.x, input.y)

    // 플레이어 업데이트
    this.player.update(this.deltaTime)

    // 카메라 업데이트
    this.camera.follow(this.player.position)

    // 타일맵 업데이트 (보이는 타일만)
    this.tileMap.updateVisibleTiles(this.camera)
  }

  /**
   * 게임 렌더링
   */
  private render(): void {
    // 화면 클리어
    this.ctx.fillStyle = '#111'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.save()

    // 1. 타일맵 렌더링 (배경)
    this.tileMap.render(this.ctx, this.camera)

    // 2. 플레이어 렌더링
    const playerScreenPos = this.camera.worldToScreen(
      this.player.position.x,
      this.player.position.y
    )
    const playerImage = this.resourceLoader.getImage('player')
    this.player.render(this.ctx, playerImage, playerScreenPos.x, playerScreenPos.y)

    this.ctx.restore()

    // 3. UI 렌더링 (항상 화면에 고정)
    this.renderUI()
  }

  /**
   * UI 렌더링
   */
  private renderUI(): void {
    // FPS 표시
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    this.ctx.fillRect(10, 10, 200, 120)

    this.ctx.fillStyle = '#fff'
    this.ctx.font = '14px monospace'
    this.ctx.fillText(`FPS: ${this.fps}`, 20, 30)
    this.ctx.fillText(`Player: (${Math.floor(this.player.position.x)}, ${Math.floor(this.player.position.y)})`, 20, 50)
    this.ctx.fillText(`Camera: (${Math.floor(this.camera.position.x)}, ${Math.floor(this.camera.position.y)})`, 20, 70)
    this.ctx.fillText(`State: ${this.state}`, 20, 90)
    this.ctx.fillText(`Moving: ${this.player.isMoving ? 'Yes' : 'No'}`, 20, 110)

    // 조작법
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    this.ctx.fillRect(10, this.canvas.height - 80, 250, 70)

    this.ctx.fillStyle = '#fff'
    this.ctx.font = 'bold 16px sans-serif'
    this.ctx.fillText('조작법', 20, this.canvas.height - 55)
    this.ctx.font = '14px sans-serif'
    this.ctx.fillText('이동: 방향키 또는 WASD', 20, this.canvas.height - 35)
    this.ctx.fillText('ESC: 일시정지', 20, this.canvas.height - 15)
  }

  /**
   * 화면 크기 조정
   */
  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this.camera.resize(width, height)
  }

  /**
   * 일시정지
   */
  pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused'
    }
  }

  /**
   * 재개
   */
  resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing'
      this.lastFrameTime = performance.now()
      this.gameLoop(this.lastFrameTime)
    }
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    this.inputManager.destroy()
    this.resourceLoader.clear()
  }
}
