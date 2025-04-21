require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const API_KEY = process.env.VISION_API_KEY;

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {};

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | BAYAR KOMISEN | BAYAR TRANSPORT");

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

  const clean = text.trim();

  let match1 = clean.match(/(\\d{1,2})\\s+(jan|feb|mac|mar|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis)\\s+(\\d{4})/i);
  if (match1) return `${match1[1].padStart(2, '0')}-${bulanMap[match1[2].toLowerCase()] || '??'}-${match1[3]}`;

  let match2 = clean.match(/(\\d{4})[\\/\\-](\\d{1,2})[\\/\\-](\\d{1,2})/);
  if (match2) return `${match2[3].padStart(2, '0')}-${match2[2].padStart(2, '0')}-${match2[1]}`;

  let match3 = clean.match(/(\\d{1,2})[\\/\\-\\.\\s](\\d{1,2})[\\/\\-\\.\\s](\\d{2,4})/);
  if (match3) return `${match3[1].padStart(2, '0')}-${match3[2].padStart(2, '0')}-${match3[3].length === 2 ? '20' + match3[3] : match3[3]}`;

  let match4 = clean.match(/(\\d{1,2})(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis)\\d{4}/i);
  if (match4) {
    const d = match4[1].padStart(2, '0');
    const m = bulanMap[match4[2].toLowerCase()] || '??';
    const y = clean.slice(-4);
    return `${d}-${m}-${y}`;
  }

  return text;
}

function cariTarikhDalamText(teks) {
  return formatTarikhStandard(teks);
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (typeof msg.text !== "string") return;

  const text = msg.text.trim();
  const originalMsgId = msg.message_id;

  const namaSah = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];
  const isKategoriSah = namaSah.some((nama) => text.toUpperCase().startsWith(nama));
  if (!isKategoriSah) return;

  if (text.length < 20) {
    await bot.sendMessage(chatId, "⚠️ Sila tambah maklumat seperti tarikh, lokasi dan jumlah dalam mesej.");
    return;
  }

  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  const lines = text.split('\n');
  const firstLine = lines[0] ? `<b>${lines[0]}</b>` : '';
  const otherLines = lines.slice(1).join('\n');
  const formattedText = `${firstLine}\n${otherLines}`;

  const sent = await bot.sendMessage(chatId, formattedText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });

  pendingUploads[sent.message_id] = {
    detail: text,
    chatId: chatId,
    replyTo: sent.message_id,
    captionMsgId: sent.message_id
  };
});

bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  if (!data.startsWith("upload_")) return;

  const uploadInfo = pendingUploads[msg.message_id];
  if (!uploadInfo) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Resit tidak dijumpai atau telah tamat.",
      show_alert: true
    });
    return;
  }

  const replyMsgId = await replyUITrick(uploadInfo.chatId, uploadInfo.detail, uploadInfo.replyTo);
  pendingUploads[replyMsgId] = {
    detail: uploadInfo.detail,
    chatId: uploadInfo.chatId,
    replyTo: replyMsgId,
    captionMsgId: msg.message_id
  };

  await bot.answerCallbackQuery(callbackQuery.id);
});

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyToMsg = msg.reply_to_message;
  if (!replyToMsg) return;

  const matched = pendingUploads[replyToMsg.message_id];
  if (!matched) return;

  const photo = msg.photo[msg.photo.length - 1];
  const file = await bot.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const lines = matched.detail.split('\n');
  const firstLine = lines[0] ? `<b>${lines[0]}</b>` : '';
  const otherLines = lines.slice(1).join('\n');
  const formattedCaption = `${firstLine}\n${otherLines}`;

  try {
    await bot.sendChatAction(chatId, 'upload_photo');
    const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(res => Buffer.from(res.data, 'binary'));

    await bot.sendPhoto(chatId, imageBuffer, {
      caption: formattedCaption,
      parse_mode: "HTML"
    });

    await bot.deleteMessage(chatId, msg.message_id);
    await bot.deleteMessage(chatId, replyToMsg.message_id);
    await bot.deleteMessage(chatId, matched.captionMsgId);

    if (matched.detail.toUpperCase().startsWith("RESIT PERBELANJAAN")) {
      const visionResponse = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
        {
          requests: [
            {
              image: { source: { imageUri: fileUrl } },
              features: [{ type: 'TEXT_DETECTION' }]
            }
          ]
        }
      );

      const response = visionResponse.data.responses[0];
      const ocrText = response.fullTextAnnotation?.text || response.textAnnotations?.[0]?.description || '';

      // Pisahkan caption ikut baris atau simbol | dan cari yang valid
const captionLine = matched.detail
  .split(/\n|\|/)
  .map(line => line.trim())
  .find(line => isTarikhValid(line)) || '';

// Pisahkan OCR text ikut baris atau simbol | dan cari yang valid
const ocrLine = ocrText
  .split(/\n|\|/)
  .map(line => line.trim())
  .find(line => isTarikhValid(line)) || '';

// Format ke bentuk standard (dd-mm-yyyy)
const { tarikhOCR, tarikhCaption } = extractTarikhFromOCRAndCaption(ocrText, matched.detail);

console.log("📅 Caption Tarikh:", tarikhCaption);
console.log("🧾 OCR Tarikh:", tarikhOCR);

// Debug log untuk semak dalam Railway log
console.log("📅 CaptionLine:", captionLine);
console.log("🧾 OCR Line:", ocrLine);
console.log("✅ Tarikh Caption:", tarikhCaption);
console.log("✅ Tarikh OCR:", tarikhOCR);

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
    }

    delete pendingUploads[replyToMsg.message_id];
  } catch (e) {
    console.error("❌ Error hantar semula gambar:", e.message);
  }
});
