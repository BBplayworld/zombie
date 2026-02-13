import { Camera } from './useCamera'

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
 * 다이아몬드 형태의 타일을 정확한 간격으로 배치
 */
export class TileMap {
  // ============================================
  // 타일 배치 설정 (챕터별로 설정 가능)
  // ============================================
  private CONFIG: any  // 챕터별 설정을 받을 수 있도록 변경
  // ============================================

  private tiles: Tile[] = []
  private sourceWidth: number   // 원본 이미지 크기
  private sourceHeight: number
  private tileWidth: number      // 화면에 그릴 논리적 타일 크기
  private tileHeight: number     // 아이소메트릭 2:1 비율
  private images: Map<string, HTMLImageElement> = new Map()

  // 맵 데이터 (챕터별)
  private mapData: number[][] = []  // 0: 이동 불가, 1: 이동 가능
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
    // 기본 설정 또는 챕터 설정 사용
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

    this.sourceWidth = this.CONFIG.SOURCE_WIDTH || this.CONFIG.sourceWidth
    this.sourceHeight = this.CONFIG.SOURCE_HEIGHT || this.CONFIG.sourceHeight
    this.tileWidth = this.CONFIG.TILE_WIDTH || this.CONFIG.tileWidth
    this.tileHeight = this.CONFIG.TILE_HEIGHT || this.CONFIG.tileHeight

    this.TILE_WIDTH_HALF = this.tileWidth / 2
    this.TILE_HEIGHT_HALF = this.tileHeight / 2

    const yMultiplier = this.CONFIG.Y_SPACING_MULTIPLIER || this.CONFIG.ySpacingMultiplier
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
   * 맵 데이터 로드 (챕터별)
   */
  loadMapData(mapData: number[][], width: number, height: number): void {
    this.mapData = mapData
    this.mapWidth = width
    this.mapHeight = height
  }

  /**
   * 특정 그리드 위치가 이동 가능한지 확인
   */
  isWalkable(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridX >= this.mapWidth || gridY < 0 || gridY >= this.mapHeight) {
      return false
    }
    return this.mapData[gridY][gridX] === 1
  }

  /**
   * 월드 좌표가 맵 경계 내에 있는지 확인
   */
  isInBounds(worldX: number, worldY: number): boolean {
    const { gridX, gridY } = this.worldToGrid(worldX, worldY)
    return gridX >= 0 && gridX < this.mapWidth && gridY >= 0 && gridY < this.mapHeight
  }

  /**
   * 그리드 좌표를 월드 좌표로 변환 (public)
   */
  getWorldPosition(gridX: number, gridY: number): { x: number; y: number } {
    return this.gridToWorld(gridX, gridY)
  }

  /**
   * 그리드 좌표를 아이소메트릭 월드 좌표로 변환
   * 
   * 순수 아이소메트릭 그리드 (체크보드 오프셋 없음):
   * - X 간격: TILE_WIDTH_HALF (64px)
   * - Y 간격: Y_SPACING (설정 가능)
   */
  private gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: (gridX - gridY) * this.TILE_WIDTH_HALF,
      y: (gridX + gridY) * this.Y_SPACING
    }
  }

  /**
   * 월드 좌표를 그리드 좌표로 변환 (역변환)
   */
  private worldToGrid(worldX: number, worldY: number): { gridX: number; gridY: number } {
    const gridX = (worldX / this.TILE_WIDTH_HALF + worldY / this.Y_SPACING) / 2
    const gridY = (worldY / this.Y_SPACING - worldX / this.TILE_WIDTH_HALF) / 2
    return { gridX, gridY }
  }

  /**
   * 카메라 뷰포트에 보이는 타일들만 동적으로 생성
   * 맵 데이터가 있으면 배경 타일 + 이동 가능한 길 타일 생성
   */
  updateVisibleTiles(camera: Camera): void {
    this.tiles = []

    // Map data check
    if (!this.mapData || this.mapData.length === 0) {
      console.warn('updateVisibleTiles: No map data found')
      return
    }

    // 맵 데이터가 있으면 맵 데이터 기반으로 렌더링
    if (this.mapData.length > 0 && this.mapWidth > 0 && this.mapHeight > 0) {
      // 맵 데이터 기반: 배경 타일 + 이동 가능한 길 타일
      let walkableTileCount = 0
      let backgroundTileCount = 0

      for (let gridY = 0; gridY < this.mapHeight; gridY++) {
        for (let gridX = 0; gridX < this.mapWidth; gridX++) {
          const worldPos = this.gridToWorld(gridX, gridY)

          if (this.mapData[gridY][gridX] === 1) {
            // 이동 가능한 길: base-tile.png
            walkableTileCount++
            this.tiles.push({
              imageKey: 'baseTile',  // base-tile.png
              x: worldPos.x,
              y: worldPos.y,
              width: this.tileWidth,
              height: this.tileHeight,
              gridX,
              gridY
            })
          } else {
            // 배경 타일: base-tile2.png
            backgroundTileCount++
            this.tiles.push({
              imageKey: 'backgroundTile',  // base-tile2.png
              x: worldPos.x,
              y: worldPos.y,
              width: this.tileWidth,
              height: this.tileHeight,
              gridX,
              gridY
            })
          }
        }
      }
    }
  }

  /**
   * 타일맵 렌더링
   */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // 깊이 정렬 (선택적)
    const tilesToRender = this.CONFIG.ENABLE_DEPTH_SORTING
      ? [...this.tiles].sort((a, b) => a.y - b.y)  // 월드 Y 좌표 순 정렬
      : this.tiles  // 정렬 안 함 (생성 순서대로)

    this.frameCount++
    if (this.frameCount % 60 === 0) {
      console.log(`TileMap Render: ${tilesToRender.length} tiles. Camera: ${camera.position.x}, ${camera.position.y}`)
    }

    tilesToRender.forEach((tile) => {
      const screenPos = camera.worldToScreen(tile.x, tile.y)
      const image = this.images.get(tile.imageKey)

      if (image && image.complete && image.naturalWidth !== 0) {
        // 아이소메트릭 타일 렌더링
        // 원본 이미지를 논리적 크기로 축소해서 그림
        // Y 오프셋을 조정하여 타일이 겹치도록 함 (검은 간격 제거)

        // 수정된 렌더링 좌표: 기준점(screenPos)을 중심으로 그리기
        const drawX = screenPos.x - this.tileWidth / 2
        const drawY = screenPos.y - this.tileHeight / 2

        ctx.drawImage(
          image,
          0, 0, image.naturalWidth, image.naturalHeight,  // 소스: 실제 이미지 크기 전체
          drawX,
          drawY,
          this.tileWidth,                                  // 목적지 너비
          this.tileHeight                                  // 목적지 높이 (설정에 따름)
        )
      } else {
        // 이미지가 로드되지 않았거나 문제가 있을 때 대체 사각형 렌더링
        ctx.fillStyle = tile.imageKey === 'baseTile' ? 'rgba(0, 255, 0, 0.3)' : 'rgba(0, 0, 255, 0.3)'
        ctx.fillRect(
          screenPos.x - this.TILE_WIDTH_HALF,
          screenPos.y - this.tileWidth - this.CONFIG.OVERLAP_OFFSET,
          this.tileWidth,
          this.tileWidth
        )
      }
    })
  }

  /**
   * 패턴 설정 (하위 호환성을 위해 유지, 아이소메트릭에서는 사용 안 함)
   */
  setPattern(pattern: string[][]): void {
    // 아이소메트릭 모드에서는 단일 타일만 사용
  }
}
