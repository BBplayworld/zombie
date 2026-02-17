import { Camera } from './useCamera'
import { Player } from './usePlayer'
import { Monster } from './useMonster'
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
  public monsters: Monster[] = []
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

    // 줌 방지 이벤트 (Ctrl + 휠, Ctrl + +/-/0)
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
      }
    });

    // 챕터 설정 로드
    const chapterConfig = getChapterConfig(this.currentChapter)

    // 시스템 초기화 (챕터 설정 사용)
    this.camera = new Camera(canvas.width, canvas.height)
    this.tileMap = new TileMap(chapterConfig.tileMapConfig)

    // 플레이어 시작 위치 설정
    if (chapterConfig.tileMapConfig.mapBoundary) {
      // 통맵(이미지 맵) 사용 시, (0,0)을 중앙으로 가정하고 시작
      this.player = new Player(0, 0)
    } else {
      // 그리드 맵 사용 시, startPosition 그리드 좌표를 월드 좌표로 변환
      const startPos = this.tileMap.getWorldPosition(
        chapterConfig.mapData.startPosition.x,
        chapterConfig.mapData.startPosition.y
      )
      this.player = new Player(startPos.x, startPos.y)
    }

    this.inputManager = new InputManager()
    this.inputManager.onKeyDown('Space', () => {
      if (this.state === 'playing') {
        this.player.attack()
      }
    })
    this.resourceLoader = new ResourceLoader()
  }

  /**
   * 게임 리소스 로드
   */
  async loadResources(): Promise<void> {
    this.state = 'loading'

    this.state = 'loading'

    // 챕터 설정 로드
    const chapterConfig = getChapterConfig(this.currentChapter)

    // 에셋 설정 가져오기
    const imageMap: Record<string, string> = { ...chapterConfig.assetConfig }

    // 몬스터 이미지 추가
    chapterConfig.monsters.forEach(m => {
      imageMap[m.id] = m.imagePath
    })

    await this.resourceLoader.loadImages(imageMap)

    // 이미지를 타일맵에 설정
    this.tileMap.setImages(this.resourceLoader.getImages())
    this.tileMap.setBaseTile('baseTile')

    // 맵 데이터 로드
    // 외부 JSON 파일이 있으면 로드 시도
    try {
      const response = await fetch('/assets/chapter-1/map/map-data.json')
      if (response.ok) {
        const jsonMap = await response.json()
        // JSON 데이터가 있으면 그걸 사용 (tiles는 0/1 배열이어야 함)
        // jsonMap.tiles가 number[][] 라고 가정
        console.log('Loaded external map data:', jsonMap.width, 'x', jsonMap.height)

        // 맵 데이터 적용
        this.tileMap.loadMapData(
          jsonMap.tiles,
          jsonMap.width,
          jsonMap.height
        )
      } else {
        throw new Error('Map json not found')
      }
    } catch (e) {
      console.warn('Failed to load external map data, using default config:', e)
      this.tileMap.loadMapData(
        chapterConfig.mapData.tiles,
        chapterConfig.mapData.width,
        chapterConfig.mapData.height
      )
    }

    // 플레이어에게 타일맵 설정
    this.player.setTileMap(this.tileMap)

    // 플레이어 스프라이트 이미지 설정
    const playerSprite = this.resourceLoader.getImage('player')
    if (playerSprite) {
      this.player.setSpriteImage(playerSprite)
    }

    const fightSprite = this.resourceLoader.getImage('fight')
    if (fightSprite) {
      this.player.setFightImage(fightSprite)
    }

    // 몬스터 스폰
    this.spawnMonsters()

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
   * 몬스터 스폰
   */


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

    // 몬스터 업데이트 & 리젠 관리
    const config = getChapterConfig(this.currentChapter)
    const targetCount = config.gameplayConfig.monsterConfig?.spawnCount || 0

    // 죽은 몬스터 제거
    this.monsters = this.monsters.filter(m => !m.isDead)

    // 몬스터 업데이트
    this.monsters.forEach(monster => monster.update(this.deltaTime))

    // 리젠 로직
    // 초기 스폰이 끝난 후(ready 상태 아님), playing 상태에서만 동작
    if (this.state === 'playing') {
      const needed = targetCount - this.monsters.length

      if (needed > 0) {
        // 리젠 타이머 체크
        if (!this.lastRegenCheckTime) {
          this.lastRegenCheckTime = performance.now()
        }

        // 설정된 리젠 시간마다 체크 (기본 1초)
        const regenInterval = (config.gameplayConfig.monsterConfig?.regenTime || 1) * 1000

        if (performance.now() - this.lastRegenCheckTime > regenInterval) {
          this.lastRegenCheckTime = performance.now()
          // 즉시 스폰
          this.spawnMonsters(needed)
        }
      }
    }

    // 카메라 업데이트
    this.camera.follow(this.player.position)

    // 타일맵 업데이트 (보이는 타일만)
    this.tileMap.updateVisibleTiles(this.camera)
  }

  private lastRegenCheckTime: number = 0;
  private initialSpawnComplete: boolean = false

  /**
   * 몬스터 스폰
   */
  private spawnMonsters(countToSpawn: number = 0): void {
    const config = getChapterConfig(this.currentChapter)

    let targetCount = 0

    if (countToSpawn === 0) {
      // 초기 스폰 호출
      if (this.initialSpawnComplete) return
      this.initialSpawnComplete = true
      targetCount = config.gameplayConfig.monsterConfig?.spawnCount || 0
    } else {
      // 리젠 호출
      targetCount = countToSpawn
    }

    if (targetCount <= 0) return

    let count = 0
    let attempts = 0
    // 무한 루프 방지
    const maxAttempts = targetCount * 50
    const boundary = config.tileMapConfig.mapBoundary

    // 스폰 가능 영역에 여유 공간 추가 (경계에서 100px 안쪽)
    const SPAWN_MARGIN = 100

    while (count < targetCount && attempts < maxAttempts) {
      attempts++

      let spawnX = 0
      let spawnY = 0

      if (boundary) {
        // 경계가 있으면 경계 내에서 랜덤 좌표 생성 (마진 적용)
        const safeMinX = boundary.minX + SPAWN_MARGIN
        const safeMaxX = boundary.maxX - SPAWN_MARGIN
        const safeMinY = boundary.minY + SPAWN_MARGIN
        const safeMaxY = boundary.maxY - SPAWN_MARGIN

        spawnX = safeMinX + Math.random() * (safeMaxX - safeMinX)
        spawnY = safeMinY + Math.random() * (safeMaxY - safeMinY)
      } else {
        // 경계가 없으면 맵 데이터 그리드 기반 (fallback)
        const mapData = config.mapData
        const gx = Math.floor(Math.random() * mapData.width)
        const gy = Math.floor(Math.random() * mapData.height)
        const wPos = this.tileMap.gridToWorld(gx, gy)
        spawnX = wPos.x
        spawnY = wPos.y
      }

      // 해당 위치가 이동 가능한지 확인 (엄격한 체크, buffer 0)
      if (this.tileMap.isWalkableAtWorld(spawnX, spawnY, 0)) {
        // 플레이어 현재 위치와 안전 거리 확보 (500px)
        const distToPlayer = Math.sqrt(
          Math.pow(spawnX - this.player.position.x, 2) +
          Math.pow(spawnY - this.player.position.y, 2)
        )

        // 플레이어 바로 옆이면 스킵
        if (distToPlayer < 500) continue

        // 몬스터 종류 랜덤 선택
        const monsterConfigs = config.monsters
        if (!monsterConfigs || monsterConfigs.length === 0) continue

        const mConfig = monsterConfigs[Math.floor(Math.random() * monsterConfigs.length)]

        // 몬스터 생성 (ID는 유니크하게)
        const uniqueId = `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const monster = new Monster(uniqueId, spawnX, spawnY, mConfig)
        monster.setTileMap(this.tileMap)

        // 이미지 설정
        const monImg = this.resourceLoader.getImage(mConfig.id)

        if (monImg) monster.setSpriteImage(monImg)

        this.monsters.push(monster)
        count++
      }
    }
    if (count > 0) console.log(`Spawned ${count} monsters.`)
  }
  /**
   * 게임 렌더링
   */
  private render(): void {
    // 화면 클리어
    this.ctx.fillStyle = '#111'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.save()

    // 1. 타일맵 렌더링 (맵 내부)
    this.tileMap.render(this.ctx, this.camera)

    // 2. 엔티티 렌더링 (플레이어 + 몬스터) - Y축 정렬 (Z-Sorting)
    // Y좌표가 작을수록(멀수록) 먼저 그려야 함 -> 오름차순 정렬
    const entities = [this.player, ...this.monsters]
    entities.sort((a, b) => a.position.y - b.position.y)

    const playerImage = this.resourceLoader.getImage('player')
    const monsterImage = this.resourceLoader.getImage('monster')

    entities.forEach(entity => {
      if (entity instanceof Player) {
        // 플레이어 렌더링
        const screenPos = this.camera.worldToScreen(entity.position.x, entity.position.y)
        // Player.render는 ctx, image, sx, sy를 받음
        entity.render(this.ctx, playerImage, screenPos.x, screenPos.y)
      } else if (entity instanceof Monster) {
        // 몬스터 렌더링
        if (monsterImage) entity.setSpriteImage(monsterImage)
        // Monster.render는 ctx, camera를 받음
        entity.render(this.ctx, this.camera)
      }
    })

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
