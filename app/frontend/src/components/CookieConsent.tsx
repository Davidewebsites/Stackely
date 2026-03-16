import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'stackely_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash immediately on load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Cookie className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-slate-600 leading-relaxed">
              This website uses cookies and analytics to improve the experience.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to="/cookies"
              className="text-[13px] text-slate-500 hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              Learn more
            </Link>
            <Button
              onClick={handleAccept}
              size="sm"
              className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium shadow-none"
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}