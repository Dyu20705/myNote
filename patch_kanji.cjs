const fs = require('fs');

let content = fs.readFileSync('kanji-ink.css', 'utf8');

const replacements = [
  { search: /stroke:\s*#d4d4d4;/g, replace: "stroke: var(--theme-colors-text, #d4d4d4);" },
  { search: /stroke:\s*#569cd6;/g, replace: "stroke: var(--theme-colors-primary, #569cd6);" }
];

let changed = false;
for (const {search, replace} of replacements) {
    if (search.test(content)) {
        content = content.replace(search, replace);
        changed = true;
    }
}

if (changed) {
    fs.writeFileSync('kanji-ink.css', content, 'utf8');
}
