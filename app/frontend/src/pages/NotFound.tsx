import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { usePageSeo } from '@/lib/seo';

export default function NotFound() {
  const navigate = useNavigate();

  usePageSeo({
    title: 'Page not found - Stackely',
    description: 'This page is not available.',
    canonicalPath: '/404',
    robots: 'noindex',
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
      <p className="text-lg text-slate-600 mb-8">Page not found</p>
      <Button onClick={() => navigate('/')} className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
        <Home className="w-4 h-4 mr-2" />
        Go Home
      </Button>
    </div>
  );
}