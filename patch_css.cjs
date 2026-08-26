const fs = require('fs');

let content = fs.readFileSync('styles.css', 'utf8');

// Replace standard colors with CSS variables mapped to theme tokens
const replacements = [
  { search: /background:\s*#1e1e1e;/g, replace: "background: var(--theme-colors-background, #1e1e1e);" },
  { search: /color:\s*#d4d4d4;/g, replace: "color: var(--theme-colors-text, #d4d4d4);" },
  { search: /background:\s*#252526;/g, replace: "background: var(--theme-colors-surface, #252526);" },
  { search: /border-color:\s*#333;/g, replace: "border-color: var(--theme-colors-border, #333);" },
  { search: /background:\s*#094771;/g, replace: "background: var(--theme-colors-primary, #094771);" },
  { search: /color:\s*#569cd6;/g, replace: "color: var(--theme-colors-secondary, #569cd6);" }
];

let changed = false;
for (const {search, replace} of replacements) {
    if (search.test(content)) {
        content = content.replace(search, replace);
        changed = true;
    }
}

if (changed) {
    fs.writeFileSync('styles.css', content, 'utf8');
}
