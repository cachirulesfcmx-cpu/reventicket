import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { SkeletonShimmer } from "@/components/skeleton-shimmer";
import { Users, ShoppingCart, DollarSign, TrendingUp, BarChart3, Eye } from "lucide-react";
import { motion } from "framer-motion";

interface OverviewData {
  dau: number;
  wau: number;
  totalOrdersWeek: number;
  paidOrdersWeek: number;
  revenueWeek: number;
}

interface FunnelStep {
  step: string;
  count: number;
}

interface TopEvent {
  eventId: string;
  views: number;
  event?: { title: string; image: string };
}

export default function AnalyticsDashboard() {
  const { data: overview, isLoading: loadingOverview } = useQuery<OverviewData>({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/enterprise/admin/analytics/overview');
      return res.json();
    },
  });

  const { data: funnelData, isLoading: loadingFunnel } = useQuery<{ funnel: FunnelStep[] }>({
    queryKey: ['analytics-funnel'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/enterprise/admin/analytics/funnel?range=7');
      return res.json();
    },
  });

  const { data: topEvents, isLoading: loadingTop } = useQuery<TopEvent[]>({
    queryKey: ['analytics-top-events'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/enterprise/admin/analytics/top-events?range=7');
      return res.json();
    },
  });

  const stepLabels: Record<string, string> = {
    view_home: 'Visitas Home',
    view_event: 'Vistas Evento',
    add_to_cart: 'Agregar Carrito',
    checkout_start: 'Inicio Checkout',
    order_created: 'Orden Creada',
    payment_confirmed: 'Pago Confirmado',
  };

  return (
    <Layout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2" data-testid="analytics-title">
          <BarChart3 className="h-7 w-7" />
          Analytics Dashboard
        </h1>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {loadingOverview ? (
            <>
              <SkeletonShimmer className="h-24 rounded-xl" />
              <SkeletonShimmer className="h-24 rounded-xl" />
              <SkeletonShimmer className="h-24 rounded-xl" />
              <SkeletonShimmer className="h-24 rounded-xl" />
            </>
          ) : overview && (
            <>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Users className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">DAU</p>
                        <p className="text-xl font-bold">{overview.dau}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Users className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">WAU</p>
                        <p className="text-xl font-bold">{overview.wau}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <ShoppingCart className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Órdenes (7d)</p>
                        <p className="text-xl font-bold">{overview.paidOrdersWeek}/{overview.totalOrdersWeek}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-lg">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue (7d)</p>
                        <p className="text-xl font-bold">${Number(overview.revenueWeek || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Funnel de Conversión (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFunnel ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <SkeletonShimmer key={i} className="h-10 rounded" />
                ))}
              </div>
            ) : funnelData?.funnel && (
              <div className="space-y-3">
                {funnelData.funnel.map((step, index) => {
                  const maxCount = Math.max(...funnelData.funnel.map(s => s.count));
                  const percentage = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
                  const prevCount = index > 0 ? funnelData.funnel[index - 1].count : step.count;
                  const dropoff = prevCount > 0 ? ((prevCount - step.count) / prevCount * 100).toFixed(1) : 0;

                  return (
                    <motion.div
                      key={step.step}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{stepLabels[step.step] || step.step}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{step.count}</span>
                          {index > 0 && Number(dropoff) > 0 && (
                            <span className="text-xs text-red-500">-{dropoff}%</span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Top Eventos (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTop ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <SkeletonShimmer key={i} className="h-12 rounded" />
                ))}
              </div>
            ) : topEvents && topEvents.length > 0 ? (
              <div className="space-y-3">
                {topEvents.slice(0, 10).map((item, index) => (
                  <motion.div
                    key={item.eventId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.event?.title || item.eventId}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold">{item.views}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sin datos de eventos</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
