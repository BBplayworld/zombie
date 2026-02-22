import { Camera } from '../systems/Camera'
import { Player } from '../entities/Player'
import { TileMap } from '../systems/TileMap'
import { InputManager } from '../systems/InputManager'
import { ResourceLoader } from '../systems/ResourceLoader'
import { MonsterManager } from './MonsterManager'
import { PlayerManager } from './PlayerManager'
import { RenderManager } from './RenderManager'
import { ItemDrop } from '../entities/ItemDrop'
import { Item } from '../entities/Item'
import { getChapterConfig } from '../config/chapters'
import { InventoryManager } from './InventoryManager'

/**
 * 게임 엔진 클래스
 *
 * 책임: 시스템 초기화·조율 + 게임 루프 실행
 * 플레이어 로직 → PlayerManager
 * 몬스터 로직 → MonsterManager
 */
export class GameEngine {
  // Canvas & Context
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  // Core Systems
  private camera: Camera
  private tileMap: TileMap
  private inputManager: InputManager
  public resourceLoader: ResourceLoader

  // Managers
  private playerManager: PlayerManager
  private monsterManager: MonsterManager
  private renderManager: RenderManager
  private inventoryManager: InventoryManager

  // 편의 접근자 (RenderManager → player 접근이 필요한 곳에서 사용)
  private get player(): Player { return this.playerManager.player }

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

  // ─────────────────────────────────────────────────────
  //  STEP 1: 생성자 — 기본 시스템 초기화
  // ─────────────────────────────────────────────────────

  constructor(canvas: HTMLCanvasElement) {
    console.log('🎮 [STEP 1] GameEngine Constructor - Initializing core systems...')

    this.canvas = canvas
    this.ctx = this.initializeContext(canvas)

    const chapterConfig = getChapterConfig(this.currentChapter)

    // 코어 시스템
    this.camera = new Camera(canvas.width, canvas.height)
    this.tileMap = new TileMap(chapterConfig.openWorldMapConfig)
    this.resourceLoader = new ResourceLoader()

    // 플레이어 생성
    const player = this.createPlayer(chapterConfig)

    // 매니저 초기화
    this.renderManager = new RenderManager(canvas, this.resourceLoader)
    this.inventoryManager = new InventoryManager(player, canvas)
    this.monsterManager = new MonsterManager(this.tileMap, this.resourceLoader)
    this.playerManager = new PlayerManager(
      player,
      this.tileMap,
      this.resourceLoader,
      this.inventoryManager,
      this.renderManager.interfaceManager,
      canvas
    )

    // 입력 설정 (playerManager 생성 후)
    this.inputManager = this.setupInputManager()

    this.setupWindowEvents()

    console.log('✅ [STEP 1] Core systems initialized')
  }

  // ─────────────────────────────────────────────────────
  //  STEP 2: 리소스 로딩
  // ─────────────────────────────────────────────────────

  async loadResources(): Promise<void> {
    console.log('📦 [STEP 2] Loading game resources...')
    this.state = 'loading'

    const chapterConfig = getChapterConfig(this.currentChapter)

    await this.loadImageResources(chapterConfig)
    await this.loadMapData(chapterConfig)

    // 플레이어 스프라이트 연결
    this.playerManager.initialize()

    // 몬스터 스폰 + fight 스프라이트 연결
    this.monsterManager.spawnInitialMonsters(chapterConfig, this.player.position)
    const fightImg = this.resourceLoader.getImage('fight')
    if (fightImg) {
      this.monsterManager.monsters.forEach(m => m.setFightImage(fightImg))
    }

    this.finalizeGameSetup(chapterConfig)

    console.log('✅ [STEP 2] All resources loaded, game ready!')
  }

  // ─────────────────────────────────────────────────────
  //  STEP 3: 게임 시작
  // ─────────────────────────────────────────────────────

  start(): void {
    console.log('🚀 [STEP 3] Starting game loop...')

    if (this.state !== 'ready') {
      console.warn('⚠️ Game is not ready. Current state:', this.state)
      return
    }

    this.state = 'playing'
    this.lastFrameTime = performance.now()
    this.gameLoop(this.lastFrameTime)

    console.log('✅ [STEP 3] Game loop started!')
  }

