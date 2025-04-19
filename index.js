require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF - SEMAK TARIKH + TAPISAN + SEBAB REJECT");

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
  if (match1) return `${match1[1].padStart(2, '0')}-${bulanMap[match1[2].toLowerCase()] || '??'}-${match1[3]}`;

  let match2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match2) return `${match2[3].padStart(2, '0')}-${match2[2].padStart(2, '0')}-${match2[1]}`;

  let match3 = clean.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/);
  if (match3) return `${match3[1].padStart(2, '0')}-${match3[2].padStart(2, '0')}-${match3[3].length === 2 ? '20' + match3[3] : match3[3]}`;

  return text;
}

function isTempatLulus(text) {
  const lokasi = ["kok lanas", "ketereh", "melor"];
  const lower = text.toLowerCase();
  return lokasi.some(l => lower.includes(l));
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

    const ocrRes = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`, {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }]
      }]
    });

    const text = ocrRes.data.responses[0].fullTextAnnotation?.text || "";
    const lines = text.split('\n').map(x => x.trim());
    const tarikhJumpa = lines.find(line => isTarikhValid(line));

    if (tarikhJumpa) {
      const match = tarikhJumpa.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}|(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i);
      const hanyaTarikh = match ? formatTarikhStandard(match[0]) : tarikhJumpa;

      // TAPISAN BERSEBAB
      const alasanReject = [];
      const upper = text.toUpperCase();

      const kosmetik = ["LIP", "MATTE", "MASCARA", "EYELINER", "BROW", "SHADOW", "BLUSH", "FOUNDATION", "POWDER"].filter(k => upper.includes(k));
      const pakaian = ["TOP", "TEE", "T-SHIRT", "SHIRT", "BLOUSE", "DRESS", "SKIRT", "PANTS", "JEANS", "SHORTS", "KURUNG", "BAJU", "SELUAR", "JACKET", "HOODIE", "SWEATER", "UNIFORM", "WOMEN", "LADIES", "BOY", "GIRL", "KIDS", "BABY", "APPAREL", "CLOTHING", "FASHION"].filter(k => upper.includes(k));
      const gajet = ["SMARTPHONE", "PHONE", "LAPTOP", "USB", "CAMERA", "CHARGER", "PRINTER", "EARPHONE", "MOUSE", "KEYBOARD", "SCREEN PROTECTOR"].filter(k => upper.includes(k));
      const elektrik = ["RICE COOKER", "PERIUK", "KETTLE", "STEAMER", "AIR FRYER", "FAN", "IRON", "VACUUM", "DRYER"].filter(k => upper.includes(k));
      const kedai = ["WATSONS", "GUARDIAN", "VITAHEALTH", "AEON", "SEPHORA"].filter(k => upper.includes(k));

      if (kosmetik.length) alasanReject.push(`Kosmetik: ${kosmetik.join(', ')}`);
      if (pakaian.length) alasanReject.push(`Pakaian: ${pakaian.join(', ')}`);
      if (gajet.length) alasanReject.push(`Gajet: ${gajet.join(', ')}`);
      if (elektrik.length) alasanReject.push(`Elektrik: ${elektrik.join(', ')}`);
      if (kedai.length) alasanReject.push(`Nama Kedai: ${kedai.join(', ')}`);

      if (alasanReject.length > 0) {
        const msg = "❌ Resit tidak dibenarkan.\nDikesan:\n" + alasanReject.map(x => `- ${x}`).join('\n');
        bot.sendMessage(chatId, msg);
        return;
      }

      if (isTempatLulus(text)) {
        bot.sendMessage(chatId, `✅ Tarikh dijumpai: ${hanyaTarikh}\n✅ Lokasi sah: Kok Lanas / Ketereh / Melor`);
      } else {
        bot.sendMessage(chatId, `✅ Tarikh dijumpai: ${hanyaTarikh}\n❌ Lokasi tidak sah. Resit bukan dari kawasan yang dibenarkan.`);
      }
    } else {
      bot.sendMessage(chatId, "❌ Tiada tarikh dijumpai dalam gambar.");
    }
  } catch (err) {
    console.error("OCR Error:", err.message);
    bot.sendMessage(chatId, "❌ Gagal membaca gambar. Sila pastikan gambar jelas.");
  }
});

