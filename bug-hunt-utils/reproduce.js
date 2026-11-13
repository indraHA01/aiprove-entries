// reproduce.js — run every suspected bug against utils.js and print
// actual vs expected. Exit 0 only if every listed bug reproduces.
const u = require('./utils.js');
const cases = [
  // --- HIGH confidence: factorial drops the final factor (i < n) ---
  { fn: 'factorial', args: [5],  expected: 120,  note: '5! = 120' },
  { fn: 'factorial', args: [2],  expected: 2,    note: '2! = 2' },
  { fn: 'factorial', args: [10], expected: 3628800, note: '10! = 3628800' },
  // --- HIGH confidence: countVowels misses uppercase vowels ---
  { fn: 'countVowels', args: ['AEIOU'], expected: 5, note: 'all 5 vowels, uppercase' },
  { fn: 'countVowels', args: ['Apple'], expected: 2, note: 'A + e' },
  { fn: 'countVowels', args: ['HELLO WORLD'], expected: 3, note: 'E, O, O' },
  // --- MEDIUM: titleCase capitalises the letter after an apostrophe ---
  { fn: 'titleCase', args: ["don't stop"], expected: "Don't Stop", note: "apostrophe is not a word boundary for title case" },
  { fn: 'titleCase', args: ["it's a test"], expected: "It's A Test", note: "same apostrophe issue" },
  // --- MEDIUM: reverse() splits surrogate pairs (astral chars / emoji) ---
  { fn: 'reverse', args: ['\u{1F600}a'], expected: 'a\u{1F600}', note: 'emoji must survive reversal as one unit' },
];
let reproduced = 0, notReproduced = 0;
for (const c of cases) {
  const actual = u[c.fn](...c.args);
  const ok = Object.is(actual, c.expected);
  const status = ok ? 'NOT A BUG (matches expected)' : 'BUG REPRODUCED';
  if (!ok) reproduced++; else notReproduced++;
  console.log(`${status} | ${c.fn}(${c.args.map(a => JSON.stringify(a)).join(', ')})`);
  console.log(`   actual:   ${JSON.stringify(actual)}`);
  console.log(`   expected: ${JSON.stringify(c.expected)}   // ${c.note}`);
}
// --- sanity: functions that look correct must stay correct ---
const sane = [
  { fn: 'sum', args: [[1, 2, 3]], expected: 6 },
  { fn: 'max', args: [[3, 1, 4]], expected: 4 },
  { fn: 'reverse', args: ['abc'], expected: 'cba' },
  { fn: 'isPalindrome', args: ['racecar'], expected: true },
  { fn: 'isPalindrome', args: ['hello'], expected: false },
  { fn: 'clamp', args: [5, 0, 10], expected: 5 },
  { fn: 'clamp', args: [-1, 0, 10], expected: 0 },
  { fn: 'clamp', args: [15, 0, 10], expected: 10 },
  { fn: 'unique', args: [[1, 1, 2, 3, 3]], expected: [1, 2, 3] },
  { fn: 'average', args: [[1, 2, 3]], expected: 2 },
  { fn: 'titleCase', args: ['hello world'], expected: 'Hello World' },
  { fn: 'countVowels', args: ['hello'], expected: 2 },
  { fn: 'factorial', args: [0], expected: 1 },
  { fn: 'factorial', args: [1], expected: 1 },
];
let saneFail = 0;
for (const c of sane) {
  const actual = u[c.fn](...c.args);
  const ok = JSON.stringify(actual) === JSON.stringify(c.expected);
  if (!ok) { saneFail++; console.log(`SANITY FAIL | ${c.fn}(${JSON.stringify(c.args)}) = ${JSON.stringify(actual)}, want ${JSON.stringify(c.expected)}`); }
}
console.log(`\nbugs reproduced: ${reproduced}/${cases.length} | sanity failures on correct fns: ${saneFail}`);
process.exit(reproduced === cases.length && saneFail === 0 ? 0 : 1);
