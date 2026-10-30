import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Privacy · SHRAVAN' };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="30 October 2026">
      <p>
        SHRAVAN (“Listen. Reflect. Apply.”) is an app by AAYAMIK that teaches books through spoken lessons. This page explains, in plain words, what we collect, why, and the choices you have.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Your account:</b> your email address and, if you sign in with Google, your name. We never see your Google password.</li>
        <li><b>Your learning:</b> the books you open, your progress, your settings (view, language, level), answers you write in Reflect (your journal), your actions and plans, and questions you ask about a chapter.</li>
        <li><b>Books you upload:</b> the file and the text taken from it, so we can make your lessons. Your uploads are private to you.</li>
        <li><b>Notifications:</b> if you allow them, a technical address so we can send notices to your phone.</li>
        <li><b>Payments:</b> when subscriptions are open, payments are handled by Razorpay. We receive the result (paid or not), never your card details.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To sign you in, show your books and progress, and make and play your lessons.</li>
        <li>To make lessons, the text of the chapter you are learning is sent to an AI service (Anthropic’s Claude). To make the narrator’s voice, the lesson text is sent to a voice service (Sarvam). Your name and email are not sent with it.</li>
        <li>To send sign-in codes and notices you asked for.</li>
        <li>To keep the service safe and to understand overall usage and costs (counts only).</li>
      </ul>
      <p>
        <b>Your journal is private.</b> No one at SHRAVAN reads your Reflect answers, actions or plans, and they are never used to make lessons for anyone else. We do not sell your data and we do not show advertising.
      </p>

      <h2>Who helps us run SHRAVAN</h2>
      <p>
        Supabase (accounts and database), Vercel (hosting), Cloudflare (storing files and audio), Anthropic (AI lessons), Sarvam (narrator voice), Google (sign-in and email delivery) and, for subscriptions, Razorpay. They process data only to provide their service to us.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and learning data while your account is open. Lessons and narration made from library books are shared by everyone and are not linked to you. You can delete your journal at any time in Account. To delete your whole account and everything linked to it, including your uploads, write to us using the contact below; we will do it within 30 days.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>See and change your settings in Account.</li>
        <li>Delete your journal in Account.</li>
        <li>Turn phone notifications on or off.</li>
        <li>Ask us for a copy of your data, a correction, or deletion of your account.</li>
      </ul>

      <h2>Age</h2>
      <p>SHRAVAN is meant for adults. Anyone under 18 should use it only with a parent’s or guardian’s consent.</p>

      <h2>Contact</h2>
      <p>AAYAMIK, India. For privacy questions or deletion requests, write to the support email shown in the app’s Account page or on the AAYAMIK website.</p>
    </LegalPage>
  );
}
