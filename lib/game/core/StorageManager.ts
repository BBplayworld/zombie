import { Player } from '../entities/player/Player'
import { Item } from '../entities/Item'
import { ResourceLoader } from '../systems/ResourceLoader'
import { InputManager } from '../systems/InputManager'
import { ITEM_SPRITE_GRID } from '../config/player'

export class StorageManager {
    private player: Player
    private canvas: HTMLCanvasElement

    constructor(player: Player, canvas: HTMLCanvasElement) {
        this.player = player
        this.canvas = canvas
    }

    render(ctx: CanvasRenderingContext2D, resourceLoader: ResourceLoader): void {
        if (!this.player.isStorageOpen) return;

        const winW = 500;
        const winH = 400;
        const winX = (this.canvas.width - winW) / 2;
        const winY = (this.canvas.height - winH) / 2;

        ctx.save();
        ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        ctx.fillRect(winX, winY, winW, winH);
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 3;
        ctx.strokeRect(winX, winY, winW, winH);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Warehouse', winX + winW / 2, winY + 30);

        ctx.font = '12px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Click item to Withdraw. Click inventory item to Deposit.', winX + winW / 2, winY + 50);

        // Draw slots 5x10 = 50 items
        const cols = 10;
        const slotSize = 40;
        const gap = 6;
        const startX = winX + (winW - (cols * slotSize + Math.max(0, cols - 1) * gap)) / 2;
        const startY = winY + 70;

        for (let i = 0; i < this.player.warehouse.capacity; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const itemX = startX + col * (slotSize + gap);
            const itemY = startY + row * (slotSize + gap);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(itemX, itemY, slotSize, slotSize);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.strokeRect(itemX, itemY, slotSize, slotSize);

            const item = this.player.warehouse.get(i);
            if (item) {
                this.renderItemIcon(ctx, resourceLoader, item, itemX, itemY, slotSize, slotSize);
            }
        }

        // Close button
        const closeBtnW = 30;
        const closeX = winX + winW - closeBtnW - 10;
        const closeY = winY + 10;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(closeX, closeY, closeBtnW, closeBtnW);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('X', closeX + closeBtnW / 2, closeY + closeBtnW / 2 + 2);

        ctx.restore();
    }

    private renderItemIcon(ctx: CanvasRenderingContext2D, resourceLoader: ResourceLoader, item: Item, x: number, y: number, w: number, h: number): void {
        const key = item.getImageKey ? item.getImageKey() : 'item_helmet'
        const img = resourceLoader.getImage(key)
        if (!img || !img.complete || img.naturalWidth === 0) return

        const grid = ITEM_SPRITE_GRID[key]
        if (grid && (grid.cols > 1 || grid.rows > 1)) {
            const ix = grid.insetX || 0
            const iy = grid.insetY || 0
            const actualGridW = img.naturalWidth - ix * 2
            const actualGridH = img.naturalHeight - iy * 2

            const fw = actualGridW / grid.cols
            const fh = actualGridH / grid.rows

            const col = grid.frameIndex % grid.cols
            const row = Math.floor(grid.frameIndex / grid.cols)
            const padding = 4

            ctx.drawImage(img,
                ix + col * fw, iy + row * fh, fw, fh,
                x + padding, y + padding, w - padding * 2, h - padding * 2
            )
        } else {
            ctx.drawImage(img, x + 4, y + 4, w - 8, h - 8)
        }
    }

    handleClick(e: MouseEvent): boolean {
        if (!this.player.isStorageOpen) return false;

        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const winW = 500;
        const winH = 400;
        const winX = (this.canvas.width - winW) / 2;
        const winY = (this.canvas.height - winH) / 2;

        // Close logic
        const closeBtnW = 30;
        const closeX = winX + winW - closeBtnW - 10;
        const closeY = winY + 10;
        if (mx >= closeX && mx <= closeX + closeBtnW && my >= closeY && my <= closeY + closeBtnW) {
            this.player.isStorageOpen = false;
            return true;
        }

        // Click item logic
        const cols = 10;
        const slotSize = 40;
        const gap = 6;
        const startX = winX + (winW - (cols * slotSize + Math.max(0, cols - 1) * gap)) / 2;
        const startY = winY + 70;

        for (let i = 0; i < this.player.warehouse.capacity; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const itemX = startX + col * (slotSize + gap);
            const itemY = startY + row * (slotSize + gap);

            if (mx >= itemX && mx <= itemX + slotSize && my >= itemY && my <= itemY + slotSize) {
                const item = this.player.warehouse.get(i);
                if (item && !this.player.inventory.isFull()) {
                    this.player.warehouse.remove(item);
                    this.player.inventory.add(item);
                }
                return true;
            }
        }

        // Block click if inside window
        if (mx >= winX && mx <= winX + winW && my >= winY && my <= winY + winH) {
            return true;
        }

        return false;
    }
}
