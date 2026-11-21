export function resolveFollowUp(value, visitDate) {
  if (typeof value !== 'string' || !value.trim() || !visitDate) return '';
  const raw = value.trim();
  const visit = new Date(visitDate);
  if (Number.isNaN(visit.getTime())) return '';
  const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1 };
  const quantity = '(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|\\d+)';
  const relative = new RegExp(`^(?:in\\s+)?${quantity}\\s+(day|week|month)s?$`, 'i').exec(raw)
    || new RegExp(`^after\\s+${quantity}\\s+(day|week|month)s?$`, 'i').exec(raw);
  if (relative) {
    const amount = numberWords[relative[1].toLowerCase()] || Number(relative[1]);
    const date = new Date(visit);
    if (relative[2].toLowerCase() === 'day') date.setDate(date.getDate() + amount);
    if (relative[2].toLowerCase() === 'week') date.setDate(date.getDate() + amount * 7);
    if (relative[2].toLowerCase() === 'month') date.setMonth(date.getMonth() + amount);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  const explicit = new Date(raw);
  return Number.isNaN(explicit.getTime()) ? '' : explicit.toISOString();
}

export function formatFollowUp(dateValue, originalValue, locale) {
  if (dateValue) {
    const date = new Date(dateValue);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString(locale);
  }
  return originalValue ? `${originalValue} — date not calculated` : '';
}

export function formatPatientAge(ageYears, ageMonths) {
  if (Number.isInteger(ageMonths) && ageMonths >= 0 && ageMonths < 12) return `${ageMonths} months`;
  if (Number.isInteger(ageYears) && ageYears >= 1 && ageYears <= 120) return String(ageYears);
  return '';
}

export function mentionsOverdueVaccination(transcript) {
  const sentences = String(transcript || '').toLocaleLowerCase().split(/[\n.!?;।]+/);
  return sentences.some((sentence) =>
    /vaccin|immuni|टीका|टिका|ಲಸಿಕೆ/.test(sentence)
    && /(last\s+week|previous\s+week|past\s+week|pichhle\s+hafte|pichle\s+hafte|पिछले\s+हफ़्ते|पिछले\s+हफ्ते|ಕಳೆದ\s+ವಾರ)/i.test(sentence)
    && /\bdue\b|\bmissed\b|\bpending\b|\boverdue\b|छूट|बाकी|ಬಾಕಿ|ತಡ/i.test(sentence)
  );
}
