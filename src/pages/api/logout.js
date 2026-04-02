export async function POST() {
    const response = new Response(null, {
        status: 302,
        headers: { Location: '/' }
    });
    response.headers.set('Set-Cookie', 'db_session=; Path=/; HttpOnly; Max-Age=0');
    return response;
}