require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR...");

// Fungsi RESIT PERBELANJAAN
function validateResitPerbelanjaan(caption) {
  const lower = caption.toLowerCase();

  // Cari tarikh
  const tarikhPattern = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
  const hasTarikh = tarikhPattern.test(lower);

  // Cari jumlah RM
  const jumlahPattern = /rm\s?\d+(\.\d{2})?|\b(total|jumlah|harga)\b/;
  const hasJumlah = jumlahPattern.test(lower);

  // Cari tujuan
  const tujuanPattern = /\b(beli|bayar|untuk|sewa|belanja|tuntutan|claim|servis)\b/;
  const hasTujuan = tujuanPattern.test(lower);

  return hasTarikh && hasJumlah && hasTujuan;
}

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  // Semak mesti ada caption dan gambar
  if (!msg.caption || !msg.photo) {
    bot.sendMessage(chatId, `❌ Resit tidak sah.\nPastikan gambar dan detail/teks dihantar bersama.`);
    return;
  }

  const caption = msg.caption.trim();

  // Jika RESIT PERBELANJAAN, semak kandungan
  if (caption.toLowerCase().startsWith("resit perbelanjaan")) {
    if (!validateResitPerbelanjaan(caption)) {
      bot.sendMessage(chatId, `❌ Tidak lengkap.\nRESIT PERBELANJAAN wajib ada:\n📆 TARIKH\n🎯 TUJUAN\n💰 TOTAL HARGA`);
      return;
    }
  }

  // Resit lulus peringkat awal, bot balas
  bot.sendMessage(chatId, `✅ Detail diterima.\n📋 Pemeriksaan teks lulus.`);

  // Kalau nak sambung semakan OCR nanti, tambah sini
});
