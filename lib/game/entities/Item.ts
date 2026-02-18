import { ItemData, ItemType, ItemRarity, StatType, ItemStatValue } from '../config/types'
import { getChapterConfig } from '../config/chapters'
import { ItemDrop } from './ItemDrop'

/**
 * 아이템 로직 클래스 (인벤토리 내 아이템)
 */
export class Item {
    public data: ItemData

    constructor(data: ItemData) {
        this.data = data
    }

    static createRandom(x: number, y: number): Item | null {
        // 챕터 1 설정 사용 (임시)
        const config = getChapterConfig(1).itemDropConfig
        if (!config) return null

        // 1. 드랍 확률 체크 (Global Drop Rate)
        if (Math.random() > config.globalDropRate) return null

        // 2. 등급 결정 (Weighted Random)
        let rarity: ItemRarity = 'Common'
        const rand = Math.random()
        let accum = 0

        // Normalize probabilities if they don't sum to 1? 
        // Assuming they are relative weights or exact probabilities that sum to <= 1.
        // Let's assume they are simple probabilities and we check in order of rarity value?
        // Or simply iterate.

        // Convert map to array for sorting/iteration
        const rarityList = Object.entries(config.rarities).map(([key, conf]) => ({
            rarity: key as ItemRarity,
            chance: conf.dropChance
        }))

        // Sort by chance ascending or simple accumulation
        // Let's just accumulate
        // If the sum is < 1, there's a chance of no specific rarity? No, we fallback to Common.

        for (const r of rarityList) {
            accum += r.chance
            if (rand < accum) {
                rarity = r.rarity
                break
            }
        }

        // 3. 스탯 생성
        // optionCount 만큼 스탯 부여
        const stats: Partial<Record<StatType, ItemStatValue>> = {}
        const statTypes: StatType[] = ['Vigor', 'Spirit', 'Might', 'Agility', 'Perception']
        const rarityConfig = config.rarities[rarity]

        // 셔플
        for (let i = statTypes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [statTypes[i], statTypes[j]] = [statTypes[j], statTypes[i]];
        }

        const selectedStats = statTypes.slice(0, rarityConfig.optionCount)

        selectedStats.forEach(statType => {
            const flatRange = rarityConfig.statRanges.flat
            const percentRange = rarityConfig.statRanges.percent

            let flatVal = 0
            let percentVal = 0

            // Flat (Always)
            flatVal = Math.floor(Math.random() * (flatRange.max - flatRange.min + 1)) + flatRange.min

            // Percent (Chance)
            if (Math.random() < percentRange.chance) {
                // percent min/max are like 0.01 - 0.05
                // random float
                percentVal = Math.random() * (percentRange.max - percentRange.min) + percentRange.min
                // round to 2 decimals
                percentVal = Math.round(percentVal * 1000) / 1000
            }

            stats[statType] = { flat: flatVal, percent: percentVal }
        })

        // 4. 타입 결정
        const types: ItemType[] = ['Helmet', 'Armor', 'Weapon']
        const type = types[Math.floor(Math.random() * types.length)]

        // 5. 이름 생성
        const name = Item.generateName(type, rarity, stats)

        const data: ItemData = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: name,
            type: type,
            rarity: rarity,
            stats: stats
        }

        return new Item(data)
    }

    private static generateName(type: ItemType, rarity: ItemRarity, stats: Partial<Record<StatType, ItemStatValue>>): string {
        const prefixes: Record<StatType, string[]> = {
            Vigor: ['Sturdy', 'Durable', 'Vital', 'Hardy'],
            Spirit: ['Arcane', 'Mystic', 'Spiritual', 'Wise'],
            Might: ['Mighty', 'Strong', 'Powerful', 'Fierce'],
            Agility: ['Swift', 'Quick', 'Fast', 'Agile'],
            Perception: ['Sharp', 'Keen', 'Precise', 'focused']
        }

        const suffixes: Record<StatType, string[]> = {
            Vigor: ['of Life', 'of Health', 'of Vitality', 'of Endurance'],
            Spirit: ['of Mana', 'of Spirit', 'of Mind', 'of Wisdom'],
            Might: ['of Power', 'of Strength', 'of Might', 'of Force'],
            Agility: ['of Speed', 'of Haste', 'of Swiftness', 'of Agility'],
            Perception: ['of Sight', 'of Focus', 'of Precision', 'of Accuracy']
        }

        // Pick primary stat (highest value or random present stat)
        const presentStats = Object.keys(stats) as StatType[]
        if (presentStats.length === 0) return `${rarity} ${type}`

        const primaryStat = presentStats[0]
        const secondaryStat = presentStats.length > 1 ? presentStats[1] : null

        let name = type as string

        // Prefix from primary
        const prefixList = prefixes[primaryStat]
        const prefix = prefixList[Math.floor(Math.random() * prefixList.length)]
        name = `${prefix} ${name}`

        // Suffix from secondary (if exists, else random or skip)
        if (secondaryStat) {
            const suffixList = suffixes[secondaryStat]
            const suffix = suffixList[Math.floor(Math.random() * suffixList.length)]
            name = `${name} ${suffix}`
        }

        return name
    }

    /**
     * 아이템을 월드에 드랍 (ItemDrop 생성)
     */
    drop(x: number, y: number): ItemDrop {
        return new ItemDrop(x, y, this.data)
    }

    /**
     * 아이템 사용/착용 (플레이어에게 적용)
     * @returns 착용 성공 여부
     */
    use(player: any): boolean {
        // 장비 아이템이면 착용 시도
        if (this.isEquipment()) {
            player.equipItem(this)
            return true
        }
        return false
    }

    isEquipment(): boolean {
        const type = this.data.type
        return ['Helmet', 'Armor', 'Weapon', 'Shield', 'Boots', 'Ring'].includes(type)
    }

    getImageKey(): string {
        // 타입별 이미지 키 반환
        switch (this.data.type) {
            case 'Helmet': return 'helmet'
            case 'Armor': return 'armor'
            case 'Weapon': return 'weapon'
            default: return 'helmet' // Fallback
        }
    }
}
