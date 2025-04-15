require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

// Pastikan BOT_TOKEN wujud
if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN tidak dijumpai dalam .env!");
  process.exit(1);
}

// Hidupkan bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("🤖 BOT AKTIF - SEMAK TARIKH GAMBAR");

// Bila terima gambar
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();

  if (chatId !== process.env.GROUP_ID) return;

  const hasPhoto = msg.photo && msg.photo.length > 0;
  if (!hasPhoto) {
    bot.sendMessage(chatId, "❌ Sila hantar gambar resit.");
    return;
  }

  try {
    // Ambil gambar saiz besar
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const localPath = path.join(__dirname, `resit_${msg.message_id}.jpg`);

    const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    await new Promise((resolve) => writer.on("finish", resolve));

    // Hantar ke Mindee OCR
    const form = new FormData();
    form.append("document", fs.createReadStream(localPath));
    const ocr = await axios.post(
      "https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict",
      form,
      {
        headers: {
          Authorization: `Token ${process.env.MINDEE_API_KEY}`,
          ...form.getHeaders(),
        },
      }
    );

    fs.unlinkSync(localPath);

    const prediction = ocr.data.document.inference.prediction;
    const ocrDate = prediction.date?.value;

    if (ocrDate) {
      bot.sendMessage(chatId, `✅ Tarikh dikesan: *${ocrDate}*`, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, "❌ Gagal kesan tarikh dalam gambar.");
    }
  } catch (err) {
    console.error("❌ Ralat semasa proses:", err.message);
    bot.sendMessage(chatId, "❌ Berlaku ralat semasa semakan.");
  }
});
