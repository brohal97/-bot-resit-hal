require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const visionApiKey = process.env.VISION_API_KEY;

console.log("🤖 BOT AKTIF – Sistem Lengkap Padanan Resit");

// =================== [ Helper: Tarikh Normalizer ] ===================
const bulanMap = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function detectAndFormatDateFromText(text) {
  text = text.toLowerCase().replace(/[\.\-]/g, ' ');

  const regex = /\b(\d{1,2})\s*([a-z]{3})\s*(\d{2,4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let [_, day, monthStr, year] = match;
    const month = bulanMap[monthStr.toLowerCase()];
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

// =================== [ OCR Vision API ] ===================
async function extractTarikhFromImage(fileUrl) {
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;

  try {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');

    const body = {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }]
      }]
    };

    const visionRes = await axios.post(endpoint, body);
    const ocrText = visionRes.data.responses[0]?.fullTextAnnotation?.text || "";
    console.log("🧾 OCR TEXT:\n", ocrText);

    const cleanText = ocrText.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const tarikh = detectAndFormatDateFromText(cleanText);
    return tarikh;

  } catch (err) {
    console.error("❌ ERROR OCR:", err.message);
    return null;
  }
}

// =================== [ FUNGSI 1: Caption Masuk ➜ Padam & Butang ] ===================
let pendingUploads = {};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const text = msg.text;

  if (!text || msg.photo || msg.document || msg.caption || msg.reply_to_message) return;

  await bot.deleteMessage(chatId, messageId).catch(err => {
    console.log("❌ Gagal padam mesej asal:", err.message);
  });

  await bot.sendMessage(chatId, `📩 *${text}*`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Upload Resit", callback_data: `upload_${messageId}` }]
      ]
    }
  });
});

// =================== [ FUNGSI 2: Tekan Butang ➜ Force Reply Aktif ] ===================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;

  if (data.startsWith('upload_')) {
    pendingUploads[userId] = {
      captionText: query.message.text || '',
      forceReplyTo: messageId
    };

    await bot.answerCallbackQuery({ callback_query_id: query.id });

    await bot.sendMessage(chatId, `📤 Sila reply mesej ini dengan gambar resit anda.`, {
      reply_markup: { force_reply: true },
      reply_to_message_id: messageId
    });
  }
});

// =================== [ FUNGSI 3: User Reply Gambar ➜ OCR + Gabung + Semakan ] ===================
bot.on('photo', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const replyTo = msg.reply_to_message?.message_id || null;

  if (!pendingUploads[userId] || !replyTo) {
    return bot.sendMessage(chatId, `⚠️ Sila tekan butang "Upload Resit" dan reply dengan gambar.`, {
      reply_to_message_id: messageId
    });
  }

  const { captionText, forceReplyTo } = pendingUploads[userId];
  const photos = msg.photo;
  const fileId = photos[photos.length - 1].file_id;

  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const tarikhOCR = await extractTarikhFromImage(fileUrl);
  const tarikhCaption = detectAndFormatDateFromText(captionText);

  let semakan = '';
  if (!tarikhOCR || !tarikhCaption) {
    semakan = `⚠️ Gagal kesan tarikh dalam gambar atau caption.`;
  } else if (tarikhOCR === tarikhCaption) {
    semakan = `✅ Tarikh padan: *${tarikhOCR}*`;
  } else {
    semakan = `❌ Tarikh tidak padan:\n📸 Gambar: *${tarikhOCR}*\n✍️ Caption: *${tarikhCaption}*`;
  }

  // Padam mesej asal
  await bot.deleteMessage(chatId, messageId).catch(() => {});
  await bot.deleteMessage(chatId, forceReplyTo).catch(() => {});

  // Hantar semula sebagai satu post (gambar + caption + hasil semakan)
  await bot.sendPhoto(chatId, fileId, {
    caption: `📩 ${captionText}\n\n${semakan}`,
    parse_mode: "Markdown"
  });

  delete pendingUploads[userId];
});
