
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, bearer } from 'better-auth/plugins';
import DbConnect from './dbConnect.js';
import nodemailer from 'nodemailer';
import { resetPasswordOTPTemplate } from '../utils/templates/index.js';
import logger from '../utils/logger.js';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: parseInt(process.env.SMTP_PORT, 10) === 465, // true para porta 465, false para 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

transporter.verify()
    .then(() => logger.info('📧 Conexão SMTP verificada com sucesso.'))
    .catch((err) => logger.error('❌ Falha na verificação SMTP — e-mails podem não ser enviados.', { error: err.message }));

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

const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

export const auth = betterAuth({
    database: prismaAdapter(DbConnect.prisma, {
        provider: 'postgresql',
    }),
    basePath: '/api/auth',
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
                input: false,
            },
        },
    },
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
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes
        },
    },
});
