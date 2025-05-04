const crypto = require('crypto');
const axios = require('axios');
const { pool } = require('../config/dbconfig');
require('dotenv').config();

const merchant_id = process.env.PHONEPE_MERCHANT_ID;
const salt_key = process.env.PHONEPE_SALT_KEY;

const newPayment = async (req, res) => {
  try {
    const merchantTransactionId = req.body.transactionId;
    const amount = req.body.amount;

    // Optional: Check order exists with this transactionId

    const data = {
      merchantId: merchant_id,
      merchantTransactionId,
      merchantUserId: req.body.MUID,
      name: req.body.name,
      amount: amount * 100,
      redirectUrl: `http://localhost:5000/api/status/${merchantTransactionId}`,
      redirectMode: 'POST',
      mobileNumber: req.body.number,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const payload = JSON.stringify(data);
    const payloadMain = Buffer.from(payload).toString('base64');
    const keyIndex = 1;
    const string = payloadMain + '/pg/v1/pay' + salt_key;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + '###' + keyIndex;

    const prod_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';
    const options = {
      method: 'POST',
      url: prod_URL,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'X-VERIFY': checksum
      },
      data: {
        request: payloadMain
      }
    };

    const response = await axios.request(options);
    return res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ success: false, message: error.message });
  }
};

const checkStatus = async (req, res) => {
  try {
    const merchantTransactionId = req.params.txnId;

    const keyIndex = 1;
    const path = `/pg/v1/status/${merchant_id}/${merchantTransactionId}`;
    const string = path + salt_key;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + '###' + keyIndex;

    const options = {
      method: 'GET',
      url: `https://api.phonepe.com/apis/hermes${path}`,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': merchant_id
      }
    };

    const response = await axios.request(options);

    const status = response.data.data.status;

    await pool.query(
      `UPDATE payments SET status = $1 WHERE transaction_id = $2`,
      [status.toLowerCase(), merchantTransactionId]
    );

    await pool.query(
      `UPDATE orders SET status = $1 WHERE phonepe_order_id = $2`,
      [status.toLowerCase(), merchantTransactionId]
    );

    if (response.data.success && status === 'SUCCESS') {
      return res.redirect(`http://localhost:3000/status?txn=${merchantTransactionId}&success=true`);
    } else {
      return res.redirect(`http://localhost:3000/status?txn=${merchantTransactionId}&success=false`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send({ success: false, message: error.message });
  }
};

module.exports = {
  newPayment,
  checkStatus
};
