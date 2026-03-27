const fs = require('fs');

const files = [
  'src/components/Points.js',
  'src/app/page.js',
  'src/components/SwapBox.js',
];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const updated = content
    .replace(/TEMPO Points/g, 'TSWAP Points')
    .replace(/\$TEMPO\b/g, '$TSWAP');
  fs.writeFileSync(file, updated, 'utf8');
  console.log('✓ Updated:', file);
});

console.log('All done!');
