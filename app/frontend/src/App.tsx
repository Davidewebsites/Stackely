import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MAINTENANCE_MODE } from '@/lib/maintenance';
import { StackProvider } from '@/contexts/StackContext';
import { CompareProvider } from '@/contexts/CompareContext';
import StackDrawer from '@/components/StackDrawer';
import GlobalStackTrigger from '@/components/GlobalStackTrigger';
import CompareDrawer from '@/components/CompareDrawer';
import GlobalCompareTrigger from '@/components/GlobalCompareTrigger';
import Index from './pages/Index';
import Results from './pages/Results';
import ToolDetail from './pages/ToolDetail';
import CategoryPage from './pages/CategoryPage';
import GoalPage from './pages/GoalPage';
import Admin from './pages/Admin';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Cookies from './pages/Cookies';
import Maintenance from './pages/Maintenance';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import NotFound from './pages/NotFound';
import ViewStack from './pages/ViewStack';
import StackLeaderboard from './pages/StackLeaderboard';
import StackLibrary from './pages/StackLibrary';
import StackEntryLanding from './pages/StackEntryLanding';
import { LegacyDailyStackRedirect, LegacySharedStackRedirect } from './pages/StackRouteRedirects';
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
      <StackProvider>
        <CompareProvider>
          <TooltipProvider>
            <Toaster
              position="top-right"
              richColors
              closeButton
              visibleToasts={4}
              offset={{ top: 86, right: 20 }}
            />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/results" element={<Results />} />
                <Route path="/tools/:slug" element={<ToolDetail />} />
                <Route path="/categories/:category" element={<CategoryPage />} />
                <Route path="/goals/:goal" element={<GoalPage />} />
                <Route path="/stack/:stackId" element={<LegacySharedStackRedirect />} />
                <Route path="/daily-stack/:side" element={<LegacyDailyStackRedirect />} />
                <Route path="/view-stack/:id" element={<ViewStack />} />
                <Route path="/stack-leaderboard" element={<StackLeaderboard />} />
                <Route path="/stack-library" element={<StackLibrary />} />
                <Route path="/stacks/:entryType" element={<StackEntryLanding />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/cookies" element={<Cookies />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/error" element={<AuthError />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <GlobalCompareTrigger />
              <GlobalStackTrigger />
              <CookieConsent />
              <CompareDrawer />
              <StackDrawer />
            </BrowserRouter>
          </TooltipProvider>
        </CompareProvider>
      </StackProvider>
    </QueryClientProvider>
  );
};

export default App;