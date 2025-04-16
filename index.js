require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR + TEKS...");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
    /\d{1,2}\s+\d{1,2}\s+\d{2,4}/,
    /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i
  ];
  return patterns.some(p => p.test(lower));
}

function detectJenisDokumen(text) {
  const lower = text.toLowerCase();
  const slipKeywords = ['transfer', 'transaction', 'reference', 'duitnow', 'bank', 'account', 'to', 'from'];
  const resitKeywords = ['item', 'qty', 'unit price', 'receipt', 'cashier', 'tax', 'total'];
  const invoiceKeywords = ['invoice', 'item code', 'description', 'discount', 'amount'];
  const notAllowedKeywords = ['kerajaan', 'negara', 'berita', 'headline', 'pm', 'menteri', 'parlimen', 'sidang', 'politik', 'rakyat', 'akbar'];

  const slipMatch = slipKeywords.filter(k => lower.includes(k)).length;
  const resitMatch = resitKeywords.filter(k => lower.includes(k)).length;
  const invoiceMatch = invoiceKeywords.filter(k => lower.includes(k)).length;
  const blockMatch = notAllowedKeywords.filter(k => lower.includes(k)).length;

  if (blockMatch >= 2) return 'lain';
  if (slipMatch >= 2 && resitMatch === 0 && invoiceMatch === 0) return 'slip_bank';
  if ((resitMatch + invoiceMatch) >= 3 && slipMatch === 0) return 'resit_pembelian';
  return 'lain';
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

  const totalLine = lines.find(line => /total.*rm\s?\d+/i.test(line));
  const kiraTotal = lines.reduce((sum, line) => {
    if (!/total/i.test(line)) {
      const match = line.match(/rm\s?(\d+(\.\d{2})?)/i);
      if (match) sum += parseFloat(match[1]);
    }
    return sum;
  }, 0);

  const matchTotal = totalLine?.match(/rm\s?(\d+(\.\d{2})?)/i);
  const jumlahTotal = matchTotal ? parseFloat(matchTotal[1]) : 0;

  return Math.abs(kiraTotal - jumlahTotal) < 0.01;
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

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';
  if (!caption.trim()) {
    bot.sendMessage(chatId, `❌ Tidak sah.\nWajib hantar SEKALI gambar & teks (dalam satu mesej).`);
    return;
  }

  const lower = caption.toLowerCase();
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const imageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(res.data, 'binary').toString('base64');

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

    const text = visionRes.data.responses[0]?.textAnnotations?.[0]?.description || '';
    if (!text) {
      bot.sendMessage(chatId, `⚠️ Ralat semasa semakan gambar. Sila cuba semula.`);
      return;
    }

    const jenisDokumen = detectJenisDokumen(text);

    if (jenisDokumen === 'lain') {
      bot.sendMessage(chatId, `❌ Gambar tidak sah.\nHanya gambar RESIT atau SLIP BANK dibenarkan.`);
      return;
    }

    if (lower.startsWith('resit perbelanjaan')) {
      if (!validateResitPerbelanjaanFlexible(caption)) {
        bot.sendMessage(chatId, `❌ Format tidak lengkap.\nRESIT PERBELANJAAN mesti ada:\n📆 Tarikh\n🎯 Tujuan (min 3 perkataan)\n💰 Harga`);
        return;
      }
      bot.sendMessage(chatId, `✅ Resit diterima. Format lengkap & sah.`);
      return;
    }

    if (lower.startsWith('bayar transport')) {
      if (!validateBayarTransportFormat(caption)) {
        bot.sendMessage(chatId, `❌ Format BAYAR TRANSPORT tidak sah atau jumlah tidak padan.\nSemak semula harga produk dan jumlah total.`);
        return;
      }
      bot.sendMessage(chatId, `✅ Bayar Transport diterima. Jumlah padan & format lengkap.`);
      return;
    }

    if (caption.startsWith('BAYAR KOMISEN')) {
      if (!validateBayarKomisenFormat(caption)) {
        bot.sendMessage(chatId, `❌ Format BAYAR KOMISEN tidak lengkap atau tidak sah.\nWajib ada:\n📆 Tarikh\n👤 Nama Salesperson\n🏦 Nama Bank\n💰 Harga RM`);
        return;
      }
      bot.sendMessage(chatId, `✅ Bayar Komisen diterima. Format lengkap & sah.`);
      return;
    }

    bot.sendMessage(chatId, `❌ Format tidak dikenali.\nBot hanya terima 'RESIT PERBELANJAAN', 'BAYAR TRANSPORT', dan 'BAYAR KOMISEN' yang sah.`);
  } catch (err) {
    console.error("❌ Ralat OCR:", err.response?.data || err.message);
    bot.sendMessage(chatId, `⚠️ Ralat semasa semakan gambar. Sila cuba semula.`);
  }
});
