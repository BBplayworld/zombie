import { Camera } from './Camera'

interface WalkableGrid {
  cellSize: number;
  cols: number;
  rows: number;
  data: string;
}

/**
 * 오픈 월드 맵: 단일 맵 이미지 렌더링 + 이동 가능 영역(폴리곤) 관리
 */
export class ZoneMap {
  private CONFIG: any
  private images: Map<string, HTMLImageElement> = new Map()

  private mapDataPolygons: { x: number, y: number }[][] = []
  private obstaclePolygons: { x: number, y: number }[][] = []
  private mapWidth: number = 0
  private mapHeight: number = 0
  private polygonsAreObstacles: boolean = false
  private walkableGrid: WalkableGrid | null = null
  /** 이동 스텝 그리드: map-data.json 기준 이동 가능 셀. 맵 로드 시 1회만 채움. 렌더는 캐시만 보고 그리기만 함 */
  private stepGridWalkableCache: Set<string> | null = null

  constructor(config?: any) {
    this.CONFIG = config || {}
  }

  setImages(images: Map<string, HTMLImageElement>): void {
    this.images = images
  }

  /**
   * 맵 데이터 로드
   * @param mapData tiles: 빨간(주황) 이동 가능 폴리곤
   * @param options.obstacleTiles 녹색 이동 불가(구멍) 폴리곤
   */
  loadMapData(
    mapData: { x: number, y: number }[] | { x: number, y: number }[][],
    width: number,
    height: number,
    options?: { polygonsAreObstacles?: boolean; obstacleTiles?: { x: number; y: number }[][]; walkableGrid?: WalkableGrid }
  ): void {
    const first = mapData[0]
    const isMulti = Array.isArray(first) && first.length > 0 && typeof (first as { x?: number }[])[0] === 'object'
    this.mapDataPolygons = isMulti
      ? (mapData as { x: number, y: number }[][])
      : [mapData as { x: number, y: number }[]]
    this.mapWidth = width
    this.mapHeight = height
    this.polygonsAreObstacles = options?.polygonsAreObstacles ?? false
    this.obstaclePolygons = options?.obstacleTiles ?? []
    this.walkableGrid = options?.walkableGrid ?? null
    this.buildStepGridCacheOnce()
  }

  /** map-data.json(tiles/obstacleTiles) 기준으로 이동 가능 셀만 1회 계산. 로드 시만 호출, 렌더에서는 캐시만 사용 */
  /** 캐시 그리드 기준 원점 (렌더링과 동일한 정렬 보장) */
  private stepGridOrigin: { x: number; y: number } = { x: 0, y: 0 }

  private buildStepGridCacheOnce(): void {
    const bounds = this.getWalkableBounds()
    if (!bounds) {
      this.stepGridWalkableCache = null
      return
    }
    const cellSize = ZoneMap.STEP_GRID.cellSize
    const halfCell = cellSize / 2
    const cache = new Set<string>()
    // 그리드 원점을 bounds.minX/minY 기준으로 고정
    const gx0 = Math.floor(bounds.minX / cellSize) * cellSize
    const gy0 = Math.floor(bounds.minY / cellSize) * cellSize
    this.stepGridOrigin = { x: gx0, y: gy0 }
    for (let gx = gx0; gx < bounds.maxX; gx += cellSize) {
      for (let gy = gy0; gy < bounds.maxY; gy += cellSize) {
        if (this.isWalkableAtWorld(gx + halfCell, gy + halfCell)) {
          cache.add(`${gx},${gy}`)
        }
      }
    }
    this.stepGridWalkableCache = cache
  }

  /** 미니맵용 폴리곤 데이터 반환 (다중 폴리곤 지원) */
  getMapPolygon(): { x: number, y: number }[] | { x: number, y: number }[][] {
    return this.mapDataPolygons.length === 1
      ? this.mapDataPolygons[0]
      : this.mapDataPolygons
  }

  /** 미니맵용 월드 경계 반환 */
  getWalkableBounds(): { minX: number, maxX: number, minY: number, maxY: number } | null {
    return this.CONFIG.walkableArea || this.CONFIG.mapBoundary || null
  }

  /**
   * 월드 좌표가 이동 가능 영역 내에 있는지 확인
   * walkableArea를 우선 사용, 없으면 mapBoundary 사용 (하위 호환)
   */
  isInWalkableArea(worldX: number, worldY: number): boolean {
    const area = this.CONFIG.walkableArea || this.CONFIG.mapBoundary

    if (!area) {
      // Area not defined, rely on mapData polygon
      return true
    }

    const { minX, maxX, minY, maxY } = area
    return worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY
  }

