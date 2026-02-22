import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

// Configuration
const SIMPLIFICATION_THRESHOLD = 2; // Keep high precision
const RED_THRESHOLD = 200; // Red channel must be > 200
const OTHER_COLOR_THRESHOLD = 100; // Green/Blue must be < 100 → 빨간색만 이동 가능

/**
 * 이동 가능 영역 데이터화용 입력 이미지: debug 디렉토리의 map.jpg 만 사용
 */
function getMapImagePath(projectRoot: string): string | null {
    const p = path.join(projectRoot, 'public/assets/chapter-1/map/debug', 'map.jpg');
    return fs.existsSync(p) ? p : null;
}

type Point = { x: number; y: number };

/** map.jpg에는 빨간색 영역만 표시됨. 빨간색만 이동 가능으로 인식 */
function isRedPixel(r: number, g: number, b: number): boolean {
    return r > RED_THRESHOLD && g < OTHER_COLOR_THRESHOLD && b < OTHER_COLOR_THRESHOLD;
}

const dx4 = [0, 1, 0, -1];
const dy4 = [-1, 0, 1, 0];
const dx8 = [0, 1, 1, 1, 0, -1, -1, -1];
const dy8 = [-1, -1, 0, 1, 1, 1, 0, -1];

/**
 * 마스크(1=영역 내부)에서 연결 요소별 경계 폴리곤 추출.
 * 반환 좌표: 타일 기준 중심 (0,0) = 타일 중앙.
 */
function extractPolygonsFromMask(
    mask: Uint8Array,
    width: number,
    height: number
): Point[][] {
    const globalVisited = new Uint8Array(width * height);
    const allPolygons: Point[][] = [];

    for (let seed = 0; seed < width * height; seed++) {
        if (mask[seed] !== 1 || globalVisited[seed] === 1) continue;
        const queue: number[] = [seed];
        globalVisited[seed] = 1;
        let qHead = 0;
        while (qHead < queue.length) {
            const currIdx = queue[qHead++];
            const px = currIdx % width;
            const py = Math.floor(currIdx / width);
            for (let d = 0; d < 4; d++) {
                const nx = px + dx4[d];
                const ny = py + dy4[d];
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    if (mask[nIdx] === 1 && globalVisited[nIdx] === 0) {
                        globalVisited[nIdx] = 1;
                        queue.push(nIdx);
                    }
                }
            }
        }

        const inComponent = new Uint8Array(width * height);
        for (const idx of queue) inComponent[idx] = 1;

        let boundStartX = -1;
        let boundStartY = -1;
        for (const idx of queue) {
            const px = idx % width;
            const py = Math.floor(idx / width);
            let onBoundary = false;
            for (let d = 0; d < 4; d++) {
                const nx = px + dx4[d];
                const ny = py + dy4[d];
                if (nx < 0 || nx >= width || ny < 0 || ny >= height || mask[ny * width + nx] !== 1) {
                    onBoundary = true;
                    break;
                }
            }
            if (onBoundary) {
                boundStartX = px;
                boundStartY = py;
                break;
            }
        }
        if (boundStartX < 0) continue;

        const boundaryPoints: Point[] = [];
        let currX = boundStartX;
        let currY = boundStartY;
        let backtrack = 6;
        const isV = (x: number, y: number) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            return inComponent[y * width + x] === 1;
        };
        boundaryPoints.push({ x: currX - width / 2, y: currY - height / 2 });
        const maxLoops = 1000000;
        let loops = 0;
        do {
            let foundNext = false;
            for (let i = 0; i < 8; i++) {
                const scanIdx = (backtrack + 1 + i) % 8;
                const nx = currX + dx8[scanIdx];
                const ny = currY + dy8[scanIdx];
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

        if (boundaryPoints.length >= 3) {
            const simplified: Point[] = [];
            simplified.push(boundaryPoints[0]);
            let lastP = boundaryPoints[0];
            for (let i = 1; i < boundaryPoints.length; i++) {
                const p = boundaryPoints[i];
                const dist = Math.sqrt((p.x - lastP.x) ** 2 + (p.y - lastP.y) ** 2);
                if (dist >= SIMPLIFICATION_THRESHOLD) {
                    simplified.push(p);
                    lastP = p;
                }
            }
            simplified.push(boundaryPoints[0]);
            allPolygons.push(simplified);
        }
    }
    return allPolygons;
}

