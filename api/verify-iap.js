// api/verify-iap.js
// iOSアプリ内課金(StoreKit2 / @capgo/native-purchases)のトランザクションをApple公式ライブラリで検証し、
// Firestoreのpremium状態に反映する。Guideline 3.1.1(アプリ内課金)対応。

const jwt = require('jsonwebtoken');
const {
  SignedDataVerifier,
  Environment,
  VerificationException,
} = require('@apple/app-store-server-library');

// Apple Root CA証明書(PEM)。ファイルI/Oに依存させずコードに直接埋め込むことで
// Vercelのゼロコンフィグ関数検出(functions.includeFiles不要)を確実に通す。
// 出典: https://www.apple.com/certificateauthority/
const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

// Apple Inc. Root Certificate(旧世代チェーン用。念のため両方を検証器に渡す)
const APPLE_INC_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIIEuzCCA6OgAwIBAgIBAjANBgkqhkiG9w0BAQUFADBiMQswCQYDVQQGEwJVUzET
MBEGA1UEChMKQXBwbGUgSW5jLjEmMCQGA1UECxMdQXBwbGUgQ2VydGlmaWNhdGlv
biBBdXRob3JpdHkxFjAUBgNVBAMTDUFwcGxlIFJvb3QgQ0EwHhcNMDYwNDI1MjE0
MDM2WhcNMzUwMjA5MjE0MDM2WjBiMQswCQYDVQQGEwJVUzETMBEGA1UEChMKQXBw
bGUgSW5jLjEmMCQGA1UECxMdQXBwbGUgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkx
FjAUBgNVBAMTDUFwcGxlIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAw
ggEKAoIBAQDkkakJH5HbHkdQ6wXtXnmELes2oldMVeyLGYne+Uts9QerIjAC6Bg+
+FAJ039BqJj50cpmnCRrEdCju+QbKsMflZ56DKRHi1vUFjczy8QPTc4UadHJGXL1
XQ7Vf1+b8iUDulWPTV0N8WQ1IxVLFVkds5T39pyez1C6wVhQZ48ItCD3y6wsIG9w
tj8BMIy3Q88PnT3zK0koGsj+zrW5DtleHNbLPbU6rfQPDgCSC7EhFi501TwN22IW
q6NxkkdTVcGvL0Gz+PvjcM3mo0xFfh9Ma1CWQYnEdGILEINBhzOKgbEwWOxaBDKM
aLOPHd5lc/9nXmW8Sdh2nzMUZaF3lMktAgMBAAGjggF6MIIBdjAOBgNVHQ8BAf8E
BAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUK9BpR5R2Cf70a40uQKb3
R01/CF4wHwYDVR0jBBgwFoAUK9BpR5R2Cf70a40uQKb3R01/CF4wggERBgNVHSAE
ggEIMIIBBDCCAQAGCSqGSIb3Y2QFATCB8jAqBggrBgEFBQcCARYeaHR0cHM6Ly93
d3cuYXBwbGUuY29tL2FwcGxlY2EvMIHDBggrBgEFBQcCAjCBthqBs1JlbGlhbmNl
IG9uIHRoaXMgY2VydGlmaWNhdGUgYnkgYW55IHBhcnR5IGFzc3VtZXMgYWNjZXB0
YW5jZSBvZiB0aGUgdGhlbiBhcHBsaWNhYmxlIHN0YW5kYXJkIHRlcm1zIGFuZCBj
b25kaXRpb25zIG9mIHVzZSwgY2VydGlmaWNhdGUgcG9saWN5IGFuZCBjZXJ0aWZp
Y2F0aW9uIHByYWN0aWNlIHN0YXRlbWVudHMuMA0GCSqGSIb3DQEBBQUAA4IBAQBc
NplMLXi37Yyb3PN3m/J20ncwT8EfhYOFG5k9RzfyqZtAjizUsZAS2L70c5vu0mQP
y3lPNNiiPvl4/2vIB+x9OYOLUyDTOMSxv5pPCmv/K/xZpwUJfBdAVhEedNO3iyM7
R6PVbyTi69G3cN8PReEnyvFteO3ntRcXqNx+IjXKJdXZD9Zr1KIkIxH3oayPc4Fg
xhtbCS+SsvhESPBgOJ4V9T0mZyCKM2r3DYLP3uujL/lTaltkwGMzd/c6ByxW69oP
IQ7aunMZT7XZNn/Bh1XZp5m5MkL72NVxnn6hUrcbvZNCJBIqxw8dtk2cXmPIS4AX
UKqK1drk/NAJBzewdXUh
-----END CERTIFICATE-----`;

const BUNDLE_ID = 'com.nihongoreal.app';
// App Store ConnectのApp情報ページに表示される数値のApple ID(本番環境の検証で必須)
const APP_APPLE_ID = 6793001947;

// 製品ID → プラン のマッピング(クライアントの自己申告は信用せず、検証済みのproductIdから逆引きする)
const PRODUCT_ID_TO_PLAN = {
  'com.nihongoreal.app.sub.ume': 'ume',
  'com.nihongoreal.app.sub.take': 'take',
  'com.nihongoreal.app.sub.matsu': 'matsu',
};
const PLAN_RANK = { ume: 1, semi: 1, take: 2, full: 2, matsu: 3 };

let admin;
let db;
function initFirebase() {
  if (db) return;
  admin = require('firebase-admin');
  if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    privateKey = privateKey.replace(/\\n/g, '\n');
    if (!privateKey.includes('\n')) {
      privateKey = privateKey
        .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
        .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  db = admin.firestore();
}

let _rootCAsCache = null;
function loadRootCAs() {
  if (_rootCAsCache) return _rootCAsCache;
  _rootCAsCache = [
    Buffer.from(APPLE_ROOT_CA_G3_PEM),
    Buffer.from(APPLE_INC_ROOT_PEM),
  ];
  return _rootCAsCache;
}

async function verifyTransaction(jwsRepresentation) {
  const appleRootCAs = loadRootCAs();

  // 署名検証の前に平文デコードしてenvironment(Production/Sandbox)を判定する
  // (最終的な信頼性はverifyAndDecodeTransactionの署名検証で担保されるので、ここは選別のみ)
  const unsafeDecoded = jwt.decode(jwsRepresentation);
  const isProduction = unsafeDecoded && unsafeDecoded.environment === 'Production';
  const environment = isProduction ? Environment.PRODUCTION : Environment.SANDBOX;

  const verifier = new SignedDataVerifier(
    appleRootCAs,
    true, // enableOnlineChecks
    environment,
    BUNDLE_ID,
    isProduction ? APP_APPLE_ID : undefined
  );

  return verifier.verifyAndDecodeTransaction(jwsRepresentation);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    initFirebase();

    // Firebase IDトークンで認証(クライアント申告のuidは信用しない)
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ success: false, error: 'missing_id_token' });

    let uid;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (e) {
      return res.status(401).json({ success: false, error: 'invalid_id_token' });
    }

    const { jwsRepresentation } = req.body || {};
    if (!jwsRepresentation) {
      return res.status(400).json({ success: false, error: 'jwsRepresentation is required' });
    }

    let transaction;
    try {
      transaction = await verifyTransaction(jwsRepresentation);
    } catch (e) {
      console.error('IAP verification failed:', e instanceof VerificationException ? e.status : e);
      return res.status(400).json({ success: false, error: 'verification_failed' });
    }

    const plan = PRODUCT_ID_TO_PLAN[transaction.productId];
    if (!plan) {
      console.error('Unknown productId in verified transaction:', transaction.productId);
      return res.status(400).json({ success: false, error: 'unknown_product' });
    }

    const now = Date.now();
    const isRevoked = !!transaction.revocationDate;
    const isExpired = !!transaction.expiresDate && transaction.expiresDate < now;
    const isActive = !isRevoked && !isExpired;

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    const existing = snap.exists ? snap.data() : {};
    const existingRank = PLAN_RANK[existing.premiumPlan] || 0;
    const newRank = PLAN_RANK[plan] || 0;
    // 既存プランより低いランクで上書きしない(ダウングレード防止)。非アクティブなら解除。
    const finalPlan = isActive ? (newRank >= existingRank ? plan : existing.premiumPlan) : existing.premiumPlan;

    const updateData = {
      premium: isActive,
      premiumPlan: finalPlan,
      plan: 'ios_iap',
      platform: 'ios',
      iapProductId: transaction.productId,
      iapTransactionId: transaction.transactionId,
      iapOriginalTransactionId: transaction.originalTransactionId,
      iapExpiresDate: transaction.expiresDate ? new Date(transaction.expiresDate).toISOString() : null,
      iapEnvironment: transaction.environment || null,
      iapLastVerifiedAt: new Date().toISOString(),
    };
    if (isActive && !existing.premiumSince) {
      updateData.premiumSince = new Date().toISOString();
    }

    await userRef.set(updateData, { merge: true });

    return res.status(200).json({
      success: true,
      plan: finalPlan,
      active: isActive,
      expiresDate: updateData.iapExpiresDate,
    });
  } catch (error) {
    console.error('verify-iap error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
