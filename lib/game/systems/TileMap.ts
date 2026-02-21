import { Camera } from './Camera'

/**
 * 오픈 월드 맵: 단일 맵 이미지 렌더링 + 이동 가능 영역(폴리곤) 관리
 */
export class TileMap {
  private CONFIG: any
  private images: Map<string, HTMLImageElement> = new Map()

  private mapDataPolygons: { x: number, y: number }[][] = []
  private mapWidth: number = 0
  private mapHeight: number = 0

  constructor(config?: any) {
    this.CONFIG = config || {}
  }

  setImages(images: Map<string, HTMLImageElement>): void {
    this.images = images
  }

  /**
   * 맵 데이터 로드 (충돌 감지용 폴리곤)
   * @param mapData 단일 폴리곤(Point[]) 또는 다중 폴리곤(Point[][])
   */
  loadMapData(
    mapData: { x: number, y: number }[] | { x: number, y: number }[][],
    width: number,
    height: number
  ): void {
    const first = mapData[0]
    const isMulti = Array.isArray(first) && first.length > 0 && typeof (first as { x?: number }[])[0] === 'object'
    this.mapDataPolygons = isMulti
      ? (mapData as { x: number, y: number }[][])
      : [mapData as { x: number, y: number }[]]
    this.mapWidth = width
    this.mapHeight = height
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
   * 1. walkableArea 범위 체크
   * 2. Polygon Point Detection (Ray Casting)
   */
  isWalkableAtWorld(worldX: number, worldY: number, buffer: number = 0): boolean {
    // 1. 이동 가능 영역(Bounding Box) 체크
    if (!this.isInWalkableArea(worldX, worldY)) return false

    // 2. 맵 데이터가 없으면 영역 체크만으로 충분
    if (!this.mapDataPolygons.length) return true

    // 3. Polygon Collision Check (다중 폴리곤 중 하나라도 포함이면 이동 가능)
    if (buffer > 0) {
      const offsets = [
        { x: 0, y: -buffer },
        { x: 0, y: buffer },
        { x: -buffer, y: 0 },
        { x: buffer, y: 0 }
      ]
      for (const offset of offsets) {
        if (!this.isPointInAnyPolygon(worldX + offset.x, worldY + offset.y)) {
          return false
        }
      }
      return true
    }
    return this.isPointInAnyPolygon(worldX, worldY)
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
   * 이동 가능 영역(폴리곤) 내부의 랜덤 좌표 반환 (게임 시작용)
   */
  getRandomWalkablePosition(): { x: number; y: number } | null {
    if (!this.mapDataPolygons.length) return null
    const bounds = this.getWalkableBounds()
    const minX = bounds?.minX ?? -2024
    const maxX = bounds?.maxX ?? 2024
    const minY = bounds?.minY ?? -2024
    const maxY = bounds?.maxY ?? 2024
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = minX + Math.random() * (maxX - minX)
      const y = minY + Math.random() * (maxY - minY)
      if (this.isWalkableAtWorld(x, y)) return { x, y }
    }
    return null
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

  /** 턴제 RPG 스타일 이동 스텝 그리드 한 칸 크기 (Player 이동 스텝과 동일하게 128*2) */
  private static readonly STEP_GRID_SIZE = 256

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

    this.renderMovementStepGrid(ctx, camera)
    this.renderEdgeShadows(ctx, camera, drawX, drawY, screenW, screenH)
  }

  /**
   * 이동 가능 범위를 턴제 RPG처럼 스텝별 사각형 그리드로 표시.
   * 네모는 셀보다 작게 그려서 이동 가능한 x,y 범위 안에만 들어가도록 함.
   */
  private renderMovementStepGrid(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const bounds = this.getWalkableBounds()
    if (!bounds) return

    const step = TileMap.STEP_GRID_SIZE
    const scale = camera.scale ?? 1
    const padding = step * 2
    /** 그리드 셀 대비 그리기 비율 (1보다 작게 해서 경계 안쪽에만 박스 표시) */
    const drawRatio = 0.95
    const drawStep = step * drawRatio
    const inset = (step - drawStep) / 2

    const startX = Math.floor(bounds.minX / step) * step
    const startY = Math.floor(bounds.minY / step) * step

    ctx.save()
    ctx.fillStyle = 'rgba(64, 128, 255, 0.12)'
    ctx.strokeStyle = 'rgba(64, 128, 255, 0.35)'
    ctx.lineWidth = 1

    for (let gx = startX; gx < bounds.maxX; gx += step) {
      for (let gy = startY; gy < bounds.maxY; gy += step) {
        const cellMinX = gx
        const cellMinY = gy
        const cellMaxX = gx + step
        const cellMaxY = gy + step
        if (cellMinX < bounds.minX || cellMaxX > bounds.maxX || cellMinY < bounds.minY || cellMaxY > bounds.maxY) continue
        const cx = gx + step / 2
        const cy = gy + step / 2
        if (!this.isWalkableAtWorld(cx, cy)) continue
        if (!camera.isInView(gx, gy, step, step, padding)) continue

        const screen = camera.worldToScreen(gx + inset, gy + inset)
        const size = drawStep * scale
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
    const edgeSize = Math.min(mapWidth, mapHeight) * 0.03
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
