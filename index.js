require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU MESEJ TEKS...");

// --- Fungsi sedia ada (jangan diusik) ---
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

function extractTotalLineAmount(lines) {
  const pattern = /total.*rm\s?(\d+(\.\d{2})?)/i;
  for (let line of lines) {
    const match = line.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function validateResitPerbelanjaanFlexible(caption) {
  const lines = caption.trim().split('\n').map(x => x.trim()).filter(x => x !== '');
  if (lines.length < 4) return false;
  if (lines[0].toLowerCase() !== 'resit perbelanjaan') return false;

  let adaTarikh = false;
  let adaJumlah = false;
  let adaTujuan = false;

  const hargaPattern = /^rm\s?\d+(\.\d{2})?$/i;
  const tujuanPattern = /\b(beli|bayar|untuk|belanja|sewa|claim|servis)\b/i;

  for (let i = 1; i < lines.length; i++) {
    if (!adaTarikh && isTarikhValid(lines[i])) adaTarikh = true;
    if (!adaJumlah && hargaPattern.test(lines[i])) adaJumlah = true;
    if (!adaTujuan && lines[i].split(' ').length >= 3 && tujuanPattern.test(lines[i])) adaTujuan = true;
  }
  return adaTarikh && adaJumlah && adaTujuan;
}

function validateBayarTransportFormat(caption) {
  const lines = caption.trim().split('\n').map(x => x.trim()).filter(x => x !== '');
  if (lines.length < 4) return false;
  if (lines[0].toLowerCase() !== 'bayar transport') return false;

  let adaTarikh = false;
  let adaProduk = false;
  let adaTotalLine = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!adaTarikh && isTarikhValid(line)) adaTarikh = true;
    if (!adaProduk && line.includes('|') && /rm\s?\d+/.test(line.toLowerCase())) adaProduk = true;
    if (!adaTotalLine && /total.*rm\s?\d+/i.test(line)) adaTotalLine = true;
  }

  if (!adaTarikh || !adaProduk || !adaTotalLine) return false;

  const kiraTotal = calculateTotalHargaFromList(lines);
  const totalLine = extractTotalLineAmount(lines);

  return totalLine !== null && Math.abs(kiraTotal - totalLine) < 0.01;
}

function validateBayarKomisenFormat(caption) {
  const lines = caption.trim().split('\n').map(x => x.trim()).filter(x => x !== '');
  if (lines.length < 4) return false;
  if (lines[0] !== 'BAYAR KOMISEN') return false;

  let adaTarikh = false;
  let adaNama = false;
  let adaHarga = false;
  let adaBank = false;

  const hargaPattern = /^rm\s?\d+(\.\d{2})?$/i;
  const bankKeywords = ['cimb', 'maybank', 'bank islam', 'rhb', 'bsn', 'ambank', 'public bank', 'bank rakyat', 'affin', 'hsbc', 'uob'];

  for (let line of lines) {
    const lower = line.toLowerCase();
    if (!adaTarikh && isTarikhValid(line)) adaTarikh = true;
    if (!adaNama && line.split(' ').length >= 1 && !lower.includes('rm') && !lower.includes('bank')) adaNama = true;
    if (!adaHarga && hargaPattern.test(line)) adaHarga = true;
    if (!adaBank && bankKeywords.some(b => lower.includes(b))) adaBank = true;
  }

  return adaTarikh && adaNama && adaHarga && adaBank;
}

// --- Fungsi SMART: Dapatkan jumlah dari baris ada perkataan "total", fallback ambil paling tinggi ---
function getJumlahDariBarisTotalOnly(ocrText) {
  const lines = ocrText.toLowerCase().split('\n');
  for (let line of lines) {
    if (line.includes('total') && /rm\s?\d+/.test(line)) {
      const match = line.match(/rm\s?(\d+(\.\d{2})?)/i);
      if (match) return parseFloat(match[1]);
    }
  }
  return null;
}

function getFallbackJumlahOCR(ocrText) {
  const pattern = /rm\s?(\d+(\.\d{2})?)/gi;
  let match;
  const amounts = [];
  while ((match = pattern.exec(ocrText.toLowerCase())) !== null) {
    amounts.push(parseFloat(match[1]));
  }
  return amounts.length ? Math.max(...amounts) : null;
}

function getJumlahOCRSmart(ocrText) {
  const totalLine = getJumlahDariBarisTotalOnly(ocrText);
  if (totalLine !== null) return totalLine;
  return getFallbackJumlahOCR(ocrText);
}
