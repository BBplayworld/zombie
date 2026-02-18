import { Camera } from './Camera'

/**
 * 타일 정보
 */
interface Tile {
  imageKey: string
  x: number
  y: number
  width: number
  height: number
  gridX: number // 그리드 좌표
  gridY: number
}

/**
 * 아이소메트릭 타일맵 시스템
 * 오픈 월드 맵 이미지 기반 렌더링 및 이동 제한 관리
 */
export class TileMap {
  private CONFIG: any
  private tiles: Tile[] = []
  private sourceWidth: number
  private sourceHeight: number
  private tileWidth: number
  private tileHeight: number
  private images: Map<string, HTMLImageElement> = new Map()

  // 맵 데이터 (충돌 감지용 - Polygon Boundary)
  private mapData: { x: number, y: number }[] = []
  private mapWidth: number = 0
  private mapHeight: number = 0

  // 아이소메트릭 타일 설정
  private baseTileKey: string = 'baseTile'
  private frameCount: number = 0

  // 아이소메트릭 좌표 변환 상수
  private readonly TILE_WIDTH_HALF: number
  private readonly TILE_HEIGHT_HALF: number
  private readonly Y_SPACING: number

  constructor(config?: any) {
    this.CONFIG = config || {
      SOURCE_WIDTH: 1024,
      SOURCE_HEIGHT: 1024,
      TILE_WIDTH: 128,
      TILE_HEIGHT: 124,
      Y_SPACING_MULTIPLIER: 0.5,
      OVERLAP_OFFSET: 80,
      VISIBLE_MARGIN: 20,
      ENABLE_DEPTH_SORTING: true,
    }

    // OpenWorldMapConfig 구조 지원
    if (this.CONFIG.worldSize) {
      this.sourceWidth = this.CONFIG.worldSize.width
      this.sourceHeight = this.CONFIG.worldSize.height
    } else {
      this.sourceWidth = this.CONFIG.SOURCE_WIDTH || this.CONFIG.sourceWidth || 1024
      this.sourceHeight = this.CONFIG.SOURCE_HEIGHT || this.CONFIG.sourceHeight || 1024
    }

    if (this.CONFIG.backgroundTile) {
      this.tileWidth = this.CONFIG.backgroundTile.width
      this.tileHeight = this.CONFIG.backgroundTile.height
    } else {
      this.tileWidth = this.CONFIG.TILE_WIDTH || this.CONFIG.tileWidth || 128
      this.tileHeight = this.CONFIG.TILE_HEIGHT || this.CONFIG.tileHeight || 64
    }

    this.TILE_WIDTH_HALF = this.tileWidth / 2
    this.TILE_HEIGHT_HALF = this.tileHeight / 2

    let yMultiplier = 0.5
    if (this.CONFIG.backgroundTile) {
      yMultiplier = this.CONFIG.backgroundTile.ySpacingMultiplier
    } else {
      yMultiplier = this.CONFIG.Y_SPACING_MULTIPLIER || this.CONFIG.ySpacingMultiplier || 0.5
    }

    this.Y_SPACING = this.TILE_HEIGHT_HALF * yMultiplier
  }

  /**
   * 이미지 리소스 설정
   */
  setImages(images: Map<string, HTMLImageElement>): void {
    this.images = images
  }

  /**
   * 베이스 타일 키 설정
   */
  setBaseTile(key: string): void {
    this.baseTileKey = key
  }

  /**
   * 맵 데이터 로드 (충돌 감지용 폴리곤)
   */
  loadMapData(mapData: { x: number, y: number }[], width: number, height: number): void {
    this.mapData = mapData
    this.mapWidth = width
    this.mapHeight = height
  }

  /**
   * 특정 그리드 위치가 이동 가능한지 확인
   * @deprecated Polygon collision does not use grid.
   */
  isWalkable(gridX: number, gridY: number): boolean {
    return false
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
    if (!this.mapData || this.mapData.length < 3) return true

    // 3. Polygon Collision Check (Ray Casting)
    if (buffer > 0) {
      const offsets = [
        { x: 0, y: -buffer },
        { x: 0, y: buffer },
        { x: -buffer, y: 0 },
        { x: buffer, y: 0 }
      ]

      for (const offset of offsets) {
        if (!this.isPointInPolygon(worldX + offset.x, worldY + offset.y)) {
          return false
        }
      }
      return true
    }

    return this.isPointInPolygon(worldX, worldY)
  }

  /**
   * Point-In-Polygon Algorithm (Ray Casting)
   */
  private isPointInPolygon(x: number, y: number): boolean {
    let inside = false
    const points = this.mapData
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
   * 그리드 좌표를 월드 좌표로 변환 (public)
   */
  getWorldPosition(gridX: number, gridY: number): { x: number; y: number } {
    return this.gridToWorld(gridX, gridY)
  }

  /**
   * 그리드 좌표를 아이소메트릭 월드 좌표로 변환
   */
  public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: (gridX - gridY) * this.TILE_WIDTH_HALF,
      y: (gridX + gridY) * this.Y_SPACING
    }
  }

  /**
   * 카메라 뷰포트에 보이는 타일들만 동적으로 생성
   * (Polygon 모드에서는 개별 타일 렌더링을 지원하지 않음 - 통맵 사용 권장)
   */
  updateVisibleTiles(camera: Camera): void {
    this.tiles = []
  }

  /**
   * 타일맵 렌더링
   */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const mapBg = this.images.get('mapBackground')

    if (mapBg && mapBg.complete && mapBg.naturalWidth !== 0) {
      // 맵 이미지 렌더링
      const screenPos = camera.worldToScreen(0, 0)
      const worldSize = this.CONFIG.worldSize
      let mapWidth = worldSize ? worldSize.width : mapBg.naturalWidth
      let mapHeight = worldSize ? worldSize.height : mapBg.naturalHeight

      const drawX = screenPos.x - mapWidth / 2
      const drawY = screenPos.y - mapHeight / 2

      ctx.drawImage(mapBg, drawX, drawY, mapWidth, mapHeight)

      // 1. 이동 가능 영역 그림자 처리 (Point #1)
      const area = this.CONFIG.walkableArea || this.CONFIG.mapBoundary
      if (area) {
        const wx = screenPos.x + area.minX
        const wy = screenPos.y + area.minY
        const ww = area.maxX - area.minX
        const wh = area.maxY - area.minY

        ctx.save()
        // 비이동 영역(바깥쪽) 어둡게 처리
        ctx.beginPath()
        // 전체 맵 범위 (넉넉하게)
        ctx.rect(drawX - 500, drawY - 500, mapWidth + 1000, mapHeight + 1000)
        // 이동 가능 영역 (반 시계 방향 또는 evenodd로 구멍 뚫기)
        ctx.rect(wx, wy, ww, wh)

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.fill('evenodd')

        // 경계선 부드러운 그림자 효과
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
        ctx.shadowBlur = 60
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.lineWidth = 5
        ctx.strokeRect(wx, wy, ww, wh)
        ctx.restore()
      }
    }
  }
}
