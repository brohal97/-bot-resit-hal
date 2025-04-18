require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let pendingUploads = {};

console.log("🤖 BOT AKTIF – Sistem resit auto bermula");

// Step 1: Bila detect mesej "RESIT PERBELANJAAN"
bot.onText(/RESIT PERBELANJAAN/i, async (msg) => {
  const chatId = msg.chat.id;
  const detailText = msg.text;
  const originalMsgId = msg.message_id;

  // Padam mesej asal staff
  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  // Hantar semula mesej + butang upload
  await bot.sendMessage(chatId, detailText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });

  // Simpan detail ikut ID asal
  pendingUploads[originalMsgId] = {
    detail: detailText,
    chatId: chatId,
    status: "waiting_for_upload"
  };
});

// Step 2: Bila tekan butang upload
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  const msgIdKey = data.split("_")[1];
  const resitData = pendingUploads[msgIdKey];
  if (!resitData) return;

  // Hantar mesej khas upload (jadi tempat reply gambar)
  const uploadMsg = await bot.sendMessage(chatId,
    `📎 Sila upload gambar untuk resit ini:\n\n🧾 ${resitData.detail}\n\n⚠️ PASTIKAN anda REPLY mesej ini bila upload gambar.`, {
    reply_to_message_id: messageId
  });

  // Simpan ikut message_id baru
  pendingUploads[uploadMsg.message_id] = {
    ...resitData,
    status: "waiting_photo"
  };
});

// Step 3: Bila gambar diterima
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message?.message_id;

  // Kalau gambar tidak direply kepada mesej yang sah
  if (!replyTo || !pendingUploads[replyTo]) {
    await bot.sendMessage(chatId, "⚠️ Gambar ini tidak dikaitkan dengan mana-mana detail. Sila reply pada mesej bot.");
    return;
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const resitData = pendingUploads[replyTo];

  // Padam gambar asal
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (e) {
    console.error("❌ Gagal padam gambar:", e.message);
  }

  // Padam mesej upload caption asal
  try {
    await bot.deleteMessage(chatId, replyTo);
  } catch (e) {
    console.error("❌ Gagal padam mesej caption asal:", e.message);
  }

  // Gabung gambar + caption dalam satu mesej
  const captionGabung = `🧾 RESIT PERBELANJAAN\n${resitData.detail}`;

  await bot.sendPhoto(chatId, fileId, {
    caption: captionGabung
  });

  // Hapus dari simpanan sementara
  delete pendingUploads[replyTo];
});

