require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const documentRoutes = require('./routes/documents');
const publicRoutes = require('./routes/public');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

const storagePath = process.env.STORAGE_PATH || './uploads';
app.use('/uploads', express.static(path.resolve(storagePath)));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/public', publicRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// Serve frontend in production
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
