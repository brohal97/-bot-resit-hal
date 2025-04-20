// ✅ Skrip Akhir telegram-bot-1: Gabungan Lengkap Siap Deploy
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {}; // Simpan pairing ikut message_id

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | KOMISEN | TRANSPORT");

// ===================== FUNGSI: BOLD BARIS PERTAMA =====================
function boldBarisPertama(text) {
  const lines = text.split("\n");
  if (lines.length === 0) return text;
  lines[0] = lines[0]
    .split('')
    .map(c => {
      if (/[A-Z]/.test(c)) return String.fromCodePoint(0x1D400 + (c.charCodeAt(0) - 65));
      if (/[a-z]/.test(c)) return String.fromCodePoint(0x1D41A + (c.charCodeAt(0) - 97));
      return c;
    })
    .join('');
  return lines.join("\n");
}

// ===================== FUNGSI: SEMAKAN TARIKH & FORMAT =====================
function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b\d{1,2}\s+\d{1,2}\s+\d{2,4}\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/,
    /\b\d{1,2}(hb)?(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis)\d{2,4}\b/i,
    /\b\d{1,2}(hb)?\s+(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis)\s+\d{2,4}\b/i,
    /\b(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis)\s+\d{1,2},?\s+\d{2,4}\b/i
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
  let match1 = clean.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (match1) return `${match1[1].padStart(2, '0')}-${bulanMap[match1[2].toLowerCase()] || '??'}-${match1[3]}`;

  let match2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match2) return `${match2[3].padStart(2, '0')}-${match2[2].padStart(2, '0')}-${match2[1]}`;

  let match3 = clean.match(/(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
  if (match3) return `${match3[1].padStart(2, '0')}-${match3[2].padStart(2, '0')}-${match3[3].length === 2 ? '20' + match3[3] : match3[3]}`;

  return text;
}

// ===================== MULA DENGAN MESEJ TEKS (BUTANG UPLOAD) =====================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const originalMsgId = msg.message_id;

  if (msg.text) {
    const text = msg.text.trim();
    const barisPertama = text.split("\n")[0].toUpperCase();
    const jenisResit = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];

    if (!jenisResit.includes(barisPertama)) return;
    if (text.length < 20) return bot.sendMessage(chatId, "⚠️ Sila tambah maklumat seperti tarikh, lokasi dan jumlah dalam mesej.");

    try { await bot.deleteMessage(chatId, originalMsgId); } catch (e) {}

    const boldText = boldBarisPertama(text);
    const sent = await bot.sendMessage(chatId, boldText, {
      reply_markup: {
        inline_keyboard: [ [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }] ]
      }
    });

    pendingUploads[sent.message_id] = {
      detail: text,
      chatId,
      detailMsgId: sent.message_id
    };
    return;
  }
});

