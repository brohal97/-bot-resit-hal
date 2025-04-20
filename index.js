const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Bila mesej masuk
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  const originalText = msg.text || msg.caption;
  if (!originalText) return;

  // Padam mesej asal
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (err) {
    console.log('Gagal padam mesej asal:', err.message);
  }

  // Tebalkan baris pertama
  const lines = originalText.trim().split('\n');
  const boldLine = lines[0] ? `*${lines[0].trim()}*` : '';
  const otherLines = lines.slice(1).join('\n');
  const mesejBaru = [boldLine, otherLines].filter(Boolean).join('\n');

  // Hantar semula mesej dengan butang "Upload Resit"
  await bot.sendMessage(chatId, mesejBaru, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📎 Upload Resit', callback_data: 'upload_resit' }
        ]
      ]
    }
  });
});

// Bila user tekan butang "Upload Resit"
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  if (data === 'upload_resit') {
    // Bot akan reply mesej asal (fungsi pairing)
    await bot.sendMessage(chatId, 'Sila upload gambar resit anda di bawah mesej ini 👇', {
      reply_to_message_id: messageId
    });

    // Optional: Buang loading animation pada butang
    await bot.answerCallbackQuery(callbackQuery.id);
  }
});

