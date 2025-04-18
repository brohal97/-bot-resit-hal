require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let pendingUploads = {}; // Simpan pairing ikut message_id

console.log("🤖 BOT AKTIF – Versi FORCE REPLY + Auto Padam Semua Asal");

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
        [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });

  // Simpan pairing ikut message_id
  pendingUploads[sent.message_id] = {
    detail: detailText,
    chatId: chatId,
    detailMsgId: sent.message_id // Simpan ID mesej detail untuk padam kemudian
  };
});

// Step 2: Bila tekan butang upload
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;

  // Jika detail asal masih disimpan, aktifkan reply UI
  if (pendingUploads[msgId]) {
    const uploadPrompt = await bot.sendMessage(chatId, "📎 Sila upload gambar untuk resit ini:", {
      reply_to_message_id: msgId,
      reply_markup: {
        force_reply: true
      }
    });

    // Simpan pairing juga pada mesej upload
    pendingUploads[uploadPrompt.message_id] = {
      ...pendingUploads[msgId],
      uploadPromptId: uploadPrompt.message_id
    };
  }
});

// Step 3: Bila gambar dihantar sebagai reply
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message?.message_id;

  if (!replyTo || !pendingUploads[replyTo]) {
    await bot.sendMessage(chatId, "⚠️ Gambar ini tidak dikaitkan dengan mana-mana resit. Sila tekan Upload Resit semula.");
    return;
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const resitData = pendingUploads[replyTo];

  // Padam gambar asal
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (e) {
    console.error("❌ Gagal padam gambar asal:", e.message);
  }

  // Padam mesej "Sila upload gambar..."
  try {
    await bot.deleteMessage(chatId, replyTo);
  } catch (e) {
    console.error("❌ Gagal padam mesej upload prompt:", e.message);
  }

  // Padam mesej asal detail juga
  try {
    await bot.deleteMessage(chatId, resitData.detailMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej detail asal:", e.message);
  }

  // Gabungkan gambar + caption ke dalam satu mesej baru
  const captionGabung = `🧾 RESIT PERBELANJAAN\n${resitData.detail}`;

  const sentPhoto = await bot.sendPhoto(chatId, fileId, {
    caption: captionGabung
  });

  // Forward ke channel rasmi jika perlu
  try {
    await bot.forwardMessage(process.env.CHANNEL_ID, chatId, sentPhoto.message_id);
  } catch (err) {
    console.error("❌ Gagal forward ke channel:", err.message);
  }

  // Hapus pairing
  delete pendingUploads[replyTo];
});
