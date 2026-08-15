// src/config/auth.js

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, bearer } from 'better-auth/plugins';
import DbConnect from './dbConnect.js';
import nodemailer from 'nodemailer';
import { resetPasswordOTPTemplate } from '../utils/templates/index.js';
import logger from '../utils/logger.js';

// Configura o transporter do Nodemailer usando as variáveis SMTP do .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: parseInt(process.env.SMTP_PORT, 10) === 465, // true para porta 465, false para 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verifica conectividade SMTP ao iniciar (não bloqueia a inicialização)
transporter.verify()
    .then(() => logger.info('📧 Conexão SMTP verificada com sucesso.'))
    .catch((err) => logger.error('❌ Falha na verificação SMTP — e-mails podem não ser enviados.', { error: err.message }));

// Client IDs do Google para o login social. Ausência não é fatal — não deve derrubar
// o boot inteiro (e junto com ele o login por e-mail/senha) só porque o Google ainda
// não foi configurado — mas fica registrado explicitamente, nunca falha em silêncio.
const googleClientIds = [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean);

if (googleClientIds.length === 0) {
    logger.warn('GOOGLE_WEB_CLIENT_ID/GOOGLE_ANDROID_CLIENT_ID não configurados — login com Google desabilitado.');
}

const googleProvider = googleClientIds.length > 0
    ? {
        google: {
            clientId: googleClientIds,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
    }
    : {};

// Origens confiáveis para o BetterAuth (seu próprio CORS interno)
// Inclui as origens da env + permite qualquer origem quando a lista está vazia
const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

export const auth = betterAuth({
    database: prismaAdapter(DbConnect.prisma, {
        provider: 'postgresql',
    }),
    basePath: '/api/auth',
    // trustedOrigins: origens aceitas pelo handler interno do BetterAuth.
    // Incluir o BASE_URL e origens do .env garante que apps mobile, Postman e
    // Swagger UI consigam fazer requests sem serem bloqueados.
    trustedOrigins: [
        process.env.BETTER_AUTH_URL || 'http://localhost:6060',
        ...corsOrigins,
    ],
    user: {
        additionalFields: {
            admin: {
                type: 'boolean',
                required: false,
                defaultValue: false,
                input: false, // impede que o próprio usuário se promova a admin no cadastro/atualização
            },
        },
    },
    // Login com Google via idToken nativo (app mobile). O `aud` do token gerado pelo
    // Google SDK no Android é sempre o Client ID Web (passado como `serverClientId`
    // no app) — por isso ele entra na lista mesmo sem o app usar o fluxo de redirect.
    // O Client ID Android só autoriza o app nativo a existir (package + SHA-1), não é
    // o que o backend valida.
    //
    // Vínculo automático a conta local existente só ocorre se essa conta já tiver
    // `emailVerified: true`. Este projeto não tem fluxo de verificação de e-mail no
    // cadastro por senha — então, na prática, o login Google só funciona pra contas
    // criadas direto pelo Google. Ver documentacao/rotas/rotas_pastolivre.md § 1.3.
    socialProviders: googleProvider,
    plugins: [
        bearer(),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                if (type === "forget-password") {
                    try {
                        await transporter.sendMail({
                            from: process.env.SMTP_FROM || process.env.SMTP_USER,
                            to: email,
                            subject: 'Pasto Livre — Código de Redefinição de Senha',
                            html: resetPasswordOTPTemplate(otp),
                        });
                        logger.info(`E-mail com código OTP enviado para ${email}`);
                    } catch (err) {
                        logger.error('Falha ao enviar código OTP', {
                            to: email,
                            error: err.message,
                        });
                    }
                }
            }
        })
    ],
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 32,
        password: {
            validator: (password) => {
                if (!/^(?=.*[A-Z])(?=.*\d).*$/.test(password)) {
                    return {
                        error: "A senha deve conter pelo menos 1 número e 1 letra maiúscula.",
                    };
                }
                return true;
            }
        },
        // sendResetPassword não configurado de propósito: o app usa o fluxo por
        // código OTP (plugin emailOTP acima), não o fluxo por link do BetterAuth.
        // Sem esse callback, /api/auth/request-password-reset fica desabilitado
        // (RESET_PASSWORD_DISABLED) em vez de existir sem uso.
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes
        },
    },
});
