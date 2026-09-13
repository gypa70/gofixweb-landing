import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import BlogRoutes from './blog-routes';
import Index from './pages/Index';
import { TermsPage, PrivacyPage, ReportIllegalPage } from './pages/LegalPage';

const queryClient = new QueryClient();

function RedirectPreserveHash({ to }: { to: string }) {
  return <Navigate to={{ pathname: to, hash: window.location.hash }} replace />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/vop" element={<TermsPage />} />
    <Route path="/ochrana-osobnich-udaju" element={<PrivacyPage />} />
    <Route path="/nahlasit-obsah" element={<ReportIllegalPage />} />
    <Route path="/terms.html" element={<RedirectPreserveHash to="/vop" />} />
    <Route path="/privacy.html" element={<RedirectPreserveHash to="/ochrana-osobnich-udaju" />} />
    <Route path="/blog/*" element={<BlogRoutes />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <ScrollToTop />
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };
