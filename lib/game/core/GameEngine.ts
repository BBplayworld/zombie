import { Camera } from "../systems/Camera";
import { Player } from "../entities/player/Player";
import { ZoneMap } from "../systems/ZoneMap";
import { InputManager } from "../systems/InputManager";
import { ResourceLoader } from "../systems/ResourceLoader";
import { CombatTextManager } from "../systems/CombatTextManager";
import { MonsterManager } from "./MonsterManager";
import { PlayerManager } from "./PlayerManager";
import { RenderManager } from "./RenderManager";
import { ItemDrop } from "../entities/ItemDrop";
import { Item } from "../entities/Item";
import { getZoneConfig } from "../config/zones";
import { InventoryManager } from "./InventoryManager";

/**
 * 게임 엔진 클래스
 *
 * 책임: 시스템 초기화·조율 + 게임 루프 실행
 * 플레이어 로직 → PlayerManager
 * 몬스터 로직 → MonsterManager
 */
export class GameEngine {
  // Canvas & Context
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Core Systems
  private camera: Camera;
  private ZoneMap: ZoneMap;
  private inputManager: InputManager;
  public resourceLoader: ResourceLoader;

  // Managers
  private playerManager: PlayerManager;
  private monsterManager: MonsterManager;
  private renderManager: RenderManager;
  private inventoryManager: InventoryManager;
  private combatTextManager: CombatTextManager;

  // 편의 접근자 (RenderManager → player 접근이 필요한 곳에서 사용)
  private get player(): Player {
    return this.playerManager.player;
  }

  // Entities
  private items: ItemDrop[] = [];

  // Game State
  public state: "loading" | "ready" | "playing" | "paused" = "loading";

  // Game Loop
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private deltaTime: number = 0;

  // Configuration
  private currentZone: number = 1;

  // Fade Effect
  private fadeAlpha: number = 0;
  private fadeTarget: number = 0;
  private isTransitioning: boolean = false;

  // ─────────────────────────────────────────────────────
  //  STEP 1: 생성자 — 기본 시스템 초기화
  // ─────────────────────────────────────────────────────

  constructor(canvas: HTMLCanvasElement) {
    console.log(
      "🎮 [STEP 1] GameEngine Constructor - Initializing core systems...",
    );

    this.canvas = canvas;
    this.ctx = this.initializeContext(canvas);

    const zoneConfig = getZoneConfig(this.currentZone);

    // 코어 시스템
    this.camera = new Camera(canvas.width, canvas.height);
    this.ZoneMap = new ZoneMap(zoneConfig.openWorldMapConfig);
    this.resourceLoader = new ResourceLoader();

    // 플레이어 생성
    const player = this.createPlayer(zoneConfig);

    // 매니저 초기화
    this.renderManager = new RenderManager(canvas, this.resourceLoader);
    this.inventoryManager = new InventoryManager(player, canvas);
    this.monsterManager = new MonsterManager(this.ZoneMap, this.resourceLoader);
    this.combatTextManager = new CombatTextManager();
    this.playerManager = new PlayerManager(
      player,
      this.ZoneMap,
      this.resourceLoader,
      this.inventoryManager,
      this.renderManager.interfaceManager,
      canvas,
      this.combatTextManager,
    );

    // 입력 설정 (playerManager 생성 후)
    this.inputManager = this.setupInputManager();

    this.setupWindowEvents();

    console.log("✅ [STEP 1] Core systems initialized");
  }

  // ─────────────────────────────────────────────────────
  //  STEP 2: 리소스 로딩
  // ─────────────────────────────────────────────────────

  async loadResources(): Promise<void> {
    console.log("📦 [STEP 2] Loading game resources...");
    this.state = "loading";

    const zoneConfig = getZoneConfig(this.currentZone);

    await this.loadImageResources(zoneConfig);
    await this.loadMapData(zoneConfig);

    // 플레이어 스프라이트 연결 (ZoneMap을 zone 충돌 경계로 전달)
    this.playerManager.initialize(this.ZoneMap);

    // 몬스터 스폰 + fight 스프라이트 연결
    this.monsterManager.spawnInitialMonsters(
      zoneConfig,
      this.player.position,
    );
    const fightImg = this.resourceLoader.getImage("fight");
    if (fightImg) {
      this.monsterManager.monsters.forEach((m) => m.setFightImage(fightImg));
    }

    this.finalizeGameSetup(zoneConfig);

    console.log("✅ [STEP 2] All resources loaded, game ready!");
  }

  // ─────────────────────────────────────────────────────
  //  STEP 3: 게임 시작
  // ─────────────────────────────────────────────────────

