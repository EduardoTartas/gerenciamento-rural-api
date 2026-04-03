// src/config/auth.js

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import DbConnect from './dbConnect.js';

export const auth = betterAuth({
    database: prismaAdapter(DbConnect.prisma, {
        provider: 'postgresql',
    }),
    basePath: '/api/auth',
    emailAndPassword: {
        enabled: true,
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes
        },
    },
});
