require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let pendingUploads = {}; // Simpan info resit menunggu upload

console.log("🤖 BOT AKTIF – Sedia terima mesej resit");

// Handle mesej dari Google Sheets (Text + Butang)
bot.onText(/RESIT PERBELANJAAN/i, async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const text = msg.text;

  // Simpan mesej asal untuk track
  pendingUploads[chatId] = {
    detail: text,
    originalMsgId: messageId,
    status: "waiting_for_upload"
  };

  // Hantar semula mesej dengan butang upload
  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: "upload_resit" }]
      ]
    }
  });
});

// Bila tekan butang [UPLOAD RESIT]
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  if (data === "upload_resit") {
    await bot.sendMessage(chatId, "✅ Sila upload gambar resit sekarang.");
  }
});

// Bila user upload gambar
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;

  if (!pendingUploads[chatId] || pendingUploads[chatId].status !== "waiting_for_upload") return;

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const detailText = pendingUploads[chatId].detail;
  const originalMsgId = pendingUploads[chatId].originalMsgId;

  // Simpan status & fileId
  pendingUploads[chatId] = {
    ...pendingUploads[chatId],
    fileId: fileId,
    status: "ready_for_check"
  };

  // NEXT: Panggil fungsi OCR → kita sambung next step nanti
  await bot.sendMessage(chatId, "🔍 Gambar diterima. Bot sedang semak resit...");

  // Simpan untuk next proses
  global.detailToCheck = detailText;
  global.fileToUse = fileId;
  global.chatToRespond = chatId;
  global.msgToDelete = originalMsgId;

  // Untuk next step: sambung semak OCR lepas ni
});

