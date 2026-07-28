const express = require('express');
const path = require('path');

const app = express();
const ASSET_PATH = path.resolve(__dirname, '../assets/dummy-500k.bin');

// Simulate auth middleware (2ms delay)
const authMiddleware = async (req, res, next) => {
    await new Promise(r => setTimeout(r, 2));
    req.user = { id: 1, role: 'admin' };
    next();
};

app.get('/api/download', authMiddleware, (req, res) => {
    // Send 500KB file
    res.sendFile(ASSET_PATH);
});

const PORT = 8091;
app.listen(PORT, () => {
    console.log(`Express listening on port ${PORT}`);
});
