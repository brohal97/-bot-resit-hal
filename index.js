require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {}; // Simpan pairing ikut message_id

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | BAYAR KOMISEN | BAYAR TRANSPORT");

// Fungsi khas aktifkan reply UI (trick)
async function replyUITrick(chatId, text, replyTo) {
  const sent = await bot.sendMessage(chatId, `❗️𝐒𝐢𝐥𝐚 𝐇𝐚𝐧𝐭𝐚𝐫 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐫𝐚❗️`, {
    reply_to_message_id: replyTo,
    parse_mode: "HTML",
    reply_markup: {
      force_reply: true
    }
  });
  return sent.message_id;
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
  // Pisahkan baris pertama dan baris selebihnya
const lines = text.split('\n');
const firstLine = lines[0] ? `<b>${lines[0]}</b>` : '';
const otherLines = lines.slice(1).join('\n');
const formattedText = `${firstLine}\n${otherLines}`;

// Hantar semula mesej dengan butang + bold baris pertama
const sent = await bot.sendMessage(chatId, formattedText, {
  parse_mode: "HTML",
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
  const replyMsgId = await replyUITrick(uploadInfo.chatId, uploadInfo.detail, uploadInfo.replyTo);

pendingUploads[replyMsgId] = {
  detail: uploadInfo.detail,
  chatId: uploadInfo.chatId,
  replyTo: replyMsgId
};

await bot.answerCallbackQuery(callbackQuery.id);

});
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyToMsg = msg.reply_to_message;

  if (!replyToMsg) return;

  const matched = pendingUploads[replyToMsg.message_id];
  if (!matched) return;

  try {
    // Padam gambar + force_reply
    await bot.deleteMessage(chatId, msg.message_id);
    await bot.deleteMessage(chatId, replyToMsg.message_id);
  } catch (e) {
    console.error("❌ Gagal padam mesej:", e.message);
  }

  // Ambil file_id gambar resolusi tertinggi
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  // Format semula caption dengan baris pertama bold
  const lines = matched.detail.split('\n');
  const firstLine = lines[0] ? `<b>${lines[0]}</b>` : '';
  const otherLines = lines.slice(1).join('\n');
  const formattedCaption = `${firstLine}\n${otherLines}`;

  // Hantar semula dalam 1 post (gambar + caption)
  await bot.sendPhoto(chatId, fileId, {
    caption: formattedCaption,
    parse_mode: "HTML"
  });

  // Optional: buang dari pendingUploads
  delete pendingUploads[replyToMsg.message_id];
});
