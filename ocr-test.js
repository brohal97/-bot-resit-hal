require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🔍 BOT AKTIF – VERSI OCR SEMAK TARIKH SAHAJA");

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const ocrResult = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`,
      {
        requests: [{
          image: { source: { imageUri: fileUrl } },
          features: [{ type: "TEXT_DETECTION" }]
        }]
      }
    );

    const response = ocrResult.data.responses[0];
    const text = response?.fullTextAnnotation?.text || response?.textAnnotations?.[0]?.description;

    if (!text || text.trim().length < 3) {
      await bot.sendMessage(chatId, "❌ Gagal baca teks dari gambar resit.");
      return;
    }

    const tarikhPattern = /\b(\d{1,2}[\/\-\.\s](\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\/\-\.\s]\d{2,4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s\-]?\d{1,2}[,\s]+\d{4})\b/gi;
    const padanan = text.match(tarikhPattern);

    if (padanan && padanan.length > 0) {
      await bot.sendMessage(chatId, `📅 Tarikh dijumpai: ${padanan[0]}`);
    } else {
      await bot.sendMessage(chatId, "❌ Tiada tarikh dijumpai dalam gambar.");
    }
  } catch (err) {
    console.error("❌ Ralat semasa OCR:", err.message);
    await bot.sendMessage(chatId, "❌ Berlaku ralat semasa baca gambar.");
  }
});

