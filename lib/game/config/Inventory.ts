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
        value: string
        fontFamily: string
    }
}

export const inventoryConfig: InventoryUIConfig = {
    position: {
        anchor: 'top-left',
        x: -100,
        y: 20
    },
    window: {
        width: 1024,
        height: 1024
    },
    statsArea: {
        x: 260,
        y: 110,
        width: 250,
        height: 482,
        lineHeight: 25,
        fontSize: 16,
        titleFontSize: 20
    },
    itemArea: {
        x: 259,
        y: 658,
        width: 543,
        height: 220,
        cols: 10,
        rows: 4,
        slotSize: 47.5,
        gap: 5
    },
    equipmentArea: {
        x: 520,
        y: 86,
        width: 250,
        height: 482
    },
    closeButton: {
        width: 50,
        height: 50,
        margin: 10 // from top-right corner
    },
    equipmentSlots: {
        'Helmet': { x: 625, y: 122, width: 64, height: 68 },
        'Weapon': { x: 540, y: 187, width: 64, height: 64 },
        'Shield': { x: 709, y: 191, width: 61, height: 62 },
        'Armor': { x: 610, y: 272, width: 97, height: 122 },
        'Boots': { x: 569, y: 447, width: 60, height: 60 },
        'Ring': { x: 700, y: 451, width: 63, height: 58 }
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
        label: '#aaaaaa',
        value: '#d4af37',
        fontFamily: 'Crimson Text;serif'
    }
}
