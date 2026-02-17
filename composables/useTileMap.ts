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
   * 월드 좌표가 맵 경계 내에 있는지 확인 (반올림 보정)
   */
  isInBounds(worldX: number, worldY: number): boolean {
    // 맵 경계 설정(Boundary)이 있으면 우선 사용
    if (this.CONFIG.mapBoundary) {
      const { minX, maxX, minY, maxY } = this.CONFIG.mapBoundary
      return worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY
    }

    const { gridX, gridY } = this.worldToGrid(worldX, worldY)
    const gx = Math.round(gridX)
    const gy = Math.round(gridY)
    return gx >= 0 && gx < this.mapWidth && gy >= 0 && gy < this.mapHeight
  }

  /**
   * 월드 좌표가 이동 가능한지 확인 (반올림 보정 + 버퍼 허용)
   * buffer: 이동 불가능한 타일이어도 주변 buffer 칸 내에 이동 가능한 타일이 있으면 true 반환
   */
  isWalkableAtWorld(worldX: number, worldY: number, buffer: number = 0): boolean {
    // 맵 경계 설정(Boundary)이 있으면 우선 사용
    // 통맵 이미지 사용 시, 타일 그리드보다는 좌표 범위로 제한
    if (this.CONFIG.mapBoundary) {
      if (!this.isInBounds(worldX, worldY)) return false;

      // 경계 내부라면, 맵 데이터를 확인 (픽셀 분석된 그리드)
      // mapData가 없으면 그냥 이동 가능 (경계만 체크)
      if (!this.mapData || this.mapData.length === 0) return true;

      const { minX, maxX, minY, maxY } = this.CONFIG.mapBoundary;
      const width = maxX - minX;
      const height = maxY - minY;

      // 월드 좌표를 0~1 비율로 정규화
      const normalizedX = (worldX - minX) / width;
      const normalizedY = (worldY - minY) / height;

      // 그리드 인덱스 변환
      const gx = Math.floor(normalizedX * this.mapWidth);
      const gy = Math.floor(normalizedY * this.mapHeight);

      // 인덱스 범위 체크
      if (gx < 0 || gx >= this.mapWidth || gy < 0 || gy >= this.mapHeight) return false;

      // 이동 가능 여부 (1: 가능, 0: 불가능)
      // 주변 버퍼 체크?
      if (buffer > 0) {
        // Buffer logic for grid
        for (let dy = -buffer; dy <= buffer; dy++) {
          for (let dx = -buffer; dx <= buffer; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx >= 0 && nx < this.mapWidth && ny >= 0 && ny < this.mapHeight) {
              if (this.mapData[ny][nx] === 1) return true;
            }
          }
        }
      }

      return this.mapData[gy][gx] === 1;
    }

    const { gridX, gridY } = this.worldToGrid(worldX, worldY)
    const gx = Math.round(gridX)
    const gy = Math.round(gridY)

    // 1. 현재 위치가 이동 가능하면 OK
    if (this.isWalkable(gx, gy)) return true

    // 2. 이동 불가능하더라도 버퍼 범위 내에 이동 가능한 타일이 있으면 허용 (유연한 이동)
    if (buffer > 0) {
      for (let dy = -buffer; dy <= buffer; dy++) {
        for (let dx = -buffer; dx <= buffer; dx++) {
          if (dx === 0 && dy === 0) continue
          if (this.isWalkable(gx + dx, gy + dy)) {
            return true
          }
        }
      }
    }

    return false
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
  public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
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
    const mapBg = this.images.get('mapBackground')

    // 1. 통맵 이미지 렌더링 (mapBackground가 있으면 우선 사용)
    if (mapBg && mapBg.complete && mapBg.naturalWidth !== 0) {
      // 0. 배경에 기본 타일(basetile-1.png) 깔기
      // 카메라가 비추는 검은 바탕(맵 바깥)을 처리하기 위함
      const bgTile = this.images.get('baseTile')
      if (bgTile) {
        const camTL = camera.screenToWorld(0, 0)
        const camBR = camera.screenToWorld(camera.width, camera.height)

        const startGrid = this.worldToGrid(camTL.x, camTL.y)
        const endGrid = this.worldToGrid(camBR.x, camBR.y)

        // 외부 카메라가 이동할 때 +100px 이상 여유분을 두어 미리 렌더링
        // 타일 크기(128) 고려하여 넉넉하게 10칸(약 1200px) 설정
        const range = 10
        const minGX = Math.floor(Math.min(startGrid.gridX, endGrid.gridX)) - range
        const maxGX = Math.ceil(Math.max(startGrid.gridX, endGrid.gridX)) + range
        const minGY = Math.floor(Math.min(startGrid.gridY, endGrid.gridY)) - range
        const maxGY = Math.ceil(Math.max(startGrid.gridY, endGrid.gridY)) + range

        for (let gy = minGY; gy <= maxGY; gy++) {
          for (let gx = minGX; gx <= maxGX; gx++) {
            const wPos = this.gridToWorld(gx, gy)
            const sPos = camera.worldToScreen(wPos.x, wPos.y)

            // 화면 밖 컬링
            if (sPos.x < -this.tileWidth || sPos.x > camera.width + this.tileWidth ||
              sPos.y < -this.tileHeight || sPos.y > camera.height + this.tileHeight) {
              continue;
            }

            ctx.drawImage(
              bgTile,
              sPos.x - this.tileWidth / 2,
              sPos.y - this.tileHeight / 2,
              this.tileWidth,
              this.tileHeight
            )
          }
        }
      }

      const screenPos = camera.worldToScreen(0, 0) // 월드 (0,0)을 기준으로 잡음

      // 맵 경계가 있으면 그 크기에 맞춰 이미지 스케일링 (8000x8000)
      let mapWidth = mapBg.naturalWidth
      let mapHeight = mapBg.naturalHeight

      if (this.CONFIG.mapBoundary) {
        const { minX, maxX, minY, maxY } = this.CONFIG.mapBoundary
        mapWidth = maxX - minX
        mapHeight = maxY - minY
      }

      // 이미지의 중앙이 월드 (0,0)에 오도록 배치
      // x는 -width/2, y는 -height/2 만큼 이동
      const drawX = screenPos.x - mapWidth / 2
      const drawY = screenPos.y - mapHeight / 2 // 세로도 중앙 정렬

      ctx.drawImage(mapBg, drawX, drawY, mapWidth, mapHeight)

      // 맵 경계 표시 (디버깅용, 빨간 네모 선)
      if (this.CONFIG.mapBoundary) {
        const { minX, maxX, minY, maxY } = this.CONFIG.mapBoundary

        // 경계의 네 꼭지점을 화면 좌표로 변환하여 그리기
        const minPos = camera.worldToScreen(minX, minY)
        const width = maxX - minX
        const height = maxY - minY

        ctx.strokeStyle = 'red'
        ctx.lineWidth = 5
        ctx.strokeRect(minPos.x, minPos.y, width, height)

        // 충돌 데이터 시각화 (디버깅용: 이동 불가 영역 표시)
        if (this.mapData && this.mapData.length > 0) {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.4)' // 반투명 빨강

          const gridRows = this.mapData.length
          const gridCols = this.mapData[0].length

          // 그리드 셀 하나의 월드 크기
          const cellW = mapWidth / gridCols
          const cellH = mapHeight / gridRows

          // 카메라 컬링: 화면에 보이는 영역만 루프
          // 카메라 범위 (월드 좌표)
          const camL = camera.position.x
          const camT = camera.position.y
          const camR = camL + camera.width
          const camB = camT + camera.height

          // 그리드 인덱스로 변환
          // 월드좌표 relative to map TopLeft (minX, minY)
          const startCol = Math.floor((camL - minX) / cellW)
          const endCol = Math.ceil((camR - minX) / cellW)
          const startRow = Math.floor((camT - minY) / cellH)
          const endRow = Math.ceil((camB - minY) / cellH)

          // 유효 범위 클램핑
          const iStart = Math.max(0, startRow)
          const iEnd = Math.min(gridRows, endRow + 1)
          const jStart = Math.max(0, startCol)
          const jEnd = Math.min(gridCols, endCol + 1)

          for (let i = iStart; i < iEnd; i++) {
            for (let j = jStart; j < jEnd; j++) {
              if (this.mapData[i][j] === 0) { // 0: 이동 불가
                // 월드 좌표 계산
                const wx = minX + j * cellW
                const wy = minY + i * cellH

                // 스크린 좌표 변환
                const sx = wx - camera.position.x
                const sy = wy - camera.position.y

                // 약간의 여유를 두고 그리기 (겹침 방지) 또는 꽉 채우기
                ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1)
              }
            }
          }
        }
      }

      // 통맵 사용 시 개별 타일은 그리지 않음 (디버깅용으로 필요하면 주석 해제)
      // return 
    }

    // 2. 개별 타일 렌더링 (mapBackground가 없거나, 타일도 같이 그려야 할 경우)
    if (!mapBg) {
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
  }

  /**
   * 패턴 설정 (하위 호환성을 위해 유지, 아이소메트릭에서는 사용 안 함)
   */
  setPattern(pattern: string[][]): void {
    // 아이소메트릭 모드에서는 단일 타일만 사용
  }
}
