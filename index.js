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

  // ✅ Semak jika mesej bermula dengan salah satu kategori
  const namaSah = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];
  const isKategoriSah = namaSah.some((nama) => text.toUpperCase().startsWith(nama));
  if (!isKategoriSah) return;

  // ❌ Tolak kalau mesej terlalu pendek
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

  // Simpan pairing
  pendingUploads[sent.message_id] = {
    detail: text,
    chatId: chatId,
    detailMsgId: sent.message_id
  };
});

// Step 2: Bila user tekan butang "Upload Resit"
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  // Semak callback jenis upload
  if (!data.startsWith("upload_")) return;

  const asalMsgId = parseInt(data.replace("upload_", ""));
  const uploadInfo = pendingUploads[msg.message_id];

  if (!uploadInfo) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Resit tidak dijumpai atau telah tamat.",
      show_alert: true
    });
    return;
  }

  // Bot reply semula mesej dengan arahan upload
  await bot.sendMessage(uploadInfo.chatId, `📎 Sila upload gambar resit bagi mesej ini:\n\n<b>${uploadInfo.detail}</b>`, {
    reply_to_message_id: uploadInfo.detailMsgId,
    parse_mode: "HTML"
  });

  await bot.answerCallbackQuery(callbackQuery.id);
});
