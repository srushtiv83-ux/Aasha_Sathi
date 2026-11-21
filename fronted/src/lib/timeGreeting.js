const TIME_ZONE = 'Asia/Kolkata';

function indiaTimeParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]));
}

export function getIndiaGreeting(date = new Date()) {
  const { hour } = indiaTimeParts(date);
  return hour >= 5 && hour < 12 ? 'Good Morning' : hour >= 12 && hour < 17 ? 'Good Afternoon' : 'Good Evening';
}

export function getIndiaGreetingKey(date = new Date()) {
  const greeting = getIndiaGreeting(date);
  return greeting === 'Good Morning' ? 'greeting_morning' : greeting === 'Good Afternoon' ? 'greeting_afternoon' : 'greeting_evening';
}

export function msUntilNextIndiaGreetingBoundary(date = new Date()) {
  const { hour, minute, second } = indiaTimeParts(date);
  const minutes = hour * 60 + minute;
  const boundaries = [5 * 60, 12 * 60, 17 * 60, 29 * 60];
  const next = boundaries.find((boundary) => boundary > minutes) ?? 29 * 60;
  return Math.max(1000, (next - minutes) * 60_000 - second * 1000);
}