  start(): void {
    console.log("🚀 [STEP 3] Starting game loop...");

    if (this.state !== "ready") {
      console.warn("⚠️ Game is not ready. Current state:", this.state);
      return;
    }

    this.state = "playing";
    this.lastFrameTime = performance.now();
    this.gameLoop(this.lastFrameTime);

    console.log("✅ [STEP 3] Game loop started!");
  }

  // ─────────────────────────────────────────────────────
  //  STEP 2 상세
  // ─────────────────────────────────────────────────────

  private async loadImageResources(zoneConfig: any): Promise<void> {
    console.log("  📸 [STEP 2-1] Loading images...");

    const imageMap: Record<string, string> = { ...zoneConfig.assetConfig };
    zoneConfig.monsters.forEach((m: any) => {
      imageMap[m.id] = m.imagePath;
    });

    await this.resourceLoader.loadImages(imageMap);
    this.ZoneMap.setImages(this.resourceLoader.getImages());

    console.log("  ✅ [STEP 2-1] Images loaded");
  }

  private async loadMapData(zoneConfig: any): Promise<void> {
    console.log("  🗺️  [STEP 2-2] Loading map data...");

    try {
      const res = await fetch(`/assets/zone-${this.currentZone}/map/map-data.json`);
      if (!res.ok) throw new Error("Map json not found");
      const jsonMap = await res.json();
      console.log(
        "  📄 External map data loaded:",
        jsonMap.width,
        "x",
        jsonMap.height,
      );
      this.ZoneMap.loadMapData(jsonMap.tiles, jsonMap.width, jsonMap.height, {
        polygonsAreObstacles: !!jsonMap.polygonsAreObstacles,
        obstacleTiles: jsonMap.obstacleTiles ?? [],
        walkableGrid: jsonMap.walkableGrid,
      });
    } catch {
      console.warn("  ⚠️ Using default config map data");
      const md = zoneConfig.mapData;
      this.ZoneMap.loadMapData(md.tiles, md.width, md.height);
    }

    // 미니맵 설정
    const miniMap = this.renderManager.getMiniMap();
    const polygon = this.ZoneMap.getMapPolygon();
    const bounds = this.ZoneMap.getWalkableBounds();
    if (Array.isArray(polygon) && polygon.length > 0) {
      miniMap.setMapPolygon(
        Array.isArray(polygon[0])
          ? polygon
          : [polygon as { x: number; y: number }[]],
      );
    }
    if (bounds) miniMap.setWorldBounds(bounds);
    const lang =
      typeof navigator !== "undefined" && navigator.language?.startsWith("ko")
        ? "ko"
        : "en";
    miniMap.setLocale(lang);

    const worldSize = zoneConfig.openWorldMapConfig?.worldSize;
    const mapImg = this.resourceLoader.getImage("mapBackground");
    if (mapImg && worldSize)
      miniMap.setMapImage(mapImg, worldSize.width, worldSize.height);

    // 오픈월드: 랜덤 시작 위치 (충돌 오프셋 동일하게 적용해 경계 끼임 방지)
    if (zoneConfig.openWorldMapConfig) {
      const collisionYOffset = zoneConfig.gameplayConfig?.collisionYOffset ?? 80;
      const startPos = this.ZoneMap.getRandomWalkablePosition(collisionYOffset, 100);
      if (startPos) {
        this.player.position.x = startPos.x;
        this.player.position.y = startPos.y;
      }
    }

    console.log("  ✅ [STEP 2-2] Map data loaded");
  }

  private finalizeGameSetup(zoneConfig: any): void {
    console.log("  🎯 [STEP 2-5] Finalizing game setup...");
    this.state = "ready";

    // 존 모드일 경우 카메라 바운더리와 기준 뷰 사이즈 적용
    const owConfig = zoneConfig.openWorldMapConfig;
    if (owConfig) {
      if (owConfig.mapType === 'zone') {
        this.camera.isZoneMode = true;
        this.camera.viewSize = Math.max(owConfig.worldSize.width, owConfig.worldSize.height);
        this.camera.setBounds(
          -owConfig.worldSize.width / 2,
          owConfig.worldSize.width / 2,
          -owConfig.worldSize.height / 2,
          owConfig.worldSize.height / 2
        );
      } else {
        this.camera.isZoneMode = false;
        this.camera.viewSize = 2048; // 심리스 디폴트
        this.camera.bounds = null;
      }
    }

    this.camera.setScaleToViewSize();
    this.camera.follow(this.player.position, true);
    this.ZoneMap.updateVisibleTiles(this.camera);
    this.player.update(0);
    this.renderManager.render(
      this.ZoneMap,
      this.camera,
      this.player,
      this.monsterManager.monsters,
      this.items,
      this.state,
      this.inventoryManager,
      this.combatTextManager,
    );
    console.log("  ✅ [STEP 2-5] Game setup complete");
    console.log(`  📖 Zone ${this.currentZone}: ${zoneConfig.name}`);
  }

