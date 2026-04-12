// src/middleware.js
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
    const { pathname } = context.url;

    // Solo actuar en rutas protegidas
    if (!pathname.startsWith('/dashboard')) {
        return next();
    }

    const dbSession = context.cookies.get('db_session')?.value;


    if (!dbSession) {
        console.log('Sin sesión — redirigiendo a /');
        return context.redirect('/');
    }

    try {
        const sessionData = JSON.parse(decodeURIComponent(dbSession));

        if (!sessionData.usuario || !sessionData.host) {
            throw new Error('Sesión incompleta');
        }

        console.log('✅ Acceso permitido para:', sessionData.usuario);

        // Disponible en cualquier página como Astro.locals.dbSession
        context.locals.dbSession = sessionData;

    } catch (err) {
        console.error('Cookie inválida:', err.message);
        context.cookies.delete('db_session', { path: '/' });
        return context.redirect('/');
    }

    return next();
});