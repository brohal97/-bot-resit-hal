require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {}; // Simpan pairing ikut message_id

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | KOMISEN | TRANSPORT");

// Step 1: Bila terima mesej jenis rasmi
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (typeof msg.text !== "string") return;

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

  const sent = await bot.sendMessage(chatId, text, {
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
});

// Step 2: Bila tekan butang upload
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const detailMsgId = pendingUploads[msgId]?.detailMsgId || msgId;

  if (pendingUploads[msgId]) {
    const trigger = await bot.sendMessage(chatId, '❗️𝐒𝐢𝐥𝐚 𝐔𝐩𝐥𝐨𝐚𝐝 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐞𝐫𝐚 ❗️', {
      reply_to_message_id: detailMsgId,
      reply_markup: {
        force_reply: true
      }
    });

    pendingUploads[trigger.message_id] = {
      ...pendingUploads[msgId],
      triggerMsgId: trigger.message_id
    };

    setTimeout(async () => {
      if (pendingUploads[trigger.message_id]) {
        try {
          await bot.deleteMessage(chatId, trigger.message_id);
        } catch (e) {
          console.error("❌ Gagal auto delete reminder:", e.message);
        }
        delete pendingUploads[trigger.message_id];
      }
    }, 40000);
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

  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (e) {
    console.error("❌ Gagal padam gambar asal:", e.message);
  }

  if (resitData.triggerMsgId) {
    try {
      await bot.deleteMessage(chatId, resitData.triggerMsgId);
    } catch (e) {
      console.error("❌ Gagal padam mesej trigger:", e.message);
    }
  }

  try {
    await bot.deleteMessage(chatId, resitData.detailMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej detail:", e.message);
  }

  const detailText = resitData.detail.trim();
  const captionGabung = detailText;

  const sentPhoto = await bot.sendPhoto(chatId, fileId, {
    caption: captionGabung
  });

  try {
    // ✅ Forward ke channel rasmi
    await bot.forwardMessage(process.env.CHANNEL_ID, chatId, sentPhoto.message_id);

    // ✅ Tunggu 5 saat, baru padam mesej dari group
    setTimeout(async () => {
      try {
        await bot.deleteMessage(chatId, sentPhoto.message_id);
      } catch (e) {
        console.error("❌ Gagal padam gambar selepas delay:", e.message);
      }
    }, 5000); // 5 saat

  } catch (err) {
    console.error("❌ Gagal forward ke channel:", err.message);
  }

  delete pendingUploads[replyTo];
});
