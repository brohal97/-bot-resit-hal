// 🤖 BOT TELEGRAM - SCAN & BALAS TEKS PENUH GAMBAR RESIT (MarkdownV2 Safe)
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (!msg.photo) {
    bot.sendMessage(chatId, "❌ Sila hantar gambar resit sahaja.");
    return;
  }

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(res.data).toString('base64');

    // Google Vision OCR API
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
      bot.sendMessage(chatId, "⚠️ Gambar tiada teks dikesan.");
      return;
    }

    // Escape simbol untuk MarkdownV2
    const escapedText = ocrText.replace(/([*_`\[\]()~>#+=|{}.!-])/g, '\$1');

    // Balas isi OCR dalam format kemas
    bot.sendMessage(chatId, "📄 *Isi Penuh Resit Dikesan:*

```" + escapedText + "```", {
      parse_mode: "MarkdownV2"
    });

  } catch (error) {
    console.error("❌ Ralat OCR:", error.message);
    bot.sendMessage(chatId, "❌ Ralat semasa baca gambar. Pastikan gambar jelas & berisi teks.");
  }
});
