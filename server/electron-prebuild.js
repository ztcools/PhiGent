const fs = require('fs');
const path = require('path');
// 将 IS_ELECTRON 替换为 yes，因为 axios 使用相对 URL
const envConfig = path.join(__dirname, './build/env-config.js');
fs.readFile(envConfig, 'utf8', function (err, files) {
  const result = files.replace(/{{IS_ELECTRON}}/g, 'yes');
  fs.writeFile(envConfig, result, 'utf8', function (err) {
    if (err) {
      console.log(err);
    }
  });
});
