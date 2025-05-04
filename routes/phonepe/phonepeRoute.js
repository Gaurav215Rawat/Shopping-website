const {newPayment, checkStatus} = require('../../controller/paymentController');
const express = require('express');
const router = express.Router();

router.post('/payment', newPayment);
router.post('/status/:txnId', checkStatus);

module.exports = router;