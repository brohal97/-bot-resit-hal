require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const vision = require('@google-cloud/vision');
const axios = require('axios');
const fs = require('fs');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ✅ Guna JSON inline dari .env
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR...");

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync('resit.jpg', response.data);

    const [result] = await client.textDetection('resit.jpg');
    const detections = result.textAnnotations;
    const ocrText = detections.length > 0 ? detections[0].description : '';

    console.log("📄 OCR Result:\n", ocrText);

    const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
    const foundDate = ocrText.match(dateRegex);

    if (foundDate) {
      bot.sendMessage(chatId, `✅ Resit diterima. Tarikh dijumpai: ${foundDate[0]}`);
    } else {
      bot.sendMessage(chatId, `❌ Resit tidak sah. Tarikh tidak dijumpai.`);
    }

    fs.unlinkSync('resit.jpg');
  } catch (error) {
    console.error("❌ Ralat OCR:", error.message);
    bot.sendMessage(chatId, "⚠️ Ralat semasa proses OCR.");
  }
});




