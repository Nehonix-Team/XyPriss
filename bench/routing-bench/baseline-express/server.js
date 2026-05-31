const express = require('express');
const app = express();
const port = 8091;

app.get('/api/data', (req, res) => {
  res.json({ status: 'ok', message: 'Hello from Express', timestamp: Date.now() });
});

app.listen(port, () => {
  console.log(`Express listening on port ${port}`);
});