// ===================== BUTANG 'UPLOAD RESIT' =====================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const detailMsgId = pendingUploads[msgId]?.detailMsgId || msgId;

  if (pendingUploads[msgId]) {
    const trigger = await bot.sendMessage(chatId, '❗️𝐒𝐢𝐥𝐚 𝐔𝐩𝐥𝐨𝐚𝐝 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐞𝐫𝐚 ❗️', {
      reply_to_message_id: detailMsgId,
      reply_markup: { force_reply: true }
    });

    pendingUploads[trigger.message_id] = {
      ...pendingUploads[msgId],
      triggerMsgId: trigger.message_id
    };

    setTimeout(async () => {
      try { await bot.deleteMessage(chatId, trigger.message_id); } catch (e) {}
      delete pendingUploads[trigger.message_id];
    }, 40000);
  }
});

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
    "LIP", "MATTE", "MASCARA", "EYELINER", "BROW", "SHADOW", "BLUSH", "FOUNDATION", "POWDER",
    "PRIMER", "CONCEALER", "TINT", "HIGHLIGHT", "MAKEUP", "LIPSTICK",
    "TOP", "TEE", "T-SHIRT", "SHIRT", "BLOUSE", "DRESS", "SKIRT",
    "PANTS", "JEANS", "SHORTS", "KURUNG", "BAJU", "SELUAR", "JACKET",
    "HOODIE", "SWEATER", "UNIFORM", "APPAREL", "CLOTHING", "FASHION",
    "PHONE", "SMARTPHONE", "LAPTOP", "USB", "PRINTER", "CAMERA",
    "CHARGER", "CABLE", "EARPHONE", "MOUSE", "KEYBOARD", "TEMPERED",
    "SCREEN PROTECTOR", "POWERBANK", "MONITOR", "SPEAKER", "HEADPHONE",
    "RICE COOKER", "PERIUK", "AIR FRYER", "KIPAS", "IRON", "KETTLE",
    "VACUUM", "TOASTER", "BLENDER", "STEAMER", "OVEN", "MICROWAVE",
    "AIRCOND", "HEATER", "WASHING MACHINE", "CLOTH DRYER",
    "WATSONS", "GUARDIAN", "SEPHORA", "FARMASI", "VITAHEALTH", "ALPRO",
    "CARING", "BIG PHARMACY", "SUNWAY PHARMACY", "SASA", "HERMO", "NASKEEN",
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

  const namaBank = getValue("nama bank");
  const noAkaun = getValue("no akaun");
  const total = getValue("total")?.replace(/(rm|myr)?\\s?/i, "");

  const ocrClean = text.replace(/[,]/g, "").toLowerCase();
  const gagal = [];

  if (namaBank && !ocrClean.includes(namaBank)) gagal.push("nama bank");
  if (noAkaun && !normalise(text).includes(normalise(noAkaun))) gagal.push("no akaun bank");

  const totalPattern = new RegExp(`(rm|myr)\\s*${total}(\\.00)?`, 'i');
  if (total && !ocrClean.match(totalPattern)) {
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

  // Cari tarikh dalam OCR
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

  // Step 1: Kira semua harga RM dalam caption baris produk
  const captionLines = caption.split('\n');
  const hargaRegex = /rm\s?(\d+(?:\.\d{1,2})?)/i;
  let totalKira = 0;
  for (let line of captionLines) {
    if (/total/i.test(line)) continue; // abaikan baris 'TOTAL'
    const match = line.match(hargaRegex);
    if (match) totalKira += parseFloat(match[1]);
  }

  // Step 2: Dapatkan nilai dalam baris 'TOTAL RMxxx' dari caption
  const barisTotal = captionLines.find(line => /total/i.test(line) && hargaRegex.test(line));
  const nilaiTotalCaption = (() => {
    const match = barisTotal?.match(hargaRegex);
    return match ? parseFloat(match[1]) : null;
  })();

  if (!nilaiTotalCaption || Math.abs(nilaiTotalCaption - totalKira) > 0.01) {
    bot.sendMessage(chatId, `❌ Jumlah dalam baris TOTAL (RM${nilaiTotalCaption || "?"}) tidak sama dengan hasil kiraan (RM${totalKira.toFixed(2)}).`);
    return;
  }

  // Step 3: Cari jumlah RM dalam OCR (seluruh teks)
  const totalFinal = nilaiTotalCaption.toFixed(2);
  const ocrClean = text.replace(/[,]/g, "").toLowerCase();
  const totalPattern = new RegExp(`(rm|myr)\\s*${totalFinal}(\\.00)?`, 'i');

  if (!ocrClean.match(totalPattern)) {
    bot.sendMessage(chatId, `❌ BAYAR TRANSPORT gagal diluluskan.\nSebab: jumlah RM${totalFinal} tidak ditemui dalam gambar.`);
    return;
  }

  bot.sendMessage(chatId, `✅ BAYAR TRANSPORT LULUS\nTarikh: ${hanyaTarikh}\nJumlah: RM${totalFinal}`);
}

  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message?.message_id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  if (!replyTo || !pendingUploads[replyTo]) {
    await bot.sendMessage(chatId, "⚠️ Gambar ini tidak dikaitkan dengan mana-mana resit. Sila tekan Upload Resit semula.");
    return;
  }

  const resitData = pendingUploads[replyTo];
  const detailText = resitData.detail.trim();
  const captionGabung = boldBarisPertama(detailText);

  try {
    await bot.deleteMessage(chatId, msg.message_id);
    if (resitData.triggerMsgId) await bot.deleteMessage(chatId, resitData.triggerMsgId);
    await bot.deleteMessage(chatId, resitData.detailMsgId);
  } catch (e) {}

  const sentPhoto = await bot.sendPhoto(chatId, fileId, { caption: captionGabung });
  try {
    await bot.forwardMessage(process.env.CHANNEL_ID, chatId, sentPhoto.message_id);
    setTimeout(async () => {
      try { await bot.deleteMessage(chatId, sentPhoto.message_id); } catch (e) {}
    }, 5000);
  } catch (err) {
    console.error("❌ Gagal forward ke channel:", err.message);
  }

  // ✅ JALANKAN OCR DAN SEMAK
  try {
    const fileUrl = await bot.getFileLink(fileId);
    const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageBuffer.data, 'binary').toString('base64');
    const ocrRes = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`, {
      requests: [{ image: { content: base64Image }, features: [{ type: "TEXT_DETECTION" }] }]
    });

    const text = ocrRes.data.responses[0].fullTextAnnotation?.text || "";
    const firstLine = detailText.split("\n")[0].toLowerCase();

    if (firstLine.includes("resit perbelanjaan")) {
  semakResitPerbelanjaan(msg, chatId, text);
} else if (firstLine.includes("bayar komisen")) {
  semakBayarKomisen(msg, chatId, text);
} else if (firstLine.includes("bayar transport")) {
  semakBayarTransport(msg, chatId, text);
}

  } catch (err) {
    console.error("OCR Error:", err.message);
    bot.sendMessage(chatId, "❌ Gagal membaca gambar. Sila pastikan gambar jelas.");
  }

  delete pendingUploads[replyTo];
});
