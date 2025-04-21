require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const visionApiKey = process.env.VISION_API_KEY;

console.log("🤖 BOT AKTIF – Sistem Padanan Tarikh Caption & Gambar");

const bulanMap = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

// Format tarikh ke bentuk standard DD/MM/YYYY
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

// OCR Google Vision
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

// ========== [ FUNGSI 1: HANTAR TEKS ➜ PADAM ➜ HANTAR DENGAN BUTANG ] ==========
let pendingUploads = {};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const text = msg.text;

  // Skip jika bukan mesej teks biasa
  if (!text || msg.photo || msg.document || msg.caption) return;

  // Padam mesej asal
  await bot.deleteMessage(chatId, messageId).catch(err => {
    console.log("❌ Gagal padam mesej asal:", err.message);
  });

  // Hantar semula dengan butang
  await bot.sendMessage(chatId, `📩 *${text}*`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Upload Resit", callback_data: `upload_${messageId}` }]
      ]
    }
  });
});

// ========== [ FUNGSI 2: SIMPAN PAIRING BILA TEKAN BUTANG ] ==========
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;

  if (data.startsWith('upload_')) {
    const originalMessageId = data.split('_')[1];

    pendingUploads[userId] = {
      captionMsgId: messageId,
      time: Date.now()
    };

    await bot.answerCallbackQuery({ callback_query_id: query.id });
    await bot.sendMessage(chatId, `📤 Sila upload gambar resit sekarang.`, {
      reply_to_message_id: messageId
    });
  }
});

// ========== [ FUNGSI 3: BILA GAMBAR DIMUAT NAIK ] ==========
bot.on('photo', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const photos = msg.photo;
  const fileId = photos[photos.length - 1].file_id;

  if (!pendingUploads[userId]) {
    return bot.sendMessage(chatId, `⚠️ Anda belum tekan butang "Upload Resit".`, {
      reply_to_message_id: messageId
    });
  }

  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const pairedMsgId = pendingUploads[userId].captionMsgId;
  const captionMsg = await bot.getChatMessage?.(chatId, pairedMsgId).catch(() => null);
  const captionText = captionMsg?.text || '';

  const tarikhOCR = await extractTarikhFromImage(fileUrl);
  const tarikhCaption = detectAndFormatDateFromText(captionText);

  if (!tarikhOCR || !tarikhCaption) {
    return bot.sendMessage(chatId, `⚠️ Gagal kesan tarikh dalam gambar atau caption.`, {
      reply_to_message_id: messageId
    });
  }

  if (tarikhOCR === tarikhCaption) {
    await bot.sendMessage(chatId, `✅ Tarikh padan: *${tarikhOCR}*`, {
      parse_mode: "Markdown",
      reply_to_message_id: messageId
    });
  } else {
    await bot.sendMessage(chatId, `❌ Tarikh tidak padan:\n📸 Gambar: *${tarikhOCR}*\n✍️ Caption: *${tarikhCaption}*`, {
      parse_mode: "Markdown",
      reply_to_message_id: messageId
    });
  }

  delete pendingUploads[userId];
});

