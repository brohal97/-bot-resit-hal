require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU MESEJ TEKS...");

// Fungsi kesan tarikh dalam mana-mana baris
function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,                          // 16/4/2025
    /\d{1,2}\s+\d{1,2}\s+\d{2,4}/,                                // 16 4 2025
    /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,                            // 2025-04-16
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i
  ];
  return patterns.some(p => p.test(lower));
}

// Fungsi semak RESIT PERBELANJAAN – wajib 4 perkara, tapi fleksibel baris
function validateResitPerbelanjaanFlexible(caption) {
  const lines = caption.trim().split('\n').map(x => x.trim()).filter(x => x !== '');

  if (lines.length < 4) return false;
  if (lines[0].toLowerCase() !== 'resit perbelanjaan') return false;

  let adaTarikh = false;
  let adaJumlah = false;
  let adaTujuan = false;

  const hargaPattern = /^rm\s?\d+(\.\d{2})?$/i;
  const tujuanPattern = /\b(beli|bayar|untuk|belanja|sewa|claim|servis)\b/i;

  for (let i = 1; i < lines.length; i++) {
    if (!adaTarikh && isTarikhValid(lines[i])) adaTarikh = true;
    if (!adaJumlah && hargaPattern.test(lines[i])) adaJumlah = true;
    if (!adaTujuan && lines[i].split(' ').length >= 3 && tujuanPattern.test(lines[i])) adaTujuan = true;
  }

  return adaTarikh && adaJumlah && adaTujuan;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text) return;

  const caption = msg.text.trim();

  // Semak jika mula dengan RESIT PERBELANJAAN
  if (caption.toLowerCase().startsWith('resit perbelanjaan')) {
    if (!validateResitPerbelanjaanFlexible(caption)) {
      bot.sendMessage(chatId, `❌ Format tidak lengkap.\nMesti ada:\n📆 Tarikh\n🎯 Tujuan (min 3 perkataan)\n💰 Harga RM`);
      return;
    }

    bot.sendMessage(chatId, `✅ Resit diterima.\nFormat lengkap dan sah.`);
    return;
  }

  bot.sendMessage(chatId, `❌ Format tidak diterima.\nHanya format 'RESIT PERBELANJAAN' dengan info lengkap dibenarkan.`);
});