/** 타일 중심 좌표(0,0=중앙) 기준 점이 폴리곤 내부인지 (ray casting) */
function isPointInPolygon(cx: number, cy: number, polygon: Point[]): boolean {
    if (polygon.length < 3) return false;
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        if (((yi > cy) !== (yj > cy)) && (cx < (xj - xi) * (cy - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

/** 비-빨간(mask 0) 픽셀의 연결 요소 목록 반환. 각 요소는 픽셀 인덱스 배열. (전체 픽셀 스캔 대신 연결 요소만 사용해 구멍 추출) */
function getConnectedComponentsOfNonRed(
    walkableMask: Uint8Array,
    width: number,
    height: number
): number[][] {
    const visited = new Uint8Array(width * height);
    const components: number[][] = [];

    for (let seed = 0; seed < width * height; seed++) {
        if (walkableMask[seed] === 1 || visited[seed] === 1) continue;
        const queue: number[] = [seed];
        visited[seed] = 1;
        let qHead = 0;
        while (qHead < queue.length) {
            const currIdx = queue[qHead++];
            const px = currIdx % width;
            const py = Math.floor(currIdx / width);
            for (let d = 0; d < 4; d++) {
                const nx = px + dx4[d];
                const ny = py + dy4[d];
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    if (walkableMask[nIdx] === 0 && visited[nIdx] === 0) {
                        visited[nIdx] = 1;
                        queue.push(nIdx);
                    }
                }
            }
        }
        components.push([...queue]);
    }
    return components;
}

/** 연결 요소의 중심(타일 중심 좌표)이 walkable 폴리곤 안에 있으면 구멍. 구멍인 요소만 경계 추출해 폴리곤 배열 반환 */
function extractHolePolygons(
    width: number,
    height: number,
    walkableMask: Uint8Array,
    walkablePolygons: Point[][],
    nonRedComponents: number[][]
): Point[][] {
    const holePolygons: Point[][] = [];
    const center = width / 2;

    for (const indices of nonRedComponents) {
        if (indices.length < 3) continue;
        let sumPx = 0;
        let sumPy = 0;
        for (const idx of indices) {
            sumPx += idx % width;
            sumPy += Math.floor(idx / width);
        }
        const cx = sumPx / indices.length - center;
        const cy = sumPy / indices.length - center;
        let insideWalkable = false;
        for (const poly of walkablePolygons) {
            if (isPointInPolygon(cx, cy, poly)) {
                insideWalkable = true;
                break;
            }
        }
        if (!insideWalkable) continue;

        const holeMask = new Uint8Array(width * height);
        for (const idx of indices) holeMask[idx] = 1;
        const polygons = extractPolygonsFromMask(holeMask, width, height);
        for (const p of polygons) holePolygons.push(p);
    }
    return holePolygons;
}

/**
 * map.jpg 분석: 빨간색 = 이동 가능(tiles). 빨간색으로 둘러싸인 안쪽의 비-빨간 지형 = 이동 불가(obstacleTiles).
 * map-debug-*.png: 이동 가능 영역 초록, 구멍(지형 지물) 빨간색 표시.
 */
async function processOneTile(
    mapPath: string,
    tileIndex: number,
    debugOutDir: string
): Promise<{ walkablePolygons: Point[][]; holePolygons: Point[][] }> {
    const image = await loadImage(mapPath);
    const width = image.width;
    const height = image.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const walkableMask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        walkableMask[i] = isRedPixel(r, g, b) ? 1 : 0;
    }

    const walkablePolygons = extractPolygonsFromMask(walkableMask, width, height);
    const nonRedComponents = getConnectedComponentsOfNonRed(walkableMask, width, height);
    const holePolygons = extractHolePolygons(width, height, walkableMask, walkablePolygons, nonRedComponents);

    const debugImagePath = path.join(debugOutDir, `map-debug-${tileIndex + 1}.png`);
    const debugCanvas = createCanvas(width, height);
    const dCtx = debugCanvas.getContext('2d');
    dCtx.drawImage(image, 0, 0);
    dCtx.fillStyle = 'rgba(0, 255, 0, 0.25)';
    dCtx.strokeStyle = 'green';
    dCtx.lineWidth = 2;
    for (const poly of walkablePolygons) {
        if (poly.length === 0) continue;
        dCtx.beginPath();
        dCtx.moveTo(poly[0].x + width / 2, poly[0].y + height / 2);
        for (let i = 1; i < poly.length; i++) {
            dCtx.lineTo(poly[i].x + width / 2, poly[i].y + height / 2);
        }
        dCtx.closePath();
        dCtx.fill();
        dCtx.stroke();
    }
    dCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    dCtx.strokeStyle = 'darkred';
    for (const poly of holePolygons) {
        if (poly.length === 0) continue;
        dCtx.beginPath();
        dCtx.moveTo(poly[0].x + width / 2, poly[0].y + height / 2);
        for (let i = 1; i < poly.length; i++) {
            dCtx.lineTo(poly[i].x + width / 2, poly[i].y + height / 2);
        }
        dCtx.closePath();
        dCtx.fill();
        dCtx.stroke();
    }
    fs.writeFileSync(debugImagePath, debugCanvas.toBuffer('image/png'));

    return { walkablePolygons, holePolygons };
}

/**
 * 타일 로컬(중심 기준) 좌표를 월드 좌표로 변환. (단일 4048x4048 맵: 중심 = 0,0)
 */
function toWorldPoints(
    points: Point[],
    opts: { center: number }
): Point[] {
    return points.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y),
    }));
}