  /**
   * 월드 좌표가 이동 가능한지 확인
   *
   * walkableGrid 있을 때: AABB 범위 체크 후 픽셀 정밀 그리드 lookup (O(1))
   *   - isRedPixel() 결과 기반이므로 우물/외곽 모두 정확히 막힘
   * walkableGrid 없을 때(폴백): obstacleTiles 폴리곤 + zone AABB
   */
  isWalkableAtWorld(worldX: number, worldY: number, buffer: number = 0): boolean {
    // 1. AABB 범위 체크 (항상 먼저)
    if (!this.isInWalkableArea(worldX, worldY)) return false

    // 2. walkableGrid 있으면 픽셀 정밀 그리드로 판별
    if (this.walkableGrid) {
      if (!this.isWalkableAtGrid(worldX, worldY)) return false
      if (buffer > 0) {
        const offsets = [
          { x: 0, y: -buffer },
          { x: 0, y: buffer },
          { x: -buffer, y: 0 },
          { x: buffer, y: 0 }
        ]
        for (const offset of offsets) {
          if (!this.isWalkableAtGrid(worldX + offset.x, worldY + offset.y)) return false
        }
      }
      return true
    }

    // 폴백: buffer 체크도 walkableArea로만 수행
    if (buffer > 0) {
      const offsets = [
        { x: 0, y: -buffer },
        { x: 0, y: buffer },
        { x: -buffer, y: 0 },
        { x: buffer, y: 0 }
      ]
      for (const offset of offsets) {
        if (!this.isInWalkableArea(worldX + offset.x, worldY + offset.y)) return false
      }
    }

    // 폴백: 장애물 폴리곤 체크
    if (this.isPointInAnyObstacle(worldX, worldY)) return false

    const hasWalkableArea = !!(this.CONFIG.walkableArea || this.CONFIG.mapBoundary)
    if (hasWalkableArea) return true

    if (this.mapDataPolygons.length > 0) {
      if (this.polygonsAreObstacles) {
        return !this.isPointInAnyPolygon(worldX, worldY)
      }
      return this.isPointInAnyPolygon(worldX, worldY)
    }

    return true
  }

  /** walkableGrid 셀 lookup. 월드 좌표 → 픽셀 인덱스 → 그리드 셀 */
  private isWalkableAtGrid(worldX: number, worldY: number): boolean {
    const { cellSize, cols, rows, data } = this.walkableGrid!
    const gridX = Math.floor((worldX + this.mapWidth / 2) / cellSize)
    const gridY = Math.floor((worldY + this.mapHeight / 2) / cellSize)
    if (gridX < 0 || gridX >= cols || gridY < 0 || gridY >= rows) return false
    return data[gridY * cols + gridX] === '1'
  }

  /**
   * 맵 이미지가 렌더링되는 스크린 영역(픽셀) 반환
   * Camera와 현재 canvas 크기가 필요함
   */
  getMapScreenRect(camera: Camera): { x: number; y: number; w: number; h: number } | null {
    const worldSize = this.CONFIG.worldSize
    if (!worldSize) return null
    const scale = camera.scale ?? 1
    const screenW = worldSize.width * scale
    const screenH = worldSize.height * scale
    const screenPos = camera.worldToScreen(0, 0)
    return {
      x: screenPos.x - screenW / 2,
      y: screenPos.y - screenH / 2,
      w: screenW,
      h: screenH
    }
  }

  private isPointInAnyObstacle(x: number, y: number): boolean {
    for (const points of this.obstaclePolygons) {
      if (points.length >= 3 && this.rayCastPointInPolygon(x, y, points)) return true
    }
    return false
  }

  /** 다중 폴리곤 중 한 곳이라도 포함되면 true */
  private isPointInAnyPolygon(x: number, y: number): boolean {
    for (const points of this.mapDataPolygons) {
      if (points.length >= 3 && this.rayCastPointInPolygon(x, y, points)) return true
    }
    return false
  }

