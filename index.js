require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ✅ Aktifkan bot Telegram
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ✅ Simpan semua detail resit ikut message_id
let pendingUploads = {};

console.log("🤖 BOT AKTIF – Sedia proses resit");

// 🧾 Bila terima mesej "RESIT PERBELANJAAN"
bot.onText(/RESIT PERBELANJAAN/i, async (msg) => {
  const chatId = msg.chat.id;
  const detailText = msg.text;
  const originalMsgId = msg.message_id;

  // ✅ Padam mesej asal dari user (nampak clean)
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

  // ✅ Bot reply mesej khas untuk upload resit
  const uploadPrompt = await bot.sendMessage(chatId,
    `🧾 RESIT PERBELANJAAN\n${dataResit.detail}\n\n📸 Sila upload gambar resit ini sebagai REPLY mesej ini.`, {
    reply_to_message_id: query.message.message_id
  });

  // ✅ Simpan semula berdasarkan message upload ini
  pendingUploads[uploadPrompt.message_id] = {
    ...dataResit,
    status: "waiting_photo"
  };
});

// 🖼 Bila gambar dimuat naik (REPLY kepada mesej bot)
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message?.message_id;

  // Jika bukan reply pada mesej bot
  if (!replyTo || !pendingUploads[replyTo]) {
    await bot.sendMessage(chatId, "⚠️ Gambar ini tidak dikaitkan dengan mana-mana detail.");
    return;
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const dataResit = pendingUploads[replyTo];

  // ✅ Padam gambar asal (yang dihantar user)
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (e) {
    console.error("Gagal padam gambar asal:", e.message);
  }

  // ✅ Padam mesej caption asal
  try {
    await bot.deleteMessage(chatId, replyTo);
  } catch (e) {
    console.error("Gagal padam mesej caption asal:", e.message);
  }

  // ✅ Gabung gambar + caption dalam satu mesej baru
  const captionGabung = `🧾 RESIT PERBELANJAAN\n${dataResit.detail}`;

  await bot.sendPhoto(chatId, fileId, {
    caption: captionGabung
  });

  // ❌ Forward ke channel = HOLD (belum buat lagi)

  // ✅ Padam dari pending list
  delete pendingUploads[replyTo];
});

