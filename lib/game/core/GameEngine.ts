import { Camera } from '../systems/Camera'
import { Player } from '../entities/Player'
import { TileMap } from '../systems/TileMap'
import { InputManager } from '../systems/InputManager'
import { ResourceLoader } from '../systems/ResourceLoader'
import { MonsterManager } from './MonsterManager'
import { RenderManager } from './RenderManager'
import { ItemDrop } from '../entities/ItemDrop'
import { Item } from '../entities/Item'
import { getChapterConfig } from '../config/chapters'
import { InventoryManager } from './InventoryManager'
import { t } from '../config/Locale'

/**
 * 게임 엔진 클래스
 * 게임의 핵심 시스템을 통합 관리하고 게임 루프를 실행
 */
export class GameEngine {
  // Canvas & Context
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  // Core Systems
  private camera: Camera
  private player: Player
  private tileMap: TileMap
  private inputManager: InputManager
  public resourceLoader: ResourceLoader

  // Managers
  private monsterManager: MonsterManager
  private renderManager: RenderManager
  private inventoryManager: InventoryManager

  // Entities
  private items: ItemDrop[] = []

  // Game State
  public state: 'loading' | 'ready' | 'playing' | 'paused' = 'loading'

  // Game Loop
  private animationFrameId: number | null = null
  private lastFrameTime: number = 0
  private deltaTime: number = 0

  // Configuration
  private currentChapter: number = 1

  /**
   * STEP 1: 생성자 - 기본 시스템 초기화
   */
  constructor(canvas: HTMLCanvasElement) {
    console.log('🎮 [STEP 1] GameEngine Constructor - Initializing core systems...')

    this.canvas = canvas
    this.ctx = this.initializeContext(canvas)
    this.setupZoomPrevention()

    const chapterConfig = getChapterConfig(this.currentChapter)

    // 시스템 초기화
    this.camera = new Camera(canvas.width, canvas.height)
    this.tileMap = new TileMap(chapterConfig.openWorldMapConfig)
    this.player = this.createPlayer(chapterConfig)
    this.inputManager = this.setupInputManager()
    this.resourceLoader = new ResourceLoader()

    // 매니저 초기화
    this.monsterManager = new MonsterManager(this.tileMap, this.resourceLoader)
    this.renderManager = new RenderManager(canvas, this.resourceLoader)
    this.inventoryManager = new InventoryManager(this.player, canvas)

    console.log('✅ [STEP 1] Core systems initialized')
  }

  /**
   * STEP 2: 리소스 로딩 - 게임 에셋 로드
   */
  async loadResources(): Promise<void> {
    console.log('📦 [STEP 2] Loading game resources...')
    this.state = 'loading'

    const chapterConfig = getChapterConfig(this.currentChapter)

    // 2-1. 이미지 리소스 로드
    await this.loadImageResources(chapterConfig)

    // 2-2. 맵 데이터 로드
    await this.loadMapData(chapterConfig)

    // 2-3. 플레이어 초기화
    this.initializePlayer()

    // 2-4. 몬스터 초기 스폰
    this.monsterManager.spawnInitialMonsters(chapterConfig, this.player.position)

    // 2-5. 게임 준비 완료
    this.finalizeGameSetup(chapterConfig)

    console.log('✅ [STEP 2] All resources loaded, game ready!')
  }

  /**
   * STEP 3: 게임 시작 - 게임 루프 실행
   */
  start(): void {
    console.log('🚀 [STEP 3] Starting game loop...')

    if (this.state !== 'ready') {
      console.warn('⚠️ Game is not ready to start. Current state:', this.state)
      return
    }

    this.state = 'playing'
    this.lastFrameTime = performance.now()
    this.gameLoop(this.lastFrameTime)

    console.log('✅ [STEP 3] Game loop started!')
  }

  // ==================== STEP 2 상세 함수들 ====================

  /**
   * STEP 2-1: 이미지 리소스 로드
   */
  private async loadImageResources(chapterConfig: any): Promise<void> {
    console.log('  📸 [STEP 2-1] Loading images...')

    const imageMap: Record<string, string> = { ...chapterConfig.assetConfig }

    // 몬스터 이미지 추가
    chapterConfig.monsters.forEach((m: any) => {
      imageMap[m.id] = m.imagePath
    })

    await this.resourceLoader.loadImages(imageMap)

    // 타일맵에 이미지 설정
    this.tileMap.setImages(this.resourceLoader.getImages())
    this.tileMap.setBaseTile('baseTile')

    console.log('  ✅ [STEP 2-1] Images loaded')
  }