  // ─────────────────────────────────────────────────────
  //  STEP 2 상세
  // ─────────────────────────────────────────────────────

  private async loadImageResources(chapterConfig: any): Promise<void> {
    console.log('  📸 [STEP 2-1] Loading images...')

    const imageMap: Record<string, string> = { ...chapterConfig.assetConfig }
    chapterConfig.monsters.forEach((m: any) => { imageMap[m.id] = m.imagePath })

    await this.resourceLoader.loadImages(imageMap)
    this.tileMap.setImages(this.resourceLoader.getImages())

    console.log('  ✅ [STEP 2-1] Images loaded')
  }

  private async loadMapData(chapterConfig: any): Promise<void> {
    console.log('  🗺️  [STEP 2-2] Loading map data...')

    try {
      const res = await fetch('/assets/chapter-1/map/map-data.json')
      if (!res.ok) throw new Error('Map json not found')
      const jsonMap = await res.json()
      console.log('  📄 External map data loaded:', jsonMap.width, 'x', jsonMap.height)
      this.tileMap.loadMapData(jsonMap.tiles, jsonMap.width, jsonMap.height, {
        polygonsAreObstacles: !!jsonMap.polygonsAreObstacles,
        obstacleTiles: jsonMap.obstacleTiles ?? []
      })
    } catch {
      console.warn('  ⚠️ Using default config map data')
      const md = chapterConfig.mapData
      this.tileMap.loadMapData(md.tiles, md.width, md.height)
    }

    // 미니맵 설정
    const miniMap = this.renderManager.getMiniMap()
    const polygon = this.tileMap.getMapPolygon()
    const bounds = this.tileMap.getWalkableBounds()
    if (Array.isArray(polygon) && polygon.length > 0) {
      miniMap.setMapPolygon(Array.isArray(polygon[0]) ? polygon : [polygon as { x: number; y: number }[]])
    }
    if (bounds) miniMap.setWorldBounds(bounds)
    const lang = typeof navigator !== 'undefined' && navigator.language?.startsWith('ko') ? 'ko' : 'en'
    miniMap.setLocale(lang)

    const worldSize = chapterConfig.openWorldMapConfig?.worldSize
    const mapImg = this.resourceLoader.getImage('mapBackground')
    if (mapImg && worldSize) miniMap.setMapImage(mapImg, worldSize.width, worldSize.height)

    // 오픈월드: 랜덤 시작 위치
    if (chapterConfig.openWorldMapConfig) {
      const startPos = this.tileMap.getRandomWalkablePosition()
      if (startPos) {
        this.player.position.x = startPos.x
        this.player.position.y = startPos.y
      }
    }

    console.log('  ✅ [STEP 2-2] Map data loaded')
  }

  private finalizeGameSetup(chapterConfig: any): void {
    console.log('  🎯 [STEP 2-5] Finalizing game setup...')
    this.state = 'ready'
    this.camera.setScaleToViewSize()
    this.camera.follow(this.player.position, true)
    this.tileMap.updateVisibleTiles(this.camera)
    this.player.update(0)
    this.renderManager.render(
      this.tileMap, this.camera, this.player,
      this.monsterManager.monsters, this.items,
      this.state, this.inventoryManager
    )
    console.log('  ✅ [STEP 2-5] Game setup complete')
    console.log(`  📖 Chapter ${this.currentChapter}: ${chapterConfig.name}`)
  }

  // ─────────────────────────────────────────────────────
  //  게임 루프
  // ─────────────────────────────────────────────────────

  private gameLoop = (currentTime: number): void => {
    if (this.state !== 'playing') return

    this.deltaTime = (currentTime - this.lastFrameTime) / 1000
    this.lastFrameTime = currentTime

    this.renderManager.updateFPS(currentTime)
    this.update(currentTime)
    this.renderManager.render(
      this.tileMap, this.camera, this.player,
      this.monsterManager.monsters, this.items,
      this.state, this.inventoryManager
    )

    requestAnimationFrame(this.gameLoop)
  }

