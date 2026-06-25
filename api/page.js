const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('<pre>Failed to load page: ' + err.message + '\ncwd: ' + process.cwd() + '</pre>');
  }
};
