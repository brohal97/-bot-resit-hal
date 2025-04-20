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

  // Hantar semula mesej dan SIMPAN messageId reply
  try {
    const sentMsg = await bot.sendMessage(chatId, mesejBaru, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📎 Upload Resit', callback_data: 'upload_resit' }]
        ]
      }
    });

    // Simpan pairing (boleh guna untuk future storage kalau nak)
    console.log('✅ Reply ID:', sentMsg.message_id);
  } catch (err) {
    console.log('❌ Gagal hantar mesej baru:', err.message);
  }
});

// Bila user tekan butang "Upload Resit"
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const msg = callbackQuery.message;

  if (!msg) return; // fail-safe kalau callback tiada mesej

  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  if (data === 'upload_resit') {
    try {
      // Bot reply pada mesej bold asal + butang
      await bot.sendMessage(chatId, 'Sila upload gambar resit anda di bawah mesej ini 👇', {
        reply_to_message_id: messageId
      });

      // Buang loading di butang
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.log('❌ Gagal reply UI:', err.message);
    }
  }
});
