require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR...");

// Fungsi untuk detect tarikh dalam pelbagai format
function extractTarikh(text) {
  const bulanMap = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12"
  };

  text = text.toLowerCase();

  // Format 1: 16/04/2025 atau 16-04-2025
  let match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const [_, d, m, y] = match;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y.length === 2 ? '20' + y : y}`;
  }

  // Format 2: 16 Apr 2025 atau 1 January 2025
  match = text.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})/i);
  if (match) {
    const [_, d, b, y] = match;
    const bulan = bulanMap[b.slice(0, 3)];
    if (bulan) return `${d.padStart(2, '0')}-${bulan}-${y}`;
  }

  // Format 3: April 16, 2025
  match = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})[,]?\s+(\d{4})/i);
  if (match) {
    const [_, b, d, y] = match;
    const bulan = bulanMap[b.slice(0, 3)];
    if (bulan) return `${d.padStart(2, '0')}-${bulan}-${y}`;
  }

  // Format 4: 2025/04/16 atau 2025-04-16
  match = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) {
    const [_, y, m, d] = match;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  return null;
}

// Fungsi semakan RESIT PERBELANJAAN
function validateResitPerbelanjaan(caption) {
  const lower = caption.toLowerCase();

  // Cari tarikh
  const tarikhPattern = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
  const hasTarikh = tarikhPattern.test(lower);

  // Cari jumlah RM
  const jumlahPattern = /rm\s?\d+(\.\d{2})?|\b(total|jumlah|harga)\b/;
  const hasJumlah = jumlahPattern.test(lower);

  // Cari tujuan
  const tujuanPattern = /\b(beli|bayar|untuk|sewa|belanja|tuntutan|claim|servis)\b/;
  const hasTujuan = tujuanPattern.test(lower);

  return hasTarikh && hasJumlah && hasTujuan;
}

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  // Pastikan ada gambar + caption
  if (!msg.caption || !msg.photo) {
    bot.sendMessage(chatId, `❌ Resit tidak sah.\nPastikan gambar dan teks dihantar bersama.`);
    return;
  }

  const caption = msg.caption.trim();

  // Semak jika RESIT PERBELANJAAN
  if (caption.toLowerCase().startsWith("resit perbelanjaan")) {
    if (!validateResitPerbelanjaan(caption)) {
      bot.sendMessage(chatId, `❌ Tidak lengkap.\nRESIT PERBELANJAAN wajib ada:\n📆 TARIKH\n🎯 TUJUAN\n💰 TOTAL HARGA`);
      return;
    }
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const imageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(res.data, 'binary').toString('base64');

    const visionRes = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`,
      {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION' }]
          }
        ]
      }
    );

    const text = visionRes.data.responses[0]?.textAnnotations?.[0]?.description || '';
    console.log("📄 OCR Result:\n", text);

    const tarikh = extractTarikh(text);

    if (tarikh) {
      bot.sendMessage(chatId, `✅ Resit diterima.\n📆 Tarikh dijumpai: ${tarikh}`);
    } else {
      bot.sendMessage(chatId, `❌ Resit tidak sah.\nTiada tarikh ditemui dalam gambar.`);
    }

  } catch (err) {
    console.error("❌ Ralat OCR:", err.message);
    bot.sendMessage(chatId, `⚠️ Ralat semasa proses OCR.`);
  }
});

