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
// =================== [ SEMAK BAYAR KOMISEN – VERSI FINAL DENGAN RM/MYR SAHAJA ] ===================
function semakBayarKomisen({ ocrText, captionText, tarikhOCR, tarikhCaption }) {
  const ocrLower = ocrText.toLowerCase();
  const captionLower = captionText.toLowerCase();

  // 1. Semak tarikh
  if (tarikhOCR !== tarikhCaption) {
    return `❌ Tarikh tidak padan.`;
  }

  // 2. Semak nama bank (normalize spacing)
  const normalize = str => str.toLowerCase().replace(/\s+/g, '');
  // 2. Semak nama bank (berpandukan caption, cari longgar dalam OCR)
const bankList = [
  'maybank', 'cimb', 'bank islam', 'rhb',
  'ambank', 'bsn', 'agrobank', 'bank muamalat', 'muamalat'
];

// Ambil bank dari caption dulu
const bankFromCaption = bankList.find(bank => captionLower.includes(bank));

// Semak: adakah nama tu wujud dalam OCR?
if (!bankFromCaption || !ocrLower.includes(bankFromCaption)) {
  return `❌ Nama bank tidak padan.`;
}

// 3. Semak nombor akaun (ketat - angka & susunan wajib sama, spacing boleh diabaikan)
const noAkaunCaption = captionLower.match(/\b\d{6,20}\b/)?.[0];

const noAkaunList = (ocrText.match(/\d[\d\s]{5,30}\d/g) || [])
  .map(n => n.replace(/\s+/g, '')); // buang semua spacing

const padanAkaun = noAkaunList.includes(noAkaunCaption);

if (!noAkaunCaption || !padanAkaun) {
  return `❌ Nombor akaun tidak padan.`;
}

  // 4. Semak jumlah (OCR mesti ada RM/MYR sahaja)
  function normalizeJumlah(str) {
    return parseFloat(
      str.replace(/,/g, '').replace(/(rm|myr)/gi, '').trim()
    ).toFixed(2);
  }

  const captionLines = captionLower.split('\n');
  const totalLine = captionLines.find(line => /total/.test(line) && /(rm|myr)/.test(line));
  const jumlahCaptionRaw = totalLine?.match(/(rm|myr)\s?\d{1,3}(,\d{3})*(\.\d{2})?/);

  const jumlahOCRraw = ocrLower.match(/(rm|myr)\s?\d{1,3}(,\d{3})*(\.\d{2})?/);

  if (!jumlahOCRraw || !jumlahCaptionRaw) {
    return `❌ Jumlah tidak dapat dipastikan.`;
  }

  const jumlahOCR = normalizeJumlah(jumlahOCRraw[0]);
  const jumlahCaption = normalizeJumlah(jumlahCaptionRaw[0]);

  if (jumlahOCR !== jumlahCaption) {
    return `❌ Jumlah tidak padan.\n📸 Slip: *RM${jumlahOCR}*\n✍️ Caption: *RM${jumlahCaption}*`;
  }

  return `✅ BAYAR KOMISEN LULUS\nTarikh: ${tarikhCaption}`;
}
// =================== [ SEMAK BAYAR TRANSPORT – VERSI FINAL DENGAN RM/MYR SAHAJA ] ===================
function semakBayarTransport({ ocrText, captionText, tarikhOCR, tarikhCaption }) {
  const ocrLower = ocrText.toLowerCase();
  const captionLower = captionText.toLowerCase();

  // 1. Semak tarikh
  if (tarikhOCR !== tarikhCaption) {
    return `❌ Tarikh tidak padan.\n📸 Gambar: *${tarikhOCR}*\n✍️ Caption: *${tarikhCaption}*`;
  }

  // 2. Kira jumlah dari senarai produk (abaikan baris 'total')
  let totalKira = 0;
  const captionLines = captionLower.split('\n');
  const hargaRegex = /rm\s?(\d+(?:\.\d{1,2})?)/;
  for (let line of captionLines) {
    if (/total/.test(line)) continue;
    const match = line.match(hargaRegex);
    if (match) totalKira += parseFloat(match[1]);
  }

  // 3. Ambil jumlah dari baris 'Total'
  const totalLine = captionLines.find(line => /total/.test(line) && /(rm|myr)/.test(line));
  const jumlahCaptionRaw = totalLine?.match(/(rm|myr)\s?\d{1,3}(,\d{3})*(\.\d{2})?/);

  // 4. Cari jumlah dalam OCR (mesti ada RM/MYR sahaja)
  const jumlahOCRraw = ocrLower.match(/(rm|myr)\s?\d{1,3}(,\d{3})*(\.\d{2})?/);

  if (!jumlahOCRraw || !jumlahCaptionRaw) {
    return `❌ Jumlah tidak dapat dipastikan.`;
  }

  // 5. Normalize dan bandingkan
  function normalizeJumlah(str) {
    return parseFloat(
      str.replace(/,/g, '').replace(/(rm|myr)/gi, '').trim()
    ).toFixed(2);
  }

  const jumlahOCR = normalizeJumlah(jumlahOCRraw[0]);
  const jumlahCaption = normalizeJumlah(jumlahCaptionRaw[0]);
  const jumlahKiraan = totalKira.toFixed(2);

  if (jumlahKiraan !== jumlahCaption) {
    return `❌ Jumlah dalam baris TOTAL (RM${jumlahCaption}) tidak sama dengan hasil kiraan (RM${jumlahKiraan}).`;
  }

  if (jumlahOCR !== jumlahCaption) {
    return `❌ Jumlah tidak padan antara slip dan caption.\n📸 Slip: *RM${jumlahOCR}*\n✍️ Caption: *RM${jumlahCaption}*`;
  }

  return `✅ BAYAR TRANSPORT LULUS\nTarikh: ${tarikhCaption}`;
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
} else if (jenis.includes("BAYAR TRANSPORT")) {
  semakan = semakBayarTransport({ ocrText, captionText, tarikhOCR: tarikh, tarikhCaption });
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
