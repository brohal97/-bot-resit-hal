require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF - MODE: DETECT TARIKH SAHAJA");

// ========== FUNGSI UTAMA: KESAN TARIKH ==========
function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // 10/03/2025 atau 10-03-2025
    /\d{1,2}\s+\d{1,2}\s+\d{2,4}/,       // 10 03 2025
    /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,   // 2025-03-10 atau 2025/03/10
    /\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i, // 10 Mac 2025
    /(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i // Mac 10, 2025
  ];
  return patterns.some(p => p.test(lower));
}

// ========== BOT LISTEN & SEMAK GAMBAR ==========
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.photo) {
    bot.sendMessage(chatId, "❌ Sila hantar gambar resit sahaja.");
    return;
  }

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const fileLink = await bot.getFileLink(fileId);

    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');

    const ocrRes = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`, {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }]
      }]
    });

    const text = ocrRes.data.responses[0].fullTextAnnotation?.text || "";
    const lines = text.split('\n').map(x => x.trim());

    const tarikhJumpa = lines.find(line => isTarikhValid(line));

    if (tarikhJumpa) {
      bot.sendMessage(chatId, `✅ Tarikh dijumpai: ${tarikhJumpa}`);
    } else {
      bot.sendMessage(chatId, "❌ Tiada tarikh dijumpai dalam gambar.");
    }
  } catch (err) {
    console.error("OCR Error:", err.message);
    console.log("FULL ERROR:", err.response?.data || err);
    bot.sendMessage(chatId, "❌ Gagal membaca gambar. Sila pastikan gambar jelas.");
  }
});

