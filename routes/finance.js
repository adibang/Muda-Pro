const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// Admin only: generate journal, pay, create kas
router.post('/journal/sales', authorizeRole('admin'), financeController.generateSalesJournal);
router.post('/piutang/pay', authorizeRole('admin'), financeController.payPiutang);
router.post('/hutang/pay', authorizeRole('admin'), financeController.payHutang);
router.post('/kas', authorizeRole('admin'), financeController.createKas);

// Read: admin only
router.get('/trial-balance', authorizeRole('admin'), financeController.trialBalance);
router.get('/income-statement', authorizeRole('admin'), financeController.incomeStatement);
router.get('/piutang', authorizeRole('admin'), financeController.listPiutang);
router.get('/hutang', authorizeRole('admin'), financeController.listHutang);
router.get('/general-ledger', authorizeRole('admin'), financeController.generalLedger);
router.get('/balance-sheet', authorizeRole('admin'), financeController.balanceSheet);
router.get('/cash-flow', authorizeRole('admin'), financeController.cashFlow);
router.get('/kartu-piutang', authorizeRole('admin'), financeController.kartuPiutang);
router.get('/kartu-hutang', authorizeRole('admin'), financeController.kartuHutang);

module.exports = router;