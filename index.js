require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let pendingUploads = {}; // Simpan pairing ikut message_id

console.log("🤖 BOT AKTIF – Versi FORCE REPLY ke DETAIL dengan auto padam dan buang ulangan header");

// Step 1: Bila terima mesej "RESIT PERBELANJAAN"
bot.onText(/RESIT PERBELANJAAN/i, async (msg) => {
  const chatId = msg.chat.id;
  const detailText = msg.text;
  const originalMsgId = msg.message_id;

  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  const sent = await bot.sendMessage(chatId, detailText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });

  pendingUploads[sent.message_id] = {
    detail: detailText,
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
  const captionGabung = detailText.toUpperCase().startsWith("RESIT PERBELANJAAN")
    ? detailText
    : `🧾 RESIT PERBELANJAAN\n${detailText}`;

  const sentPhoto = await bot.sendPhoto(chatId, fileId, {
    caption: captionGabung
  });

  try {
    await bot.forwardMessage(process.env.CHANNEL_ID, chatId, sentPhoto.message_id);
  } catch (err) {
    console.error("❌ Gagal forward ke channel:", err.message);
  }

  delete pendingUploads[replyTo];
});
