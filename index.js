require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const { db, initDatabase } = require('./config/database');
const initSalesTables = require('./config/initSalesTables');
const initProductUnits = require('./config/initProductUnits');
const initConfigTables = require('./config/initConfigTables');
const initPricingTables = require('./config/initPricingTables');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware global
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Sajikan file statis dari folder public (frontend)
// app.use(express.static(path.join(__dirname, 'public')));

async function start() {
  // Inisialisasi database dan tabel
  await initDatabase();
  initSalesTables();
  initProductUnits();
  initConfigTables();
  initPricingTables();

  // API Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/kategori', require('./routes/kategori'));
  app.use('/api/satuan', require('./routes/satuan'));
  app.use('/api/gudang', require('./routes/gudang'));
  app.use('/api/customer', require('./routes/customer'));
  app.use('/api/supplier', require('./routes/supplier'));
  app.use('/api/produk', require('./routes/produk'));
  app.use('/api/sales', require('./routes/sales'));
  app.use('/api/pengaturan', require('./routes/pengaturan'));
  app.use('/api/pricing', require('./routes/pricing'));

  // Fallback SPA: untuk semua request non-API, kirim index.html
  app.use((req, res, next) => {
    // Jika request mengarah ke API, biarkan lanjut ke error handler standar
    if (req.path.startsWith('/api/')) {
      return next();
    }
    // Untuk request lainnya (frontend), kirim index.html
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  });

  // Jalankan server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});