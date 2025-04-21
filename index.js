// ✅ BOT TELEGRAM PALING RINGKAS – DETECT TARIKH SAHAJA DARI GAMBAR
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const API_KEY = process.env.VISION_API_KEY;
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF – DETECT TARIKH GAMBAR SAHAJA");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b\d{1,2}\s+\d{1,2}\s+\d{2,4}\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/,
    /\b\d{1,2}(hb)?\s*(jan|feb|mac|mar|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis|january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|julai|oktober|disember)\s*\d{2,4}\b/i
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

  const clean = text.trim().toLowerCase().replace(/[–—]/g, '-');

  let match1 = clean.match(/(\d{1,2})\s+(jan|feb|mac|mar|apr|may|mei|jun|jul|aug|ogos|sep|oct|nov|dec|dis)\s+(\d{4})/i);
  if (match1) return `${match1[1].padStart(2, '0')}-${bulanMap[match1[2].toLowerCase()] || '??'}-${match1[3]}`;

  let match2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match2) return `${match2[3].padStart(2, '0')}-${match2[2].padStart(2, '0')}-${match2[1]}`;

  let match3 = clean.match(/(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
  if (match3) return `${match3[1].padStart(2, '0')}-${match3[2].padStart(2, '0')}-${match3[3].length === 2 ? '20' + match3[3] : match3[3]}`;

  return null;
}

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1];
  try {
    const file = await bot.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const visionResponse = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`, {
      requests: [
        {
          image: { source: { imageUri: fileUrl } },
          features: [{ type: 'TEXT_DETECTION' }]
        }
      ]
    });

    const text = visionResponse.data.responses[0]?.fullTextAnnotation?.text || '';
    const baris = text.split('\n');
    const lineWithTarikh = baris.find(line => isTarikhValid(line));
    const formatted = lineWithTarikh ? formatTarikhStandard(lineWithTarikh) : null;

    if (formatted) {
      await bot.sendMessage(chatId, `📅 Tarikh dijumpai dalam gambar: ${formatted}`);
    } else {
      await bot.sendMessage(chatId, `❌ Tiada tarikh dijumpai dalam gambar.`);
    }
  } catch (e) {
    console.error("OCR ERROR:", e.message);
    await bot.sendMessage(chatId, "❌ Gagal proses gambar.");
  }
});
