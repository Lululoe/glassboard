const fs = require('fs');
const path = require('path');

function getFiles(dir, files_) {
  files_ = files_ || [];
  const files = fs.readdirSync(dir);
  for (let i in files) {
    const name = dir + '/' + files[i];
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files_);
    } else if (name.endsWith('.js') || name.endsWith('.jsx')) {
      files_.push(name);
    }
  }
  return files_;
}

const allFiles = [...getFiles('src'), ...getFiles('server')];
let needsDocs = [];

for (let file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Simple check: how many function declarations vs how many /**
  const functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>|export\s+(?:default\s+)?(?:function|const)/g) || []).length;
  const jsdocs = (content.match(/\/\*\*/g) || []).length;
  
  if (functions > jsdocs) {
    needsDocs.push({ file, functions, jsdocs });
  }
}

console.log(JSON.stringify(needsDocs, null, 2));
