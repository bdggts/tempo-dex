const fs = require('fs');
const file = 'src/config/web3.js';
let c = fs.readFileSync(file, 'utf8');
let count = 0;
const logos = ['USD', 'A$', 'B$', 'T$'];
c = c.replace(/logo:\s*'[^']+'/g, (match) => {
  const replacement = "logo: '" + (logos[count] || '?') + "'";
  count++;
  return replacement;
});
fs.writeFileSync(file, c, 'utf8');
console.log('Fixed ' + count + ' logos');
c.split('\n').filter(l => l.includes('logo:')).forEach(l => console.log(l.trim()));
