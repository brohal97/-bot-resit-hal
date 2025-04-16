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

  // Format: 16/04/2025 atau 16-04-2025
  let match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const [_, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Format: 16 Apr 2025
  match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (match) {
    const [_, d, b, y] = match;
    const bulan = bulanMap[b.toLowerCase().slice(0, 3)];
    if (bulan) return `${y}-${bulan}-${d.padStart(2, '0')}`;
  }

  // Format: April 16, 2025
  match = text.match(/([A-Za-z]+)\s+(\d{1,2})[,]?\s+(\d{4})/);
  if (match) {
    const [_, b, d, y] = match;
    const bulan = bulanMap[b.toLowerCase().slice(0, 3)];
    if (bulan) return `${y}-${bulan}-${d.padStart(2, '0')}`;
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
