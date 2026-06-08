// api/create-checkout.js
// Stripe 決済セッションを作成するVercel Function

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, email, plan } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const siteUrl = process.env.SITE_URL || 'https://itsuki07122509.github.io/nihongo-app';

    // プランに応じた価格IDを選択
    const priceId = plan === 'yearly'
      ? process.env.STRIPE_PRICE_YEARLY   // 年額 1,490,000₫
      : process.env.STRIPE_PRICE_MONTHLY; // 月額 149,000₫

    // Stripe Checkout セッション作成
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      // ユーザー情報をメタデータに保存（Webhookで使う）
      metadata: {
        userId: userId,
        plan: plan || 'monthly',
      },
      customer_email: email || undefined,
      // 決済完了後のリダイレクト先
      success_url: `${siteUrl}/NihonGo_App.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/NihonGo_App.html?payment=cancelled`,
      // サブスクリプション設定
      subscription_data: {
        metadata: {
          userId: userId,
        },
        // 7日間の無料トライアル（オプション）
        // trial_period_days: 7,
      },
    });

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message });
  }
};