  private update(currentTime: number): void {
    // ── 플레이어 업데이트 (PlayerManager 위임) ───────
    this.items = this.playerManager.update(
      this.deltaTime,
      this.inputManager,
      this.items,
      this.monsterManager.monsters
    )

    // 아이템 물리 업데이트
    this.items.forEach(item => item.update(this.deltaTime))

    // ── 몬스터 업데이트 (MonsterManager 위임) ────────
    const config = getChapterConfig(this.currentChapter)

    const deadMonsters = this.monsterManager.removeDeadMonsters()
    deadMonsters.forEach(m => {
      const dropped = Item.createRandom(m.position.x, m.position.y)
      if (dropped) this.items.push(dropped.drop(m.position.x, m.position.y))
    })

    this.monsterManager.updateAll(this.deltaTime)
    this.monsterManager.handleRespawn(config, this.player.position, currentTime)

    // 몬스터-플레이어 충돌 밀어내기
    this.monsterManager.monsters.forEach(monster => {
      monster.checkPlayerCollision(this.player.position.x, this.player.position.y)
      this.monsterManager.monsters.forEach(other => {
        if (monster !== other) monster.resolveMonsterCollision(other)
      })
    })

    // ── 카메라 & 타일맵 ───────────────────────────────
    this.camera.follow(this.player.position)
    this.tileMap.updateVisibleTiles(this.camera)
  }

  // ─────────────────────────────────────────────────────
  //  헬퍼 / 이벤트 설정
  // ─────────────────────────────────────────────────────

  private initializeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D context')
    return ctx
  }

  private createPlayer(chapterConfig: any): Player {
    if (chapterConfig.openWorldMapConfig) return new Player(0, 0)
    const startPos = this.tileMap.getWorldPosition(
      chapterConfig.mapData.startPosition.x,
      chapterConfig.mapData.startPosition.y
    )
    return new Player(startPos.x, startPos.y)
  }

  /** 브라우저 전역 이벤트 (줌방지 / 미니맵 / mousemove hover) */
  private setupWindowEvents(): void {
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) { e.preventDefault(); return }
      this.renderManager?.getMiniMap()?.handleWheel(e)
    }, { passive: false })

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0'))
        e.preventDefault()
    })

    this.canvas.addEventListener('mousedown', (e) => {
      this.renderManager?.getMiniMap()?.handleMouseDown(e)
    })

    window.addEventListener('mousemove', (e) => {
      this.renderManager?.getMiniMap()?.handleMouseMove(e)
      // 인벤토리 닫힌 상태의 아이콘 hover는 PlayerManager.update() → handleCursor() 에서 처리
    })

    window.addEventListener('mouseup', () => {
      this.renderManager?.getMiniMap()?.handleMouseUp()
    })
  }

  /** 키보드 + 마우스 클릭 입력 등록 */
  private setupInputManager(): InputManager {
    const inputManager = new InputManager()

    // 공격 (Space)
    inputManager.onKeyDown('Space', () => {
      if (this.state === 'playing') {
        this.playerManager.handleAttack(this.monsterManager.monsters)
      }
    })

    // 인벤토리 토글 (I)
    inputManager.onKeyDown('KeyI', () => {
      if (this.state === 'playing') {
        this.playerManager.toggleInventory()
      }
    })

    // 마우스 클릭
    inputManager.onMouseDown((e: MouseEvent) => {
      // 인벤토리 아이콘 클릭 체크
      const iconRect = this.renderManager?.inventoryIconRect
      if (iconRect && this.state === 'playing') {
        const rect = this.canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        if (mx >= iconRect.x && mx <= iconRect.x + iconRect.w &&
          my >= iconRect.y && my <= iconRect.y + iconRect.h) {
          this.playerManager.toggleInventory()
          return
        }
      }

      // 인벤토리 열려있으면 내부 클릭 처리
      if (this.player.isInventoryOpen) {
        const handled = this.inventoryManager.handleClick(e)
        if (handled) return
      }
    })

    return inputManager
  }

  // ─────────────────────────────────────────────────────
  //  공개 API
  // ─────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this.camera.resize(width, height)
    this.camera.setScaleToViewSize()
  }

  pause(): void {
    if (this.state === 'playing') this.state = 'paused'
  }

  resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing'
      this.lastFrameTime = performance.now()
      this.gameLoop(this.lastFrameTime)
    }
  }

  resetToTitle(): void {
    if (this.state === 'paused') this.state = 'ready'
  }

  destroy(): void {
    this.inputManager.destroy()
    this.resourceLoader.clear()
  }
}
