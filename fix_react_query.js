const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        try {
            let stat = fs.statSync(dirPath);
            if (stat.isDirectory()) {
                walkDir(dirPath, callback);
            } else {
                callback(dirPath);
            }
        } catch (e) {
            // Ignore EPERM
        }
    });
}

walkDir('./frontend/src', function (filePath) {
    if (filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content.replace(/queryClient\.invalidateQueries\(\[([^\]]+)\]\)/g, 'queryClient.invalidateQueries({ queryKey: [$1] })');
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Fixed ' + filePath);
        }
    }
});
