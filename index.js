require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {}; // Simpan pairing ikut message_id

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | KOMISEN | TRANSPORT");

// Fungsi khas aktifkan reply UI (trick)
function replyUITrick(chatId, text, replyTo) {
  return bot.sendMessage(chatId, `❗️𝐒𝐢𝐥𝐚 𝐇𝐚𝐧𝐭𝐚𝐫 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐫𝐚❗️`, {
    reply_to_message_id: replyTo,
    parse_mode: "HTML",
    reply_markup: {
      force_reply: true
    }
  });
}

// Bila terima mesej jenis rasmi
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

  // Hantar semula dengan butang sahaja (tiada force_reply lagi)
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
    replyTo: sent.message_id
  };
});

// Bila user tekan butang "Upload Resit"
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

  // Aktifkan trick reply UI bila user tekan butang
  await replyUITrick(uploadInfo.chatId, uploadInfo.detail, uploadInfo.replyTo);
  await bot.answerCallbackQuery(callbackQuery.id);
});
