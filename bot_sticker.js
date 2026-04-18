const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
require('dotenv').config();
const http = require('http');

/**
 * CONFIGURAÇÕES GERAIS DO BOT
 * Centralize aqui todos os IDs e constantes para facilitar a manutenção.
 */
const CONFIG = {
    LOG_FILE: 'mensagens_grupo.txt',
    STICKER_METADATA: {
        name: "Bot @stk 2026",
        author: "@NexusCleo"
    },
    GROUPS: {
        BOAS_VINDAS: (process.env.GROUPS_WELCOME || '').split(','),
        ARQUIVO_TEXTO: (process.env.GROUPS_LOG || '').split(','),
        STICKERS: (process.env.GROUPS_STICKERS || '').split(',')
    }
};

const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    puppeteer: {
        executablePath: process.env.CHROME_PATH || (process.platform === 'linux' ? '/usr/bin/chromium' : undefined),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions'
        ],
    },
    authTimeoutMs: 60000, // Aumenta o timeout para conexões lentas de VPS
});

/**
 * SERVIDOR PARA O RENDER (Health Check)
 */
const port = process.env.PORT || 5500; // 3000
const server = http.createServer((req, res) => res.end('Bot is running'));

server.listen(port, () => {
    console.log(`Servidor de monitoramento ativo na porta ${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`[Aviso] Porta ${port} já está em uso. O servidor de monitoramento não foi iniciado localmente, mas o bot continuará operando.`);
    } else {
        console.error('Erro crítico no servidor de monitoramento:', err);
    }
});

/**
 * CICLO DE VIDA E AUTENTICAÇÃO
 */
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code recebido. Escaneie com seu WhatsApp.');
});

client.on('authenticated', () => {
    console.log('Autenticação realizada com sucesso!');
});

client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação:', msg);
});

client.on('ready', () => {
    console.log('Bot está pronto e conectado!');
});

/**
 * PROCESSO PRINCIPAL DE MENSAGENS (ROTEADOR)
 * Gerencia para onde cada mensagem deve ser enviada com base no tipo e permissão.
 */
client.on('message', async (msg) => {
    const chatId = msg.from;
    const isGroup = chatId.endsWith('@g.us');

    // --- ÁREA 1: CAPTURA PARA RESUMO (IA) ---
    // Salva apenas textos simples de grupos autorizados para posterior análise.
    if (isGroup && CONFIG.GROUPS.ARQUIVO_TEXTO.includes(chatId) && msg.type === 'chat') {
        await saveMessageToLog(msg);
    }

    // --- ÁREA 2: COMANDOS DE UTILITÁRIOS (STICKERS) ---
    const command = msg.body.toLowerCase();
    if (command === '@stk') {
        if (isGroup && !CONFIG.GROUPS.STICKERS.includes(chatId)) return;
        await handleStickerCommand(msg);
    }
});

/**
 * --- ÁREA 3: GESTÃO DE MEMBROS (BOAS-VINDAS) ---
 * Monitora a entrada de novos usuários nos grupos configurados.
 */
client.on('group_join', async (notification) => {
    if (!CONFIG.GROUPS.BOAS_VINDAS.includes(notification.chatId)) return;

    try {
        const chat = await notification.getChat();
        const contact = await client.getContactById(notification.recipientIds[0]);
        const welcomeMsg = `Olá, @${contact.id.user}! 🎉\n\n` +
            `Seja muito bem-vindo(a) ao grupo *${chat.name}*!\n\n` +
            `Para mantermos a organização, por favor, preencha o nosso formulário de apresentação:\n` +
            `📋 *Formulário do grupo:* https://forms.gle/HfXSuhizLrrp4Nu18\n\n` +
            `Ao final do formulário, você terá acesso ao link do nosso Discord oficial!`;
        await chat.sendMessage(welcomeMsg, { mentions: [contact] });
    } catch (error) {
        console.error('Erro ao enviar boas-vindas:', error);
    }
});

/** 
 * FUNÇÕES AUXILIARES DE SUPORTE
 */

async function saveMessageToLog(msg) {
    try {
        const contact = await msg.getContact();
        const name = contact.pushname || contact.number;
        const time = new Date().toLocaleString('pt-BR');
        const entry = `[${time}] ${name}: ${msg.body}\n`;

        await fs.promises.appendFile(CONFIG.LOG_FILE, entry, 'utf8');
    } catch (error) {
        console.error('Erro ao salvar log:', error);
    }
}

async function handleStickerCommand(msg) {
    try {
        let targetMsg = msg;

        // Suporte para responder (quote) a uma imagem
        if (!msg.hasMedia && msg.hasQuotedMsg) {
            targetMsg = await msg.getQuotedMessage();
        }

        if (targetMsg.hasMedia && targetMsg.type === 'image') {
            const media = await targetMsg.downloadMedia();

            await client.sendMessage(msg.from, media, {
                sendMediaAsSticker: true,
                stickerName: CONFIG.STICKER_METADATA.name,
                stickerAuthor: CONFIG.STICKER_METADATA.author
            });
        } else {
            await msg.reply('Por favor, envie uma imagem ou responda a uma com o comando *@stk*.');
        }
    } catch (error) {
        console.error('Erro ao criar figurinha:', error);
        await msg.reply('❌ Ocorreu um erro ao processar sua figurinha.');
    }
}

client.initialize().catch(err => console.error('Erro na inicialização:', err));