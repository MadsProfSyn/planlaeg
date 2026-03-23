import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { AppLayout } from "./components/AppLayout";
import Auth from "./pages/Auth";
import Inspections from "./pages/Inspections";
import Scheduled from "./pages/Scheduled";
import Availability from "./pages/Availability";
import UnavailableConsultants from "./pages/UnavailableConsultants";
import Inspectors from "./pages/Inspectors";
import ProfSynAI from "./pages/ProfSynAI";
import PlanlaegSyn from "./pages/PlanlaegSyn";
import AlleSyn from "./pages/AlleSyn";
import Account from "./pages/admin/Account";
import Users from "./pages/admin/Users";
import SynVariabler from "./pages/admin/SynVariabler";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import { ErrorBoundary } from "@/components/utility/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => {
  return (
    <ErrorBoundary name="App Root">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/inspections" element={<ProtectedRoute><AppLayout><Inspections /></AppLayout></ProtectedRoute>} />
                <Route path="/scheduled" element={<ProtectedRoute><AppLayout><Scheduled /></AppLayout></ProtectedRoute>} />
                <Route path="/alle-syn" element={<ProtectedRoute><AppLayout><AlleSyn /></AppLayout></ProtectedRoute>} />
                <Route path="/availability" element={<ProtectedRoute><AppLayout><Availability /></AppLayout></ProtectedRoute>} />
                <Route path="/unavailable-consultants" element={<ProtectedRoute><AppLayout><UnavailableConsultants /></AppLayout></ProtectedRoute>} />
                <Route path="/inspectors" element={<ProtectedRoute><AppLayout><Inspectors /></AppLayout></ProtectedRoute>} />
                <Route path="/profsyn-ai" element={<ProtectedRoute><AppLayout><ProfSynAI /></AppLayout></ProtectedRoute>} />
                <Route path="/planlaeg-syn" element={<ProtectedRoute><AppLayout><PlanlaegSyn /></AppLayout></ProtectedRoute>} />
                
                {/* Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute><AppLayout><Navigate to="/admin/account" replace /></AppLayout></ProtectedRoute>} />
                <Route path="/admin/account" element={<ProtectedRoute><AppLayout><Account /></AppLayout></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><AdminRoute><AppLayout><Users /></AppLayout></AdminRoute></ProtectedRoute>} />
                <Route path="/admin/syn-variabler" element={<ProtectedRoute><AdminRoute><AppLayout><SynVariabler /></AppLayout></AdminRoute></ProtectedRoute>} />
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
