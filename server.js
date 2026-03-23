// server.js

import "dotenv/config";
import app from "./src/app.js";
import DbConnect from "./src/config/dbConnect.js";

const port = process.env.APP_PORT || process.env.API_PORT || 6060;

const server = app.listen(port, (error) => {
    if (error) {
        console.error('Erro ao iniciar o servidor:', error);
        process.exit(1);
    }
    else {
        console.log(`Servidor escutando em http://localhost:${port}`);
    }
});

const gracefulShutdown = async (signal) => {
    console.log(`\nRecebido ${signal}. Encerrando aplicação com segurança...`);
    server.close(async () => {
        try {
            await DbConnect.disconnect();
            console.log('Conexão com o banco encerrada.');
            process.exit(0);
        } catch (error) {
            console.error('Erro ao encerrar o banco:', error);
            process.exit(1);
        }
    });
};

['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => gracefulShutdown(signal));
});
