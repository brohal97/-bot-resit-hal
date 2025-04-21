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

// =================== [ SEMAK BAYAR KOMISEN ] ===================
function semakBayarKomisen({ ocrText, captionText, tarikhOCR, tarikhCaption }) {
  const ocrLower = ocrText.toLowerCase();
  const captionLower = captionText.toLowerCase();

  if (tarikhOCR !== tarikhCaption) {
    return `❌ Tarikh tidak padan.`;
  }

  const bankMatch = /(maybank|cimb|bank islam|rhb|ambank|bsn|agrobank|muamalat)/;
  const bankOCR = ocrLower.match(bankMatch)?.[0];
  const bankCaption = captionLower.match(bankMatch)?.[0];
  if (!bankOCR || !bankCaption || bankOCR !== bankCaption) {
    return `❌ Nama bank tidak padan.`;
  }

  const noAkaunOCR = ocrLower.match(/\b\d{10,16}\b/);
  const noAkaunCaption = captionLower.match(/\b\d{10,16}\b/);
  if (!noAkaunOCR || !noAkaunCaption || noAkaunOCR[0] !== noAkaunCaption[0]) {
    return `❌ Nombor akaun tidak padan.`;
  }

  const jumlahOCR = ocrLower.match(/(rm|myr)?\s?\d{1,3}(,\d{3})*(\.\d{2})?/);
  const jumlahCaption = captionLower.match(/(rm|myr)?\s?\d{1,3}(,\d{3})*(\.\d{2})?/);
  if (!jumlahOCR || !jumlahCaption || jumlahOCR[0] !== jumlahCaption[0]) {
    return `❌ Jumlah tidak padan.`;
  }

  return `✅ Komisen disahkan: *${jumlahOCR[0].toUpperCase()}*`;
}

