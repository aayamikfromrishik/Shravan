import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Terms · SHRAVAN' };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="30 October 2026">
      <p>These terms apply when you use SHRAVAN, an app by AAYAMIK. By using SHRAVAN you agree to them.</p>

      <h2>What SHRAVAN is</h2>
      <p>
        SHRAVAN explains books in short spoken lessons, asks reflection questions and helps you turn ideas into actions. Lessons are written with the help of AI from the text of each chapter, and checked so that anything presented as the author’s words matches the book. Even so, mistakes can happen: lessons are a learning aid, not a replacement for the book or for professional advice. Use “Report a problem” on any lesson that looks wrong.
      </p>

      <h2>Books and copyright</h2>
      <ul>
        <li>The library holds books that are free of copyright, books we have permission to use, and books whose authors allow it. Modern books are marked “bring your own copy”.</li>
        <li>You may upload only books you own or are allowed to use, for your <b>personal study</b>. Your uploads stay private to your account. You are responsible for the files you upload.</li>
        <li>SHRAVAN gives summaries and commentary, not copies of books. Do not use SHRAVAN to copy or share books.</li>
      </ul>

      <h2>Free use and Premium</h2>
      <p>
        Free use includes the free part of chapter 1 of a limited number of books. Premium (when available) unlocks full books and features such as offline listening. Prices, billing period and renewal are shown before you pay; payments are handled by Razorpay. Some features have fair-use limits so the service stays available for everyone.
      </p>

      <h2>Your account</h2>
      <p>Keep your sign-in secure. Do not misuse the service, try to break it, or use it for anything unlawful. We may suspend accounts that do.</p>

      <h2>Changes and availability</h2>
      <p>We are improving SHRAVAN all the time and may change or remove features. We will tell you about important changes to these terms in the app.</p>

      <h2>Limits of responsibility</h2>
      <p>SHRAVAN is provided as it is. To the extent the law allows, AAYAMIK is not responsible for indirect losses arising from use of the app.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>Contact</h2>
      <p>AAYAMIK, India: write to the support email shown in the app’s Account page or on the AAYAMIK website.</p>
    </LegalPage>
  );
}
