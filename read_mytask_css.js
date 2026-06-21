const fs = require('fs');
const content = fs.readFileSync('public/styles.css', 'utf8');

const regex = /mytask-card|mytask-title|mytask/gi;
let match;
while ((match = regex.exec(content)) !== null) {
  const start = Math.max(0, match.index - 50);
  const end = Math.min(content.length, match.index + 50);
  console.log(`Match: "${match[0]}" at index ${match.index}:`);
  console.log(`   ...${content.slice(start, end).replace(/\n/g, ' ')}...`);
}
