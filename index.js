// ✅ index.js versi clean, stabil, dan confirm boleh deploy
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const API_KEY = process.env.VISION_API_KEY;

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {};

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | BAYAR KOMISEN | BAYAR TRANSPORT");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b\d{1,2}\s+\d{1,2}\s+\d{2,4}\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/,
    /\b\d{1,2}(hb)?(jan|feb|mac|...|disember)\d{2,4}\b/i,
    /\b\d{1,2}(hb)?\s+(jan|feb|mac|...|disember)\s+\d{2,4}\b/i,
    /\b(jan|feb|mac|...|disember)\s+\d{1,2},?\s+\d{2,4}\b/i
  ];
  return patterns.some(p => p.test(lower));
}

function formatTarikhStandard(text) {
  const bulanMap = { jan: '01', januari: '01', ..., disember: '12' };
  const clean = text.trim();
  let m1 = clean.match(/(\d{1,2})\s+(jan|...|disember)\s+(\d{4})/i);
  if (m1) return `${m1[1].padStart(2, '0')}-${bulanMap[m1[2].toLowerCase()] || '??'}-${m1[3]}`;
  let m2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m2) return `${m2[3].padStart(2, '0')}-${m2[2].padStart(2, '0')}-${m2[1]}`;
  let m3 = clean.match(/(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
  if (m3) return `${m3[1].padStart(2, '0')}-${m3[2].padStart(2, '0')}-${m3[3].length === 2 ? '20' + m3[3] : m3[3]}`;
  return text;
}

function cariTarikhDalamText(teks) {
  return formatTarikhStandard(teks);
}

function extractTarikhFromOCRAndCaption(ocrText, captionText) {
  const ocrLine = ocrText.split(/\n|\|/).map(l => l.trim()).find(isTarikhValid) || '';
  const captionLine = captionText.split(/\n|\|/).map(l => l.trim()).find(isTarikhValid) || '';
  return {
    tarikhOCR: cariTarikhDalamText(ocrLine),
    tarikhCaption: cariTarikhDalamText(captionLine)
  };
}

async function replyUITrick(chatId, text, replyTo) {
  const sent = await bot.sendMessage(chatId, `❗️𝐒𝐢𝐥𝐚 𝐇𝐚𝐧𝐭𝐚𝐫 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐫𝐚❗️`, {
    reply_to_message_id: replyTo,
    parse_mode: "HTML",
    reply_markup: {
      force_reply: true
    }
  });
  return sent.message_id;
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (typeof msg.text !== "string") return;
  const text = msg.text.trim();
  const originalMsgId = msg.message_id;
  const sah = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];
  if (!sah.some(n => text.toUpperCase().startsWith(n))) return;
  if (text.length < 20) return bot.sendMessage(chatId, "⚠️ Sila tambah maklumat seperti tarikh, lokasi dan jumlah dalam mesej.");

  try { await bot.deleteMessage(chatId, originalMsgId); } catch {}
  const [first, ...others] = text.split('\n');
  const formattedText = `<b>${first}</b>\n${others.join('\n')}`;
  const sent = await bot.sendMessage(chatId, formattedText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]]
    }
  });
  pendingUploads[sent.message_id] = { detail: text, chatId, replyTo: sent.message_id, captionMsgId: sent.message_id };
});

bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const uploadInfo = pendingUploads[msg.message_id];
  if (!uploadInfo) return bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Resit tidak dijumpai atau telah tamat.", show_alert: true });
  const replyMsgId = await replyUITrick(uploadInfo.chatId, uploadInfo.detail, uploadInfo.replyTo);
  pendingUploads[replyMsgId] = { ...uploadInfo, replyTo: replyMsgId };
  await bot.answerCallbackQuery(callbackQuery.id);
});

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message;
  if (!replyTo) return;
  const matched = pendingUploads[replyTo.message_id];
  if (!matched) return;

  const file = await bot.getFile(msg.photo[msg.photo.length - 1].file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(res => Buffer.from(res.data));
  await bot.sendPhoto(chatId, imageBuffer, { caption: `<b>${matched.detail.split('\n')[0]}</b>\n${matched.detail.split('\n').slice(1).join('\n')}`, parse_mode: "HTML" });
  try {
    await bot.deleteMessage(chatId, msg.message_id);
    await bot.deleteMessage(chatId, replyTo.message_id);
    await bot.deleteMessage(chatId, matched.captionMsgId);
  } catch {}

  if (matched.detail.toUpperCase().startsWith("RESIT PERBELANJAAN")) {
    const visionResponse = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`, {
      requests: [{ image: { source: { imageUri: fileUrl } }, features: [{ type: 'TEXT_DETECTION' }] }]
    });
    const response = visionResponse.data.responses[0];
    const ocrText = response.fullTextAnnotation?.text || response.textAnnotations?.[0]?.description || '';
    const { tarikhOCR, tarikhCaption } = extractTarikhFromOCRAndCaption(ocrText, matched.detail);
    console.log("📅 Caption:", tarikhCaption, "🧾 OCR:", tarikhOCR);
    if (tarikhOCR && tarikhCaption && tarikhOCR === tarikhCaption) {
      await bot.sendMessage(chatId, `✅ Tarikh padan: ${tarikhCaption}`);
    } else {
      await bot.sendMessage(chatId, `❌ Tarikh tidak sepadan.\n📅 Caption: ${tarikhCaption || '❓'}\n🧾 Gambar: ${tarikhOCR || '❓'}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Luluskan Secara Manual", callback_data: `manual_${replyTo.message_id}` }]
          ]
        }
      });
    }
  }
  delete pendingUploads[replyTo.message_id];
});
