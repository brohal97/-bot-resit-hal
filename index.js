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

function semakResitPerbelanjaan(msg, chatId, text) {
  const caption = msg.caption || msg.text || "";
  const lines = text.split('\n').map(x => x.trim());
  const tarikhJumpa = lines.find(line => isTarikhValid(line));

  if (!tarikhJumpa) {
    bot.sendMessage(chatId, "❌ Gagal kesan tarikh dalam gambar.");
    return;
  }

  const hanyaTarikh = formatTarikhStandard(tarikhJumpa);
  const captionWords = caption.split(/\s+/);
  let tarikhDalamCaption = null;
  for (let word of captionWords) {
    if (isTarikhValid(word)) {
      tarikhDalamCaption = formatTarikhStandard(word);
      break;
    }
  }

  if (!tarikhDalamCaption || tarikhDalamCaption !== hanyaTarikh) {
    bot.sendMessage(chatId, `❌ Tarikh dalam gambar (${hanyaTarikh}) tidak padan dengan teks.`);
    return;
  }

  const upper = text.toUpperCase();
  const blacklist = [
    // Kosmetik
    "LIP", "MATTE", "MASCARA", "EYELINER", "BROW", "SHADOW", "BLUSH", "FOUNDATION", "POWDER",
    "PRIMER", "CONCEALER", "TINT", "HIGHLIGHT", "MAKEUP", "LIPSTICK",

    // Pakaian
    "TOP", "TEE", "T-SHIRT", "SHIRT", "BLOUSE", "DRESS", "SKIRT",
    "PANTS", "JEANS", "SHORTS", "KURUNG", "BAJU", "SELUAR", "JACKET",
    "HOODIE", "SWEATER", "UNIFORM", "APPAREL", "CLOTHING", "FASHION",

    // Gajet
    "PHONE", "SMARTPHONE", "LAPTOP", "USB", "PRINTER", "CAMERA",
    "CHARGER", "CABLE", "EARPHONE", "MOUSE", "KEYBOARD", "TEMPERED",
    "SCREEN PROTECTOR", "POWERBANK", "MONITOR", "SPEAKER", "HEADPHONE",

    // Elektrik rumah
    "RICE COOKER", "PERIUK", "AIR FRYER", "KIPAS", "IRON", "KETTLE",
    "VACUUM", "TOASTER", "BLENDER", "STEAMER", "OVEN", "MICROWAVE",
    "AIRCOND", "HEATER", "WASHING MACHINE", "CLOTH DRYER",

    // Nama kedai farmasi / barangan kesihatan
    "WATSONS", "GUARDIAN", "SEPHORA", "FARMASI", "VITAHEALTH", "ALPRO",
    "CARING", "BIG PHARMACY", "SUNWAY PHARMACY", "SASA", "HERMO", "NASKEEN",

    // Nama makanan segera
    "KFC", "MCDONALD", "MCD", "PIZZA HUT", "DOMINO", "TEXAS", "AYAM PENYET",
    "SUBWAY", "MARRYBROWN", "STARBUCKS", "COFFEE BEAN", "TEALIVE",
    "SECRET RECIPE", "DUNKIN", "SUSHI KING", "BBQ PLAZA", "OLD TOWN",
    "PAPA JOHN", "NANDOS", "A&W", "CHATIME", "BOOST JUICE", "ZUS COFFEE",
    "COOLBLOG", "FAMILYMART", "DAISO", "EMART", "E-MART"
  ];

  const blacklistMatch = blacklist.filter(word => upper.includes(word));
  if (blacklistMatch.length) {
    bot.sendMessage(chatId, "❌ Resit mengandungi perkataan tidak dibenarkan:\n- " + blacklistMatch.join(', '));
    return;
  }

  if (!isTempatLulus(text)) {
    bot.sendMessage(chatId, "❌ Lokasi resit tidak sah. Mesti dari Kok Lanas, Ketereh, atau Melor.");
    return;
  }

  bot.sendMessage(chatId, `✅ RESIT PERBELANJAAN LULUS\nTarikh: ${hanyaTarikh}`);
}