  // ─────────────────────────────────────────────────────
  //  게임 루프
  // ─────────────────────────────────────────────────────

  private gameLoop = (currentTime: number): void => {
    if (this.state !== "playing" && !this.isTransitioning) return;

    this.deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    this.renderManager.updateFPS(currentTime);
    this.update(currentTime);
    this.renderManager.render(
      this.ZoneMap,
      this.camera,
      this.player,
      this.monsterManager.monsters,
      this.items,
      this.state,
      this.inventoryManager,
      this.combatTextManager,
    );

    // 페이드 인/아웃 렌더링
    if (this.fadeAlpha > 0) {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // 페이드 애니메이션 진행
    if (this.fadeAlpha !== this.fadeTarget) {
      const fadeSpeed = this.deltaTime * 2.0; // 0.5초 경과
      if (this.fadeAlpha < this.fadeTarget) {
        this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + fadeSpeed);
      } else {
        this.fadeAlpha = Math.max(this.fadeTarget, this.fadeAlpha - fadeSpeed);
      }
    }

    requestAnimationFrame(this.gameLoop);
  };

  private update(currentTime: number): void {
    // ── 플레이어 업데이트 (PlayerManager 위임) ───────
    this.items = this.playerManager.update(
      this.deltaTime,
      this.inputManager,
      this.items,
      this.monsterManager.monsters,
    );

    // 아이템 물리 업데이트
    this.items.forEach((item) => item.update(this.deltaTime));

    // ── 몬스터 업데이트 (MonsterManager 위임) ────────
    const config = getZoneConfig(this.currentZone);

    const deadMonsters = this.monsterManager.removeDeadMonsters();
    deadMonsters.forEach((m) => {
      const dropped = Item.createRandom(m.position.x, m.position.y);
      if (dropped) this.items.push(dropped.drop(m.position.x, m.position.y));
    });

    this.monsterManager.updateAll(this.deltaTime, this.player.position);
    this.monsterManager.handleRespawn(
      config,
      this.player.position,
      currentTime,
    );

    // 몬스터-플레이어 충돌 밀어내기
    this.monsterManager.monsters.forEach((monster) => {
      monster.checkPlayerCollision(
        this.player.position.x,
        this.player.position.y,
      );
      this.monsterManager.monsters.forEach((other) => {
        if (monster !== other) monster.resolveMonsterCollision(other);
      });
    });

    // ── 카메라 & 타일맵 ───────────────────────────────
    this.camera.follow(this.player.position);
    this.ZoneMap.updateVisibleTiles(this.camera);

    // ── 기타 시스템 ─────────────────────────────────────
    this.combatTextManager.update(this.deltaTime);

    // ── 존 전환 (포탈) 처리 ──
    const openWorldMapConfig = config.openWorldMapConfig;
    if (openWorldMapConfig?.mapType === 'zone' || openWorldMapConfig?.portals) {
      this.checkPortals(openWorldMapConfig.portals);
    }
  }

  private checkPortals(portals?: any[]): void {
    if (!portals || this.isTransitioning) return;
    for (const portal of portals) {
      if (
        this.player.position.x >= portal.x &&
        this.player.position.x <= portal.x + portal.width &&
        this.player.position.y >= portal.y &&
        this.player.position.y <= portal.y + portal.height
      ) {
        console.log(`Portal hit! Transitioning to zone ${portal.targetZoneId}`);
        // Prevent multiple triggers
        this.state = "transitioning" as any;
        this.isTransitioning = true;
        this.transitionToZone(portal.targetZoneId, portal.targetX, portal.targetY);
        break;
      }
    }
  }

  private async transitionToZone(zoneId: number, targetX: number, targetY: number): Promise<void> {
    console.log(`Loading new zone: Zone ${zoneId}...`);

    // 페이드 아웃 시작
    this.fadeTarget = 1;

    // 페이드 아웃 완료 대기
    await new Promise(resolve => setTimeout(resolve, 500));

    this.currentZone = zoneId;

    // 기존 맵 데이터와 그래픽 교체
    const config = getZoneConfig(zoneId);
    if (!config) {
      console.error("Target zone not found!");
      this.state = "playing";
      this.isTransitioning = false;
      this.fadeTarget = 0;
      return;
    }

    await this.loadImageResources(config);

    this.monsterManager.monsters = [];
    this.monsterManager.spawnInitialMonsters(config, { x: targetX, y: targetY } as any);
    const fightImg = this.resourceLoader.getImage("fight");
    if (fightImg) {
      this.monsterManager.monsters.forEach((m) => m.setFightImage(fightImg));
    }

    this.player.position.x = targetX;
    this.player.position.y = targetY;

    // 존 모드 갱신
    const owConfig = config.openWorldMapConfig;
    if (owConfig) {
      if (owConfig.mapType === 'zone') {
        this.camera.isZoneMode = true;
        this.camera.viewSize = Math.max(owConfig.worldSize.width, owConfig.worldSize.height);
        this.camera.setBounds(
          -owConfig.worldSize.width / 2,
          owConfig.worldSize.width / 2,
          -owConfig.worldSize.height / 2,
          owConfig.worldSize.height / 2
        );
      } else {
        this.camera.isZoneMode = false;
        this.camera.viewSize = 2048; // 심리스 디폴트
        this.camera.bounds = null;
      }
      this.camera.setScaleToViewSize();
    }
    this.camera.follow(this.player.position, true);

    this.ZoneMap.updateVisibleTiles(this.camera);

    // 페이드 인 시작
    this.fadeTarget = 0;
    this.state = "playing";

    // 페이드 인 완료 대기
    await new Promise(resolve => setTimeout(resolve, 500));
    this.isTransitioning = false;
    this.lastFrameTime = performance.now();
  }

