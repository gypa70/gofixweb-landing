import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import BlogRoutes from './blog-routes';
import Index from './pages/Index';
import { TermsPage, PrivacyPage } from './pages/LegalPage';

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/vop" element={<TermsPage />} />
    <Route path="/ochrana-osobnich-udaju" element={<PrivacyPage />} />
    <Route path="/terms.html" element={<Navigate to="/vop" replace />} />
    <Route path="/privacy.html" element={<Navigate to="/ochrana-osobnich-udaju" replace />} />
    <Route path="/blog/*" element={<BlogRoutes />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };
