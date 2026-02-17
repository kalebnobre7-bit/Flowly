
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
const jsPath = path.join(__dirname, 'js/app.js');

const htmlContent = fs.readFileSync(filePath, 'utf-8');

// Find the script tag that starts at line 195 (around)
// We look for <script> after line 180...
const lines = htmlContent.split('\n');

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '<script>' && i > 180) {
        startIndex = i;
        break;
    }
}

for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '</script>') {
        endIndex = i;
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    // Extract JS content
    const jsContent = lines.slice(startIndex + 1, endIndex).join('\n');

    // Write JS file
    fs.mkdirSync(path.dirname(jsPath), { recursive: true });
    fs.writeFileSync(jsPath, jsContent);

    // Replace script tag in HTML
    const newHtmlLines = [
        ...lines.slice(0, startIndex),
        '    <script type="module" src="js/app.js"></script>',
        ...lines.slice(endIndex + 1)
    ];

    fs.writeFileSync(filePath, newHtmlLines.join('\n'));

    console.log(`Extracted JS from lines ${startIndex + 1} to ${endIndex + 1} into js/app.js`);
} else {
    console.error('Could not find script block');
}
