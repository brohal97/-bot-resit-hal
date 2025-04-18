// ===================== DETECT TARIKH SAHAJA (FORMAT DMY + SEMAK TEMPAT) =====================
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF - DETECT TARIKH & TEMPAT");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b\d{1,2}\s+\d{1,2}\s+\d{2,4}\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\b/i,
    /\b(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}\b/i
  ];
  return patterns.some(p => p.test(lower));
}

function formatTarikhStandard(text) {
  const bulanMap = {
    jan: '01', feb: '02', mac: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const clean = text.trim();

  let match1 = clean.match(/(\d{1,2})\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/i);
  if (match1) {
    const d = match1[1].padStart(2, '0');
    const m = bulanMap[match1[2].toLowerCase()] || '??';
    const y = match1[3];
    return `${d}-${m}-${y}`;
  }

  let match2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match2) {
    const d = match2[3].padStart(2, '0');
    const m = match2[2].padStart(2, '0');
    const y = match2[1];
    return `${d}-${m}-${y}`;
  }

  let match3 = clean.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/);
  if (match3) {
    const d = match3[1].padStart(2, '0');
    const m = match3[2].padStart(2, '0');
    const y = match3[3].length === 2 ? '20' + match3[3] : match3[3];
    return `${d}-${m}-${y}`;
  }

  return text;
}

function isTempatLulus(text) {
  const lokasi = ["kok lanas", "ketereh", "melor"];
  const lowerText = text.toLowerCase();
  return lokasi.some(nama => lowerText.includes(nama));
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.photo) {
    bot.sendMessage(chatId, "❌ Sila hantar gambar resit sahaja.");
    return;
  }

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const fileUrl = await bot.getFileLink(fileId);

    const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageBuffer.data, 'binary').toString('base64');

    const ocrRes = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`,
      {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "TEXT_DETECTION" }]
          }
        ]
      },
      { timeout: 10000 }
    );

    const text = ocrRes.data.responses[0].fullTextAnnotation?.text || "";
    const lines = text.split('\n').map(x => x.trim());

    const tarikhJumpa = lines.find(line => isTarikhValid(line));

    if (tarikhJumpa) {
      const padanTarikh = tarikhJumpa.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}|(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i);
      const hanyaTarikh = padanTarikh ? formatTarikhStandard(padanTarikh[0]) : tarikhJumpa;

      const tempatLulus = isTempatLulus(text);

      if (tempatLulus) {
        bot.sendMessage(chatId, `✅ Tarikh dijumpai: ${hanyaTarikh}\n✅ Lokasi sah: Kok Lanas / Ketereh / Melor`);
      } else {
        bot.sendMessage(chatId, `✅ Tarikh dijumpai: ${hanyaTarikh}\n❌ Lokasi tidak sah. Resit bukan dari kawasan yang dibenarkan.`);
      }
    } else {
      bot.sendMessage(chatId, "❌ Tiada tarikh dijumpai dalam gambar.");
    }
  } catch (err) {
    console.error("OCR Error:", err.message);
    console.log("FULL ERROR:", err.response?.data || err);
    bot.sendMessage(chatId, "❌ Gagal membaca gambar. Sila pastikan gambar jelas.");
  }
});

