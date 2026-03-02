export interface InventoryUIConfig {
    position: {
        anchor: 'top-right' | 'top-left' | 'center' | 'custom'
        x: number
        y: number
    }
    window: {
        width: number
        height: number
    }
    statsArea: {
        x: number
        y: number
        width: number
        height: number
        lineHeight: number
        fontSize: number
        titleFontSize: number
    }
    itemArea: {
        x: number
        y: number
        width: number
        height: number
        cols: number
        rows: number
        slotSize: number
        gap: number
    }
    equipmentArea: {
        x: number
        y: number
        width: number
        height: number
    }
    closeButton: {
        width: number
        height: number
        margin: number
    }
    equipmentSlots: Record<string, { x: number, y: number, width: number, height: number }>
    tooltip: {
        width: number
        padding: number
        backgroundColor: string
        borderColor: string
        titleColor: string
        textColor: string
    }
    textStyles: {
        title: string
        label: string
        desc: string
        value: string
        fontFamily: string
    }
}

export const inventoryConfig: InventoryUIConfig = {
    position: {
        anchor: 'top-left',
        x: 90,
        y: 60
    },
    window: {
        width: 680,
        height: 680
    },
    statsArea: {
        x: 38,
        y: 140,
        width: 165,
        height: 513,
        lineHeight: 20,
        fontSize: 13.5,
        titleFontSize: 14
    },
    itemArea: {
        x: 485,
        y: 135,
        width: 174,
        height: 477,
        cols: 3,
        rows: 7,
        slotSize: 45,
        gap: 10
    },
    equipmentArea: {
        x: 520,
        y: 86,
        width: 250,
        height: 482
    },
    closeButton: {
        width: 30,
        height: 30,
        margin: 10 // from top-right corner
    },
    equipmentSlots: {
        'Helmet': { x: 296, y: 133, width: 42, height: 54 },
        'Weapon': { x: 297, y: 205, width: 41, height: 51 },
        'Shield': { x: 298, y: 276, width: 39, height: 51 },
        'Armor': { x: 298, y: 346, width: 38, height: 48 },
        'Boots': { x: 363, y: 413, width: 39, height: 50 },
        'Ring': { x: 418, y: 413, width: 39, height: 50 }
    },
    tooltip: {
        width: 240,
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderColor: '#ffffff',
        titleColor: '#ffaa00',
        textColor: '#ffffff'
    },
    textStyles: {
        title: '#ffaa00',
        label: '#ffffffff',
        desc: '#a1a1a1ff',
        value: '#d4af37',
        fontFamily: 'Crimson Text;serif'
    }
}
