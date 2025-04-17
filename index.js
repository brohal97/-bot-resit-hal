// 🤖 BOT TELEGRAM – VERSI 3: SEMI-AI LOGIK KONTEKS RESIT
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Kata kunci penting untuk nilai jumlah
const keywordPatterns = [
  "total", "grand total", "sub-total", "subtotal", "jumlah rm", "jumlah", "amount"
];

function extractJumlahSemiAI(lines) {
  const hargaPattern = /(rm|myr)?\s?(\d{1,3}(,\d{3})*|\d+)(\.\d{2})?/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase().trim();

    for (let keyword of keywordPatterns) {
      if (line.includes(keyword)) {
        // 1. Cuba cari harga dalam baris sekarang (selepas tanda titik dua atau hujung)
        const afterColon = lines[i].split(/[:\s]{1,}/).pop();
        const matchInline = afterColon.match(hargaPattern);
        if (matchInline) return matchInline[0].replace(/,/g, '').trim();

        // 2. Kalau tak jumpa, cuba baris seterusnya
        const nextLine = lines[i + 1]?.trim();
        if (nextLine) {
          const matchNext = nextLine.match(hargaPattern);
          if (matchNext) return matchNext[0].replace(/,/g, '').trim();
        }
      }
    }
  }

  // 3. Fallback: ambil harga terbesar dari seluruh OCR
  const allMatches = lines
    .flatMap(line => [...line.matchAll(/(rm|myr)?\s?(\d{1,3}(,\d{3})*|\d+)(\.\d{2})?/gi)])
    .map(m => m[0].replace(/,/g, '').trim());
  if (allMatches.length > 0) {
    return allMatches.sort((a, b) => parseFloat(b) - parseFloat(a))[0];
  }

  return "-";
}

function extractTarikh(text) {
  const regex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g;
  const matches = text.match(regex);
  return matches ? matches[0] : "-";
}

function extractNamaKedai(lines) {
  for (let i = 0; i < 5; i++) {
    const line = lines[i]?.trim();
    if (line && line.length > 5 && line === line.toUpperCase()) return line;
  }
  return "-";
}

function extractOperator(text) {
  const regex = /operator\s*[:\-]?\s*(.+)/i;
  const match = text.match(regex);
  return match ? match[1].trim() : "-";
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (!msg.photo) {
    bot.sendMessage(chatId, "❌ Sila hantar gambar resit.");
    return;
  }

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(res.data).toString('base64');

    const visionRes = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`,
      {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
          }
        ]
      }
    );

    const ocrText = visionRes.data.responses[0]?.textAnnotations?.[0]?.description || '';

    if (!ocrText.trim()) {
      bot.sendMessage(chatId, "⚠️ Gambar tidak mengandungi teks yang boleh dibaca.");
      return;
    }

    const lines = ocrText.split('\n');
    const kedai = extractNamaKedai(lines);
    const tarikh = extractTarikh(ocrText);
    const jumlah = extractJumlahSemiAI(lines);
    const operator = extractOperator(ocrText);

    const reply = `📄 *Resit Dikesan:*

` +
                  `🏪 *Nama Kedai:* ${kedai}
` +
                  `📅 *Tarikh:* ${tarikh}
` +
                  `💵 *Jumlah:* ${jumlah}
` +
                  `👤 *Operator:* ${operator}`;

    bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });

  } catch (error) {
    console.error("❌ Ralat semasa proses OCR:", error.message);
    bot.sendMessage(chatId, "❌ Ralat semasa proses gambar. Pastikan gambar jelas & mengandungi resit.");
  }
});
