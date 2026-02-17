const fs = require('fs');
try {
    let html = fs.readFileSync('index.html', 'utf8');
    // Regex para capturar <style>...</style> e substituir
    // Usando [\s\S]*? para pegar multiline content non-greedy
    const regex = /<style>[\s\S]*?<\/style>/;
    
    if (regex.test(html)) {
        const newHtml = html.replace(regex, '<link rel="stylesheet" href="styles.css">');
        fs.writeFileSync('index.html', newHtml);
        console.log('Successfully replaced <style> with <link>');
    } else {
        console.log('<style> tag not found');
    }
} catch (e) {
    console.error(e);
}
