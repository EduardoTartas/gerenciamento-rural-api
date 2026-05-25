// src/utils/templates/resetPassword.js

/**
 * Gera o HTML do e-mail de redefinição de senha.
 * @param {string} userName - Nome do usuário.
 * @param {string} resetUrl - URL completa para redefinição de senha.
 * @returns {string} HTML formatado.
 */
export function resetPasswordTemplate(userName, resetUrl) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinição de Senha — Pasto Livre</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #2d6a4f 0%, #40916c 100%);padding:32px 40px;text-align:center;">
                            <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:0.5px;">
                                🐄 Pasto Livre
                            </h1>
                            <p style="color:#b7e4c7;margin:8px 0 0;font-size:14px;">
                                Gerenciamento Rural Inteligente
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="color:#1b4332;margin:0 0 16px;font-size:22px;">
                                Olá, ${userName}!
                            </h2>
                            <p style="color:#52796f;font-size:16px;line-height:1.6;margin:0 0 24px;">
                                Recebemos uma solicitação para redefinir a senha da sua conta. 
                                Clique no botão abaixo para criar uma nova senha:
                            </p>

                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding:8px 0 32px;">
                                        <a href="${resetUrl}" 
                                           style="display:inline-block;background:linear-gradient(135deg,#2d6a4f,#40916c);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
                                            Redefinir Minha Senha
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color:#52796f;font-size:14px;line-height:1.6;margin:0 0 16px;">
                                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                            </p>
                            <p style="color:#2d6a4f;font-size:13px;word-break:break-all;background-color:#f0f7f4;padding:12px 16px;border-radius:6px;border:1px solid #d8f3dc;margin:0 0 24px;">
                                ${resetUrl}
                            </p>

                            <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0;" />

                            <p style="color:#95a5a6;font-size:13px;line-height:1.5;margin:0;">
                                ⚠️ Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição 
                                de senha, ignore este e-mail — sua conta permanece segura.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f8faf9;padding:24px 40px;text-align:center;border-top:1px solid #e8e8e8;">
                            <p style="color:#95a5a6;font-size:12px;margin:0;">
                                © ${new Date().getFullYear()} Pasto Livre — Gerenciamento Rural
                            </p>
                            <p style="color:#b0b0b0;font-size:11px;margin:8px 0 0;">
                                Este é um e-mail automático. Por favor, não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();
}

    export function resetPasswordOTPTemplate(otp) {
        return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Código de Redefinição de Senha — Pasto Livre</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:40px 0;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #2d6a4f 0%, #40916c 100%);padding:32px 40px;text-align:center;">
                                <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:0.5px;">
                                    🐄 Pasto Livre
                                </h1>
                                <p style="color:#b7e4c7;margin:8px 0 0;font-size:14px;">
                                    Gerenciamento Rural Inteligente
                                </p>
                            </td>
                        </tr>
    
                        <!-- Body -->
                        <tr>
                            <td style="padding:40px;">
                                <h2 style="color:#1b4332;margin:0 0 16px;font-size:22px;">
                                    Olá!
                                </h2>
                                <p style="color:#52796f;font-size:16px;line-height:1.6;margin:0 0 24px;">
                                    Recebemos uma solicitação para redefinir a senha da sua conta. 
                                    Utilize o código abaixo no aplicativo para criar uma nova senha:
                                </p>
    
                                <!-- OTP Code -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding:8px 0 32px;">
                                            <div style="display:inline-block;background-color:#f0f7f4;color:#2d6a4f;padding:16px 40px;border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px;border:2px dashed #40916c;">
                                                ${otp}
                                            </div>
                                        </td>
                                    </tr>
                                </table>
    
                                <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0;" />
    
                                <p style="color:#95a5a6;font-size:13px;line-height:1.5;margin:0;">
                                    ⚠️ Este código expira em <strong>5 minutos</strong>. Se você não solicitou a redefinição 
                                    de senha, ignore este e-mail — sua conta permanece segura.
                                </p>
                            </td>
                        </tr>
    
                        <!-- Footer -->
                        <tr>
                            <td style="background-color:#f8faf9;padding:24px 40px;text-align:center;border-top:1px solid #e8e8e8;">
                                <p style="color:#95a5a6;font-size:12px;margin:0;">
                                    © ${new Date().getFullYear()} Pasto Livre — Gerenciamento Rural
                                </p>
                                <p style="color:#b0b0b0;font-size:11px;margin:8px 0 0;">
                                    Este é um e-mail automático. Por favor, não responda.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`.trim();
    }
    
    export default { resetPasswordTemplate, resetPasswordOTPTemplate };
