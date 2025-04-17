// ✅ INDEX.JS PENUH: Termasuk fungsi semakan OCR + kedudukan angka dalam gambar
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU MESEJ TEKS...");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
    /\d{1,2}\s+\d{1,2}\s+\d{2,4}/,
    /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
    /\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
    /(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i
  ];
  return patterns.some(p => p.test(lower));
}

function calculateTotalHargaFromList(lines) {
  let total = 0;
  const hargaPattern = /rm\s?(\d+(\.\d{2})?)/i;
  for (let line of lines) {
    if (/total/i.test(line)) continue;
    const match = line.match(hargaPattern);
    if (match) total += parseFloat(match[1]);
  }
  return total;
}

function extractTotalLineAmount(lines) {
  const pattern = /total.*rm\s?(\d+(\.\d{2})?)/i;
  for (let line of lines) {
    const match = line.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

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

function validateBayarTransportFormat(caption) {
  const lines = caption.trim().split('\n').map(x => x.trim()).filter(x => x !== '');
  if (lines.length < 4) return false;
  if (lines[0].toLowerCase() !== 'bayar transport') return false;

  let adaTarikh = false;
  let adaProduk = false;
  let adaTotalLine = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!adaTarikh && isTarikhValid(line)) adaTarikh = true;
    if (!adaProduk && line.includes('|') && /rm\s?\d+/.test(line.toLowerCase())) adaProduk = true;
    if (!adaTotalLine && /total.*rm\s?\d+/i.test(line)) adaTotalLine = true;
  }

  if (!adaTarikh || !adaProduk || !adaTotalLine) return false;

  const kiraTotal = calculateTotalHargaFromList(lines);
  const totalLine = extractTotalLineAmount(lines);

  return totalLine !== null && Math.abs(kiraTotal - totalLine) < 0.01;
}

function validateBayarKomisenFormat(caption) {
  const lines = caption.trim().split('\n').map(x => x.trim()).filter(x => x !== '');
  if (lines.length < 4) return false;
  if (lines[0] !== 'BAYAR KOMISEN') return false;

  let adaTarikh = false;
  let adaNama = false;
  let adaHarga = false;
  let adaBank = false;

  const hargaPattern = /^rm\s?\d+(\.\d{2})?$/i;
  const bankKeywords = ['cimb', 'maybank', 'bank islam', 'rhb', 'bsn', 'ambank', 'public bank', 'bank rakyat', 'affin', 'hsbc', 'uob'];

  for (let line of lines) {
    const lower = line.toLowerCase();
    if (!adaTarikh && isTarikhValid(line)) adaTarikh = true;
    if (!adaNama && line.split(' ').length >= 1 && !lower.includes('rm') && !lower.includes('bank')) adaNama = true;
    if (!adaHarga && hargaPattern.test(line)) adaHarga = true;
    if (!adaBank && bankKeywords.some(b => lower.includes(b))) adaBank = true;
  }

  return adaTarikh && adaNama && adaHarga && adaBank;
}

function isJumlahTerasingDenganJarak(ocrText, target) {
  const lines = ocrText.split('\n');
  const targetStr = target.toFixed(2);
  const targetRaw = target.toString();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === targetRaw || line === `RM${targetStr}` || line === `rm${targetStr}`) {
      return true;
    }

    const prevLine = lines[i - 1] ? lines[i - 1].trim() : '';
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';

    if ((line.includes(targetRaw) || line.includes(`RM${targetStr}`)) &&
        !line.includes(' ') &&
        !prevLine.includes(targetRaw) &&
        !nextLine.includes(targetRaw)) {
      return true;
    }

    const regex = new RegExp(`(?:^|\s)(rm\s?)?${targetRaw}(?=\s|$)`, 'i');
    const match = line.match(regex);
    if (match) {
      const index = line.indexOf(match[0]);
      const before = line.slice(0, index);
      const after = line.slice(index + match[0].length);

      const isJarakSebelum = before.match(/\s{5,}$/);
      const isJarakSelepas = after.match(/^\s{5,}/);

      const jarakSebelumLulus = before === '' || isJarakSebelum;
      const jarakSelepasLulus = after === '' || isJarakSelepas;

      if (jarakSebelumLulus || jarakSelepasLulus) {
        return true;
      }
    }
  }
  return false;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || msg.text || '';

  if (!caption.trim() || !msg.photo) {
    bot.sendMessage(chatId, "❌ Tidak sah.\nWajib hantar SEKALI gambar & teks (dalam satu mesej).");
    return;
  }

  const lower = caption.toLowerCase();

  if (lower.startsWith('resit perbelanjaan')) {
    if (!validateResitPerbelanjaanFlexible(caption)) {
      bot.sendMessage(chatId, "❌ Format tidak lengkap.\nRESIT PERBELANJAAN mesti ada:\n📆 Tarikh\n🎯 Tujuan (min 3 perkataan)\n💰 Harga");
      return;
    }
  }

  if (lower.startsWith('bayar transport')) {
    if (!validateBayarTransportFormat(caption)) {
      bot.sendMessage(chatId, "❌ Format BAYAR TRANSPORT tidak sah atau jumlah tidak padan.\nSemak semula harga produk dan jumlah total.");
      return;
    }
  }

  if (lower.startsWith('bayar komisen')) {
    if (!validateBayarKomisenFormat(caption)) {
      bot.sendMessage(chatId, "❌ Format BAYAR KOMISEN tidak lengkap atau tidak sah.\nWajib ada:\n📆 Tarikh\n👤 Nama Salesperson\n🏦 Nama Bank\n💰 Harga RM");
      return;
    }
  }

  if (msg.photo) {
    try {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const file = await bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
      const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(res.data).toString('base64');

      const visionRes = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`,
        {
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: 'TEXT_DETECTION' }]
            }
          ]
        }
      );

      const ocrText = visionRes.data.responses[0]?.textAnnotations?.[0]?.description || '';
      const captionLines = caption.split('\n');
      const captionTotal = calculateTotalHargaFromList(captionLines);

      if (!isJumlahTerasingDenganJarak(ocrText, captionTotal)) {
        bot.sendMessage(chatId, `❌ RM${captionTotal} terlalu rapat atau bercampur dengan angka/perkataan lain dalam gambar.`);
        return;
      } else {
        bot.sendMessage(chatId, `✅ RM${captionTotal} disahkan berada dalam baris selamat.`);
      }

    } catch (error) {
      console.error("❌ Ralat semasa OCR:", error.message);
      bot.sendMessage(chatId, "⚠️ Ralat semasa semakan gambar. Gambar mungkin kabur atau tiada teks.");
      return;
    }
  }

  bot.sendMessage(chatId, "✅ Semakan selesai. Jika anda tidak menerima mesej ralat, data anda telah lulus semakan awal.");
});