  /**
   * STEP 2-2: 맵 데이터 로드
   */
  private async loadMapData(chapterConfig: any): Promise<void> {
    console.log('  🗺️  [STEP 2-2] Loading map data...')

    try {
      const response = await fetch('/assets/chapter-1/map/map-data.json')
      if (!response.ok) throw new Error('Map json not found')

      const jsonMap = await response.json()
      console.log('  📄 External map data loaded:', jsonMap.width, 'x', jsonMap.height)

      this.tileMap.loadMapData(jsonMap.tiles, jsonMap.width, jsonMap.height)
    } catch (e) {
      console.warn('  ⚠️ Using default config map data')
      this.tileMap.loadMapData(
        chapterConfig.mapData.tiles,
        chapterConfig.mapData.width,
        chapterConfig.mapData.height
      )
    }

    console.log('  ✅ [STEP 2-2] Map data loaded')
  }

  /**
   * STEP 2-3: 플레이어 초기화
   */
  private initializePlayer(): void {
    console.log('  🏃 [STEP 2-3] Initializing player...')

    this.player.setTileMap(this.tileMap)

    const playerSprite = this.resourceLoader.getImage('player')
    if (playerSprite) this.player.setSpriteImage(playerSprite)

    const fightSprite = this.resourceLoader.getImage('fight')
    if (fightSprite) this.player.setFightImage(fightSprite)

    const helmetSprite = this.resourceLoader.getImage('helmet')
    if (helmetSprite) this.player.setHelmetImage(helmetSprite)

    console.log('  ✅ [STEP 2-3] Player initialized')
  }

  /**
   * STEP 2-5: 게임 설정 완료
   */
  private finalizeGameSetup(chapterConfig: any): void {
    console.log('  🎯 [STEP 2-5] Finalizing game setup...')

    this.state = 'ready'

    // 초기 카메라 위치 설정 및 렌더링
    this.camera.follow(this.player.position, true)
    this.tileMap.updateVisibleTiles(this.camera)
    this.player.update(0)
    // First render to show game is ready
    this.renderManager.render(
      this.tileMap,
      this.camera,
      this.player,
      this.monsterManager.monsters,
      this.items, // add items
      this.state,
      this.inventoryManager
    )

    console.log('  ✅ [STEP 2-5] Game setup complete')
    console.log(`  📖 Chapter ${this.currentChapter}: ${chapterConfig.name}`)
    console.log(`  📐 Map size: ${chapterConfig.mapData.width}x${chapterConfig.mapData.height}`)
  }

  // ==================== 게임 루프 ====================

  /**
   * 게임 루프 - 매 프레임 실행
   */
  private gameLoop = (currentTime: number): void => {
    if (this.state !== 'playing') return

    // Delta time 계산
    this.deltaTime = (currentTime - this.lastFrameTime) / 1000
    this.lastFrameTime = currentTime

    // FPS 계산
    this.renderManager.updateFPS(currentTime)

    // 업데이트 & 렌더링
    this.update(currentTime)
    this.renderManager.render(
      this.tileMap,
      this.camera,
      this.player,
      this.monsterManager.monsters,
      this.items, // add items
      this.state,
      this.inventoryManager
    )

    requestAnimationFrame(this.gameLoop)
  }

