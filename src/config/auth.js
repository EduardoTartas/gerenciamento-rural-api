// src/config/auth.js

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins';
import DbConnect from './dbConnect.js';
import nodemailer from 'nodemailer';
import { resetPasswordTemplate, resetPasswordOTPTemplate } from '../utils/templates/index.js';
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
    plugins: [
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
        async sendResetPassword({ user, url }) {
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: user.email,
                    subject: 'Pasto Livre — Redefinição de Senha',
                    html: resetPasswordTemplate(user.name, url),
                });
                logger.info(`E-mail de redefinição de senha enviado para ${user.email}`);
            } catch (err) {
                logger.error('Falha ao enviar e-mail de redefinição de senha', {
                    to: user.email,
                    error: err.message,
                });
                // Não relança o erro para não expor falha interna ao cliente
            }
        },
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes
        },
    },
});
