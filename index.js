require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const visionApiKey = process.env.VISION_API_KEY;

console.log("🤖 BOT AKTIF – Kesan Tarikh dari Gambar");

const bulanMap = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function detectAndFormatDateFromText(text) {
  text = text.toLowerCase().replace(/[\.\-]/g, ' ');

  const regex = /\b(\d{1,2})\s*([a-zA-Z]{3})\s*(\d{2,4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let [_, day, monthStr, year] = match;
    let month = bulanMap[monthStr.toLowerCase()];
    if (!month) continue;

    if (year.length === 2) {
      year = year > 30 ? `19${year}` : `20${year}`;
    }

    day = day.padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // fallback to format dd/mm/yyyy
  const altRegex = /\b(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](\d{2,4})\b/;
  const altMatch = text.match(altRegex);
  if (altMatch) {
    let [_, day, month, year] = altMatch;
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');
    if (year.length === 2) {
      year = year > 30 ? `19${year}` : `20${year}`;
    }
    return `${day}/${month}/${year}`;
  }

  return null;
}

async function extractTarikhFromImage(imageUrl) {
  const visionEndpoint = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
  const body = {
    requests: [{
      image: { source: { imageUri: imageUrl } },
      features: [{ type: "TEXT_DETECTION" }]
    }]
  };

  const response = await axios.post(visionEndpoint, body);
  const ocrText = response.data.responses[0]?.fullTextAnnotation?.text || "";

  const tarikh = detectAndFormatDateFromText(ocrText);
  return tarikh;
}

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photos = msg.photo;
  const fileId = photos[photos.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const tarikh = await extractTarikhFromImage(fileUrl);

    if (tarikh) {
      bot.sendMessage(chatId, `📅 Tarikh dikesan dalam gambar: *${tarikh}*`, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, `⚠️ Tiada tarikh sah ditemui dalam gambar ini.`);
    }
  } catch (error) {
    console.error("❌ Error semasa proses gambar:", error.message);
    bot.sendMessage(chatId, `❌ Gagal proses gambar. Sila cuba lagi.`);
  }
});
