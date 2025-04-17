// 🤖 BOT TELEGRAM – SCAN & BALAS MAKLUMAT RINGKAS RESIT
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Fungsi cari tarikh dalam format umum
function extractTarikh(text) {
  const regex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g;
  const matches = text.match(regex);
  return matches ? matches[0] : "-";
}

// Fungsi cari jumlah terakhir (RM)
function extractJumlah(text) {
  const regex = /(RM|MYR)?\s?(\d{1,3}(,\d{3})*|\d+)(\.\d{2})?/gi;
  const matches = [...text.matchAll(regex)].map(m => m[0].replace(/,/g, '').trim());
  return matches.length ? matches[matches.length - 1] : "-";
}

// Fungsi cari nama kedai (baris pertama huruf besar panjang)
function extractNamaKedai(lines) {
  for (let i = 0; i < 5; i++) {
    const line = lines[i]?.trim();
    if (line && line.length > 5 && line === line.toUpperCase()) return line;
  }
  return "-";
}

// Fungsi cari nama operator (jika ada)
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

    // Hantar ke Google Vision OCR
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
    const jumlah = extractJumlah(ocrText);
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
