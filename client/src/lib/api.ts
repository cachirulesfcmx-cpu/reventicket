import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, invalidateIdempotencyKey } from "./csrf";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "buyer" | "admin";
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string | null;
  capacity: number | null;
  mapData: any;
  image: string | null;
}

export interface Event {
  id: string;
  title: string;
  category: string;
  date: string;
  venueId: string;
  image: string | null;
  minPrice: string | null;
  tags: string[];
  description: string | null;
}

export interface Zone {
  id: string;
  eventId: string;
  name: string;
  color: string | null;
  basePrice: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  zoneId: string;
  row: string;
  seat: string;
  price: string;
  sellerId: string | null;
  status: string;
}

export interface Order {
  id: string;
  userId: string;
  ticketId: string;
  totalAmount: string;
  fees: string;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
}

export function useAuth() {
  return useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const adminToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      return apiRequest("POST", "/api/auth/login", credentials);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: string;
    }) => {
      return apiRequest("POST", "/api/auth/register", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });
}

export function useEvents(category?: string) {
  const url = category ? `/api/events?category=${category}` : "/api/events";
  return useQuery<Event[]>({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar eventos");
      return res.json();
    },
  });
}

export function useEvent(id: string) {
  return useQuery<Event>({
    queryKey: [`/api/events/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/events/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar evento");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: Partial<Event>) => {
      return apiRequest("POST", "/api/events", event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });
}

export function useUpdateEvent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: Partial<Event>) => {
      return apiRequest("PATCH", `/api/events/${id}`, event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });
}

export function useVenues() {
  return useQuery<Venue[]>({
    queryKey: ["/api/venues"],
    queryFn: async () => {
      const res = await fetch("/api/venues", { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar recintos");
      return res.json();
    },
  });
}

export function useVenue(id: string) {
  return useQuery<Venue>({
    queryKey: [`/api/venues/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/venues/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar recinto");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useZones(eventId: string) {
  return useQuery<Zone[]>({
    queryKey: [`/api/events/${eventId}/zones`],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/zones`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar zonas");
      return res.json();
    },
    enabled: !!eventId,
  });
}

export function useTickets(eventId: string, available = true) {
  const url = `/api/events/${eventId}/tickets${available ? "?available=true" : ""}`;
  return useQuery<Ticket[]>({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar boletos");
      return res.json();
    },
    enabled: !!eventId,
  });
}

export interface TicketWithSection extends Ticket {
  section?: string;
}

export function useTicket(ticketId: string) {
  return useQuery<TicketWithSection>({
    queryKey: ["/api/tickets", ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar boleto");
      return res.json();
    },
    enabled: !!ticketId,
  });
}

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const adminToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch("/api/orders", {
        credentials: "include",
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      });
      if (!res.ok) throw new Error("Error al cargar órdenes");
      return res.json();
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderData: {
      ticketId?: string;
      zoneId?: string;
      eventId?: string;
      paymentMethod: string;
      phone?: string;
    }) => {
      return apiRequest("POST", "/api/orders", orderData, { useIdempotencyKey: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      invalidateIdempotencyKey();
    },
    onError: () => {
      invalidateIdempotencyKey();
    },
  });
}

export function useUpdateOrderStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
  });
}

export function useWhatsAppStatus() {
  return useQuery<{ isReady: boolean; qrCode: string | null; connected: boolean }>({
    queryKey: ["/api/whatsapp/status"],
    queryFn: async () => {
      const adminToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch("/api/whatsapp/status", {
        credentials: "include",
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      });
      if (!res.ok) throw new Error("Error al obtener estado de WhatsApp");
      return res.json();
    },
    refetchInterval: 3000,
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (venue: Partial<Venue>) => {
      return apiRequest("POST", "/api/venues", venue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
    },
  });
}

export function useUpdateVenue(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (venue: Partial<Venue>) => {
      return apiRequest("PATCH", `/api/venues/${id}`, venue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      queryClient.invalidateQueries({ queryKey: [`/api/venues/${id}`] });
    },
  });
}

export function useSendOTP() {
  return useMutation({
    mutationFn: async (phone: string) => {
      return apiRequest("POST", "/api/otp/send", { phone });
    },
  });
}

export function useVerifyOTP() {
  return useMutation({
    mutationFn: async (data: { phone: string; code: string }) => {
      return apiRequest("POST", "/api/otp/verify", data);
    },
  });
}

export function useCart() {
  return useMutation({
    mutationFn: async (cartData: {
      sessionId: string;
      ticketId?: string;
      eventId?: string;
      phone?: string;
    }) => {
      return apiRequest("POST", "/api/cart", cartData);
    },
  });
}

export function useUpdateCart(id: string) {
  return useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest("PATCH", `/api/cart/${id}`, updates);
    },
  });
}

export function useAdminOrders() {
  return useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/orders", { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar órdenes");
      return res.json();
    },
  });
}

export function useAdminCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest("POST", `/api/admin/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
    },
  });
}

export function useAdminConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest("POST", `/api/orders/${orderId}/confirm-payment`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
    },
  });
}

export function useCheckoutMap() {
  return useMutation({
    mutationFn: async (checkoutData: {
      items: any[];
      total: number;
      mapId: string;
    }) => {
      return apiRequest("POST", "/api/checkout-map", checkoutData);
    },
  });
}

export { apiRequest };
