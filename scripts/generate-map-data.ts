import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

// Configuration
const SIMPLIFICATION_THRESHOLD = 2; // Keep high precision
const RED_THRESHOLD = 200; // Red channel must be > 200
const OTHER_COLOR_THRESHOLD = 100; // Green/Blue must be < 100 to be considered "Red Line"

async function getMapImagePath() {
    // Defines the precise "Line Map" provided by the user
    return 'public/assets/chapter-1/map/map-1_3072-line.png';
}

async function generateMapData() {
    const projectRoot = process.cwd();
    const imagePathRel = await getMapImagePath();
    const mapPath = path.join(projectRoot, imagePathRel);

    const outputDir = path.dirname(mapPath);
    const outputPath = path.join(outputDir, 'map-data.json');
    const debugImagePath = path.join(outputDir, 'map-debug.png');

    console.log(`Analyzing LINE map image: ${mapPath}`);

    if (!fs.existsSync(mapPath)) {
        console.error(`Error: Map line image not found at ${mapPath}`);
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

        // 1. Identify Logic:
        // The Red Line is the FENCE.
        // We want to find the Walkable Area enclosed by this Red Line.
        // We will Flood Fill from the center (assuming center is inside).
        // The Red Line pixels act as walls (value 0). Everything else is potential floor (value 1).

        // Create mask: 0 = Wall (Red Line), 1 = Walkable (Not Red)
        const mask = new Uint8Array(width * height);

        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            // alpha? Assume opacity.

            // Check if pixel is RED (The Boundary)
            const isRedLine = r > RED_THRESHOLD && g < OTHER_COLOR_THRESHOLD && b < OTHER_COLOR_THRESHOLD;

            if (isRedLine) {
                mask[i] = 0; // Wall
            } else {
                mask[i] = 1; // Walkable space (potentially)
            }
        }

        // 2. Flood Fill to identify the enclosed walkable region
        const visited = new Uint8Array(width * height); // 0=unvisited, 1=verified walkable
        const queue: number[] = [];

        // Find Start Point
        let startIdx = -1;
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);

        // Search spiral for a non-red pixel
        let foundStart = false;
        const maxR = Math.min(width, height) / 2;

        // Check exact center first
        if (mask[cy * width + cx] === 1) {
            startIdx = cy * width + cx;
            foundStart = true;
        } else {
            console.log("Center is on the Red Line? Searching for open space...");
            for (let r = 5; r < maxR; r += 10) {
                for (let deg = 0; deg < 360; deg += 30) {
                    const rad = deg * Math.PI / 180;
                    const tx = Math.floor(cx + Math.cos(rad) * r);
                    const ty = Math.floor(cy + Math.sin(rad) * r);
                    if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
                        const idx = ty * width + tx;
                        if (mask[idx] === 1) {
                            startIdx = idx;
                            foundStart = true;
                            break;
                        }
                    }
                }
                if (foundStart) break;
            }
        }

        if (!foundStart) {
            console.error("Could not find any walkable area inside!");
            return;
        }

        console.log(`Starting Flood Fill from ${startIdx % width}, ${Math.floor(startIdx / width)}`);

        // BFS
        queue.push(startIdx);
        visited[startIdx] = 1;
        let visitedCount = 0;
        let qHead = 0;

        while (qHead < queue.length) {
            const currIdx = queue[qHead++];
            visitedCount++;

            const cx = currIdx % width;
            const cy = Math.floor(currIdx / width);

            const neighbors = [
                { x: cx, y: cy - 1 },
                { x: cx + 1, y: cy },
                { x: cx, y: cy + 1 },
                { x: cx - 1, y: cy }
            ];

            for (const n of neighbors) {
                if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                    const nIdx = n.y * width + n.x;
                    // If it is NOT a Red Line, and NOT visited, we fill it.
                    if (mask[nIdx] === 1 && visited[nIdx] === 0) {
                        visited[nIdx] = 1;
                        queue.push(nIdx);
                    }
                }
            }
        }

        console.log(`Flood Fill complete. Found ${visitedCount} walkable pixels inside the Red Line.`);

        // 3. Moore-Neighbor Tracing on the VISITED region
        // Find a starting edge pixel (Top-most, then Left-most of the VISITED blob)
        let boundStartX = -1;
        let boundStartY = -1;

        for (let i = 0; i < width * height; i++) {
            if (visited[i] === 1) {
                boundStartX = i % width;
                boundStartY = Math.floor(i / width);
                break;
            }
        }

        console.log(`Tracing boundary from ${boundStartX}, ${boundStartY}`);

        const boundaryPoints: { x: number, y: number }[] = [];
        let currX = boundStartX;
        let currY = boundStartY;
        let backtrack = 6; // West

        const dx = [0, 1, 1, 1, 0, -1, -1, -1];
        const dy = [-1, -1, 0, 1, 1, 1, 0, -1];

        const isV = (x: number, y: number) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            return visited[y * width + x] === 1;
        };

        // Trace
        let loops = 0;
        const maxLoops = 1000000; // High limit

        boundaryPoints.push({ x: currX - width / 2, y: currY - height / 2 });

        do {
            let foundNext = false;
            for (let i = 0; i < 8; i++) {
                const scanIdx = (backtrack + 1 + i) % 8;
                const nx = currX + dx[scanIdx];
                const ny = currY + dy[scanIdx];

                if (isV(nx, ny)) {
                    currX = nx;
                    currY = ny;
                    backtrack = (scanIdx + 4) % 8;
                    foundNext = true;
                    break;
                }
            }

            if (!foundNext) break;

            boundaryPoints.push({ x: currX - width / 2, y: currY - height / 2 });
            loops++;

            if (currX === boundStartX && currY === boundStartY) break;

        } while (loops < maxLoops);

        console.log(`Traced ${boundaryPoints.length} boundary points.`);

        // 4. Simplify
        const simplified: { x: number, y: number }[] = [];
        if (boundaryPoints.length > 0) {
            simplified.push(boundaryPoints[0]);
            let lastP = boundaryPoints[0];

            for (let i = 1; i < boundaryPoints.length; i++) {
                const p = boundaryPoints[i];
                const dist = Math.sqrt(Math.pow(p.x - lastP.x, 2) + Math.pow(p.y - lastP.y, 2));

                if (dist >= SIMPLIFICATION_THRESHOLD) {
                    simplified.push(p);
                    lastP = p;
                }
            }
            simplified.push(boundaryPoints[0]); // Closing loop
        }

        console.log(`Simplified to ${simplified.length} points.`);

        // 5. Debug Image
        const debugCanvas = createCanvas(width, height);
        const dCtx = debugCanvas.getContext('2d');
        dCtx.drawImage(image, 0, 0); // Draw original line map

        // Draw Fill (Visual verification of walkability)
        dCtx.fillStyle = 'rgba(0, 255, 0, 0.3)'; // Semi-transparent green
        // Creating a path from the polygon
        dCtx.beginPath();
        if (simplified.length > 0) {
            dCtx.moveTo(simplified[0].x + width / 2, simplified[0].y + height / 2);
            for (let i = 1; i < simplified.length; i++) {
                dCtx.lineTo(simplified[i].x + width / 2, simplified[i].y + height / 2);
            }
        }
        dCtx.closePath();
        dCtx.fill();
        dCtx.strokeStyle = 'blue';
        dCtx.lineWidth = 3;
        dCtx.stroke();

        const buffer = debugCanvas.toBuffer('image/png');
        fs.writeFileSync(debugImagePath, buffer);
        console.log(`Debug image saved to ${debugImagePath}`);

        // Save JSON
        const mapData = {
            width: width,
            height: height,
            tiles: simplified,
            walkableTile: 'baseTile',
            startPosition: { x: 0, y: 0 }
        };

        fs.writeFileSync(outputPath, JSON.stringify(mapData));
        console.log(`Map data saved to ${outputPath}`);

    } catch (error) {
        console.error('Error processing map image:', error);
    }
}

generateMapData();
