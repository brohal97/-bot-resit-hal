require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR...");

// Fungsi untuk detect tarikh dalam pelbagai format
function extractTarikh(text) {
  const bulanMap = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12"
  };

  text = text.toLowerCase();

  // Format 1: 16/04/2025 atau 16-04-2025
  let match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const [_, d, m, y] = match;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y.length === 2 ? '20' + y : y}`;
  }

  // Format 2: 16 Apr 2025 atau 1 January 2025
  match = text.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})/i);
  if (match) {
    const [_, d, b, y] = match;
    const bulan = bulanMap[b.slice(0, 3)];
    if (bulan) return `${d.padStart(2, '0')}-${bulan}-${y}`;
  }

  // Format 3: April 16, 2025
  match = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})[,]?\s+(\d{4})/i);
  if (match) {
    const [_, b, d, y] = match;
    const bulan = bulanMap[b.slice(0, 3)];
    if (bulan) return `${d.padStart(2, '0')}-${bulan}-${y}`;
  }

  // Format 4: 2025/04/16 atau 2025-04-16
  match = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) {
    const [_, y, m, d] = match;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  return null;
}

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    // Dapatkan URL gambar dari Telegram
    const file = await bot.getFile(fileId);
    const imageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Convert image ke base64
    const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(res.data, 'binary').toString('base64');

    // Hantar ke Google Vision OCR API
    const visionRes = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`,
      {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION' }]
          }
        ]
      }
    );

    const text = visionRes.data.responses[0]?.textAnnotations?.[0]?.description || '';
    console.log("📄 OCR Result:\n", text);

    const tarikh = extractTarikh(text);

    if (tarikh) {
      bot.sendMessage(chatId, `✅ Resit diterima.\n📆 Tarikh dijumpai: ${tarikh}`);
    } else {
      bot.sendMessage(chatId, `❌ Resit tidak sah.\nTiada tarikh ditemui.`);
    }

  } catch (err) {
    console.error("❌ Ralat OCR:", err.message);
    bot.sendMessage(chatId, `⚠️ Ralat semasa proses OCR.`);
  }
});

