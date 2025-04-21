// ✅ index.js – Versi FINAL ✅ CLEAN ✅ SIAP DEPLOY
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
    /\b\d{1,2}(hb)?(jan|feb|mac|mar|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis|january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|julai|oktober|disember)\d{2,4}\b/i,
    /\b\d{1,2}(hb)?\s+(jan|feb|mac|mar|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis|january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|julai|oktober|disember)\s+\d{2,4}\b/i,
    /\b(jan|feb|mac|mar|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis|january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|julai|oktober|disember)\s+\d{1,2},?\s+\d{2,4}\b/i
  ];
  return patterns.some(p => p.test(lower));
}

function formatTarikhStandard(text) {
  const bulanMap = {
    jan: '01', januari: '01', january: '01',
    feb: '02', februari: '02', february: '02',
    mar: '03', mac: '03', march: '03',
    apr: '04', april: '04',
    may: '05', mei: '05',
    jun: '06',
    jul: '07', julai: '07', july: '07',
    aug: '08', ogos: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', oktober: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', dis: '12', disember: '12', december: '12'
  };

  const clean = text.trim().toLowerCase().replace(/[–—]/g, '-');

  let match1 = clean.match(/(\d{1,2})\s+(jan|feb|mac|mar|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis)\s+(\d{4})/i);
  if (match1) return `${match1[1].padStart(2, '0')}-${bulanMap[match1[2].toLowerCase()] || '??'}-${match1[3]}`;

  let match2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match2) return `${match2[3].padStart(2, '0')}-${match2[2].padStart(2, '0')}-${match2[1]}`;

  let match3 = clean.match(/(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
  if (match3) return `${match3[1].padStart(2, '0')}-${match3[2].padStart(2, '0')}-${match3[3].length === 2 ? '20' + match3[3] : match3[3]}`;

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

  pendingUploads[sent.message_id] = {
    detail: text,
    chatId,
    replyTo: sent.message_id,
    captionMsgId: sent.message_id
  };
});

bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const uploadInfo = pendingUploads[msg.message_id];

  if (!uploadInfo) return bot.answerCallbackQuery(callbackQuery.id, {
    text: "❌ Resit tidak dijumpai atau telah tamat.",
    show_alert: true
  });

  const replyMsgId = await bot.sendMessage(uploadInfo.chatId, `❗️𝐒𝐢𝐥𝐚 𝐇𝐚𝐧𝐭𝐚𝐫 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐫𝐚❗️`, {
    reply_to_message_id: uploadInfo.replyTo,
    parse_mode: "HTML",
    reply_markup: { force_reply: true }
  });

  pendingUploads[replyMsgId] = {
    ...uploadInfo,
    replyTo: replyMsgId
  };

  await bot.answerCallbackQuery(callbackQuery.id);
});

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyToMsg = msg.reply_to_message;
  if (!replyToMsg) return;

  const matched = pendingUploads[replyToMsg.message_id];
  if (!matched) return;

  const file = await bot.getFile(msg.photo[msg.photo.length - 1].file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(res => Buffer.from(res.data));

  await bot.sendPhoto(chatId, imageBuffer, {
    caption: `<b>${matched.detail.split('\n')[0]}</b>\n${matched.detail.split('\n').slice(1).join('\n')}`,
    parse_mode: "HTML"
  });

  try {
    await bot.deleteMessage(chatId, msg.message_id);
    await bot.deleteMessage(chatId, replyToMsg.message_id);
    await bot.deleteMessage(chatId, matched.captionMsgId);
  } catch {}

  if (matched.detail.toUpperCase().startsWith("RESIT PERBELANJAAN")) {
    try {
      const visionResponse = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`, {
        requests: [
          {
            image: { source: { imageUri: fileUrl } },
            features: [{ type: 'TEXT_DETECTION' }]
          }
        ]
      });

      const response = visionResponse.data.responses[0];
      const ocrText = response.fullTextAnnotation?.text || response.textAnnotations?.[0]?.description || '';
      const { tarikhOCR, tarikhCaption } = extractTarikhFromOCRAndCaption(ocrText, matched.detail);
      console.log("📅 Caption Tarikh:", tarikhCaption);
      console.log("🧾 OCR Tarikh:", tarikhOCR);

      if (tarikhCaption && tarikhOCR && tarikhCaption === tarikhOCR) {
        await bot.sendMessage(chatId, `✅ Tarikh padan: ${tarikhCaption}`);
      } else {
        await bot.sendMessage(chatId, `❌ Tarikh tidak sepadan.\n📅 Caption: ${tarikhCaption || '❓'}\n🧾 Gambar: ${tarikhOCR || '❓'}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Luluskan Secara Manual", callback_data: `manual_${replyToMsg.message_id}` }]
            ]
          }
        });
      }
    } catch (e) {
      console.error("❌ OCR Error:", e.message);
      await bot.sendMessage(chatId, "❌ Gagal baca teks dari gambar.");
    }
  }

  delete pendingUploads[replyToMsg.message_id];
});
