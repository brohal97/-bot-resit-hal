require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const vision = require('@google-cloud/vision');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ✅ Inisialisasi bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR...");

// ✅ Guna credentials dari .env (inline JSON)
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    // ✅ Muat turun gambar dari Telegram
    const file = await bot.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await axios.get(url, { responseType: 'arraybuffer' });

    const filePath = path.join(__dirname, 'resit.jpg');
    fs.writeFileSync(filePath, res.data);

    // ✅ Proses OCR guna Google Cloud Vision
    const [result] = await client.textDetection(filePath);
    const detections = result.textAnnotations;
    const ocrText = detections.length > 0 ? detections[0].description : '';

    console.log("📄 OCR Result:\n", ocrText);

    // ✅ Cari tarikh dalam teks OCR
    const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
    const foundDate = ocrText.match(dateRegex);

    if (foundDate) {
      bot.sendMessage(chatId, `✅ Resit diterima.\n📆 Tarikh dijumpai: ${foundDate[0]}`);
    } else {
      bot.sendMessage(chatId, `❌ Resit tidak sah.\n⛔ Tarikh tidak dijumpai.`);
    }

    fs.unlinkSync(filePath); // Padam gambar selepas selesai
  } catch (error) {
    console.error("❌ Ralat OCR:", error);
    bot.sendMessage(chatId, "⚠️ Ralat semasa proses OCR. Sila cuba lagi.");
  }
});



