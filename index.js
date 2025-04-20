// ✅ GABUNGAN PENUH – BOT SEMAK 3 JENIS RESIT + AUTO PADAM + GAYA BOLD + FORWARD CHANNEL
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {}; // Simpan pairing ikut message_id

console.log("🤖 BOT AKTIF – SEMAK RESIT PERBELANJAAN | KOMISEN | TRANSPORT");

function boldBarisPertama(text) {
  const lines = text.split("\n");
  if (lines.length === 0) return text;
  lines[0] = lines[0]
    .split('')
    .map(c => {
      if (/[A-Z]/.test(c)) return String.fromCodePoint(0x1D400 + (c.charCodeAt(0) - 65));
      if (/[a-z]/.test(c)) return String.fromCodePoint(0x1D41A + (c.charCodeAt(0) - 97));
      return c;
    })
    .join('');
  return lines.join("\n");
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text && typeof msg.text === "string") {
    const text = msg.text.trim();
    const originalMsgId = msg.message_id;
    const barisPertama = text.split("\n")[0].toUpperCase();
    const namaSah = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];
    if (!namaSah.includes(barisPertama)) return;

    if (text.length < 20) {
      await bot.sendMessage(chatId, "⚠️ Sila tambah maklumat seperti tarikh, lokasi dan jumlah dalam mesej.");
      return;
    }

    try {
      await bot.deleteMessage(chatId, originalMsgId);
    } catch (e) {
      console.error("❌ Gagal padam mesej asal:", e.message);
    }

    const boldText = boldBarisPertama(text);
    const sent = await bot.sendMessage(chatId, boldText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
        ]
      }
    });

    pendingUploads[sent.message_id] = {
      detail: text,
      chatId: chatId,
      detailMsgId: sent.message_id
    };
    return;
  }

  if (msg.photo) {
    const replyTo = msg.reply_to_message?.message_id;
    if (!replyTo || !pendingUploads[replyTo]) {
      await bot.sendMessage(chatId, "⚠️ Gambar ini tidak dikaitkan dengan mana-mana resit. Sila tekan Upload Resit semula.");
      return;
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const resitData = pendingUploads[replyTo];

    try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) {}
    try { await bot.deleteMessage(chatId, resitData.triggerMsgId); } catch (e) {}
    try { await bot.deleteMessage(chatId, resitData.detailMsgId); } catch (e) {}

    const detailText = resitData.detail.trim();
    const captionGabung = boldBarisPertama(detailText);
    const sentPhoto = await bot.sendPhoto(chatId, fileId, { caption: captionGabung });
    await bot.forwardMessage(process.env.CHANNEL_ID, chatId, sentPhoto.message_id);

    setTimeout(async () => {
      try { await bot.deleteMessage(chatId, sentPhoto.message_id); } catch (e) {}
    }, 5000);

    try {
      const fileUrl = await bot.getFileLink(fileId);
      const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(imageBuffer.data, 'binary').toString('base64');
      const ocrRes = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`, {
        requests: [{ image: { content: base64Image }, features: [{ type: "TEXT_DETECTION" }] }]
      });
      const ocrText = ocrRes.data.responses[0].fullTextAnnotation?.text || "";
      const firstLine = detailText.trim().split("\n")[0].toLowerCase();

      if (firstLine.includes("resit perbelanjaan")) {
        semakResitPerbelanjaan(msg, chatId, ocrText);
      } else if (firstLine.includes("bayar komisen")) {
        semakBayarKomisen(msg, chatId, ocrText);
      } else if (firstLine.includes("bayar transport")) {
        semakBayarTransport(msg, chatId, ocrText);
      } else {
        bot.sendMessage(chatId, "❌ Format caption tidak dikenali. Sila guna RESIT PERBELANJAAN / BAYAR KOMISEN / BAYAR TRANSPORT.");
      }
    } catch (err) {
      console.error("OCR Error:", err.message);
      bot.sendMessage(chatId, "❌ Gagal membaca gambar. Sila pastikan gambar jelas.");
    }

    delete pendingUploads[replyTo];
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const detailMsgId = pendingUploads[msgId]?.detailMsgId || msgId;

  if (pendingUploads[msgId]) {
    const trigger = await bot.sendMessage(chatId, '❗️𝐒𝐢𝐥𝐚 𝐔𝐩𝐥𝐨𝐚𝐝 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐞𝐑𝐀 ❗️', {
      reply_to_message_id: detailMsgId,
      reply_markup: { force_reply: true }
    });

    pendingUploads[trigger.message_id] = {
      ...pendingUploads[msgId],
      triggerMsgId: trigger.message_id
    };

    setTimeout(async () => {
      if (pendingUploads[trigger.message_id]) {
        try { await bot.deleteMessage(chatId, trigger.message_id); } catch (e) {}
        delete pendingUploads[trigger.message_id];
      }
    }, 40000);
  }
});

