import { readFileSync } from 'node:fs';

const files = [
  'index.html',
  'app.js',
  'styles.css',
  'supabase-invite.js',
  'supabase-schedule-sync.js',
  'sw.js',
];

const brokenPatterns = [
  '�',
  '??/span>',
  '??/div>',
  '??/strong>',
  'ì',
  'ê',
];

const failures = [];

for (const file of files) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const pattern of brokenPatterns) {
    if (text.includes(pattern)) {
      failures.push(`${file}: broken text pattern detected: ${pattern}`);
    }
  }
}

const index = readFileSync('index.html', 'utf8');
if (!index.includes('<meta charset="UTF-8"')) {
  failures.push('index.html: missing UTF-8 charset');
}

if (!index.includes('<title>SHJJ Brief</title>')) {
  failures.push('index.html: production base title must be SHJJ Brief');
}

const forbiddenProductionLabels = ['Preview v4', 'Preview v', '검수본 v4'];
for (const label of forbiddenProductionLabels) {
  if (index.includes(label)) {
    failures.push(`index.html: forbidden production label detected: ${label}`);
  }
}

const weatherIndex = index.indexOf('id="weatherSection"');
const guideIndex = index.indexOf('id="guideSection"');
if (weatherIndex < 0 || guideIndex < 0 || weatherIndex > guideIndex) {
  failures.push('index.html: weatherSection must appear before guideSection');
}

if (!index.includes('id="scheduleSection"') || !index.includes('<details class="fold-card"')) {
  failures.push('index.html: schedule section must remain foldable, not deleted');
}

if (!index.includes('id="notificationTimeInput"')) {
  failures.push('index.html: notification time input is missing');
}

if (failures.length) {
  console.error('Static guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Static guard passed.');
