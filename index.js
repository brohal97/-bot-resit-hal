from zipfile import ZipFile

# Skrip index.js dengan fungsi diperbaiki untuk MYR + angka dengan koma
fixed_index_js = """\
// ✅ FINAL KOMBINASI (Fix Tarikh + Format + Jumlah + Koma)
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}/,
    /\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}/,
    /\\d{1,2}\\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\\s+\\d{4}/i,
    /(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\\s+\\d{1,2},?\\s+\\d{4}/i
  ];
  return patterns.some(p => p.test(lower));
}

function extractTarikhList(text) {
  const patterns = [
    /\\b\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}\\b/g,
    /\\b\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}\\b/g,
    /\\b\\d{1,2}\\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\\s+\\d{4}/gi,
    /\\b(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)[\\s\\-]+\\d{1,2},?\\s+\\d{4}/gi
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
    const cleaned = t.toLowerCase().replace(/,/g, '').replace(/\\s+/g, ' ');
    if (cleaned.match(/\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}/)) {
      const [d, m, y] = cleaned.split(/[\\/\\-]/);
      const year = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${year}`;
    }
    if (cleaned.match(/\\d{1,2}\\s+[a-z]+\\s+\\d{2,4}/)) {
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
  const hargaPattern = /(rm|myr)?\\s?(\\d{1,3}(,\\d{3})*(\\.\\d{2})?|\\d+(\\.\\d{2})?)/gi;
  for (let line of lines) {
    if (/total/i.test(line)) continue;
    const match = hargaPattern.exec(line.toLowerCase());
    if (match) {
      const num = match[2].replace(/,/g, '');
      total += parseFloat(num);
    }
  }
  return total;
}

function isAngkaBerdiriSendiri(ocrText, targetNumber) {
  const target = parseFloat(targetNumber).toFixed(2);
  const targetKoma = parseInt(targetNumber).toLocaleString('en-US');
  const lines = ocrText.split('\\n');
  for (let line of lines) {
    const clean = line.trim().toLowerCase().replace(/,/g, '');
    if (clean.includes(target) || clean.includes(`rm${target}`) || clean.includes(`myr${target}`)) return true;
    if (line.includes(targetKoma) || line.includes(`RM${targetKoma}`) || line.includes(`MYR${targetKoma}`)) return true;
  }
  return false;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || msg.text || '';
  if (!caption.trim() || !msg.photo) {
    bot.sendMessage(chatId, "❌ Tidak sah.\\nWajib hantar SEKALI gambar & teks (dalam satu mesej).");
    return;
  }

  const captionLines = caption.split('\\n');
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

    if (!isAngkaBerdiriSendiri(ocrText, captionTotal)) {
      bot.sendMessage(chatId, `❌ RM${captionTotal} tidak sah – tidak berdiri sendiri.`);
      return;
    }

    bot.sendMessage(chatId, `✅ Gambar disahkan: Tarikh, Jumlah & Format lengkap.`);
  } catch (error) {
    console.error("❌ Ralat semasa OCR:", error.message);
    bot.sendMessage(chatId, "⚠️ Ralat semasa semakan gambar. Gambar mungkin kabur atau tiada teks.");
  }
});
"""

# Simpan ZIP
zip_path = "/mnt/data/bot-resit-hal-kemaskini-angka-koma.zip"
with ZipFile(zip_path, "w") as zipf:
    zipf.writestr("index.js", fixed_index_js)
    zipf.writestr(".env.example", "BOT_TOKEN=\nVISION_API_KEY=\n")

zip_path
