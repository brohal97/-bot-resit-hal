const TelegramBot = require('node-telegram-bot-api');
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Simpan pairing antara message bot dan message user
const pendingUploads = {};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const originalMessageId = msg.message_id;
  const originalText = msg.text || msg.caption;
  if (!originalText) return;

  // Format mesej (bold baris pertama)
  const lines = originalText.trim().split('\n');
  const boldLine = lines[0] ? `*${lines[0].trim()}*` : '';
  const otherLines = lines.slice(1).join('\n');
  const mesejBaru = [boldLine, otherLines].filter(Boolean).join('\n');

  // Padam mesej asal
  try {
    await bot.deleteMessage(chatId, originalMessageId);
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  // Hantar mesej bold semula dengan butang "Upload Resit"
  try {
    const sent = await bot.sendMessage(chatId, mesejBaru, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "📎 Upload Resit", callback_data: `upload_${originalMessageId}` }]
        ]
      }
    });

    // Simpan pairing: mesej baru ➜ mesej asal
    pendingUploads[sent.message_id] = {
      chatId: chatId,
      originalMsgId: originalMessageId
    };

  } catch (err) {
    console.error("❌ Gagal hantar mesej baru:", err.message);
  }
});

// Bila user tekan butang "Upload Resit"
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  // Ambil message ID asal dari callback_data
  if (data.startsWith('upload_')) {
    const originalMsgId = parseInt(data.split('_')[1]);

    try {
      await bot.sendMessage(chatId, 'Sila upload gambar resit anda di bawah mesej ini 👇', {
        reply_to_message_id: originalMsgId
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.error("❌ Gagal reply UI:", err.message);
    }
  }
});