async function generateMapData(): Promise<void> {
    const projectRoot = process.cwd();
    const mapPath = getMapImagePath(projectRoot);
    const debugDir = path.join(projectRoot, 'public/assets/chapter-1/map/debug');
    const mapDir = path.join(projectRoot, 'public/assets/chapter-1/map');
    const outputPath = path.join(mapDir, 'map-data.json');

    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }

    if (!mapPath) {
        console.error('Map image not found. Place map.jpg in public/assets/chapter-1/map/debug/');
        process.exit(1);
    }

    console.log(`Analyzing single map: ${mapPath}`);
    const { walkablePolygons, holePolygons } = await processOneTile(mapPath, 0, debugDir);

    const img = await loadImage(mapPath);
    const mapWidth = img.width;
    const mapHeight = img.height;
    const opts = { center: mapWidth / 2 };

    const tiles: Point[][] = [];
    for (const polygon of walkablePolygons) {
        if (polygon.length > 0) {
            tiles.push(toWorldPoints(polygon, opts));
        }
    }
    const obstacleTiles: Point[][] = [];
    for (const polygon of holePolygons) {
        if (polygon.length > 0) {
            obstacleTiles.push(toWorldPoints(polygon, opts));
        }
    }

    const mapData = {
        width: mapWidth,
        height: mapHeight,
        tiles,
        obstacleTiles,
        walkableTile: 'baseTile',
        startPosition: { x: 0, y: 0 },
    };

    fs.writeFileSync(outputPath, JSON.stringify(mapData));
    console.log(`Map data saved to ${outputPath} (walkable: ${tiles.length}, holes: ${obstacleTiles.length}, ${mapWidth}x${mapHeight}).`);
}

generateMapData();
