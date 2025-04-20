const TelegramBot = require('node-telegram-bot-api');

// Ganti dengan token bot Telegram kau
const token = 'TOKEN_BOT_KAU'; 

// Aktifkan polling
const bot = new TelegramBot(token, { polling: true });

// Bila mesej masuk
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  // Dapatkan teks asal (boleh jadi mesej biasa atau caption dari gambar)
  const originalText = msg.text || msg.caption;

  // Kalau tiada teks langsung, abaikan
  if (!originalText) return;

  try {
    // Padam mesej asal
    await bot.deleteMessage(chatId, messageId);
  } catch (err) {
    console.log('Gagal padam mesej:', err.message);
  }

  // Proses teks: tebalkan baris pertama
  const lines = originalText.trim().split('\n');
  const boldLine = lines[0] ? `*${lines[0].trim()}*` : '';
  const otherLines = lines.slice(1).join('\n');
  const mesejBaru = [boldLine, otherLines].filter(Boolean).join('\n');

  // Hantar semula mesej
  await bot.sendMessage(chatId, mesejBaru, {
    parse_mode: 'Markdown'
  });
});
