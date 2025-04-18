require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let lastUploadRequest = {}; // Simpan pairing ikut chat ID

console.log("🤖 BOT AKTIF – Versi TRICK Tanpa Reply, Auto Gabung Gambar");

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
  await bot.sendMessage(chatId, detailText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });
});

// Step 2: Bila tekan butang upload
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const detailText = query.message.text;

  // Simpan pairing ikut chat ID selama 60 saat
  lastUploadRequest[chatId] = {
    detail: detailText,
    timestamp: Date.now()
  };

  await bot.sendMessage(chatId, "📎 Sila upload gambar resit sekarang. Tak perlu tekan reply.");
});

// Step 3: Bila gambar dihantar (tanpa reply)
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const now = Date.now();
  const photoId = msg.photo[msg.photo.length - 1].file_id;

  const pair = lastUploadRequest[chatId];

  if (!pair || now - pair.timestamp > 60000) {
    await bot.sendMessage(chatId, "⚠️ Gambar ini tidak dikaitkan dengan mana-mana resit. Sila tekan butang Upload Resit semula.");
    return;
  }

  // Padam gambar asal
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (e) {
    console.error("❌ Gagal padam gambar asal:", e.message);
  }

  // Gabungkan gambar + caption ke dalam satu mesej
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

  // Hapus pairing lepas guna
  delete lastUploadRequest[chatId];
});
