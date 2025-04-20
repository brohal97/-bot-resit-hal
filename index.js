const TelegramBot = require('node-telegram-bot-api');
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Bila mesej masuk
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const originalMessageId = msg.message_id;
  const originalText = msg.text || msg.caption;
  if (!originalText) return;

  // Format: Tebalkan baris pertama
  const lines = originalText.trim().split('\n');
  const boldLine = lines[0] ? `*${lines[0].trim()}*` : '';
  const otherLines = lines.slice(1).join('\n');
  const mesejBaru = [boldLine, otherLines].filter(Boolean).join('\n');

  // Padam mesej asal
  try {
    await bot.deleteMessage(chatId, originalMessageId);
  } catch (err) {
    console.log('❌ Gagal padam mesej asal:', err.message);
  }

  // Hantar semula caption + butang
  try {
    const sent = await bot.sendMessage(chatId, mesejBaru, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📎 Upload Resit', callback_data: `upload_${chatId}_${originalMessageId}` }]
        ]
      }
    });
  } catch (err) {
    console.log('❌ Gagal hantar mesej baru:', err.message);
  }
});

// Bila user tekan butang "Upload Resit"
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const replyTo = msg.message_id;

  if (callbackQuery.data.startsWith('upload_')) {
    try {
      // Bot reply mesej bold tadi (Reply UI visible)
      await bot.sendMessage(chatId, 'Sila upload gambar resit anda di bawah mesej ini 👇', {
        reply_to_message_id: replyTo
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.log('❌ Gagal reply UI:', err.message);
    }
  }
});
