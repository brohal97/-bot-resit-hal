require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR...");

// Fungsi RESIT PERBELANJAAN (format bebas tapi wajib item penting)
function validateResitPerbelanjaanFlexible(caption) {
  const lower = caption.toLowerCase();

  const hasHeader = lower.startsWith("resit perbelanjaan");

  const hasTarikh = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/.test(lower);
  const hasJumlah = /rm\s?\d+(\.\d{2})?|\b(total|jumlah|harga)\b/.test(lower);
  const hasTujuan = /\b(beli|bayar|untuk|sewa|belanja|tuntutan|claim|servis)\b/.test(lower);

  return hasHeader && hasTarikh && hasJumlah && hasTujuan;
}

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  // Semak mesti ada caption dan gambar
  if (!msg.caption || !msg.photo) {
    bot.sendMessage(chatId, `❌ Resit tidak sah.\nPastikan gambar dan detail/teks dihantar bersama.`);
    return;
  }

  const caption = msg.caption.trim();

  // Semak jika caption mula dengan "RESIT PERBELANJAAN"
  if (caption.toLowerCase().startsWith("resit perbelanjaan")) {
    if (!validateResitPerbelanjaanFlexible(caption)) {
      bot.sendMessage(chatId, `❌ Format tidak sah.\n'RESIT PERBELANJAAN' mesti mengandungi:\n📆 Tarikh\n🎯 Tujuan\n💰 Harga (RM...)`);
      return;
    }

    bot.sendMessage(chatId, `✅ RESIT PERBELANJAAN diluluskan (semua item wajib lengkap).`);
    return;
  }

  // Jika bukan RESIT PERBELANJAAN
  bot.sendMessage(chatId, `❌ Format tidak dikenali.\nHanya 'RESIT PERBELANJAAN' disokong buat masa ini.`);
});

