require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT HIDUP & TENGAH TUNGGU GAMBAR...");

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const image = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(image.data).toString('base64');

    // Cuba access Document AI guna API Key
    const apiKey = process.env.DOCUMENT_API_KEY;
    const url = `https://us-documentai.googleapis.com/v1/projects/neat-cycling-456917-k5/locations/us/processors/8c8c055737b80cb9:process?key=${apiKey}`;

    const response = await axios.post(url, {
      rawDocument: {
        content: base64Image,
        mimeType: 'image/png'
      }
    });

    bot.sendMessage(chatId, `✅ Berjaya: ${JSON.stringify(response.data, null, 2)}`);
  } catch (err) {
    console.error("❌ Ralat:", err.response?.data || err.message);
    bot.sendMessage(chatId, `❌ Gagal: ${err.response?.data?.error?.message || err.message}`);
  }
});
