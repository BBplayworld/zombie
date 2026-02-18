import { Item } from './Item'

/**
 * 인벤토리 엔티티
 * 아이템 목록 관리 및 제어 담당
 */
export class Inventory {
    items: Item[] = []
    capacity: number = 30 // Default capacity

    constructor() {
        this.items = []
    }

    /**
     * 아이템 추가
     */
    add(item: Item): boolean {
        if (this.isFull()) return false
        this.items.push(item)
        return true
    }

    /**
     * 아이템 제거 by Instance
     */
    remove(item: Item): boolean {
        const idx = this.items.indexOf(item)
        if (idx !== -1) {
            this.items.splice(idx, 1)
            return true
        }
        return false
    }

    /**
     * 아이템 제거 by Index
     */
    removeAt(index: number): Item | undefined {
        if (index >= 0 && index < this.items.length) {
            return this.items.splice(index, 1)[0]
        }
        return undefined
    }

    /**
     * 아이템 가져오기
     */
    get(index: number): Item | undefined {
        return this.items[index]
    }

    /**
     * 가득 찼는지 확인
     */
    isFull(): boolean {
        return this.items.length >= this.capacity
    }

    /**
     * 비어있는지 확인
     */
    isEmpty(): boolean {
        return this.items.length === 0
    }

    /**
     * 초기화
     */
    clear(): void {
        this.items = []
    }
}
