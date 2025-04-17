
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

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

function isAngkaBerdiriSendiri(ocrText, targetNumber) {
  const target = parseFloat(targetNumber).toFixed(2);
  const lines = ocrText.split('\n');
  for (let line of lines) {
    const cleanLine = line.trim();
    if (cleanLine.includes(target)) {
      const idx = cleanLine.indexOf(target);
      const sebelum = cleanLine[idx - 1] || ' ';
      const selepas = cleanLine[idx + target.length] || ' ';
      const isSpaceKiri = sebelum === ' ' || sebelum === '';
      const isSpaceKanan = selepas === ' ' || selepas === '';
      const tiadaHurufSekeliling = !/[a-zA-Z0-9]/.test(sebelum + selepas);
      if (isSpaceKiri && isSpaceKanan && tiadaHurufSekeliling) return true;
    }
  }
  return false;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || msg.text || '';
  if (!caption.trim() || !msg.photo) {
    bot.sendMessage(chatId, "❌ Tidak sah.
Wajib hantar SEKALI gambar & teks (dalam satu mesej).");
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
    if (!isAngkaBerdiriSendiri(ocrText, captionTotal)) {
      bot.sendMessage(chatId, `❌ RM${captionTotal} tidak sah – tidak berdiri sendiri.`);
      return;
    }
    bot.sendMessage(chatId, `✅ Gambar disahkan: Jumlah & Format lengkap.`);
  } catch (error) {
    console.error("❌ Ralat semasa OCR:", error.message);
    bot.sendMessage(chatId, "⚠️ Ralat semasa semakan gambar. Gambar mungkin kabur atau tiada teks.");
  }
});
