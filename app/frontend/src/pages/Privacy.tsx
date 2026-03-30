import { Link } from 'react-router-dom';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Subtle atmosphere */}
      <div
        className="pointer-events-none fixed top-[-150px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-[0.035]"
        style={{ background: 'radial-gradient(circle, #2F80ED 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-[-150px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-[0.025]"
        style={{ background: 'radial-gradient(circle, #8A2BE2 0%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="border-b border-[#2F80ED]/20 bg-white/92 backdrop-blur-sm sticky top-0 z-50 shadow-[0_2px_18px_rgba(79,70,229,0.08)]">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <Link to="/">
            <StackelyLogo size="sm" showText={false} />
          </Link>
          <nav className="flex items-center gap-5" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-8 py-20">
        <h1 className="text-[36px] font-bold text-slate-900 tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-[14px] text-slate-400 mb-12">Last updated: March 10, 2026</p>

        <div className="space-y-10 text-[15px] text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">1. Information We Collect</h2>
            <p>
              Stackely collects anonymous usage data such as pages visited and search queries entered.
              A random visitor ID may be stored locally in your browser to help analyze usage patterns.
              No personal accounts or personal data are required to use Stackely.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">2. Analytics</h2>
            <p>
              We use Google Analytics to understand how visitors use the site. Google Analytics collects
              information such as how often users visit the site, what pages they visit, and what other
              sites they used prior to coming to this site. We use the information we get from Google
              Analytics only to improve this site. Google Analytics collects the IP address assigned to
              you on the date you visit the site, rather than your name or other identifying information.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">3. Local Storage</h2>
            <p>
              Stackely stores a randomly generated visitor ID in your browser's local storage. This ID
              is used solely to distinguish visits and improve the quality of recommendations. It does
              not contain any personal information and cannot be used to identify you.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">4. External Links</h2>
            <p>
              Stackely may link to third-party tools and websites. We are not responsible for the
              privacy practices or the content of those external sites. We encourage you to read the
              privacy policies of any third-party sites you visit.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">5. Data Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your information to outside parties. The
              anonymous analytics data collected is used exclusively to improve Stackely's services
              and user experience.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">6. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this
              page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">7. Contact</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:stackelyofficial@gmail.com" className="hover:underline" style={{ color: '#2F80ED' }}>
                stackelyofficial@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