  /**
   * 게임 상태 업데이트
   */
  private update(currentTime: number): void {
    // 입력 처리
    const input = this.inputManager.getMovementInput()
    this.player.move(input.x, input.y)

    // 플레이어 업데이트
    this.player.update(this.deltaTime)

    // Inventory Hover Check (Tooltip + Cursor)
    if (this.player.isInventoryOpen) {
      this.inventoryManager.handleHover(this.inputManager)
    } else {
      this.canvas.style.cursor = 'default'
      this.player.hoveredItem = null
    }

    // 몬스터 관리
    const config = getChapterConfig(this.currentChapter)

    // 1. 죽은 몬스터 처리 및 아이템 드랍
    const deadMonsters = this.monsterManager.removeDeadMonsters()
    deadMonsters.forEach(m => {
      // 아이템 생성 (확률은 내부 config에서 처리)
      const item = Item.createRandom(m.position.x, m.position.y)
      if (item) {
        this.items.push(item.drop(m.position.x, m.position.y))
      }
    })

    this.monsterManager.updateAll(this.deltaTime)
    this.monsterManager.handleRespawn(config, this.player.position, currentTime)

    // 아이템 업데이트 및 획득 처리
    this.items.forEach(item => item.update(this.deltaTime))

    // 아이템 획득 거리 체크 (플레이어와 거리 50px 이내)
    this.items = this.items.filter(item => {
      const dx = this.player.position.x - item.position.x
      const dy = this.player.position.y - item.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 50) {
        console.log(`Item collected: ${item.data.name} (${item.data.rarity})`)
        this.player.addItem(item.data)
        item.isCollected = true
        return false // Remove from list
      }
      return true
    })

    // Player-Monster Collision (Block/Return)
    this.monsterManager.monsters.forEach(monster => {
      monster.checkPlayerCollision(this.player.position.x, this.player.position.y)
      this.monsterManager.monsters.forEach(other => {
        if (monster !== other) monster.resolveMonsterCollision(other)
      })
    })

    // 카메라 업데이트
    this.camera.follow(this.player.position)
    this.tileMap.updateVisibleTiles(this.camera)
  }

  private handlePlayerAttack(): void {
    const ATTACK_RANGE = 250 // 공격 범위

    this.monsterManager.monsters.forEach(monster => {
      if (monster.isDead) return

      const dx = monster.position.x - this.player.position.x
      const dy = monster.position.y - this.player.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= ATTACK_RANGE) {
        const { amount, isCrit } = this.player.getDamage()
        monster.takeDamage(amount)

        const pushPower = 50 + (isCrit ? 30 : 0)
        monster.pushFrom(this.player.position.x, this.player.position.y, pushPower)

        const hitType = isCrit ? 'CRITICAL HIT!' : 'Hit'
        console.log(`${hitType} monster ${monster.id}! Damage: ${amount}, HP: ${monster.hp}`)
      }
    })
  }

  // ==================== 헬퍼 함수들 ====================

  /**
   * Canvas Context 초기화
   */
  private initializeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D context')
    return ctx
  }

  /**
   * 줌 방지 설정
   */
  private setupZoomPrevention(): void {
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) e.preventDefault()
    }, { passive: false })

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault()
      }
    })
  }

  /**
   * 플레이어 생성
   */
  private createPlayer(chapterConfig: any): Player {
    if (chapterConfig.openWorldMapConfig) {
      return new Player(0, 0)
    }

    const startPos = this.tileMap.getWorldPosition(
      chapterConfig.mapData.startPosition.x,
      chapterConfig.mapData.startPosition.y
    )
    return new Player(startPos.x, startPos.y)
  }

  /**
   * 입력 매니저 설정
   */
  private setupInputManager(): InputManager {
    const inputManager = new InputManager()

    inputManager.onKeyDown('Space', () => {
      if (this.state === 'playing') {
        this.player.attack()
        this.handlePlayerAttack()
      }
    })

    inputManager.onKeyDown('KeyI', () => {
      if (this.state === 'playing') {
        this.player.toggleInventory()

        // Reset hover and cursor when toggling
        this.player.hoveredItem = null
        this.canvas.style.cursor = 'default'

        // Reset menu on open
        if (this.player.isInventoryOpen) {
          this.player.inventoryMenu = null
        }
      }
    })

    inputManager.onMouseDown((e: MouseEvent) => {
      // Delegate to Inventory Manager if open
      if (this.player.isInventoryOpen) {
        const handled = this.inventoryManager.handleClick(e)
        if (handled) return
      }

      // If not handled by inventory (e.g. clicked outside or inventory closed),
      // we might handle movement here. 
      // Current system uses Keyboard for movement, so nothing else here.
    })

    return inputManager
  }

  // ==================== 공개 API ====================

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this.camera.resize(width, height)
  }

  pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused'
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing'
      this.lastFrameTime = performance.now()
      this.gameLoop(this.lastFrameTime)
    }
  }

  destroy(): void {
    this.inputManager.destroy()
    this.resourceLoader.clear()
  }
}
