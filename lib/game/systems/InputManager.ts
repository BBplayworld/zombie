/**
 * 키보드 입력 관리자
 */
export class InputManager {
    private keys: Map<string, boolean> = new Map()
    private keyDownHandlers: Map<string, Function[]> = new Map()
    private keyUpHandlers: Map<string, Function[]> = new Map()

    constructor() {
        this.setupEventListeners()
    }

    private setupEventListeners(): void {
        if (typeof window === 'undefined') return

        window.addEventListener('keydown', (e: KeyboardEvent) => {
            this.keys.set(e.code, true)

            // 이벤트 핸들러 호출
            const handlers = this.keyDownHandlers.get(e.code)
            if (handlers) {
                handlers.forEach(handler => handler(e))
            }
        })

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            this.keys.set(e.code, false)

            // 이벤트 핸들러 호출
            const handlers = this.keyUpHandlers.get(e.code)
            if (handlers) {
                handlers.forEach(handler => handler(e))
            }
        })

        // 브라우저 포커스 잃을 때 모든 키 초기화
        window.addEventListener('blur', () => {
            this.keys.clear()
        })
    }

    /**
     * 특정 키가 눌려있는지 확인
     */
    isKeyPressed(keyCode: string): boolean {
        return this.keys.get(keyCode) || false
    }

    /**
     * 여러 키 중 하나라도 눌려있는지 확인
     */
    isAnyKeyPressed(...keyCodes: string[]): boolean {
        return keyCodes.some(key => this.isKeyPressed(key))
    }

    /**
     * 이동 입력 가져오기 (정규화된 벡터)
     */
    getMovementInput(): { x: number, y: number } {
        let x = 0
        let y = 0

        // 상하좌우 입력
        if (this.isAnyKeyPressed('KeyW', 'ArrowUp')) y -= 1
        if (this.isAnyKeyPressed('KeyS', 'ArrowDown')) y += 1
        if (this.isAnyKeyPressed('KeyA', 'ArrowLeft')) x -= 1
        if (this.isAnyKeyPressed('KeyD', 'ArrowRight')) x += 1

        return { x, y }
    }

    /**
     * 키 다운 이벤트 리스너 등록
     */
    onKeyDown(keyCode: string, handler: Function): void {
        if (!this.keyDownHandlers.has(keyCode)) {
            this.keyDownHandlers.set(keyCode, [])
        }
        this.keyDownHandlers.get(keyCode)!.push(handler)
    }

    /**
     * 키 업 이벤트 리스너 등록
     */
    onKeyUp(keyCode: string, handler: Function): void {
        if (!this.keyUpHandlers.has(keyCode)) {
            this.keyUpHandlers.set(keyCode, [])
        }
        this.keyUpHandlers.get(keyCode)!.push(handler)
    }

    /**
     * 리소스 정리
     */
    destroy(): void {
        this.keys.clear()
        this.keyDownHandlers.clear()
        this.keyUpHandlers.clear()
    }
}
