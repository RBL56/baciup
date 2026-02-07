const fs = require('fs');
const path = require('path');
const indexPath = path.join('node_modules', '@deriv', 'quill-icons', 'dist', 'cjs', 'react', 'LabelPaired', 'index.js');
try {
    const content = fs.readFileSync(indexPath, 'utf8');
    const matches = content.match(/LabelPaired[A-Z][a-zA-Z0-9]+Icon/g);
    if (!matches) {
        console.log('No icons found.');
    } else {
        const uniqueIcons = [...new Set(matches)];
        const robotIcons = uniqueIcons.filter(name => name.toLowerCase().includes('robot'));
        const botIcons = uniqueIcons.filter(name => name.toLowerCase().includes('bot'));
        console.log('Robot Icons:', robotIcons);
        console.log('Bot Icons:', botIcons);
        console.log('Total Icons Found:', uniqueIcons.length);
        console.log('Sample Icons:', uniqueIcons.slice(0, 10));
    }
} catch (e) {
    console.error('Error reading index file:', e.message);
}
