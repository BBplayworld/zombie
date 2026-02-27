import { ItemData, ItemType, ItemRarity, StatType, ItemStatValue } from '../config/types'
import { getZoneConfig } from '../config/zones'
import { ItemDrop } from './ItemDrop'
import { t } from '../config/Locale'

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
        const config = getZoneConfig(1).itemDropConfig
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
        const statTypes: StatType[] = ['Vigor', 'Spirit', 'Might', 'Agility', 'Luck']
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

        // 5. 이름 생성 (locale별)
        const nameLocale = Item.generateNameLocale(type, rarity, stats)

        const data: ItemData = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: nameLocale['en'],
            nameLocale,
            type: type,
            rarity: rarity,
            stats: stats
        }

        return new Item(data)
    }

    private static generateNameLocale(
        type: ItemType,
        rarity: ItemRarity,
        stats: Partial<Record<StatType, ItemStatValue>>
    ): Record<string, string> {
        const presentStats = Object.keys(stats) as StatType[]
        const primaryStat = presentStats[0] ?? null
        const secondaryStat = presentStats.length > 1 ? presentStats[1] : null

        const buildName = (lang: string): string => {
            const typeKey = `inventory.itemTypes.${type}`
            const typeName = lang === 'ko'
                ? (t(typeKey) !== typeKey ? t(typeKey) : type)
                : type

            if (!primaryStat) return `${rarity} ${typeName}`

            const prefixKey = `inventory.itemPrefixes.${primaryStat}`
            const prefixList = lang === 'ko'
                ? (t(prefixKey) !== prefixKey ? (t(prefixKey) as any) : null)
                : null

            const enPrefixes: Record<StatType, string[]> = {
                Vigor: ['Sturdy', 'Durable', 'Vital', 'Hardy'],
                Spirit: ['Arcane', 'Mystic', 'Spiritual', 'Wise'],
                Might: ['Mighty', 'Strong', 'Powerful', 'Fierce'],
                Agility: ['Swift', 'Quick', 'Fast', 'Agile'],
                Luck: ['Sharp', 'Keen', 'Precise', 'Focused']
            }
            const enSuffixes: Record<StatType, string[]> = {
                Vigor: ['of Life', 'of Health', 'of Vitality', 'of Endurance'],
                Spirit: ['of Mana', 'of Spirit', 'of Mind', 'of Wisdom'],
                Might: ['of Power', 'of Strength', 'of Might', 'of Force'],
                Agility: ['of Speed', 'of Haste', 'of Swiftness', 'of Agility'],
                Luck: ['of Sight', 'of Focus', 'of Precision', 'of Accuracy']
            }
            const koPrefixes: Record<StatType, string[]> = {
                Vigor: ['견고한', '내구성의', '생명력의', '강건한'],
                Spirit: ['신비로운', '마법의', '영적인', '현명한'],
                Might: ['강력한', '용맹한', '힘찬', '맹렬한'],
                Agility: ['신속한', '날렵한', '빠른', '민첩한'],
                Luck: ['예리한', '통찰의', '정밀한', '집중된']
            }
            const koSuffixes: Record<StatType, string[]> = {
                Vigor: ['의 생명', '의 건강', '의 활력', '의 인내'],
                Spirit: ['의 마나', '의 정신', '의 마음', '의 지혜'],
                Might: ['의 힘', '의 강인함', '의 용맹', '의 위력'],
                Agility: ['의 속도', '의 질풍', '의 신속', '의 민첩'],
                Luck: ['의 시야', '의 집중', '의 정밀', '의 통찰']
            }

            const prefixes = lang === 'ko' ? koPrefixes : enPrefixes
            const suffixes = lang === 'ko' ? koSuffixes : enSuffixes

            const prefixArr = prefixes[primaryStat]
            const prefix = prefixArr[Math.floor(Math.random() * prefixArr.length)]

            let name = lang === 'ko' ? `${prefix} ${typeName}` : `${prefix} ${typeName}`

            if (secondaryStat) {
                const suffixArr = suffixes[secondaryStat]
                const suffix = suffixArr[Math.floor(Math.random() * suffixArr.length)]
                name = `${name} ${suffix}`
            }

            return name
        }

        return { en: buildName('en'), ko: buildName('ko') }
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
