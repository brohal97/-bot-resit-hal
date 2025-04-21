require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const visionApiKey = process.env.VISION_API_KEY;

console.log("🤖 BOT AKTIF – Sistem Lengkap Padanan Resit");

// =================== [ Helper: Tarikh Normalizer ] ===================
const bulanMap = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function detectAndFormatDateFromText(text) {
  text = text.toLowerCase().replace(/[\.\-]/g, ' ');

  const regex = /\b(\d{1,2})\s*([a-z]{3})\s*(\d{2,4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let [_, day, monthStr, year] = match;
    const month = bulanMap[monthStr.toLowerCase()];
    if (!month) continue;
    if (year.length === 2) year = year > 30 ? `19${year}` : `20${year}`;
    return `${day.padStart(2, '0')}/${month}/${year}`;
  }

  const altRegex = /\b(0?[1-9]|[12][0-9]|3[01])[\s\/\-\.](0?[1-9]|1[0-2])[\s\/\-\.](\d{2,4})\b/;
  const altMatch = text.match(altRegex);
  if (altMatch) {
    let [_, day, month, year] = altMatch;
    if (year.length === 2) year = year > 30 ? `19${year}` : `20${year}`;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  return null;
}

// =================== [ OCR Vision API ] ===================
async function extractTarikhFromImage(fileUrl) {
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;

  try {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');

    const body = {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }]
      }]
    };

    const visionRes = await axios.post(endpoint, body);
    const ocrText = visionRes.data.responses[0]?.fullTextAnnotation?.text || "";
    console.log("📜 OCR TEXT:\n", ocrText);

    const cleanText = ocrText.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const tarikh = detectAndFormatDateFromText(cleanText);
    return { tarikh, ocrText };

  } catch (err) {
    console.error("❌ ERROR OCR:", err.message);
    return { tarikh: null, ocrText: '' };
  }
}

// =================== [ SEMAK RESIT PERBELANJAAN ] ===================
function semakResitPerbelanjaan({ ocrText, captionText, tarikhOCR, tarikhCaption }) {
  const blacklist = ['watson', 'kfc', 'guardian', 'farmasi'];
  const lokasiWajib = ['kok lanas', 'ketereh', 'melor'];

  const ocrLower = ocrText.toLowerCase();

  if (tarikhOCR !== tarikhCaption) {
    return `❌ Tarikh tidak padan:\n📸 Gambar: *${tarikhOCR}*\n✍️ Caption: *${tarikhCaption}*`;
  }

  if (blacklist.some(word => ocrLower.includes(word))) {
    return `❌ Resit ditolak kerana mengandungi jenama/kedai tidak dibenarkan.`;
  }

  const lokasiOK = lokasiWajib.some(word => ocrLower.includes(word));
  if (!lokasiOK) {
    return `❌ Lokasi tidak sah. Hanya resit dari kawasan tertentu sahaja dibenarkan.`;
  }

  return `✅ Resit disahkan: *${tarikhOCR}*`;
}
// =================== [ SEMAK BAYAR KOMISEN – FINAL STABIL ] ===================
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

// =================== [ PAIRING STORAGE ] ===================
let pendingUploads = {};

// =================== [ FUNGSI 1: Caption Masuk ➜ Padam & Butang ] ===================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const text = msg.text;

  if (!text || msg.photo || msg.document || msg.caption || msg.reply_to_message) return;

  await bot.deleteMessage(chatId, messageId).catch(() => {});
  await bot.sendMessage(chatId, `*${text}*`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Upload Resit", callback_data: `upload_${messageId}` }]
      ]
    }
  });
});

// =================== [ FUNGSI 2: Tekan Butang ➜ Force Reply + Prompt ] ===================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;

  if (data.startsWith('upload_')) {
    const captionText = query.message.text || '';

    await bot.answerCallbackQuery({ callback_query_id: query.id });

    const promptMsg = await bot.sendMessage(chatId, `❗️𝐒𝐢𝐥𝐚 𝐇𝐚𝐧𝐭𝐚𝐫 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐞𝐫𝐚❗️ `, {
      reply_markup: { force_reply: true },
      reply_to_message_id: messageId
    });

    pendingUploads[userId] = {
      captionText,
      forceReplyTo: messageId,
      promptMsgId: promptMsg.message_id
    };
  }
});

// =================== [ FUNGSI 3: Reply Gambar ➜ OCR + Gabung + Semakan + Padam ] ===================
bot.on('photo', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const replyTo = msg.reply_to_message?.message_id || null;

  if (!pendingUploads[userId] || !replyTo) {
    return bot.sendMessage(chatId, `⚠️ Sila tekan butang "Upload Resit" dan reply dengan gambar.`, {
      reply_to_message_id: messageId
    });
  }

  const { captionText, forceReplyTo, promptMsgId } = pendingUploads[userId];
  const photos = msg.photo;
  const fileId = photos[photos.length - 1].file_id;

  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const { tarikh, ocrText } = await extractTarikhFromImage(fileUrl);
  const tarikhCaption = detectAndFormatDateFromText(captionText);

  let semakan = '';
  const jenis = captionText.split('\n')[0].trim().toUpperCase();

  if (jenis.includes("RESIT PERBELANJAAN")) {
  semakan = semakResitPerbelanjaan({ ocrText, captionText, tarikhOCR: tarikh, tarikhCaption });
} else if (jenis.includes("BAYAR KOMISEN")) {
  semakan = semakBayarKomisen({ ocrText, captionText, tarikhOCR: tarikh, tarikhCaption });
} else {
  semakan = '⚠️ Jenis resit tidak dikenali.';
}

  const lines = captionText.split('\n');
  const formattedCaption = `*${lines[0]}*\n` + lines.slice(1).join('\n');

  await bot.deleteMessage(chatId, messageId).catch(() => {});
  await bot.deleteMessage(chatId, forceReplyTo).catch(() => {});
  await bot.deleteMessage(chatId, promptMsgId).catch(() => {});

  await bot.sendPhoto(chatId, fileId, {
    caption: `${formattedCaption}\n\n${semakan}`,
    parse_mode: "Markdown"
  });

  delete pendingUploads[userId];
});
