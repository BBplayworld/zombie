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
import { InventoryManager } from './InventoryManager';
import { StorageManager } from './StorageManager';
import { VillageManager } from "./VillageManager";
import { Monster } from "../entities/monster/Monster";
import { SaveManager } from "../systems/SaveManager";
import { calcMonsterExp, LevelSystem } from "../systems/LevelSystem";

/**
 * 게임 엔진 클래스
 *
 * 책임: 시스템 초기화·조율 + 게임 루프 실행
 * 플레이어 로직 → PlayerManager
 * 몬스터 로직 → MonsterManager
 * 마을 NPC 로직 → VillageManager
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
  private storageManager: StorageManager;
  private combatTextManager: CombatTextManager;
  private villageManager: VillageManager;

  // 편의 접근자
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

  // ── Portal System ────────────────────────────────────────────────────────
  /** V키로 생성된 임시 포털 (플레이어 위치 기준) */
  private playerPortal: {
    x: number; y: number;
    width: number; height: number;
    targetZoneId: number; targetX: number; targetY: number;
    /** 마을로 갈 때 저장된 플레이어의 원래 zone 1 위치 */
    returnX?: number; returnY?: number;
  } | null = null;

  /** 마을에서 Zone 1으로 돌아갈 때 복원할 몬스터 스냅샷 */
  private savedMonsters: Monster[] = [];
  /** 마을에서 복귀할 Zone의 포털 귀환 위치 */
  private savedReturnX: number = 0;
  private savedReturnY: number = 0;
  /** 마을 이동 직전 전투 존 ID (복귀 포털에서만 사용) */
  private savedReturnZone: number = 1;

  /** 포털 시각 효과용 애니메이션 타이머 */
  private portalAnimTimer: number = 0;

  /** 자동저장 타이머 (60초마다) */
  private autoSaveTimer: number = 0;
  private readonly AUTO_SAVE_INTERVAL = 60;  // 초

  // ─────────────────────────────────────────────────────
  //  STEP 1: 생성자 — 기본 시스템 초기화
  // ─────────────────────────────────────────────────────

  constructor(canvas: HTMLCanvasElement) {
    console.log("🎮 [STEP 1] GameEngine Constructor - Initializing core systems...");

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
    this.storageManager = new StorageManager(player, canvas);
    this.monsterManager = new MonsterManager(this.ZoneMap, this.resourceLoader);
    this.combatTextManager = new CombatTextManager();
    this.villageManager = new VillageManager(player, this.combatTextManager, canvas);
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

    this.playerManager.initialize(this.ZoneMap);

    this.monsterManager.spawnInitialMonsters(zoneConfig, this.player.position);

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
      if (m.moveImagePath) imageMap[`${m.id}_move`] = m.moveImagePath;
      if (m.attackImagePath) imageMap[`${m.id}_attack`] = m.attackImagePath;
    });

    await this.resourceLoader.loadImages(imageMap);
    this.ZoneMap.setImages(this.resourceLoader.getImages());

    console.log("  ✅ [STEP 2-1] Images loaded");
  }

  private async loadMapData(zoneConfig: any): Promise<void> {
    console.log("  🗺️  [STEP 2-2] Loading map data...");

    try {
      // 마을(zone-99)는 /assets/village/map/ 경로 사용
      const mapPath = this.currentZone === 99
        ? `/assets/village/map/map-data.json`
        : `/assets/zone-${this.currentZone}/map/map-data.json`;

      const res = await fetch(mapPath);
      if (!res.ok) throw new Error("Map json not found");
      const jsonMap = await res.json();
      this.ZoneMap.loadMapData(jsonMap.tiles, jsonMap.width, jsonMap.height, {
        polygonsAreObstacles: !!jsonMap.polygonsAreObstacles,
        obstacleTiles: jsonMap.obstacleTiles ?? [],
        walkableGrid: jsonMap.walkableGrid,
      });
    } catch {
      console.warn("  ⚠️ Using default config map data");
      const md = zoneConfig.mapData;
      if (md.tiles && md.tiles.length > 0) {
        this.ZoneMap.loadMapData(md.tiles, md.width, md.height);
      }
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
        this.camera.viewSize = 2048;
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

    // [Layer 1] 월드 렌더 (맵 배경 + 엔티티 + 전투텍스트)
    this.renderManager.renderWorld(
      this.ZoneMap,
      this.camera,
      this.player,
      this.monsterManager.monsters,
      this.items,
      this.combatTextManager,
    );

    // [Layer 2] 마을 NPC — 월드 위, 인벤토리 아래
    if (this.currentZone === 99) {
      this.villageManager.render(this.ctx, this.camera);
    }
    // 제거된 inventory, storage render 블록

    // [Layer 2] 플레이어 포털 — 월드 위, 인벤토리 아래
    if (this.playerPortal) {
      this.renderPlayerPortal();
    }

    // [Layer 3] 인벤토리/HUD (최상위)
    this.renderManager.renderOverlay(
      this.ZoneMap,
      this.camera,
      this.player,
      this.monsterManager.monsters,
      this.state,
      this.inventoryManager,
    );

    if (this.player.isStorageOpen) {
      this.storageManager.render(this.ctx, this.resourceLoader);
    }

    // 페이드 인/아웃 렌더링
    if (this.fadeAlpha > 0) {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // 페이드 애니메이션 진행
    if (this.fadeAlpha !== this.fadeTarget) {
      const fadeSpeed = this.deltaTime * 2.0;
      if (this.fadeAlpha < this.fadeTarget) {
        this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + fadeSpeed);
      } else {
        this.fadeAlpha = Math.max(this.fadeTarget, this.fadeAlpha - fadeSpeed);
      }
    }

    requestAnimationFrame(this.gameLoop);
  };

  private update(currentTime: number): void {
    this.portalAnimTimer += this.deltaTime;

    // ── 플레이어 업데이트 ───────
    this.items = this.playerManager.update(
      this.deltaTime,
      this.inputManager,
      this.items,
      this.monsterManager.monsters,
    );

    // 아이템 물리 업데이트
    this.items.forEach((item) => item.update(this.deltaTime));

    // ── 마을 NPC 업데이트 ───────
    if (this.currentZone === 99) {
      this.villageManager.update(this.deltaTime);
    }

    // ── 몬스터 업데이트 ────────
    const config = getZoneConfig(this.currentZone);

    if (this.currentZone !== 99) {
      const deadMonsters = this.monsterManager.removeDeadMonsters();
      deadMonsters.forEach((m) => {
        // 아이템 드랍
        const dropped = Item.createRandom(m.position.x, m.position.y, this.currentZone);
        if (dropped) this.items.push(dropped.drop(m.position.x, m.position.y));

        // 경험치 지급
        const monsterLevel = (m as any).config?.level ?? 1;
        const exp = calcMonsterExp(monsterLevel, this.player.levelSystem.level);
        const prevLevel = this.player.levelSystem.level;
        this.player.gainExp(exp);
        this.combatTextManager.add(m.position.x, m.position.y - 60, `+${exp} EXP`, 'heal');

        // 레벨업 알림
        if (this.player.levelSystem.level > prevLevel) {
          this.combatTextManager.add(
            this.player.position.x,
            this.player.position.y - 120,
            `✦ LEVEL UP! Lv.${this.player.levelSystem.level}`,
            'critical'
          );
        }
      });

      this.monsterManager.updateAll(this.deltaTime, this.player.position);
      this.monsterManager.handleRespawn(config, this.player.position, currentTime);

      // 몬스터-플레이어 충돌 밀어내기
      this.monsterManager.monsters.forEach((monster) => {
        monster.checkPlayerCollision(this.player.position.x, this.player.position.y);
        this.monsterManager.monsters.forEach((other) => {
          if (monster !== other) monster.resolveMonsterCollision(other);
        });
      });
    }

    // ── 카메라 & 타일맵 ───────────────────────────────
    this.camera.follow(this.player.position);
    this.ZoneMap.updateVisibleTiles(this.camera);

    // ── 기타 시스템 ─────────────────────────────────────
    this.combatTextManager.update(this.deltaTime);

    // 레벨업 타이머 감소
    if (this.player.levelUpTimer > 0) {
      this.player.levelUpTimer -= this.deltaTime;
    }

    // 자동 저장
    this.autoSaveTimer += this.deltaTime;
    if (this.autoSaveTimer >= this.AUTO_SAVE_INTERVAL) {
      this.autoSaveTimer = 0;
      this.autoSave();
    }

    // ── 존 전환 포탈 처리 ──
    const openWorldMapConfig = config.openWorldMapConfig;
    if (openWorldMapConfig?.mapType === 'zone' || openWorldMapConfig?.portals) {
      // zone config 포탈
      this.checkPortals(openWorldMapConfig.portals);
      // 플레이어가 V키로 생성한 임시 포탈
      if (this.playerPortal) {
        this.checkSinglePortal(this.playerPortal);
      }
    }
  }

  // ─────────────────────────────────────────────────────
  //  포털 시스템
  // ─────────────────────────────────────────────────────

  /**
   * V키 입력: 플레이어 위치에 마을 포털 생성
   * - Zone 1에서 V키 → 마을(99) 포털 생성 + 현재 몬스터 저장
   * - 마을(99)에서는 이미 config 포탈이 zone 1 복귀 처리
   */
  private createPlayerPortal(): void {
    if (this.isTransitioning) return;

    if (this.currentZone === 99) {
      // 마을에서는 V키 불필요 (이미 하단 포탈 존재)
      return;
    }

    // 이미 포탈이 있으면 제거 (토글)
    if (this.playerPortal) {
      this.playerPortal = null;
      return;
    }

    const px = this.player.position.x;
    const py = this.player.position.y;
    const portalW = 80;
    const portalH = 120;

    // 포털을 플레이어 우측 100px에 배치
    const portalX = px + 100;
    const portalY = py - portalH / 2;

    this.playerPortal = {
      x: portalX,
      y: portalY,
      width: portalW,
      height: portalH,
      targetZoneId: 99,
      targetX: 0,
      targetY: -100,
      returnX: px,
      returnY: py,
    };

    // 현재 몬스터 상태 스냅샷 + 귀환 존 저장
    this.savedMonsters = [...this.monsterManager.monsters];
    this.savedReturnX = px;
    this.savedReturnY = py;
    this.savedReturnZone = this.currentZone;  // ← 직전 전투 존 기억

    console.log("🔵 [Portal] Village portal created at", portalX, portalY);
    this.combatTextManager.add(px, py - 100, "✦ 마을 포털 개방!", "heal");
  }

  private checkPortals(portals?: any[]): void {
    if (!portals || this.isTransitioning) return;
    for (const portal of portals) {
      this.checkSinglePortal(portal);
    }
  }

  private checkSinglePortal(portal: any): void {
    if (this.isTransitioning) return;
    if (
      this.player.position.x >= portal.x &&
      this.player.position.x <= portal.x + portal.width &&
      this.player.position.y >= portal.y &&
      this.player.position.y <= portal.y + portal.height
    ) {
      const isReturnFromVillage = this.currentZone === 99;

      // 마을에서 복귀: 직전 전투 존으로 이동 (고정 zone 1 아님)
      const targetZoneId = isReturnFromVillage
        ? (this.savedReturnZone || portal.targetZoneId)
        : portal.targetZoneId;

      console.log(`Portal hit! Transitioning to zone ${targetZoneId}`);
      this.state = "transitioning" as any;
      this.isTransitioning = true;

      this.transitionToZone(
        targetZoneId,
        portal.targetX,
        portal.targetY,
        isReturnFromVillage
      );
    }
  }

  private async transitionToZone(
    zoneId: number,
    targetX: number,
    targetY: number,
    isReturnFromVillage: boolean = false
  ): Promise<void> {
    console.log(`Loading new zone: Zone ${zoneId}...`);

    this.fadeTarget = 1;
    await new Promise(resolve => setTimeout(resolve, 500));

    this.currentZone = zoneId;

    const config = getZoneConfig(zoneId);
    if (!config) {
      console.error("Target zone not found!");
      this.state = "playing";
      this.isTransitioning = false;
      this.fadeTarget = 0;
      return;
    }

    await this.loadImageResources(config);

    // ── 마을에서 돌아왔을 때: 저장된 몬스터 복원 ──
    if (isReturnFromVillage && this.savedMonsters.length > 0) {
      this.monsterManager.monsters = this.savedMonsters.filter(m => !m.isDead);
      this.savedMonsters = [];
      console.log(`✅ [Portal] Restored ${this.monsterManager.monsters.length} monsters from village save`);
    } else if (!isReturnFromVillage && zoneId !== 99) {
      // 일반 존 전환: 새로 스폰
      this.monsterManager.monsters = [];
      this.monsterManager.resetSpawnState();
      this.monsterManager.spawnInitialMonsters(config, { x: targetX, y: targetY } as any);
    } else if (zoneId === 99) {
      // 마을로 이동: 몬스터 없음
      this.monsterManager.monsters = [];
    }

    // 플레이어 위치 이동
    // 마을에서 돌아오면 저장된 귀환 위치 우선
    if (isReturnFromVillage && (this.savedReturnX !== 0 || this.savedReturnY !== 0)) {
      this.player.position.x = this.savedReturnX;
      this.player.position.y = this.savedReturnY;
      // 귀환 후 임시 포탈 제거
      this.playerPortal = null;
      this.savedReturnX = 0;
      this.savedReturnY = 0;
    } else {
      this.player.position.x = targetX;
      this.player.position.y = targetY;
    }

    // 존 모드 갱신
    const owConfig = config.openWorldMapConfig;
    this.ZoneMap = new ZoneMap(owConfig);
    this.ZoneMap.setImages(this.resourceLoader.getImages());
    await this.loadMapData(config);
    this.player.setZoneMap(this.ZoneMap);
    this.monsterManager.setZoneMap(this.ZoneMap);

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
        this.camera.viewSize = 2048;
        this.camera.bounds = null;
      }
      this.camera.setScaleToViewSize();
    }
    this.camera.follow(this.player.position, true);
    this.ZoneMap.updateVisibleTiles(this.camera);

    this.fadeTarget = 0;
    this.state = "playing";

    await new Promise(resolve => setTimeout(resolve, 500));
    this.isTransitioning = false;
    this.lastFrameTime = performance.now();
  }

  // ─────────────────────────────────────────────────────
  //  포털 시각화
  // ─────────────────────────────────────────────────────

  private renderPlayerPortal(): void {
    if (!this.playerPortal) return;

    const portal = this.playerPortal;
    const screen = this.camera.worldToScreen(portal.x, portal.y);
    const scale = this.camera.scale ?? 1;
    const pw = portal.width * scale;
    const ph = portal.height * scale;
    const t = this.portalAnimTimer;

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 포털 외부 글로우
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    this.ctx.shadowColor = `rgba(80, 160, 255, ${0.6 + pulse * 0.4})`;
    this.ctx.shadowBlur = 30 + pulse * 20;

    // 포털 외곽 (긴 둥근 원 모양, 점선 제거)
    const cx = screen.x + pw / 2;
    const cy = screen.y + ph / 2;
    const rx = pw / 2;
    const ry = ph / 2;

    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

    // 포털 몸체 (신비로운 아쿠아 / 에메랄드 색상 변경)
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, ry);
    grad.addColorStop(0, `rgba(50, 255, 180, ${0.4 + pulse * 0.2})`);
    grad.addColorStop(1, `rgba(0, 150, 120, ${0.1 + pulse * 0.1})`);
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // 부드러운 단선 테두리
    this.ctx.strokeStyle = `rgba(100, 255, 200, ${0.8 + pulse * 0.2})`;
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    // 포털 내부 소용돌이 효과 (타원형)
    for (let i = 3; i >= 1; i--) {
      const r_x = rx * (i / 3) * (0.8 + 0.2 * Math.sin(t * 2 + i));
      const r_y = ry * (i / 3) * (0.8 + 0.2 * Math.sin(t * 2 + i));
      const innerGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r_y);
      innerGrad.addColorStop(0, `rgba(150, 255, 220, ${0.15 * i})`);
      innerGrad.addColorStop(1, 'rgba(0, 200, 150, 0)');
      this.ctx.fillStyle = innerGrad;
      this.ctx.beginPath();
      this.ctx.ellipse(cx, cy, r_x, r_y, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  // ─────────────────────────────────────────────────────
  //  헬퍼 / 이벤트 설정
  // ─────────────────────────────────────────────────────

  private initializeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
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

    // 마을 포털 생성 (V)
    inputManager.onKeyDown("KeyV", () => {
      if (this.state === "playing") {
        this.createPlayerPortal();
      }
    });

    // NPC 상호작용 (F)
    inputManager.onKeyDown("KeyF", () => {
      if (this.state === "playing" && this.currentZone === 99) {
        const msg = this.villageManager.interact();
        if (msg) {
          this.villageManager.showMessage(msg);
        }
      }
    });

    // 마우스 클릭
    inputManager.onMouseDown((e: MouseEvent) => {
      if (this.player.isStorageOpen) {
        const handled = this.storageManager.handleClick(e);
        if (handled) return;
      }
      if (this.player.isInventoryOpen) {
        const handled = this.inventoryManager.handleClick(e);
        if (handled) return;
      } else {
        const { x, y } = inputManager.getMousePosition();
        const rect = this.canvas.getBoundingClientRect();
        const localX = x - rect.left;
        const localY = y - rect.top;
        const iconRect = this.renderManager.interfaceManager.iconRects['inventory'];
        if (iconRect && localX >= iconRect.x && localX <= iconRect.x + iconRect.w && localY >= iconRect.y && localY <= iconRect.y + iconRect.h) {
          this.playerManager.toggleInventory();
          return;
        }
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

    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

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

  // ─────────────────────────────────────────────────────
  //  저장 / 로딩
  // ─────────────────────────────────────────────────────

  /** 자동 저장 (백그라운드) */
  private autoSave(): void {
    const sm = SaveManager.getInstance();
    const equipment: Record<string, any> = {};
    Object.entries(this.player.equipment).forEach(([k, item]) => {
      if (item) equipment[k] = item.data;
    });
    sm.save({
      version: 1,
      savedAt: new Date().toISOString(),
      player: {
        level: this.player.levelSystem.level,
        exp: this.player.levelSystem.currentExp,
        hp: this.player.hp,
        lastZone: this.currentZone,
        lastX: Math.round(this.player.position.x),
        lastY: Math.round(this.player.position.y),
      },
      inventory: this.player.inventory.items.map(i => i.data),
      equipment,
    });
  }

  /**
   * 게임 로딩 시 저장 데이터 복원
   * loadResources() 이후 호출
   */
  async loadSaveData(): Promise<boolean> {
    const sm = SaveManager.getInstance();
    const save = await sm.load();
    if (!save) return false;
    this.applyLoadedSave(save);
    return true;
  }

  private applyLoadedSave(save: any): void {
    const p = save.player;
    if (!p) return;

    // 레벨 / 경험치 복원
    this.player.levelSystem = LevelSystem.deserialize({ level: p.level ?? 1, exp: p.exp ?? 0 });
    this.player.hp = p.hp ?? this.player.maxHp;

    // 마지막 위치 복원
    this.player.position.x = p.lastX ?? 0;
    this.player.position.y = p.lastY ?? 0;

    // 인벤토리 복원
    if (Array.isArray(save.inventory)) {
      save.inventory.forEach((data: any) => {
        this.player.inventory.add(new Item(data));
      });
    }

    // 장비 복원
    if (save.equipment && typeof save.equipment === 'object') {
      Object.entries(save.equipment).forEach(([slot, data]: [string, any]) => {
        if (data) {
          (this.player.equipment as Record<string, any>)[slot] = new Item(data);
        }
      });
    }

    this.player.updateStats();
    // 복원 후 hp 콜램프 (maxHp 업데이트 후)
    if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;
    console.log(`📂 Save loaded. Level: ${this.player.levelSystem.level}`);
  }
}

