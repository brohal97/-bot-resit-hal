require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU MESEJ TEKS...");

// Fungsi RESIT PERBELANJAAN (format fleksibel)
function validateResitPerbelanjaanFlexible(caption) {
  const lower = caption.toLowerCase();

  const hasHeader = lower.startsWith("resit perbelanjaan");
  const hasTarikh = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/.test(lower);
  const hasJumlah = /rm\s?\d+(\.\d{2})?|\b(total|jumlah|harga)\b/.test(lower);
  const hasTujuan = /\b(beli|bayar|untuk|sewa|belanja|tuntutan|claim|servis)\b/.test(lower);

  return hasHeader && hasTarikh && hasJumlah && hasTujuan;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // Jika tiada teks, abaikan
  if (!msg.text) return;

  const caption = msg.text.trim();

  // Semak jika mula dengan RESIT PERBELANJAAN
  if (caption.toLowerCase().startsWith("resit perbelanjaan")) {
    if (!validateResitPerbelanjaanFlexible(caption)) {
      bot.sendMessage(chatId, `❌ Format tidak lengkap.\nRESIT PERBELANJAAN mesti mengandungi:\n📆 Tarikh\n🎯 Tujuan\n💰 Harga (RM...)`);
      return;
    }

    bot.sendMessage(chatId, `✅ Resit diterima.\nSemua info wajib lengkap.`);
    return;
  }

  // Selain RESIT PERBELANJAAN, abaikan
});

