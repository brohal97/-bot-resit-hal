require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ✅ Aktifkan bot Telegram
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ✅ Simpan semua detail resit ikut message_id
let pendingUploads = {};

console.log("🤖 BOT AKTIF – Sedia proses resit dari Google Sheet");

// 🧾 Bila terima mesej "RESIT PERBELANJAAN"
bot.onText(/RESIT PERBELANJAAN/i, async (msg) => {
  const chatId = msg.chat.id;
  const detailText = msg.text;
  const originalMsgId = msg.message_id;

  // ✅ Padam mesej asal dari user (supaya group bersih)
  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("Gagal padam mesej asal:", e.message);
  }

  // ✅ Bot hantar semula mesej resit + butang upload
  const sent = await bot.sendMessage(chatId, detailText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: `upload_${msg.message_id}` }]
      ]
    }
  });

  // ✅ Simpan detail ikut message_id asal
  pendingUploads[msg.message_id] = {
    detail: detailText,
    chatId: chatId,
    status: "waiting_for_upload"
  };
});

// 📸 Bila tekan butang "Upload Resit"
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Dapatkan ID mesej asal resit
  const msgIdKey = data.split("_")[1];
  const dataResit = pendingUploads[msgIdKey];
  if (!dataResit) return;

  // ✅ Bot reply mesej khas upload resit (untuk dijadikan tempat reply gambar)
  const uploadPrompt = await bot.sendMessage(chatId,
    `✅ Sila upload gambar resit untuk:\n${dataResit.detail}`, {
    reply_to_message_id: query.message.message_id
  });

  // ✅ Simpan semula berdasarkan message upload khas ini
  pendingUploads[uploadPrompt.message_id] = {
    ...dataResit,
    status: "waiting_photo"
  };
});

// 🖼 Bila gambar dimuat naik (dalam reply)
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message?.message_id;

  if (!replyTo || !pendingUploads[replyTo]) {
    await bot.sendMessage(chatId, "⚠️ Gambar ini tidak berkait dengan mana-mana resit.");
    return;
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const dataResit = pendingUploads[replyTo];

  // ✅ Simpan fileId & anggap LULUS (OCR sambung kemudian)
  await bot.sendMessage(chatId, "🟢 Gambar diterima. Bot sedang proses resit...");

  // ✅ Hantar semula gambar + caption detail resit
  const sentPhoto = await bot.sendPhoto(chatId, fileId, {
    caption: dataResit.detail
  });

  // ✅ Forward ke Channel rasmi
  await bot.forwardMessage(process.env.CHANNEL_ID, chatId, sentPhoto.message_id);

  // ✅ Bersihkan data
  delete pendingUploads[replyTo];
});

