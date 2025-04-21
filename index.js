require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const visionApiKey = process.env.VISION_API_KEY;

console.log("🤖 BOT AKTIF – Kesan Tarikh dari Gambar");

// Peta bulan untuk format 'Jan', 'Feb', dll
const bulanMap = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

// Kesan dan format tarikh ke DD/MM/YYYY
function detectAndFormatDateFromText(text) {
  text = text.toLowerCase().replace(/[\.\-]/g, ' ');

  const regex = /\b(\d{1,2})\s*([a-z]{3})\s*(\d{2,4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let [_, day, monthStr, year] = match;
    let month = bulanMap[monthStr.toLowerCase()];
    if (!month) continue;
    if (year.length === 2) year = year > 30 ? `19${year}` : `20${year}`;
    return `${day.padStart(2, '0')}/${month}/${year}`;
  }

  const altRegex = /\b(0?[1-9]|[12][0-9]|3[01])[\s\/\-\.](0?[1-9]|1[0-2])[\s\/\-\.](\d{2,4})\b/;
  const altMatch = text.match(altRegex);
  if (altMatch) {
    let [_, day, month, year] = altMatch;
    if (year.length === 2) year = year > 30 ? `19${year}` : `20${year}`;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  return null;
}

// Proses gambar: download dari Telegram dan hantar ke Vision API
async function extractTarikhFromImage(fileUrl) {
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;

  try {
    // Muat turun image dari Telegram
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    const base64Image = imageBuffer.toString('base64');

    // Hantar ke Google Vision API
    const body = {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }]
      }]
    };

    const visionRes = await axios.post(endpoint, body);
    const ocrText = visionRes.data.responses[0]?.fullTextAnnotation?.text || "";

    console.log("🧾 OCR OUTPUT:\n", ocrText);

    const cleanText = ocrText.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const tarikh = detectAndFormatDateFromText(cleanText);
    return tarikh;

  } catch (err) {
    console.error("❌ ERROR OCR:", err.message);
    return null;
  }
}

// Trigger bila gambar dihantar
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photos = msg.photo;
  const fileId = photos[photos.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    const tarikh = await extractTarikhFromImage(fileUrl);

    if (tarikh) {
      await bot.sendMessage(chatId, `📅 Tarikh dikesan dalam gambar: *${tarikh}*`, {
        parse_mode: "Markdown",
        reply_to_message_id: msg.message_id
      });
    } else {
      await bot.sendMessage(chatId, `⚠️ Tiada tarikh sah ditemui dalam gambar ini.`, {
        reply_to_message_id: msg.message_id
      });
    }

  } catch (error) {
    console.error("❌ Error Proses Gambar:", error.message);
    bot.sendMessage(chatId, `❌ Gagal proses gambar. Sila cuba lagi.`);
  }
});
