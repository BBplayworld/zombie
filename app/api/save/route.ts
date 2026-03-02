import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SAVE_FILE = path.join(DATA_DIR, 'save.json');

/** GET: 저장 데이터 로딩 */
export async function GET() {
    try {
        await fs.access(SAVE_FILE);
        const raw = await fs.readFile(SAVE_FILE, 'utf-8');
        return NextResponse.json(JSON.parse(raw));
    } catch {
        return NextResponse.json({ error: 'No save file' }, { status: 404 });
    }
}

/** POST: 저장 데이터 쓰기 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(SAVE_FILE, JSON.stringify(body, null, 2), 'utf-8');
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

/** DELETE: 저장 파일 삭제 */
export async function DELETE() {
    try {
        await fs.unlink(SAVE_FILE);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: true }); // 파일 없어도 ok
    }
}
