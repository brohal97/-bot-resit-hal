require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const vision = require('@google-cloud/vision');
const fs = require('fs');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const client = new vision.ImageAnnotatorClient({
  keyFilename: './neat-cycling-456917-k5-a69fb15ebab7.json'
});

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR RESIT...");

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Muat turun gambar
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync('temp.jpg', response.data);

    // Hantar ke Google Vision OCR
    const [result] = await client.textDetection('temp.jpg');
    const detections = result.textAnnotations;
    const ocrText = detections.length > 0 ? detections[0].description : '';

    console.log("🔍 OCR Result:\n", ocrText);

    // Semak jika mengandungi tarikh
    const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/; // contoh: 13/4/2025
    const foundDate = ocrText.match(dateRegex);

    if (foundDate) {
      bot.sendMessage(chatId, `✅ Resit diterima. Tarikh dijumpai: ${foundDate[0]}`);
    } else {
      bot.sendMessage(chatId, `❌ Resit tidak sah. Tarikh tidak dijumpai.`);
    }

    // Padam fail sementara
    fs.unlinkSync('temp.jpg');
  } catch (error) {
    console.error("❌ Ralat:", error.message);
    bot.sendMessage(chatId, "⚠️ Ralat berlaku semasa proses OCR.");
  }
});




