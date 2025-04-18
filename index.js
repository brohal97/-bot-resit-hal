bot.onText(/RESIT PERBELANJAAN/i, async (msg) => {
  const chatId = msg.chat.id;
  const detailText = msg.text;
  const originalMsgId = msg.message_id;

  // ✅ Padam mesej asal dari user (nampak bersih)
  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("Gagal padam mesej asal:", e.message);
  }

  // Bot hantar semula mesej resit + butang upload
  const sent = await bot.sendMessage(chatId, detailText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: `upload_${msg.message_id}` }]
      ]
    }
  });

  // Simpan detail ikut message_id asal
  pendingUploads[msg.message_id] = {
    detail: detailText,
    chatId: chatId,
    status: "waiting_for_upload"
  };
});

