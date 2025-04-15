require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const vision = require("@google-cloud/vision");

// 📂 Baca fail keyfile.json dari filesystem
const keyPath = path.join(__dirname, "keyfile.json");
const credentials = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
const client = new vision.ImageAnnotatorClient({ credentials });

// 🛡️ Semak token
if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN tidak dijumpai dalam .env");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("🤖 BOT AKTIF - SEMAK TARIKH GAMBAR");

// 📸 Bila terima gambar
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  if (chatId !== process.env.GROUP_ID) return;

  const hasPhoto = msg.photo && msg.photo.length > 0;
  if (!hasPhoto) return;

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const localPath = path.join(__dirname, "temp.jpg");

    const response = await axios.get(fileUrl, { responseType: "stream" });
    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(localPath);
      response.data.pipe(stream);
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    const [result] = await client.textDetection(localPath);
    fs.unlinkSync(localPath); // padam fail lepas scan

    const text = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";
    const dateMatch = text.match(/(\d{1,2}[\-\/\s]\d{1,2}[\-\/\s]\d{2,4})/);

    if (dateMatch) {
      bot.sendMessage(chatId, `✅ Tarikh dikesan: *${dateMatch[1]}*`, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, `❌ Tiada tarikh dijumpai dalam gambar.`);
    }
  } catch (err) {
    console.error("❌ Gagal proses gambar:", err.message);
    bot.sendMessage(chatId, "❌ Gagal proses gambar.");
  }
});


