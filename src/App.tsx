import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import Index from "./pages/Index";
import Inspections from "./pages/Inspections";
import Scheduled from "./pages/Scheduled";
import Availability from "./pages/Availability";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route 
            path="/inspections" 
            element={
              <AppLayout>
                <Inspections />
              </AppLayout>
            } 
          />
          <Route 
            path="/scheduled" 
            element={
              <AppLayout>
                <Scheduled />
              </AppLayout>
            } 
          />
          <Route 
            path="/availability" 
            element={
              <AppLayout>
                <Availability />
              </AppLayout>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
