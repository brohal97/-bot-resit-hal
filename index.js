require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR...");

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

    const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
    const foundDate = text.match(dateRegex);

    if (foundDate) {
      bot.sendMessage(chatId, `✅ Resit diterima.\n📆 Tarikh dijumpai: ${foundDate[0]}`);
    } else {
      bot.sendMessage(chatId, `❌ Resit tidak sah.\nTiada tarikh ditemui.`);
    }

  } catch (err) {
    console.error("❌ Ralat OCR:", err.message);
    bot.sendMessage(chatId, `⚠️ Ralat semasa proses OCR.`);
  }
});

