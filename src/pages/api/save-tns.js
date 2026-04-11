import fs from 'fs/promises';
import path from 'path';

export async function POST({ request }) {
    const { connections } = await request.json();
    const filePath = path.join(process.cwd(), 'connections.json');
    
    try {
        await fs.writeFile(filePath, JSON.stringify(connections, null, 4));
        return new Response(JSON.stringify({ success: true }));
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }));
    }
}