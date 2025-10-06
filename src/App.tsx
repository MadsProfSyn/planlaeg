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
import AdminLayout from "./pages/admin/AdminLayout";
import Overview from "./pages/admin/Overview";
import Account from "./pages/admin/Account";
import MySyn from "./pages/admin/MySyn";
import Users from "./pages/admin/Users";
import NotFound from "./pages/NotFound";
import { useActivityHeartbeat } from "@/hooks/useActivityHeartbeat";

const queryClient = new QueryClient();

const App = () => {
  useActivityHeartbeat();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route path="/inspections" element={<ProtectedRoute><AppLayout><Inspections /></AppLayout></ProtectedRoute>} />
              <Route path="/scheduled" element={<ProtectedRoute><AppLayout><Scheduled /></AppLayout></ProtectedRoute>} />
              <Route path="/availability" element={<ProtectedRoute><AppLayout><Availability /></AppLayout></ProtectedRoute>} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/admin/overview" replace />} />
                <Route path="overview" element={<Overview />} />
                <Route path="account" element={<Account />} />
                <Route path="my-syn" element={<MySyn />} />
                <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
              </Route>
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
