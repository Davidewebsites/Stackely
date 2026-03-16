import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MAINTENANCE_MODE } from '@/lib/maintenance';
import Index from './pages/Index';
import Results from './pages/Results';
import ToolDetail from './pages/ToolDetail';
import CategoryPage from './pages/CategoryPage';
import GoalPage from './pages/GoalPage';
import SharedStack from './pages/SharedStack';
import Admin from './pages/Admin';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Cookies from './pages/Cookies';
import Maintenance from './pages/Maintenance';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import NotFound from './pages/NotFound';
import CookieConsent from './components/CookieConsent';

const queryClient = new QueryClient();

const App = () => {
  if (MAINTENANCE_MODE) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Maintenance />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/results" element={<Results />} />
            <Route path="/tools/:slug" element={<ToolDetail />} />
            <Route path="/categories/:category" element={<CategoryPage />} />
            <Route path="/goals/:goal" element={<GoalPage />} />
            <Route path="/stack/:stackId" element={<SharedStack />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/error" element={<AuthError />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;