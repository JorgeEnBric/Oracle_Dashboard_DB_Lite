import fs from 'fs/promises';
import path from 'path';

export async function GET() {
    const filePath = path.join(process.cwd(), 'connections.json');
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return new Response(JSON.stringify({ success: true, connections: JSON.parse(data) }));
    } catch (err) {
        return new Response(JSON.stringify({ success: true, connections: [] }));
    }
}