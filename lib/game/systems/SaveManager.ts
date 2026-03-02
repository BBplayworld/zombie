// ============================================================================
// SaveManager.ts
//
// 로컬 JSON 파일(/data/save.json) 기반 데이터 저장/로딩
// - 레벨 & 경험치
// - 인벤토리 & 장착 아이템
// - 마지막 전투 위치 (zoneId, x, y)
// ============================================================================

import type { ItemData } from '../config/types';

export interface SaveData {
    version: number;
    savedAt: string;
    player: {
        level: number;
        exp: number;
        hp: number;
        lastZone: number;
        lastX: number;
        lastY: number;
    };
    inventory: ItemData[];
    equipment: Record<string, ItemData>;
}

const SAVE_API = '/api/save';
const SAVE_VERSION = 1;

export class SaveManager {
    private static _instance: SaveManager | null = null;

    static getInstance(): SaveManager {
        if (!SaveManager._instance) {
            SaveManager._instance = new SaveManager();
        }
        return SaveManager._instance;
    }

    /**
     * 현재 게임 상태를 /data/save.json에 저장
     */
    async save(data: SaveData): Promise<boolean> {
        try {
            const res = await fetch(SAVE_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, savedAt: new Date().toISOString(), version: SAVE_VERSION }),
            });
            if (!res.ok) throw new Error(`Save failed: ${res.status}`);
            console.log('💾 [SaveManager] Game saved.');
            return true;
        } catch (e) {
            console.warn('⚠️ [SaveManager] Save error:', e);
            return false;
        }
    }

    /**
     * /data/save.json에서 저장 데이터 로딩
     */
    async load(): Promise<SaveData | null> {
        try {
            const res = await fetch(SAVE_API, { cache: 'no-store' });
            if (!res.ok) {
                if (res.status === 404) return null; // 저장 파일 없음 - 정상
                console.warn('⚠️ [SaveManager] Load failed:', res.status);
                return null;
            }
            const data: SaveData = await res.json();
            console.log('📂 [SaveManager] Game loaded. Level:', data.player?.level);
            return data;
        } catch (e) {
            // 네트워크 오류 등 - 조용히 null 반환 (게임은 계속 실행)
            return null;
        }
    }

    /**
     * 저장 데이터 삭제 (새 게임 시작)
     */
    async deleteSave(): Promise<boolean> {
        try {
            const res = await fetch(SAVE_API, { method: 'DELETE' });
            return res.ok;
        } catch {
            return false;
        }
    }

    /** 빈 기본 저장 데이터 */
    static createDefault(): SaveData {
        return {
            version: SAVE_VERSION,
            savedAt: new Date().toISOString(),
            player: { level: 1, exp: 0, hp: 100, lastZone: 1, lastX: 0, lastY: 0 },
            inventory: [],
            equipment: {},
        };
    }
}
