require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const vision = require('@google-cloud/vision');
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: './key.json'
});

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

function cariTarikhDalamText(teks) {
  const pattern1 = /\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/;
  const match1 = teks.match(pattern1);
  if (match1) {
    const [_, dd, mm, yyyy] = match1;
    return `${yyyy.length === 2 ? '20' + yyyy : yyyy}-${pad(mm)}-${pad(dd)}`;
  }
  const pattern2 = /\b(\d{1,2})(Jan|Feb|Mac|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-]?(20\d{2}|\d{2})\b/i;
  const match2 = teks.match(pattern2);
  if (match2) {
    const [_, dd, bulan, tahun] = match2;
    const bulanMap = {
      Jan: '01', Feb: '02', Mac: '03', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    const mm = bulanMap[bulan.slice(0, 3)];
    const yyyy = tahun.length === 2 ? '20' + tahun : tahun;
    return `${yyyy}-${mm}-${pad(dd)}`;
  }
  return null;
}

function pad(n) {
  return n.toString().padStart(2, '0');
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
  console.log("📎 fileUrl:", fileUrl);

  try {
    await bot.deleteMessage(chatId, msg.message_id);
    await bot.deleteMessage(chatId, replyToMsg.message_id);
    await bot.deleteMessage(chatId, matched.captionMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej:", e.message);
  }

  const [result] = await visionClient.textDetection(fileUrl);
  const ocrText = result.fullTextAnnotation ? result.fullTextAnnotation.text : '';

  const tarikhCaption = cariTarikhDalamText(matched.detail);
  const tarikhOCR = cariTarikhDalamText(ocrText);

  if (matched.detail.toUpperCase().startsWith("RESIT PERBELANJAAN")) {
    if (!tarikhCaption || !tarikhOCR || tarikhCaption !== tarikhOCR) {
      await bot.sendMessage(chatId, `❌ Tarikh tidak sepadan.\n📅 Caption: ${tarikhCaption || '❓'}\n🧾 Resit: ${tarikhOCR || '❓'}`);
      return;
    }
  }

  const lines = matched.detail.split('\n');
  const firstLine = lines[0] ? `<b>${lines[0]}</b>` : '';
  const otherLines = lines.slice(1).join('\n');
  const formattedCaption = `${firstLine}\n${otherLines}`;

  // Hantar semula guna buffer dari axios (gambar + caption 1 post)
  const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(res => Buffer.from(res.data, 'binary'));

  await bot.sendPhoto(chatId, imageBuffer, {
    caption: formattedCaption,
    parse_mode: "HTML"
  });

  delete pendingUploads[replyToMsg.message_id];
});

