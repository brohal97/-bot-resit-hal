const TelegramBot = require('node-telegram-bot-api');
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Simpan pairing: userMessageId ➜ botReplyMessageId
const pairingMap = new Map();

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const originalMessageId = msg.message_id;
  const originalText = msg.text || msg.caption;
  if (!originalText) return;

  // Format mesej baru (bold baris pertama)
  const lines = originalText.trim().split('\n');
  const boldLine = lines[0] ? `*${lines[0].trim()}*` : '';
  const otherLines = lines.slice(1).join('\n');
  const mesejBaru = [boldLine, otherLines].filter(Boolean).join('\n');

  // Hantar mesej bold + butang
  try {
    const sent = await bot.sendMessage(chatId, mesejBaru, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📎 Upload Resit', callback_data: `upload_${originalMessageId}` }]
        ]
      }
    });

    // Simpan pairing (kalau nak guna nanti)
    pairingMap.set(sent.message_id, originalMessageId);

  } catch (err) {
    console.log('❌ Gagal hantar mesej bold:', err.message);
  }

  // **(Optional)** Kalau masih nak delete mesej asal — delay sikit (tak disarankan untuk UI reply)
  // setTimeout(() => bot.deleteMessage(chatId, originalMessageId), 2000);
});

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('upload_')) {
    const replyToId = parseInt(data.split('_')[1]); // ID mesej asal user

    try {
      await bot.sendMessage(chatId, 'Sila upload gambar resit anda di bawah mesej ini 👇', {
        reply_to_message_id: replyToId
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.log('❌ Gagal reply UI:', err.message);
    }
  }
});