  // ─────────────────────────────────────────────────────
  //  헬퍼 / 이벤트 설정
  // ─────────────────────────────────────────────────────

  private initializeContext(
    canvas: HTMLCanvasElement,
  ): CanvasRenderingContext2D {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    return ctx;
  }

  private createPlayer(zoneConfig: any): Player {
    if (zoneConfig.openWorldMapConfig) return new Player(0, 0);
    const startPos = this.ZoneMap.getWorldPosition(
      zoneConfig.mapData.startPosition.x,
      zoneConfig.mapData.startPosition.y,
    );
    return new Player(startPos.x, startPos.y);
  }

  /** 브라우저 전역 이벤트 (줌방지 / 미니맵 / mousemove hover) */
  private setupWindowEvents(): void {
    window.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          return;
        }
        this.renderManager?.getMiniMap()?.handleWheel(e);
      },
      { passive: false },
    );

    window.addEventListener("keydown", (e) => {
      if (
        e.ctrlKey &&
        (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")
      )
        e.preventDefault();
    });

    this.canvas.addEventListener("mousedown", (e) => {
      this.renderManager?.getMiniMap()?.handleMouseDown(e);
    });

    window.addEventListener("mousemove", (e) => {
      this.renderManager?.getMiniMap()?.handleMouseMove(e);
      // 인벤토리 닫힌 상태의 아이콘 hover는 PlayerManager.update() → handleCursor() 에서 처리
    });

    window.addEventListener("mouseup", () => {
      this.renderManager?.getMiniMap()?.handleMouseUp();
    });
  }

  /** 키보드 + 마우스 클릭 입력 등록 */
  private setupInputManager(): InputManager {
    const inputManager = new InputManager();

    // 공격 (Space)
    inputManager.onKeyDown("Space", () => {
      if (this.state === "playing") {
        this.playerManager.handleAttack(this.monsterManager.monsters, "space");
      }
    });

    ['KeyQ', 'KeyW', 'KeyE', 'KeyR'].forEach((keyCode, index) => {
      const skillKey = ['q', 'w', 'e', 'r'][index] as any;
      inputManager.onKeyDown(keyCode, () => {
        if (this.state === "playing") {
          this.playerManager.handleAttack(this.monsterManager.monsters, skillKey);
        }
      });
    });

    // 인벤토리 토글 (I)
    inputManager.onKeyDown("KeyI", () => {
      if (this.state === "playing") {
        this.playerManager.toggleInventory();
      }
    });

    // 마우스 클릭
    inputManager.onMouseDown((e: MouseEvent) => {
      // (인벤토리 아이콘이 UI 화면에서 제거되었으므로 클릭 토글 기능 제거)
      if (this.player.isInventoryOpen) {
        const handled = this.inventoryManager.handleClick(e);
        if (handled) return;
      }
    });

    return inputManager;
  }

  // ─────────────────────────────────────────────────────
  //  공개 API
  // ─────────────────────────────────────────────────────

  resize(width: number, height: number, dpr: number = 1): void {
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // Reset transform to identity then scale correctly for high DPI
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    // 카메라 및 게임 로직은 모두 논리적 크기 기반으로 동작
    this.camera.resize(width, height);
    this.camera.setScaleToViewSize();
  }

  pause(): void {
    if (this.state === "playing") this.state = "paused";
  }

  resume(): void {
    if (this.state === "paused") {
      this.state = "playing";
      this.lastFrameTime = performance.now();
      this.gameLoop(this.lastFrameTime);
    }
  }

  resetToTitle(): void {
    if (this.state === "paused") this.state = "ready";
  }

  destroy(): void {
    this.inputManager.destroy();
    this.resourceLoader.clear();
  }
}
