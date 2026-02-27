import sharp from 'sharp';
import path from 'path';

async function analyzeInventory() {
    try {
        const imagePath = path.resolve(__dirname, '../public/assets/zone-1/player/inventory-debug.png');
        const image = sharp(imagePath);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            console.error('Failed to get image metadata');
            return;
        }

        console.log(`Image Size: ${metadata.width} x ${metadata.height}`);

        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

        const visited = new Uint8Array(info.width * info.height);
        const blueRegions: { minX: number, maxX: number, minY: number, maxY: number }[] = [];

        // Color thresholds
        const isBlue = (r: number, g: number, b: number) => r < 100 && g < 100 && b > 180;
        const isRed = (r: number, g: number, b: number) => r > 200 && g < 100 && b < 100;
        const isYellow = (r: number, g: number, b: number) => r > 200 && g > 200 && b < 100;

        // Global bounds for Red/Yellow
        let minRedX = info.width, maxRedX = 0, minRedY = info.height, maxRedY = 0;
        let minYellowX = info.width, maxYellowX = 0, minYellowY = info.height, maxYellowY = 0;

        for (let y = 0; y < info.height; y++) {
            for (let x = 0; x < info.width; x++) {
                const idx = (y * info.width + x) * info.channels;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // Red
                if (isRed(r, g, b)) {
                    if (x < minRedX) minRedX = x;
                    if (x > maxRedX) maxRedX = x;
                    if (y < minRedY) minRedY = y;
                    if (y > maxRedY) maxRedY = y;
                }

                // Yellow
                if (isYellow(r, g, b)) {
                    if (x < minYellowX) minYellowX = x;
                    if (x > maxYellowX) maxYellowX = x;
                    if (y < minYellowY) minYellowY = y;
                    if (y > maxYellowY) maxYellowY = y;
                }

                // Blue (flood fill for distinct regions)
                if (isBlue(r, g, b) && !visited[y * info.width + x]) {
                    const queue = [{ x, y }];
                    visited[y * info.width + x] = 1;

                    let regionMinX = x, regionMaxX = x;
                    let regionMinY = y, regionMaxY = y;

                    let head = 0;
                    while (head < queue.length) {
                        const p = queue[head++];

                        if (p.x < regionMinX) regionMinX = p.x;
                        if (p.x > regionMaxX) regionMaxX = p.x;
                        if (p.y < regionMinY) regionMinY = p.y;
                        if (p.y > regionMaxY) regionMaxY = p.y;

                        // Check 4 neighbors
                        const neighbors = [
                            { nx: p.x + 1, ny: p.y },
                            { nx: p.x - 1, ny: p.y },
                            { nx: p.x, ny: p.y + 1 },
                            { nx: p.x, ny: p.y - 1 }
                        ];

                        for (const n of neighbors) {
                            if (n.nx >= 0 && n.nx < info.width && n.ny >= 0 && n.ny < info.height) {
                                const nIdx = n.ny * info.width + n.nx;
                                if (!visited[nIdx]) {
                                    const nr = data[nIdx * info.channels];
                                    const ng = data[nIdx * info.channels + 1];
                                    const nb = data[nIdx * info.channels + 2];
                                    if (isBlue(nr, ng, nb)) {
                                        visited[nIdx] = 1;
                                        queue.push({ x: n.nx, y: n.ny });
                                    }
                                }
                            }
                        }
                    }

                    // Store region if significant size
                    if ((regionMaxX - regionMinX) > 10 && (regionMaxY - regionMinY) > 10) {
                        blueRegions.push({ minX: regionMinX, maxX: regionMaxX, minY: regionMinY, maxY: regionMaxY });
                    }
                }
            }
        }

        console.log('--- Red Area (Items) ---');
        console.log(`X: ${minRedX}, Y: ${minRedY}`);
        console.log(`Width: ${maxRedX - minRedX}, Height: ${maxRedY - minRedY}`);

        console.log('--- Yellow Area (Stats) ---');
        console.log(`X: ${minYellowX}, Y: ${minYellowY}`);
        console.log(`Width: ${maxYellowX - minYellowX}, Height: ${maxYellowY - minYellowY}`);

        console.log('--- Blue Regions (Equipment Slots) ---');
        // Sort regions by Y then X to order them logicallly
        blueRegions.sort((a, b) => {
            if (Math.abs(a.minY - b.minY) > 20) return a.minY - b.minY;
            return a.minX - b.minX;
        });

        blueRegions.forEach((r, i) => {
            console.log(`Slot ${i}: X:${r.minX}, Y:${r.minY}, W:${r.maxX - r.minX}, H:${r.maxY - r.minY}`);
        });

    } catch (error) {
        console.error('Error analyzing image:', error);
    }
}

analyzeInventory();