function semakBayarKomisen(msg, chatId, text) {
  const caption = msg.caption || msg.text || "";
  const lines = text.split('\n').map(x => x.trim());
  const tarikhJumpa = lines.find(line => isTarikhValid(line));

  if (!tarikhJumpa) {
    bot.sendMessage(chatId, "❌ Gagal kesan tarikh dalam gambar.");
    return;
  }

  const hanyaTarikh = formatTarikhStandard(tarikhJumpa);
  const captionLines = caption.split('\n');
  const tarikhTeks = captionLines.find(line => isTarikhValid(line));
  const tarikhDalamTeks = tarikhTeks ? formatTarikhStandard(tarikhTeks) : null;

  if (tarikhDalamTeks !== hanyaTarikh) {
    bot.sendMessage(chatId, `❌ Tarikh dalam gambar (${hanyaTarikh}) tidak padan dengan teks.`);
    return;
  }

  const getValue = (label) => {
    const regex = new RegExp(label + "\\s*[:：]\\s*(.+)", "i");
    const match = caption.match(regex);
    return match ? match[1].trim().toLowerCase() : null;
  };

  const normalise = (str) => str.replace(/[^0-9]/g, "");

  // Tidak semak nama salesperson – semakan hanya ikut no akaun
  const namaBank = getValue("nama bank");
  const noAkaun = getValue("no akaun");
  const total = getValue("total")?.replace(/(rm|myr)?\\s?/i, "");

  const ocrLower = text.toLowerCase();
  const gagal = [];

  if (namaBank && !ocrLower.includes(namaBank)) gagal.push("nama bank");
  if (noAkaun && !normalise(text).includes(normalise(noAkaun))) gagal.push("no akaun bank");
  if (total && !ocrLower.match(new RegExp(`(rm|myr)?\\s*${total}`, 'i'))) {
    gagal.push("jumlah total");
  }

  if (gagal.length) {
    bot.sendMessage(chatId, `❌ BAYAR KOMISEN gagal diluluskan.\nSebab tidak padan: ${gagal.join(", ")}`);
    return;
  }

  bot.sendMessage(chatId, `✅ BAYAR KOMISEN LULUS\nTarikh: ${hanyaTarikh}`);
}

function semakBayarTransport(msg, chatId, text) {
  const caption = msg.caption || msg.text || "";
  const lines = text.split('\n').map(x => x.trim());
  const hanyaTarikh = (() => {
    const t = lines.find(line => isTarikhValid(line));
    return t ? formatTarikhStandard(t) : null;
  })();

  // Cari tarikh dalam caption
  let tarikhDalamCaption = null;
  for (let word of caption.split(/\s+/)) {
    if (isTarikhValid(word)) {
      tarikhDalamCaption = formatTarikhStandard(word);
      break;
    }
  }

  if (!hanyaTarikh || !tarikhDalamCaption || tarikhDalamCaption !== hanyaTarikh) {
    bot.sendMessage(chatId, `❌ Tarikh dalam gambar (${hanyaTarikh || "-"}) tidak padan dengan tarikh dalam teks.`);
    return;
  }

  // Kira jumlah dari caption (semua baris ada RM kecuali baris 'TOTAL')
  const captionLines = caption.split('\n');
  const hargaRegex = /rm\s?(\d+(?:\.\d{1,2})?)/i;
  let totalCaption = 0;
  for (let line of captionLines) {
    if (/total/i.test(line)) continue;
    const match = line.match(hargaRegex);
    if (match) totalCaption += parseFloat(match[1]);
  }

  // Cari baris 'TOTAL' dalam OCR
  const barisTotal = lines.find(line => /total|jumlah/i.test(line));
  const totalOCR = (() => {
    const match = barisTotal?.match(/(rm|myr)?\s?(\d+(?:\.\d{1,2})?)/i);
    return match ? parseFloat(match[2]) : null;
  })();

  if (totalOCR === null) {
    bot.sendMessage(chatId, "❌ Gagal kesan jumlah total dalam gambar (baris mengandungi perkataan 'TOTAL' atau 'JUMLAH').");
    return;
  }

  if (Math.abs(totalCaption - totalOCR) > 0.01) {
    bot.sendMessage(chatId, `❌ Jumlah dalam caption (RM${totalCaption.toFixed(2)}) tidak sama dengan jumlah dalam gambar (RM${totalOCR.toFixed(2)}).`);
    return;
  }

  bot.sendMessage(chatId, `✅ BAYAR TRANSPORT LULUS\nTarikh: ${hanyaTarikh}\nJumlah: RM${totalCaption.toFixed(2)}`);
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
      semakBayarKomisen(msg, chatId, text);
    } else if (firstLine.includes("bayar transport")) {
      semakBayarTransport(msg, chatId, text);
    } else {
      bot.sendMessage(chatId, "❌ Format caption tidak dikenali. Sila guna RESIT PERBELANJAAN / BAYAR KOMISEN / BAYAR TRANSPORT.");
    }

  } catch (err) {
    console.error("OCR Error:", err.message);
    bot.sendMessage(chatId, "❌ Gagal membaca gambar. Sila pastikan gambar jelas.");
  }
});
