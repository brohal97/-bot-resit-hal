require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let lastUploadRequest = {}; // Simpan pairing berdasarkan chatId

console.log("🤖 BOT AKTIF – Versi TRICK Tanpa Reply + Tanpa Mesej Upload");

// Step 1: Bila terima mesej "RESIT PERBELANJAAN"
bot.onText(/RESIT PERBELANJAAN/i, async (msg) => {
  const chatId = msg.chat.id;
  const detailText = msg.text;
  const originalMsgId = msg.message_id;

  // Padam mesej asal user
  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  // Hantar semula mesej detail + butang upload
  const sent = await bot.sendMessage(chatId, detailText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit Disini", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });

  // Simpan ID mesej detail untuk padam kemudian
  lastUploadRequest[chatId] = {
    detail: detailText,
    detailMsgId: sent.message_id,
    timestamp: Date.now()
  };
});

// Step 2: Bila tekan butang upload (TIADA mesej tambahan dihantar)
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (lastUploadRequest[chatId]) {
    lastUploadRequest[chatId].timestamp = Date.now(); // reset masa
  }
});

// Step 3: Bila gambar dihantar (tanpa reply)
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const photoId = msg.photo[msg.photo.length - 1].file_id;
  const now = Date.now();

  const pair = lastUploadRequest[chatId];

  if (!pair || now - pair.timestamp > 60000) {
    await bot.sendMessage(chatId, "⚠️ Gambar ini tidak dikaitkan dengan mana-mana resit. Sila tekan Upload Resit semula.");
    return;
  }

  // Padam gambar asal
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (e) {
    console.error("❌ Gagal padam gambar asal:", e.message);
  }

  // Padam mesej asal detail
  try {
    await bot.deleteMessage(chatId, pair.detailMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej detail asal:", e.message);
  }

  // Gabungkan gambar + caption ke dalam satu mesej baru
  const captionGabung = `🧾 RESIT PERBELANJAAN\n${pair.detail}`;

  const sentPhoto = await bot.sendPhoto(chatId, photoId, {
    caption: captionGabung
  });

  // Forward ke channel rasmi jika perlu
  try {
    await bot.forwardMessage(process.env.CHANNEL_ID, chatId, sentPhoto.message_id);
  } catch (err) {
    console.error("❌ Gagal forward ke channel:", err.message);
  }

  // Padam pairing
  delete lastUploadRequest[chatId];
});

