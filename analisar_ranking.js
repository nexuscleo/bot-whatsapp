const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de log (mesmo definido no bot_sticker.js)
const LOG_FILE = path.join(__dirname, 'mensagens_grupo.txt');

function gerarRanking() {
    if (!fs.existsSync(LOG_FILE)) {
        console.error('Erro: O arquivo mensagens_grupo.txt não foi encontrado.');
        return;
    }

    const data = fs.readFileSync(LOG_FILE, 'utf8');
    const linhas = data.split('\n').filter(linha => linha.trim() !== '');
    const totalMensagens = linhas.length;

    if (totalMensagens === 0) {
        console.log('O log está vazio.');
        return;
    }

    const estatisticas = {};

    linhas.forEach(linha => {
        // O formato esperado é: [data/hora] Nome: Mensagem
        // Capturamos o texto entre o primeiro ']' e o primeiro ':'
        const regex = /\] (.*?):/;
        const match = linha.match(regex);

        if (match && match[1]) {
            const nome = match[1];
            estatisticas[nome] = (estatisticas[nome] || 0) + 1;
        }
    });

    const ranking = Object.entries(estatisticas).sort((a, b) => b[1] - a[1]);

    console.log(`\n--- RANKING DE PARTICIPAÇÃO (Total: ${totalMensagens} mensagens) ---\n`);
    ranking.forEach(([usuario, total]) => {
        const percentual = ((total / totalMensagens) * 100).toFixed(2);
        console.log(`${usuario}: ${total} mensagens (${percentual}%)`);
    });
}

gerarRanking();