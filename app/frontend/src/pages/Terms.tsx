import { Link } from 'react-router-dom';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';

export default function Terms() {
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
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <Link to="/">
            <StackelyLogo size="sm" />
          </Link>
          <nav className="flex items-center gap-5" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-8 py-20">
        <h1 className="text-[36px] font-bold text-slate-900 tracking-tight mb-2">Terms of Service</h1>
        <p className="text-[14px] text-slate-400 mb-12">Last updated: March 10, 2026</p>

        <div className="space-y-10 text-[15px] text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Stackely, you accept and agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use the site.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">2. Service Description</h2>
            <p>
              Stackely is an informational platform that provides automated recommendations of software
              tools. Recommendations are generated using AI-assisted algorithms and are provided for
              informational purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">3. No Guarantees</h2>
            <p>
              Stackely does not guarantee that any recommended tool is suitable for your specific needs,
              business, or situation. Tool recommendations are based on general criteria and may not
              account for all individual requirements. Users are responsible for independently evaluating
              any tools before using or purchasing them.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">4. User Responsibility</h2>
            <p>
              You acknowledge that you are solely responsible for evaluating and selecting tools for your
              use. Stackely is not liable for any decisions made based on the recommendations provided.
              You should conduct your own research and due diligence before committing to any tool or
              service.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">5. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, Stackely and its operators shall not be
              liable for any indirect, incidental, special, consequential, or punitive damages, or any
              loss of profits or revenues, whether incurred directly or indirectly, or any loss of data,
              use, goodwill, or other intangible losses resulting from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">6. Third-Party Links</h2>
            <p>
              Stackely contains links to third-party websites and tools. These links are provided for
              convenience and informational purposes only. Stackely does not endorse, control, or assume
              responsibility for the content, privacy policies, or practices of any third-party sites.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">7. Intellectual Property</h2>
            <p>
              All product names, logos, and brands mentioned on Stackely are property of their respective
              owners. Use of these names, logos, and brands does not imply endorsement.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">8. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. Changes will be posted
              on this page with an updated revision date. Continued use of the site after changes
              constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold text-slate-900 mb-3">9. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at{' '}
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