const { parseBuffer } = require('music-metadata');

const BENGALI_TO_LATIN = {
  'অ': 'a', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
  'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n', '্': '', '়': '', 'য়': 'oy',
  'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng', 'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n', 'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
  'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n', 'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm', 'য': 'y', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ক্ষ': 'kkh'
};

function transliterateBengali(value) {
  return String(value || '').replace(/ক্ষ|য়|[অ-হড়ঢ়য়ৎংঃঁািীুূৃেৈোৌ়্]/g, character => BENGALI_TO_LATIN[character] || character);
}

function englishLabel(value, fallback = 'Unknown agent') {
  const transliterated = transliterateBengali(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = transliterated.replace(/[^A-Za-z0-9._ -]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.split(' ').map(word => /^[a-z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word).join(' ') : fallback;
}

function agentLabelFromReport(name, reportText) {
  const text = String(reportText || '');
  const spoken = text.match(/(?:student\s+advisor|স্টুডেন্ট\s*অ্যাডভাইজার)\s+([A-Za-zঀ-৳][A-Za-zঀ-৳ .'-]{1,60}?)(?:\s+(?:বলছি|speaking|here|বলতেছি)|[,.])/i);
  return englishLabel(spoken?.[1] || name);
}

async function readAudioDurationSeconds(file) {
  try {
    const metadata = await parseBuffer(Buffer.from(file.data, 'base64'), { mimeType: file.mimeType, path: file.name }, { duration: true });
    const duration = Number(metadata?.format?.duration);
    return Number.isFinite(duration) && duration > 0 ? Number(duration.toFixed(1)) : null;
  } catch {
    return null;
  }
}

async function enrichAudioDurations(files) {
  return Promise.all(files.map(async file => {
    const parsed = await readAudioDurationSeconds(file);
    const fallback = Number(file.durationSeconds);
    return { ...file, durationSeconds: parsed ?? (Number.isFinite(fallback) && fallback > 0 ? Number(fallback.toFixed(1)) : null) };
  }));
}

module.exports = { englishLabel, agentLabelFromReport, readAudioDurationSeconds, enrichAudioDurations };
