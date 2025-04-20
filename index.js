const TelegramBot = require('node-telegram-bot-api');

// Guna token dari Railway variable
const token = process.env.BOT_TOKEN;

// Aktifkan bot dalam mode polling
const bot = new TelegramBot(token, { polling: true });

// Bila mesej masuk
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  // Ambil mesej asal - boleh jadi text atau caption
  const originalText = msg.text || msg.caption;

  // Kalau tiada teks langsung, keluar awal
  if (!originalText) return;

  try {
    // Padam mesej asal
    await bot.deleteMessage(chatId, messageId);
  } catch (err) {
    console.log('Gagal padam mesej:', err.message);
  }

  // Tebalkan baris pertama
  const lines = originalText.trim().split('\n');
  const boldLine = lines[0] ? `*${lines[0].trim()}*` : '';
  const otherLines = lines.slice(1).join('\n');
  const mesejBaru = [boldLine, otherLines].filter(Boolean).join('\n');

  // Hantar semula mesej
  await bot.sendMessage(chatId, mesejBaru, {
    parse_mode: 'Markdown'
  });
});
