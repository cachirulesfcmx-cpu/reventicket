import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "sonner";
import Layout from "./components/layout";
import Home from "./pages/home";
import Search from "./pages/search";
import EventDetails from "./pages/event-details";
import Checkout from "./pages/checkout";
import Login from "./pages/login";
import Sell from "./pages/sell";
import Wallet from "./pages/wallet";
import Admin from "./pages/admin";
import AdminLogin from "./pages/admin-login";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={Admin} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/search" component={Search} />
              <Route path="/events/:id" component={EventDetails} />
              <Route path="/checkout/:ticketId" component={Checkout} />
              <Route path="/login" component={Login} />
              <Route path="/sell" component={Sell} />
              <Route path="/wallet" component={Wallet} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
      <Toaster theme="dark" position="top-center" />
    </QueryClientProvider>
  );
}