  /**
   * Point-In-Polygon (Ray Casting)
   */
  private rayCastPointInPolygon(x: number, y: number, points: { x: number, y: number }[]): boolean {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y
      const xj = points[j].x, yj = points[j].y
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  /**
   * 이동 가능 영역 내부의 랜덤 좌표 반환 (게임 시작용)
   *
   * @param collisionYOffset 플레이어 충돌 포인트의 Y 오프셋 (applyMovement와 동일한 값 전달 필수)
   * @param safeMargin       경계에서 최소 이 거리만큼 떨어진 위치만 허용 (px)
   *
   * 1순위: stepGridWalkableCache 에서 랜덤 셀 최대 200회 시도 —
   *        (x,y), (x,y+offset), 상하좌우 margin 지점 전부 워크어블인 셀만 허용
   * 2순위: walkableArea 범위 랜덤 시도 500회
   * 3순위: walkableArea 중심 좌표 폴백
   */
  getRandomWalkablePosition(
    collisionYOffset: number = 0,
    safeMargin: number = 80,
  ): { x: number; y: number } | null {
    const bounds = this.getWalkableBounds();

    // 스폰 안전 조건 헬퍼
    const isSafeSpawn = (x: number, y: number): boolean => {
      if (!this.isWalkableAtWorld(x, y)) return false;
      if (collisionYOffset !== 0 && !this.isWalkableAtWorld(x, y + collisionYOffset)) return false;
      const dirs = [
        { dx: 0, dy: -safeMargin },
        { dx: 0, dy: safeMargin },
        { dx: -safeMargin, dy: 0 },
        { dx: safeMargin, dy: 0 },
      ];
      for (const d of dirs) {
        if (!this.isWalkableAtWorld(x + d.dx, y + d.dy)) return false;
        if (collisionYOffset !== 0 && !this.isWalkableAtWorld(x + d.dx, y + d.dy + collisionYOffset)) return false;
      }
      return true;
    };

    // 1순위: 스텝 그리드 캐시에서 랜덤 셀 선택 (정확한 워크어블 셀 보장)
    if (this.stepGridWalkableCache && this.stepGridWalkableCache.size > 0) {
      const cells = Array.from(this.stepGridWalkableCache);
      const maxTries = Math.min(cells.length, 200);
      const halfCell = ZoneMap.STEP_GRID.cellSize / 2;

      for (let i = 0; i < maxTries; i++) {
        const pick = cells[Math.floor(Math.random() * cells.length)];
        const [gx, gy] = pick.split(',').map(Number);
        if (isSafeSpawn(gx + halfCell, gy + halfCell)) {
          return { x: gx + halfCell, y: gy + halfCell };
        }
      }
    }

    // 2순위: 폴리곤 범위 랜덤 시도
    if (!bounds && !this.mapDataPolygons.length) return null;

    const minX = bounds?.minX ?? -2024;
    const maxX = bounds?.maxX ?? 2024;
    const minY = bounds?.minY ?? -2024;
    const maxY = bounds?.maxY ?? 2024;

    for (let attempt = 0; attempt < 500; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (isSafeSpawn(x, y)) return { x, y };
    }

    // 3순위: 최종 폴백 — walkableArea 중심
    if (bounds) {
      return {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
    }
    return null;
  }


  /**
   * 좌표를 월드 좌표로 반환 (타일 그리드 미사용 시 단순 identity)
   */
  getWorldPosition(x: number, y: number): { x: number; y: number } {
    return { x, y }
  }

  /**
   * 그리드 인덱스를 월드 좌표로 변환 (폴백용, 단순 스케일)
   */
  gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return this.getWorldPosition(gridX, gridY)
  }

  updateVisibleTiles(_camera: Camera): void {
    // 단일 맵 모드에서는 사용하지 않음
  }

  /**
   * 이동 스텝 그리드. enabled=false면 그리드 미표시로 FPS 60 유지.
   * - enabled: true로 두면 매 프레임 폴리곤 검사로 부하 증가 → 필요 시에만 true.
   * - cellSize: 그리드 셀 한 변(월드). 클수록 셀 수 감소해 가벼움.
   */
  static readonly STEP_GRID = {
    enabled: false,
    cellSize: 24,
    boxRatio: 0.75,
    gap: undefined as number | undefined,
  }

  /**
   * 단일 맵 이미지 렌더링
   */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const worldSize = this.CONFIG.worldSize
    const mapWidth = worldSize?.width
    const mapHeight = worldSize?.height
    const scale = camera.scale ?? 1
    const screenW = mapWidth * scale
    const screenH = mapHeight * scale
    const screenPos = camera.worldToScreen(0, 0)
    const drawX = screenPos.x - screenW / 2
    const drawY = screenPos.y - screenH / 2

    const mapBg = this.images.get('mapBackground')
    if (mapBg?.complete && (mapBg.naturalWidth ?? 0) > 0) {
      ctx.drawImage(mapBg, drawX, drawY, screenW, screenH)
    }

    if (ZoneMap.STEP_GRID.enabled) {
      this.renderMovementStepGrid(ctx, camera)
    }
    this.renderPortals(ctx, camera)
    this.renderEdgeShadows(ctx, camera, drawX, drawY, screenW, screenH)
  }

