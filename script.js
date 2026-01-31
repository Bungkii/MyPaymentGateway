/**
 * Frontend Logic for Payment Gateway
 * Handles UI interactions, API calls, and State Management.
 */

// ==========================================
// 1. GLOBAL STATE & CONFIG
// ==========================================
let currentAmount = "1.00";
let promptpayID = "0925384159"; // Default Fallback
let currentTxId = null;

// Ensure this matches your server port
const API_URL = '/api';

// ==========================================
// 2. INITIALIZATION
// ==========================================
window.onload = function() {
    loadData();
};

function loadData() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // -- Handle Note --
    const paramNote = urlParams.get('note');
    const noteEl = document.getElementById('displayNote');
    if (paramNote && paramNote.trim() !== "") {
        noteEl.querySelector('span').innerText = paramNote;
        noteEl.classList.remove('hidden'); 
    }

    // -- Handle Merchant Name --
    const paramMerchant = urlParams.get('merchant');
    const storedName = localStorage.getItem('merchantName') || "My Shop";
    const finalMerchantName = paramMerchant || storedName;
    document.getElementById('displayMerchant').innerText = finalMerchantName;

    // -- Handle Amount --
    const rawAmount = urlParams.get('amount') || localStorage.getItem('amount') || "0";
    currentAmount = parseFloat(rawAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    // Update UI elements
    document.getElementById('displayAmount').innerText = currentAmount;
    document.getElementById('btnAmount').innerText = currentAmount;

    // -- Handle Config --
    if(localStorage.getItem('promptpayID')) {
        promptpayID = localStorage.getItem('promptpayID');
    }
}

// ==========================================
// 3. PROMPTPAY LOGIC
// ==========================================
async function generateQR() {
    // Basic Validation
    const email = document.getElementById('customerEmail').value;
    if (!validateEmail(email)) {
        alert('Please enter a valid email address first.');
        document.getElementById('customerEmail').focus();
        return;
    }

    const rawAmount = currentAmount.replace(/,/g, '');
    const merchantName = document.getElementById('displayMerchant').innerText;

    // UI Reset
    openModal('scan');
    
    // Show fallback QR immediately for UX
    document.getElementById("qrImage").src = `https://promptpay.io/${promptpayID}/${rawAmount}`;

    try {
        const response = await fetch(`${API_URL}/create-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: rawAmount, merchantName, email })
        });
        
        const data = await response.json();

        if (data.success) {
            currentTxId = data.transactionId;
            console.log("Transaction Created:", currentTxId);
            
            // If server returns a specific PromptPay ID, use it
            if(data.promptpayId) {
                 document.getElementById("qrImage").src = `https://promptpay.io/${data.promptpayId}/${rawAmount}`;
            }
        } else {
            alert('Failed to create transaction. Using offline QR.');
        }

    } catch (error) {
        console.error("Server Offline:", error);
        // Fallback continues to show the QR generated locally
    }
}

async function simulateCheckPayment() {
    if (!currentTxId) {
        alert("Offline Mode: Cannot check status from server.");
        return;
    }
    
    const overlay = document.getElementById('checkingOverlay');
    overlay.classList.remove('hidden'); 
    overlay.classList.add('flex');

    try {
        const response = await fetch(`${API_URL}/check-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: currentTxId })
        });

        const data = await response.json();

        // Artificial delay for better UX
        setTimeout(() => {
            if (data.status === 'completed') {
                showSuccessScreen("QR", currentTxId, currentAmount);
            } else {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
                alert('Server: Payment not yet received. Please try again.');
            }
        }, 1500);

    } catch (error) {
        overlay.classList.add('hidden');
        alert('Connection Error: Could not reach server.');
    }
}

// ==========================================
// 4. TRUEMONEY LOGIC
// ==========================================
async function payWithTrueMoney() {
    // Validation
    const email = document.getElementById('customerEmail').value;
    if (!validateEmail(email)) {
        alert('Please enter a valid email address first.');
        document.getElementById('customerEmail').focus();
        return;
    }

    const link = document.getElementById('angpaoLink').value;
    if (!link || !link.includes('gift.truemoney.com')) {
        alert('Please enter a valid TrueMoney Gift Link.');
        document.getElementById('angpaoLink').focus();
        return;
    }

    // Switch UI
    openModal('loading');

    try {
        const response = await fetch(`${API_URL}/redeem-angpao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                link: link, 
                mobile: promptpayID, 
                email: email 
            })
        });

        const data = await response.json();

        if (data.success) {
            const amountStr = parseFloat(data.amount).toLocaleString('en-US', {minimumFractionDigits: 2});
            showSuccessScreen("TRUEMONEY", data.transactionId, amountStr);
        } else {
            closeModal();
            alert('Payment Failed: ' + (data.message || 'Unknown Error'));
        }

    } catch (error) {
        closeModal();
        console.error(error);
        alert('Server Error: Could not process request.');
    }
}

// ==========================================
// 5. HELPER FUNCTIONS
// ==========================================

function openModal(viewName) {
    const modal = document.getElementById("qrModal");
    const scanView = document.getElementById("scanView");
    const loadingView = document.getElementById("loadingView");
    const successView = document.getElementById("successView");
    const overlay = document.getElementById('checkingOverlay');

    modal.classList.remove('hidden');
    
    // Reset all views
    scanView.classList.add('hidden');
    loadingView.classList.add('hidden');
    successView.classList.add('hidden');
    overlay.classList.add('hidden');

    // Show specific view
    if (viewName === 'scan') scanView.classList.remove('hidden');
    if (viewName === 'loading') loadingView.classList.remove('hidden');
    if (viewName === 'success') successView.classList.remove('hidden');
}

function showSuccessScreen(method, txId, amount) {
    openModal('success');

    const merchantName = document.getElementById('displayMerchant').innerText;
    document.getElementById('successMerchantName').innerText = merchantName;
    document.getElementById('receiptAmount').innerText = amount;
    document.getElementById('txId').innerText = txId;

    const badge = document.getElementById('receiptMethod');
    if (method === 'QR') {
        badge.innerText = 'QR PAYMENT';
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-600 uppercase';
    } else {
        badge.innerText = 'TMN GIFT';
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-600 uppercase';
    }
}

function closeModal() {
    document.getElementById("qrModal").classList.add('hidden');
    // Reset Input
    document.getElementById('angpaoLink').value = '';
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById("qrModal");
    if (event.target == modal) {
        closeModal();
    }

}

