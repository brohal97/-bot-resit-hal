// ✅ INDEX.JS PENUH dengan semua logik OCR terkini:
// - Sokong RM/MYR
// - Tarikh 2 digit automatik jadi 2025
// - Padanan normalisasi tarikh caption vs OCR

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU MESEJ TEKS...");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
    /\d{1,2}\s+\d{1,2}\s+\d{2,4}/,
    /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
    /\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
    /(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i
  ];
  return patterns.some(p => p.test(lower));
}

function extractTarikhList(text) {
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g,
    /\b\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/gi,
    /\b(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)[\s\-]+\d{1,2},?\s+\d{4}/gi
  ];
  let result = [];
  patterns.forEach(p => {
    const matches = text.match(p);
    if (matches) result.push(...matches.map(m => m.toLowerCase()));
  });
  return result;
}

function normalisasiTarikhList(list) {
  return list.map(t => {
    const cleaned = t.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
    if (cleaned.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)) {
      const [d, m, y] = cleaned.split(/[\/\-]/);
      const year = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${year}`;
    }
    if (cleaned.match(/\d{1,2}\s+[a-z]+\s+\d{2,4}/)) {
      const [d, month, y] = cleaned.split(' ');
      const map = { jan:'01', feb:'02', mac:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
      const year = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}-${map[month.slice(0,3)]}-${year}`;
    }
    return cleaned;
  });
}

function calculateTotalHargaFromList(lines) {
  let total = 0;
  const hargaPattern = /rm\s?(\d+(\.\d{2})?)/i;
  for (let line of lines) {
    if (/total/i.test(line)) continue;
    const match = line.match(hargaPattern);
    if (match) total += parseFloat(match[1]);
  }
  return total;
}

function isJumlahTerasingDenganJarak(ocrText, target) {
  const lines = ocrText.replace(/,/g, '').split('\n');
  const targetStr = target.toFixed(2);
  const targetRaw = target.toString();

  for (let line of lines) {
    const clean = line.trim();
    if (
      clean === targetRaw ||
      clean === `RM${targetStr}` ||
      clean === `rm${targetStr}` ||
      clean === `MYR${targetStr}` ||
      clean === `myr${targetStr}`
    ) return true;

    if (line.match(new RegExp(`(Amount|RM|MYR)?\s{0,5}${targetRaw}\.?0{0,2}\s*$`, 'i'))) return true;
  }
  return false;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || msg.text || '';

  if (!caption.trim() || !msg.photo) {
    bot.sendMessage(chatId, "❌ Tidak sah.\nWajib hantar SEKALI gambar & teks (dalam satu mesej).");
    return;
  }

  const captionLines = caption.split('\n');
  const captionTotal = calculateTotalHargaFromList(captionLines);

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(res.data).toString('base64');

    const visionRes = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`,
      {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
          }
        ]
      }
    );

    const ocrText = visionRes.data.responses[0]?.textAnnotations?.[0]?.description || '';

    // TARIKH
    const tarikhOCR = normalisasiTarikhList(extractTarikhList(ocrText));
    const tarikhCaption = normalisasiTarikhList(extractTarikhList(caption));

    if (!tarikhOCR.length) {
      bot.sendMessage(chatId, "❌ Gambar tidak mengandungi sebarang tarikh.");
      return;
    }
    if (!tarikhOCR.some(t => tarikhCaption.includes(t))) {
      bot.sendMessage(chatId, "❌ Tarikh dalam gambar tidak sepadan dengan tarikh dalam caption.");
      return;
    }

    // JUMLAH
    if (!isJumlahTerasingDenganJarak(ocrText, captionTotal)) {
      bot.sendMessage(chatId, `❌ RM${captionTotal} terlalu rapat atau bercampur dengan angka/perkataan lain dalam gambar.`);
      return;
    }

    bot.sendMessage(chatId, `✅ Gambar disahkan: Tarikh & Jumlah padan sempurna.`);

  } catch (error) {
    console.error("❌ Ralat semasa OCR:", error.message);
    bot.sendMessage(chatId, "⚠️ Ralat semasa semakan gambar. Gambar mungkin kabur atau tiada teks.");
  }
});