  private renderPortals(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const config = this.CONFIG
    if (config.mapType !== 'zone' || !config.portals) return

    ctx.save()
    for (const portal of config.portals) {
      const screenPos = camera.worldToScreen(portal.x, portal.y)
      const scale = camera.scale ?? 1

      ctx.fillStyle = 'rgba(100, 200, 255, 0.4)'
      ctx.fillRect(screenPos.x, screenPos.y, portal.width * scale, portal.height * scale)

      ctx.strokeStyle = 'cyan'
      ctx.lineWidth = 2
      ctx.strokeRect(screenPos.x, screenPos.y, portal.width * scale, portal.height * scale)

      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(`PORTAL to Zone ${portal.targetZoneId}`, screenPos.x + 5, screenPos.y + 15)
    }
    ctx.restore()
  }

  /**
   * 이동 가능 영역을 네모 박스로 표시만 함. map-data.json으로 이미 정해진 영역을 캐시에서 읽어 그리기만 하며
   * isWalkableAtWorld 등 로직 없음 → FPS와 무관.
   * 캐시는 로드 시 1회만 구성되며, 이후 렌더링은 캐시 조회만 수행.
   */
  private renderMovementStepGrid(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const cache = this.stepGridWalkableCache
    if (cache === null || cache.size === 0) return

    const cfg = ZoneMap.STEP_GRID
    const cellSize = cfg.cellSize
    const boxSize = cfg.gap !== undefined ? cellSize - cfg.gap : cellSize * cfg.boxRatio
    const inset = (cellSize - boxSize) / 2

    const scale = camera.scale ?? 1
    // 카메라 뷰 월드 영역 계산 (camera.position은 뷰 좌상단 월드 좌표)
    const vw = camera.width / scale
    const vh = camera.height / scale
    const viewLeft = camera.position.x
    const viewTop = camera.position.y
    const viewRight = viewLeft + vw
    const viewBottom = viewTop + vh

    // 캐시 그리드 원점(gx0, gy0)에서 정렬된 범위만 순회
    const origin = this.stepGridOrigin
    // 뷰 범위에 맞는 셀 인덱스 계산
    const ixMin = Math.floor((viewLeft - origin.x) / cellSize)
    const ixMax = Math.ceil((viewRight - origin.x) / cellSize)
    const iyMin = Math.floor((viewTop - origin.y) / cellSize)
    const iyMax = Math.ceil((viewBottom - origin.y) / cellSize)

    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)'
    ctx.lineWidth = 0.5

    for (let ix = ixMin; ix <= ixMax; ix++) {
      for (let iy = iyMin; iy <= iyMax; iy++) {
        const gx = origin.x + ix * cellSize
        const gy = origin.y + iy * cellSize
        if (!cache.has(`${gx},${gy}`)) continue

        const screen = camera.worldToScreen(gx + inset, gy + inset)
        const size = boxSize * scale
        ctx.fillRect(screen.x, screen.y, size, size)
        ctx.strokeRect(screen.x, screen.y, size, size)
      }
    }

    ctx.restore()
  }

  /**
   * 월드맵 동서남북 가장자리 비네트 그림자 (게임 시작 화면과 동일한 느낌)
   */
  private renderEdgeShadows(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    drawX: number,
    drawY: number,
    mapWidth: number,
    mapHeight: number
  ): void {
    const edgeSize = Math.min(mapWidth, mapHeight) * 0.01
    const topH = edgeSize
    const bottomH = edgeSize
    const leftW = edgeSize
    const rightW = edgeSize

    ctx.save()
    // 상단
    const gradTop = ctx.createLinearGradient(drawX, drawY, drawX, drawY + topH)
    gradTop.addColorStop(0, 'rgba(0, 0, 0, 0.75)')
    gradTop.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradTop
    ctx.fillRect(drawX, drawY, mapWidth, topH)
    // 하단
    const gradBottom = ctx.createLinearGradient(drawX, drawY + mapHeight - bottomH, drawX, drawY + mapHeight)
    gradBottom.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradBottom.addColorStop(1, 'rgba(0, 0, 0, 0.92)')
    ctx.fillStyle = gradBottom
    ctx.fillRect(drawX, drawY + mapHeight - bottomH, mapWidth, bottomH)
    // 좌측
    const gradLeft = ctx.createLinearGradient(drawX, drawY, drawX + leftW, drawY)
    gradLeft.addColorStop(0, 'rgba(0, 0, 0, 0.75)')
    gradLeft.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradLeft
    ctx.fillRect(drawX, drawY, leftW, mapHeight)
    // 우측
    const gradRight = ctx.createLinearGradient(drawX + mapWidth - rightW, drawY, drawX + mapWidth, drawY)
    gradRight.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradRight.addColorStop(1, 'rgba(0, 0, 0, 0.75)')
    ctx.fillStyle = gradRight
    ctx.fillRect(drawX + mapWidth - rightW, drawY, rightW, mapHeight)
    ctx.restore()
  }
}
