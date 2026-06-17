const { Resend } = require('resend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, userName, userEmail, theme, date, sessionId } = req.body;
  const resend = new Resend(process.env.RESEND_API_KEY);

  let subject = '';
  let text = '';

  if(type === 'zoom'){
    subject = '【NihonGo!】新しいZoom登録がありました';
    text = '新しいZoom登録！\n\n名前：' + userName + '\nメール：' + userEmail + '\nテーマ：' + theme + '\n日程：' + date;
  } else if(type === 'new_user'){
    subject = '【NihonGo!】新規ユーザー登録がありました';
    text = '新規ユーザー登録！\n\n名前：' + userName + '\nメール：' + userEmail;
  } else if(type === 'premium'){
    subject = '【NihonGo!】新しいPremium登録がありました 🎉';
    text = 'Premium登録！\n\n名前：' + userName + '\nメール：' + userEmail;
  }

  try {
    await resend.emails.send({
      from: 'NihonGo! <onboarding@resend.dev>',
      to: 'nihongoapp.contact@gmail.com',
      subject: subject,
      text: text,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
