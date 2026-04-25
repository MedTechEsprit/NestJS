const axios = require('axios');

async function testWebhook() {
  try {
    const payload = {
      event: {
        id: 'test-001',
        type: 'INITIAL_PURCHASE',
        app_user_id: '65f1a2b3c4d5e6f7a8b9c0d1',
        original_app_user_id: '65f1a2b3c4d5e6f7a8b9c0d1',
        entitlement_ids: ['premium'],
        product_id: 'diabcare_premium_monthly',
        purchased_at_ms: 1714000000000,
        expiration_at_ms: 1716592000000,
      }
    };

    const response = await axios.post('http://localhost:3000/api/subscriptions/revenuecat/webhook', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer diabcare-rc-webhook-2026'
      }
    });
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testWebhook();
