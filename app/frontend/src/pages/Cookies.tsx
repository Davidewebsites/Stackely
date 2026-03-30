import { Link } from 'react-router-dom';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';

export default function Cookies() {
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
        <h1 className="text-[36px] font-bold text-slate-900 tracking-tight mb-2">Cookie Policy</h1>
        <p className="text-[14px] text-slate-400 mb-12">Last updated: March 10, 2026</p>

        <div className="space-y-10 text-[15px] text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">1. What Are Cookies</h2>
            <p>
              Cookies are small text files that are stored on your device when you visit a website. They
              are widely used to make websites work more efficiently and to provide information to the
              owners of the site.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">2. Cookies We Use</h2>
            <div className="space-y-5">
              <div>
                <h3 className="text-[16px] font-medium text-slate-800 mb-1.5">Google Analytics Cookies</h3>
                <p>
                  We use Google Analytics to collect anonymous information about how visitors use our site.
                  Google Analytics uses cookies such as <code className="text-[13px] bg-slate-100 px-1.5 py-0.5 rounded">_ga</code> and{' '}
                  <code className="text-[13px] bg-slate-100 px-1.5 py-0.5 rounded">_gid</code> to distinguish
                  unique users and throttle request rates. These cookies do not collect personal information.
                </p>
              </div>
              <div>
                <h3 className="text-[16px] font-medium text-slate-800 mb-1.5">Cookie Consent</h3>
                <p>
                  We store a <code className="text-[13px] bg-slate-100 px-1.5 py-0.5 rounded">stackely_cookie_consent</code> value
                  in your browser's local storage to remember whether you have accepted our cookie notice.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">3. Local Storage</h2>
            <div className="space-y-5">
              <div>
                <h3 className="text-[16px] font-medium text-slate-800 mb-1.5">Visitor ID</h3>
                <p>
                  Stackely stores a randomly generated visitor ID in your browser's local storage. This
                  ID is used to distinguish visits and improve the quality of tool recommendations. It
                  does not contain any personal information and cannot be used to identify you personally.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">4. How to Manage Cookies</h2>
            <p className="mb-3">
              Most web browsers allow you to control cookies through their settings. You can usually find
              these settings in the "Options" or "Preferences" menu of your browser. You can:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Delete all cookies from your browser</li>
              <li>Block all cookies from being set</li>
              <li>Allow all cookies to be set</li>
              <li>Block third-party cookies</li>
              <li>Clear all cookies when you close the browser</li>
            </ul>
            <p className="mt-3">
              Please note that disabling cookies may affect the functionality of this and other websites
              you visit.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">5. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time. Any changes will be posted on this
              page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">6. Contact</h2>
            <p>
              If you have any questions about our use of cookies, please contact us at{' '}
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
