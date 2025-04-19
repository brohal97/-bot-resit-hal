// ===================== DETECT TARIKH + SEMUA TAPISAN PENUH =====================
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF - TAPISAN: TARIKH, LOKASI, KOSMETIK, PAKAIAN, GAJET, KEDAI, ELEKTRIK");

// ... [semua fungsi isTarikhValid, formatTarikhStandard, isKosmetikDetected, dll kekal seperti sekarang] ...

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

      if (
        isKosmetikDetected(text) ||
        isNamaKedaiKosmetik(text) ||
        isPakaianDetected(text) ||
        isGajetDetected(text) ||
        isElektrikRumahDetected(text)
      ) {
        bot.sendMessage(chatId, `❌ Resit tidak dibenarkan. Dikesan pembelian kosmetik, pakaian, gajet, barangan elektrik, atau dari kedai tidak sah.`);
        return;
      }

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
