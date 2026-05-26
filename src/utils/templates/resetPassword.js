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
<body style="margin:0;padding:0;background-color:#F8F9FA;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #317B3B 0%, #5EAA65 100%);padding:32px 40px;text-align:center;">
                            <h1 style="color:#FFFFFF;margin:0;font-size:28px;font-weight:700;letter-spacing:0.5px;">
                                <img src="data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2020%2016%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%2016V14H5.75C5.38333%2012.5833%204.6875%2011.3625%203.6625%2010.3375C2.6375%209.3125%201.41667%208.61667%200%208.25C0.333333%208.16667%200.6625%208.10417%200.9875%208.0625C1.3125%208.02083%201.65%208%202%208C4.23333%208%206.125%208.775%207.675%2010.325C9.225%2011.875%2010%2013.7667%2010%2016H0ZM12%2016C12%2015.3%2011.925%2014.6042%2011.775%2013.9125C11.625%2013.2208%2011.4083%2012.5583%2011.125%2011.925C11.825%2010.7417%2012.7792%209.79167%2013.9875%209.075C15.1958%208.35833%2016.5333%208%2018%208C18.35%208%2018.6875%208.02083%2019.0125%208.0625C19.3375%208.10417%2019.6667%208.16667%2020%208.25C18.5833%208.61667%2017.3667%209.3125%2016.35%2010.3375C15.3333%2011.3625%2014.6333%2012.5833%2014.25%2014H20V16H12ZM10%2010.025C10%208.94167%2010.2%207.925%2010.6%206.975C11%206.025%2011.55%205.1875%2012.25%204.4625C12.95%203.7375%2013.7708%203.15833%2014.7125%202.725C15.6542%202.29167%2016.6583%202.05833%2017.725%202.025C16.7917%202.60833%2015.975%203.325%2015.275%204.175C14.575%205.025%2014.0333%205.975%2013.65%207.025C12.9167%207.375%2012.2458%207.80417%2011.6375%208.3125C11.0292%208.82083%2010.4833%209.39167%2010%2010.025ZM8.175%208.15C7.975%208%207.775%207.85833%207.575%207.725C7.375%207.59167%207.16667%207.45833%206.95%207.325C6.95%207.225%206.95833%207.12083%206.975%207.0125C6.99167%206.90417%207%206.8%207%206.7C7%205.43333%206.8%204.23333%206.4%203.1C6%201.96667%205.43333%200.933333%204.7%200C5.8%200.45%206.75417%201.09583%207.5625%201.9375C8.37083%202.77917%208.99167%203.75%209.425%204.85C9.125%205.35%208.86667%205.87917%208.65%206.4375C8.43333%206.99583%208.275%207.56667%208.175%208.15Z%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E" alt="Logo" width="24" height="24" style="vertical-align: middle; margin-right: 8px;" />Pasto Livre
                            </h1>
                            <p style="color:#D4F5D6;margin:8px 0 0;font-size:14px;">
                                Gerenciamento Rural Inteligente
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="color:#1E293B;margin:0 0 16px;font-size:22px;">
                                Olá, \${userName}!
                            </h2>
                            <p style="color:#64748B;font-size:16px;line-height:1.6;margin:0 0 24px;">
                                Recebemos uma solicitação para redefinir a senha da sua conta. 
                                Clique no botão abaixo para criar uma nova senha:
                            </p>

                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding:8px 0 32px;">
                                        <a href="\${resetUrl}" 
                                           style="display:inline-block;background:linear-gradient(135deg,#317B3B,#5EAA65);color:#FFFFFF;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
                                            Redefinir Minha Senha
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color:#64748B;font-size:14px;line-height:1.6;margin:0 0 16px;">
                                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                            </p>
                            <p style="color:#317B3B;font-size:13px;word-break:break-all;background-color:#E8F5E9;padding:12px 16px;border-radius:6px;border:1px solid #D4F5D6;margin:0 0 24px;">
                                \${resetUrl}
                            </p>

                            <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />

                            <p style="color:#94A3B8;font-size:13px;line-height:1.5;margin:0;">
                                ⚠️ Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição 
                                de senha, ignore este e-mail — sua conta permanece segura.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#F1F5F9;padding:24px 40px;text-align:center;border-top:1px solid #E2E8F0;">
                            <p style="color:#94A3B8;font-size:12px;margin:0;">
                                © \${new Date().getFullYear()} Pasto Livre — Gerenciamento Rural
                            </p>
                            <p style="color:#94A3B8;font-size:11px;margin:8px 0 0;">
                                Este é um e-mail automático. Por favor, não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>\`.trim();
}

export function resetPasswordOTPTemplate(otp) {
    return \`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de Redefinição de Senha — Pasto Livre</title>
</head>
<body style="margin:0;padding:0;background-color:#F8F9FA;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #317B3B 0%, #5EAA65 100%);padding:32px 40px;text-align:center;">
                            <h1 style="color:#FFFFFF;margin:0;font-size:28px;font-weight:700;letter-spacing:0.5px;">
                                <img src="data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2020%2016%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%2016V14H5.75C5.38333%2012.5833%204.6875%2011.3625%203.6625%2010.3375C2.6375%209.3125%201.41667%208.61667%200%208.25C0.333333%208.16667%200.6625%208.10417%200.9875%208.0625C1.3125%208.02083%201.65%208%202%208C4.23333%208%206.125%208.775%207.675%2010.325C9.225%2011.875%2010%2013.7667%2010%2016H0ZM12%2016C12%2015.3%2011.925%2014.6042%2011.775%2013.9125C11.625%2013.2208%2011.4083%2012.5583%2011.125%2011.925C11.825%2010.7417%2012.7792%209.79167%2013.9875%209.075C15.1958%208.35833%2016.5333%208%2018%208C18.35%208%2018.6875%208.02083%2019.0125%208.0625C19.3375%208.10417%2019.6667%208.16667%2020%208.25C18.5833%208.61667%2017.3667%209.3125%2016.35%2010.3375C15.3333%2011.3625%2014.6333%2012.5833%2014.25%2014H20V16H12ZM10%2010.025C10%208.94167%2010.2%207.925%2010.6%206.975C11%206.025%2011.55%205.1875%2012.25%204.4625C12.95%203.7375%2013.7708%203.15833%2014.7125%202.725C15.6542%202.29167%2016.6583%202.05833%2017.725%202.025C16.7917%202.60833%2015.975%203.325%2015.275%204.175C14.575%205.025%2014.0333%205.975%2013.65%207.025C12.9167%207.375%2012.2458%207.80417%2011.6375%208.3125C11.0292%208.82083%2010.4833%209.39167%2010%2010.025ZM8.175%208.15C7.975%208%207.775%207.85833%207.575%207.725C7.375%207.59167%207.16667%207.45833%206.95%207.325C6.95%207.225%206.95833%207.12083%206.975%207.0125C6.99167%206.90417%207%206.8%207%206.7C7%205.43333%206.8%204.23333%206.4%203.1C6%201.96667%205.43333%200.933333%204.7%200C5.8%200.45%206.75417%201.09583%207.5625%201.9375C8.37083%202.77917%208.99167%203.75%209.425%204.85C9.125%205.35%208.86667%205.87917%208.65%206.4375C8.43333%206.99583%208.275%207.56667%208.175%208.15Z%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E" alt="Logo" width="24" height="24" style="vertical-align: middle; margin-right: 8px;" />Pasto Livre
                            </h1>
                            <p style="color:#D4F5D6;margin:8px 0 0;font-size:14px;">
                                Gerenciamento Rural Inteligente
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="color:#1E293B;margin:0 0 16px;font-size:22px;">
                                Olá!
                            </h2>
                            <p style="color:#64748B;font-size:16px;line-height:1.6;margin:0 0 24px;">
                                Recebemos uma solicitação para redefinir a senha da sua conta. 
                                Utilize o código abaixo no aplicativo para criar uma nova senha:
                            </p>

                            <!-- OTP Code -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding:8px 0 32px;">
                                        <div style="display:inline-block;background-color:#E8F5E9;color:#317B3B;padding:16px 40px;border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px;border:2px dashed #5EAA65;">
                                            \${otp}
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />

                            <p style="color:#94A3B8;font-size:13px;line-height:1.5;margin:0;">
                                ⚠️ Este código expira em <strong>5 minutos</strong>. Se você não solicitou a redefinição 
                                de senha, ignore este e-mail — sua conta permanece segura.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#F1F5F9;padding:24px 40px;text-align:center;border-top:1px solid #E2E8F0;">
                            <p style="color:#94A3B8;font-size:12px;margin:0;">
                                © \${new Date().getFullYear()} Pasto Livre — Gerenciamento Rural
                            </p>
                            <p style="color:#94A3B8;font-size:11px;margin:8px 0 0;">
                                Este é um e-mail automático. Por favor, não responda.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>\`.trim();
}

export default { resetPasswordTemplate, resetPasswordOTPTemplate };
