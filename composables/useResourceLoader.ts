/**
 * 게임 리소스 관리자
 * 이미지, 사운드 등의 리소스를 비동기로 로드하고 관리
 */
export class ResourceLoader {
  private images: Map<string, HTMLImageElement> = new Map()
  private loadedCount: number = 0
  private totalCount: number = 0
  private onProgressCallback?: (progress: number) => void
  private onCompleteCallback?: () => void

  /**
   * 이미지 리소스 로드
   */
  async loadImages(imageMap: Record<string, string>): Promise<void> {
    this.totalCount = Object.keys(imageMap).length
    this.loadedCount = 0

    const promises = Object.entries(imageMap).map(([key, path]) => {
      return this.loadImage(key, path)
    })

    await Promise.all(promises)
    this.onCompleteCallback?.()
  }

  private loadImage(key: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        this.images.set(key, img)
        this.loadedCount++
        const progress = (this.loadedCount / this.totalCount) * 100
        this.onProgressCallback?.(progress)
        resolve()
      }

      img.onerror = () => {
        console.error(`Failed to load image: ${path}`)
        // 로드 실패해도 진행
        this.loadedCount++
        const progress = (this.loadedCount / this.totalCount) * 100
        this.onProgressCallback?.(progress)
        resolve()
      }

      img.src = path
    })
  }

  getImage(key: string): HTMLImageElement | undefined {
    return this.images.get(key)
  }

  getImages(): Map<string, HTMLImageElement> {
    return this.images
  }

  onProgress(callback: (progress: number) => void): void {
    this.onProgressCallback = callback
  }

  onComplete(callback: () => void): void {
    this.onCompleteCallback = callback
  }

  clear(): void {
    this.images.clear()
    this.loadedCount = 0
    this.totalCount = 0
  }
}
