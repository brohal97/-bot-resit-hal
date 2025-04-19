// ===================== BOT SEMAK 3 JENIS RESIT =====================
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("🤖 BOT AKTIF - SEMAK RESIT PERBELANJAAN | KOMISEN | TRANSPORT");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b\d{1,2}\s+\d{1,2}\s+\d{2,4}\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/,
    /\b\d{1,2}(hb)?(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis|january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|julai|oktober|disember)\d{2,4}\b/i,
    /\b\d{1,2}(hb)?\s+(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis|january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|julai|oktober|disember)\s+\d{2,4}\b/i,
    /\b(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis|january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|julai|oktober|disember)\s+\d{1,2},?\s+\d{2,4}\b/i
  ];
  return patterns.some(p => p.test(lower));
}

function formatTarikhStandard(text) {
  const bulanMap = {
    jan: '01', januari: '01', january: '01',
    feb: '02', februari: '02', february: '02',
    mar: '03', mac: '03', march: '03',
    apr: '04', april: '04',
    may: '05', mei: '05',
    jun: '06',
    jul: '07', julai: '07', july: '07',
    aug: '08', ogos: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', oktober: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', dis: '12', disember: '12', december: '12'
  };

  const clean = text.trim();
  let match1 = clean.match(/(\d{1,2})\s+(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis|january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|julai|oktober|disember)\s+(\d{4})/i);
  if (match1) return `${match1[1].padStart(2, '0')}-${bulanMap[match1[2].toLowerCase()] || '??'}-${match1[3]}`;

  let match2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match2) return `${match2[3].padStart(2, '0')}-${match2[2].padStart(2, '0')}-${match2[1]}`;

  let match3 = clean.match(/(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
  if (match3) return `${match3[1].padStart(2, '0')}-${match3[2].padStart(2, '0')}-${match3[3].length === 2 ? '20' + match3[3] : match3[3]}`;

  let match4 = clean.match(/(\d{1,2})(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis)\d{4}/i);
  if (match4) {
    const d = match4[1].padStart(2, '0');
    const m = bulanMap[match4[2].toLowerCase()] || '??';
    const y = clean.slice(-4);
    return `${d}-${m}-${y}`;
  }

  return text;
}

function isTempatLulus(text) {
  const lokasi = ["kok lanas", "ketereh", "melor"];
  const lower = text.toLowerCase();
  return lokasi.some(l => lower.includes(l));
}

function semakResitPerbelanjaan(msg, chatId, ocrText) {
  const caption = msg.caption || msg.text || "";
  const lines = ocrText.split('\n').map(x => x.trim());
  const tarikhJumpa = lines.find(line => isTarikhValid(line));

  if (!tarikhJumpa) {
    bot.sendMessage(chatId, "❌ Gagal kesan tarikh dalam gambar.");
    return;
  }

  const match = tarikhJumpa.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+(jan|feb|mar|mac|...)\s+\d{4}|(jan|feb|mac|...)\s+\d{1,2},?\s+\d{4}/i);
const hanyaTarikh = match ? formatTarikhStandard(match[0]) : formatTarikhStandard(tarikhJumpa);

  let tarikhDalamCaption = null;
  const captionWords = caption.split(/\s+/);
  for (let word of captionWords) {
    if (isTarikhValid(word)) {
      tarikhDalamCaption = formatTarikhStandard(word);
      break;
    }
  }

  if (!tarikhDalamCaption || tarikhDalamCaption !== hanyaTarikh) {
    bot.sendMessage(chatId, "❌ Tarikh dalam gambar (${hanyaTarikh}) tidak padan dengan teks.");
    return;
  }

  const upper = ocrText.toUpperCase();
  const blacklist = [
    "LIP", "MATTE", "MASCARA", "EYELINER", "BROW", "SHADOW", "BLUSH", "FOUNDATION", "POWDER",
    "TOP", "TEE", "T-SHIRT", "SHIRT", "JEANS", "KURUNG", "BAJU", "SELUAR",
    "PHONE", "USB", "CHARGER", "SMARTPHONE", "PRINTER", "LAPTOP",
    "RICE COOKER", "AIR FRYER", "IRON", "KIPAS", "PERIUK",
    "WATSONS", "GUARDIAN", "SEPHORA", "AEON", "VITAHEALTH"
  ];

  const blacklistMatch = blacklist.filter(word => upper.includes(word));
  if (blacklistMatch.length) {
    bot.sendMessage(chatId, "❌ Resit mengandungi perkataan tidak dibenarkan:\n- " + blacklistMatch.join(', '));
    return;
  }

  if (!isTempatLulus(ocrText)) {
    bot.sendMessage(chatId, "❌ Lokasi resit tidak sah. Mesti dari Kok Lanas, Ketereh, atau Melor.");
    return;
  }

  bot.sendMessage(chatId, `✅ Resit LULUS (RESIT PERBELANJAAN)\nTarikh: ${hanyaTarikh}`);
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || msg.text || "";
  const firstLine = caption.trim().split('\n')[0].toLowerCase();

  if (!msg.photo) {
    bot.sendMessage(chatId, "❌ Sila hantar gambar resit sahaja.");
    return;
  }

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const fileUrl = await bot.getFileLink(fileId);
    const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageBuffer.data, 'binary').toString('base64');

    const ocrRes = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`, {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }]
      }]
    });

    const text = ocrRes.data.responses[0].fullTextAnnotation?.text || "";

    if (firstLine.includes("resit perbelanjaan")) {
      semakResitPerbelanjaan(msg, chatId, text);
    } else if (firstLine.includes("bayar komisen")) {
      bot.sendMessage(chatId, "📌 BAYAR KOMISEN DIKESAN – Fungsi dalam pembinaan.");
    } else if (firstLine.includes("bayar transport")) {
      bot.sendMessage(chatId, "📌 BAYAR TRANSPORT DIKESAN – Fungsi dalam pembinaan.");
    } else {
      bot.sendMessage(chatId, "❌ Format caption tidak dikenali. Sila guna RESIT PERBELANJAAN / BAYAR KOMISEN / BAYAR TRANSPORT.");
    }

  } catch (err) {
    console.error("OCR Error:", err.message);
    bot.sendMessage(chatId, "❌ Gagal membaca gambar. Sila pastikan gambar jelas.");
  }
});

