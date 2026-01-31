/**
 * SERVER.JS - Backend API for Payment Gateway
 * Features:
 * 1. PromptPay QR Generation (Mockup)
 * 2. TrueMoney Gift Link Redemption (Direct API)
 * 3. Email Receipt Sending (Nodemailer)
 * 4. In-Memory Database (Transaction History)
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// Middleware Setup
app.use(cors());
app.use(bodyParser.json());

// ==========================================
// 💽 DATABASE & CONFIG
// ==========================================
let transactions = []; // Store transactions in memory

// Config Email Sender (Gmail หรือ SMTP)
// *** สำคัญ: ต้องไปเปิด App Password ใน Google Account ก่อนนำมาใส่ ***
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: '30260@student.act.ac.th', // <--- แก้ตรงนี้
        pass: 'Act@30260'     // <--- แก้ตรงนี้
    }
});

// ==========================================
// 📧 EMAIL TEMPLATE GENERATOR
// ==========================================
const getEmailTemplate = (data) => {
    return `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; }
  .header { background: #002060; padding: 20px; text-align: center; color: white; }
  .content { padding: 30px; }
  .table-details { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .table-details td { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
  .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h2>Transaction Receipt</h2>
        <p>${data.date}</p>
    </div>
    <div class="content">
        <p>Dear <strong>${data.customerName || 'Customer'}</strong>,</p>
        <p>You made a payment of <strong>${data.amount} THB</strong> to <strong>${data.merchant}</strong></p>
        
        <div style="background:#f0f4f8; padding:15px; border-radius:5px; margin:15px 0;">
            <strong>Merchant:</strong> ${data.merchant}
        </div>

        <h3>Transaction Details</h3>
        <table class="table-details">
            <tr><td>Invoice Number:</td><td align="right">${data.invoiceNo}</td></tr>
            <tr><td>Transaction Reference:</td><td align="right">${data.txId}</td></tr>
            <tr><td>Transaction Date/Time:</td><td align="right">${data.date}</td></tr>
            <tr><td>Paid via:</td><td align="right">${data.method}</td></tr>
            <tr><td>Approval Code:</td><td align="right">${data.approvalCode}</td></tr>
        </table>

        <table width="100%" style="margin-top:20px;">
            <tr>
                <td><strong>Description</strong></td>
                <td align="right"><strong>Amount</strong></td>
            </tr>
            <tr>
                <td style="padding:10px 0; border-bottom:1px solid #ccc;">Payment for Goods/Services</td>
                <td align="right" style="padding:10px 0; border-bottom:1px solid #ccc;">${data.amount} THB</td>
            </tr>
            <tr>
                <td style="padding-top:10px;"><strong>Total</strong></td>
                <td align="right" style="padding-top:10px; color:#002060; font-size:18px;"><strong>${data.amount} THB</strong></td>
            </tr>
        </table>

        <div style="margin-top:30px; padding-top:20px; border-top:1px solid #eee;">
            <p style="font-size:12px; color:#666;">For further information and assistance please contact:</p>
            <p><strong>${data.merchant}</strong><br>Tel: 08X-XXX-XXXX<br>Email: support@bungkii.com</p>
        </div>
    </div>
    <div class="footer">
        Please do not reply to this email.<br>
        Copyright © Bungkii | www.bungkii.com
    </div>
</div>
</body>
</html>
    `;
};

// ==========================================
// 🚀 API ENDPOINTS
// ==========================================

// 1. Create PromptPay Transaction
app.post('/api/create-payment', (req, res) => {
    const { amount, merchantName, email } = req.body;
    const transactionId = 'TXN-' + Date.now();
    
    // Create new transaction record
    const newTx = {
        id: transactionId,
        type: 'PromptPay',
        amount: parseFloat(amount).toFixed(2),
        merchant: merchantName || 'Unknown Shop',
        email: email || '-',
        status: 'pending',
        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
    };
    
    transactions.unshift(newTx); // Add to top of list
    console.log(`[New Order] ID: ${transactionId} | Amount: ${amount}`);

    res.json({
        success: true,
        transactionId: transactionId,
        promptpayId: '0925384159' // Default fallback ID
    });
});

// 2. Check Payment Status (Simulation)
app.post('/api/check-status', (req, res) => {
    const { transactionId } = req.body;
    const tx = transactions.find(t => t.id === transactionId);

    if (!tx) return res.status(404).json({ success: false });

    // Simulate Success Logic (50/50 Chance)
    if (tx.status === 'completed') {
        return res.json({ status: 'completed' });
    }

    const isSuccess = Math.random() > 0.5;
    if (isSuccess) {
        tx.status = 'completed';
        
        // Send Email if completed
        if (tx.email && tx.email.includes('@')) {
            sendReceipt(tx);
        }
        
        return res.json({ status: 'completed' });
    } else {
        return res.json({ status: 'pending' });
    }
});

// 3. Redeem TrueMoney Gift Link
app.post('/api/redeem-angpao', async (req, res) => {
    const { link, mobile, email } = req.body;

    if (!link || !mobile || !link.includes('gift.truemoney.com')) {
        return res.status(400).json({ success: false, message: 'Invalid Link' });
    }

    try {
        const voucherCode = link.split('v=')[1].split('&')[0];
        
        // Call TrueMoney API
        const response = await axios.post('https://gift.truemoney.com/campaign/v1/redeem', {
            mobile: mobile,
            voucher_hash: voucherCode
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const result = response.data;

        if (result.status.code === 'SUCCESS') {
            const amount = result.data.my_ticket.amount_baht;
            const sender = result.data.owner_profile.full_name;
            const txId = 'TMN-' + Date.now();

            const newTx = {
                id: txId,
                type: 'TrueMoney',
                amount: parseFloat(amount).toFixed(2),
                merchant: `Gift from ${sender}`,
                email: email || '-',
                status: 'completed',
                timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
            };
            
            transactions.unshift(newTx);

            // Send Email
            if (email && email.includes('@')) {
                sendReceipt(newTx);
            }

            return res.json({ success: true, transactionId: txId, amount: amount });
        } else {
            return res.json({ success: false, message: result.status.message });
        }
    } catch (error) {
        console.error('TMN Error:', error.message);
        return res.json({ success: false, message: 'Link Invalid or Expired' });
    }
});

// 4. Get History
app.get('/api/history', (req, res) => {
    res.json(transactions);
});

// Helper: Send Email Function
async function sendReceipt(tx) {
    const html = getEmailTemplate({
        date: tx.timestamp,
        customerName: tx.email.split('@')[0],
        amount: tx.amount,
        merchant: 'Bungkii Shop', // Or tx.merchant
        invoiceNo: tx.id.replace('TXN-', 'INV-'),
        txId: tx.id,
        method: tx.type === 'TrueMoney' ? 'TrueMoney Gift' : 'EMV QR',
        approvalCode: Math.floor(100000 + Math.random() * 900000)
    });

    try {
        await transporter.sendMail({
            from: '"Bungkii Payment" <noreply@bungkii.com>',
            to: tx.email,
            subject: `Receipt for your payment ${tx.id}`,
            html: html
        });
        console.log(`📧 Email sent to ${tx.email}`);
    } catch (err) {
        console.error('Email Failed:', err);
    }
}

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
