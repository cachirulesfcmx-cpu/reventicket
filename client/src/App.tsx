import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useEffect, Suspense, lazy } from "react";
import { Layout } from "./components/layout";
import { AdminRoute } from "@/components/admin-route";
import { InstallPrompt } from "@/components/install-prompt";
import { SkeletonShimmer } from "@/components/skeleton-shimmer";
import { OfflineIndicator } from "@/components/offline-indicator";

function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
}

// Eager loaded pages (critical path)
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";

// Lazy loaded pages (code splitting)
const EventDetails = lazy(() => import("@/pages/event-details"));
const Checkout = lazy(() => import("@/pages/checkout"));
const Admin = lazy(() => import("@/pages/admin"));
const Search = lazy(() => import("@/pages/search"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const About = lazy(() => import("@/pages/about"));
const HelpCenter = lazy(() => import("@/pages/help-center"));
const Sell = lazy(() => import("@/pages/sell"));
const Payments = lazy(() => import("@/pages/payments"));
const MapViewer = lazy(() => import("@/pages/map-viewer"));
const Wallet = lazy(() => import("@/pages/wallet"));
const Scanner = lazy(() => import("@/pages/scanner"));
const AnalyticsDashboard = lazy(() => import("@/pages/analytics-dashboard"));

// Loading fallback component with shimmer
function PageLoader() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <SkeletonShimmer className="h-12 w-1/3 mb-6" />
        <div className="space-y-4">
          <SkeletonShimmer className="h-64 w-full" />
          <div className="grid md:grid-cols-3 gap-4">
            <SkeletonShimmer className="h-48" />
            <SkeletonShimmer className="h-48" />
            <SkeletonShimmer className="h-48" />
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Protected Admin Page
function ProtectedAdmin() {
  return (
    <AdminRoute>
      <Admin />
    </AdminRoute>
  );
}

// Profile Page
function Profile() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading font-bold mb-6">Mi Perfil</h1>
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-2">
            <div className="p-4 bg-muted/20 rounded-lg font-bold">Mis Boletos</div>
            <div className="p-4 hover:bg-muted/20 rounded-lg cursor-pointer">Historial</div>
            <div className="p-4 hover:bg-muted/20 rounded-lg cursor-pointer">Configuración</div>
          </div>
          <div className="md:col-span-3">
            <div className="p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
              <p>Aún no tienes boletos comprados.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/portal-admin/login" component={AdminLogin} />
        <Route path="/event/:id" component={EventDetails} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/profile" component={Profile} />
        <Route path="/portal-admin/dashboard" component={ProtectedAdmin} />
        <Route path="/category/:cat" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/help" component={HelpCenter} />
        <Route path="/sell" component={Sell} />
        <Route path="/payments" component={Payments} />
        <Route path="/map-viewer" component={MapViewer} />
        <Route path="/wallet" component={Wallet} />
        <Route path="/portal-admin/scanner" component={Scanner} />
        <Route path="/portal-admin/analytics" component={AnalyticsDashboard} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ScrollToTop />
        <Toaster />
        <OfflineIndicator />
        <Router />
        <InstallPrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
