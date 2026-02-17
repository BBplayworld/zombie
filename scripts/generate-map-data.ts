import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

// Configuration
const CHAPTER_ID = 1; // Default chapter
const CONFIG_FILE_PATH = 'composables/useChapterConfig.ts';
const GRID_SIZE = 4; // Grid cell size
const WALL_BRIGHTNESS_THRESHOLD = 40;
const WALL_ALPHA_THRESHOLD = 20;

async function getMapImagePath() {
    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, CONFIG_FILE_PATH);

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        // Simple regex to find mapBackground for the specific chapter
        // Assuming structure: 1: { ... assetConfig: { ... mapBackground: '...' } }
        // This is a rough heuristic.
        const chapterBlockRegex = new RegExp(`${CHAPTER_ID}\\s*:\\s*{[\\s\\S]*?assetConfig\\s*:\\s*{[\\s\\S]*?mapBackground\\s*:\\s*['"]([^'"]+)['"]`, 'm');
        const match = content.match(chapterBlockRegex);

        if (match && match[1]) {
            // Path in config is usually relative to public or root, e.g. '/assets/...'
            // We need to make it relative to project root for fs.
            let imgPath = match[1];
            if (imgPath.startsWith('/')) imgPath = imgPath.substring(1); // Remove leading /
            // Config usually points to 'assets/...', which is in 'public/assets/...'
            if (!imgPath.startsWith('public/')) imgPath = 'public/' + imgPath;
            return imgPath;
        }
    } catch (e) {
        console.error('Failed to read config file:', e);
    }
    return 'public/assets/chapter-1/map/map-1_3072.png'; // Fallback
}

async function generateMapData() {
    const projectRoot = process.cwd();
    const imagePathRel = await getMapImagePath();
    const mapPath = path.join(projectRoot, imagePathRel);

    // Output path: same dir as image, named map-data.json
    const outputDir = path.dirname(mapPath);
    const outputPath = path.join(outputDir, 'map-data.json');

    console.log(`Analyzing map image: ${mapPath}`);

    if (!fs.existsSync(mapPath)) {
        console.error(`Error: Map image not found at ${mapPath}`);
        return;
    }

    try {
        const image = await loadImage(mapPath);
        const width = image.width;
        const height = image.height;

        console.log(`Image size: ${width}x${height}`);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const gridWidth = Math.ceil(width / GRID_SIZE);
        const gridHeight = Math.ceil(height / GRID_SIZE);

        console.log(`Grid size: ${gridWidth}x${gridHeight} (Cell: ${GRID_SIZE}px)`);

        const tiles: number[][] = [];
        let walkableCount = 0;

        for (let y = 0; y < gridHeight; y++) {
            const row: number[] = [];
            for (let x = 0; x < gridWidth; x++) {
                // Conservative check: If ANY pixel in the cell is wall, the cell is wall.
                let isOpsWall = false; // Is Obstacle?

                const startX = x * GRID_SIZE;
                const startY = y * GRID_SIZE;
                const endX = Math.min(startX + GRID_SIZE, width);
                const endY = Math.min(startY + GRID_SIZE, height);

                for (let py = startY; py < endY; py++) {
                    for (let px = startX; px < endX; px++) {
                        const index = (py * width + px) * 4;
                        const r = data[index];
                        const g = data[index + 1];
                        const b = data[index + 2];
                        const a = data[index + 3];

                        // Check if this pixel is a wall
                        if (a < WALL_ALPHA_THRESHOLD) {
                            isOpsWall = true;
                        } else {
                            const brightness = (r + g + b) / 3;
                            if (brightness < WALL_BRIGHTNESS_THRESHOLD) {
                                isOpsWall = true;
                            }
                        }
                        if (isOpsWall) break;
                    }
                    if (isOpsWall) break;
                }

                const isWalkable = isOpsWall ? 0 : 1;
                if (isWalkable) walkableCount++;
                row.push(isWalkable);
            }
            tiles.push(row);
        }

        const mapData = {
            width: gridWidth,
            height: gridHeight,
            tileSize: GRID_SIZE,
            imageWidth: width,
            imageHeight: height,
            tiles: tiles
        };

        fs.writeFileSync(outputPath, JSON.stringify(mapData)); // Minified for size
        console.log(`Map data saved to ${outputPath}`);
        console.log(`Walkable ratio: ${(walkableCount / (gridWidth * gridHeight) * 100).toFixed(1)}%`);

    } catch (error) {
        console.error('Error processing map image:', error);
    }
}

generateMapData();
