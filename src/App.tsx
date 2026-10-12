import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { AppLayout } from "./components/AppLayout";
import Auth from "./pages/Auth";
import { ErrorBoundary } from "@/components/utility/ErrorBoundary";

const Scheduled = lazy(() => import("./pages/Scheduled"));
const Availability = lazy(() => import("./pages/Availability"));
const UnavailableConsultants = lazy(() => import("./pages/UnavailableConsultants"));
const Inspectors = lazy(() => import("./pages/Inspectors"));
const Systemstatus = lazy(() => import("./pages/Systemstatus"));
const ProfSynAI = lazy(() => import("./pages/ProfSynAI"));
const PlanlaegSyn = lazy(() => import("./pages/PlanlaegSyn"));
const AlleSyn = lazy(() => import("./pages/AlleSyn"));
const Account = lazy(() => import("./pages/admin/Account"));
const Users = lazy(() => import("./pages/admin/Users"));
const SynVariabler = lazy(() => import("./pages/admin/SynVariabler"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SetPassword = lazy(() => import("./pages/SetPassword"));

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

const PageFallback = () => (
  <div className="flex min-h-[50vh] w-full items-center justify-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    Indlæser…
  </div>
);

const App = () => {
  return (
    <ErrorBoundary name="App Root">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/set-password" element={<SetPassword />} />
                  <Route path="/inspections" element={<Navigate to="/planlaeg-syn" replace />} />
                  <Route path="/scheduled" element={<ProtectedRoute><AppLayout><Scheduled /></AppLayout></ProtectedRoute>} />
                  <Route path="/alle-syn" element={<ProtectedRoute><AppLayout><AlleSyn /></AppLayout></ProtectedRoute>} />
                  <Route path="/availability" element={<ProtectedRoute><AppLayout><Availability /></AppLayout></ProtectedRoute>} />
                  <Route path="/unavailable-consultants" element={<ProtectedRoute><AppLayout><UnavailableConsultants /></AppLayout></ProtectedRoute>} />
                  <Route path="/inspectors" element={<ProtectedRoute><AppLayout><Inspectors /></AppLayout></ProtectedRoute>} />
                  <Route path="/systemstatus" element={<ProtectedRoute><AppLayout><Systemstatus /></AppLayout></ProtectedRoute>} />
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
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
