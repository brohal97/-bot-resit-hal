require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Simpan pairing message_id
let pendingUploads = {};

console.log("🤖 BOT AKTIF – SEMAK CAPTION + UPLOAD REPLY UI");

// Bila mesej masuk
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  const text = (msg.text || msg.caption || "").trim();
  const originalMsgId = msg.message_id;

  // ❌ Abaikan kalau mesej tiada teks
  if (!text) return;

  // ✅ Padam mesej asal
  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  // ✅ Bold baris pertama
  const lines = text.split('\n');
  const boldLine = lines[0] ? `*${lines[0].trim()}*` : '';
  const otherLines = lines.slice(1).join('\n');
  const mesejBaru = [boldLine, otherLines].filter(Boolean).join('\n');

  // ✅ Hantar mesej semula dengan butang "Upload Resit"
  const sent = await bot.sendMessage(chatId, mesejBaru, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: "📎 Upload Resit", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });

  // ✅ Simpan pairing
  pendingUploads[sent.message_id] = {
    chatId: chatId,
    originalMsgId: originalMsgId
  };
});

// Bila user tekan butang "Upload Resit"
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  // Extract ID mesej asal
  if (data.startsWith("upload_")) {
    const originalMsgId = parseInt(data.split("_")[1]);

    try {
      await bot.sendMessage(chatId, "Sila upload gambar resit anda di bawah mesej ini 👇", {
        reply_to_message_id: originalMsgId
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.error("❌ Gagal reply UI:", err.message);
    }
  }
});

