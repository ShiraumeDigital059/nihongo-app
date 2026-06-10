// api/cancel-subscription.js
// サブスクリプションをキャンセルする
 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
let admin, db;
 
function initFirebase() {
  if (db) return;
  if (!admin) {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }
  db = admin.firestore();
}
 
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
 
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
 
  try {
    initFirebase();
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
 
    const { stripeSubscriptionId } = doc.data();
    if (!stripeSubscriptionId) return res.status(400).json({ error: 'No subscription found' });
 
    // 期間終了時にキャンセル（今すぐ止めない）
    await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
 
    return res.status(200).json({ success: true, message: '期間終了時にキャンセルされます' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
