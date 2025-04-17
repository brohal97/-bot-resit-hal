// ✅ INDEX.JS PENUH dengan semakan OCR, RM/MYR dan padanan TARIKH dalam gambar
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

function extractTarikhList(text) {
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g,
    /\b\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec|january|...)/gi,
    /\b(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec|january|...)[\s\-]+\d{1,2},?\s+\d{4}\b/gi
  ];
  let result = [];
  patterns.forEach(p => {
    const matches = text.match(p);
    if (matches) result.push(...matches.map(m => m.toLowerCase()));
  });
  return result;
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

function isJumlahTerasingDenganJarak(ocrText, target) {
  const lines = ocrText.replace(/,/g, '').split('\n');
  const targetStr = target.toFixed(2);
  const targetRaw = target.toString();

  for (let line of lines) {
    const clean = line.trim();
    if (
      clean === targetRaw ||
      clean === `RM${targetStr}` ||
      clean === `rm${targetStr}` ||
      clean === `MYR${targetStr}` ||
      clean === `myr${targetStr}`
    ) return true;

    if (line.match(new RegExp(`(Amount|RM|MYR)?\s{0,5}${targetRaw}\.?0{0,2}\s*$`, 'i'))) return true;
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

  if (lower.startsWith('resit perbelanjaan') && !validateResitPerbelanjaanFlexible(caption)) {
    bot.sendMessage(chatId, "❌ Format tidak lengkap.\nRESIT PERBELANJAAN mesti ada:\n📆 Tarikh\n🎯 Tujuan (min 3 perkataan)\n💰 Harga");
    return;
  }

  if (lower.startsWith('bayar transport') && !caption.includes('total')) {
    bot.sendMessage(chatId, "❌ Format BAYAR TRANSPORT tidak sah atau jumlah tidak padan.\nSemak semula harga produk dan jumlah total.");
    return;
  }

  if (lower.startsWith('bayar komisen') && !caption.includes('bank')) {
    bot.sendMessage(chatId, "❌ Format BAYAR KOMISEN tidak lengkap atau tidak sah.\nWajib ada:\n📆 Tarikh\n👤 Nama Salesperson\n🏦 Nama Bank\n💰 Harga RM");
    return;
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

      // TARIKH SEMAKAN
      const tarikhDalamOCR = extractTarikhList(ocrText);
      const tarikhDalamCaption = extractTarikhList(caption);

      const tarikhMatch = tarikhDalamOCR.some(tarikh => tarikhDalamCaption.includes(tarikh));

      if (!tarikhDalamOCR.length) {
        bot.sendMessage(chatId, "❌ Gambar tidak mengandungi sebarang tarikh.");
        return;
      }
      if (!tarikhMatch) {
        bot.sendMessage(chatId, "❌ Tarikh dalam gambar tidak sepadan dengan tarikh dalam caption.");
        return;
      }

      // SEMAK JUMLAH
      if (!isJumlahTerasingDenganJarak(ocrText, captionTotal)) {
        bot.sendMessage(chatId, `❌ RM${captionTotal} terlalu rapat atau bercampur dengan angka/perkataan lain dalam gambar.`);
        return;
      }

      bot.sendMessage(chatId, `✅ Gambar disahkan: Tarikh & Jumlah padan sempurna.`);

    } catch (error) {
      console.error("❌ Ralat semasa OCR:", error.message);
      bot.sendMessage(chatId, "⚠️ Ralat semasa semakan gambar. Gambar mungkin kabur atau tiada teks.");
    }
  }
});
