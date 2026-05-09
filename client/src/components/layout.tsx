import { Link, useLocation } from "wouter";
import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomNav } from "./bottom-nav";

export function Layout({ children, hideNav = false }: { children: React.ReactNode; hideNav?: boolean }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          
          {/* Mobile Menu & Logo */}
          <div className="flex items-center gap-2 md:gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-foreground" data-testid="button-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-card border-border">
                <SheetHeader>
                  <SheetTitle className="font-heading text-primary text-2xl text-left">RevenTicket</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-8">
                  <Link href="/" className="text-lg font-medium hover:text-primary text-foreground" data-testid="link-menu-inicio">Inicio</Link>
                  <Link href="/search?category=Concert" className="text-lg font-medium hover:text-primary text-foreground" data-testid="link-menu-conciertos">Conciertos</Link>
                  <Link href="/search?category=Sports" className="text-lg font-medium hover:text-primary text-foreground" data-testid="link-menu-deportes">Deportes</Link>
                  <Link href="/search?category=Theater" className="text-lg font-medium hover:text-primary text-foreground" data-testid="link-menu-teatro">Teatro</Link>
                  <div className="border-t border-border my-4"></div>
                  <Link href="/login" className="text-lg font-medium hover:text-primary text-foreground" data-testid="link-menu-login">Iniciar Sesión</Link>
                </nav>
              </SheetContent>
            </Sheet>
            
            <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center transform -rotate-6">
                <span className="text-white font-heading font-bold text-lg">R</span>
              </div>
              <span className="font-heading font-bold text-xl tracking-tight text-foreground">RevenTicket</span>
            </Link>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar artista, evento o recinto..." 
              className="pl-9 bg-muted/50 border-border focus:bg-background transition-all"
              data-testid="input-search"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/login" data-testid="link-login">
              <Button variant="ghost" size="sm" className="text-foreground hover:text-primary">
                Iniciar sesión
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Footer (Desktop only) */}
      <footer className="border-t border-border py-12 bg-card/50 mt-12 hidden md:block">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-heading font-bold mb-4 text-foreground">RevenTicket</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-primary transition-colors" data-testid="link-footer-about">Sobre nosotros</Link></li>
              <li><Link href="/payments" className="hover:text-primary transition-colors" data-testid="link-footer-payments">Pagos y reembolsos</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading font-bold mb-4 text-foreground">Ayuda</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/help" className="hover:text-primary transition-colors" data-testid="link-footer-help">Centro de ayuda</Link></li>
              <li><Link href="/sell" className="hover:text-primary transition-colors" data-testid="link-footer-sell">Vender boletos</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading font-bold mb-4 text-foreground">Categorías</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/search?category=Concert" className="hover:text-primary transition-colors" data-testid="link-footer-conciertos">Conciertos</Link></li>
              <li><Link href="/search?category=Sports" className="hover:text-primary transition-colors" data-testid="link-footer-deportes">Deportes</Link></li>
              <li><Link href="/search?category=Theater" className="hover:text-primary transition-colors" data-testid="link-footer-teatro">Teatro</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading font-bold mb-4 text-foreground">Síguenos</h3>
            <div className="flex gap-4">
              <a href="https://wa.me/5215512345678" target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity" data-testid="link-footer-whatsapp">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          © 2026 RevenTicket. Todos los derechos reservados.
        </div>
      </footer>

      {/* Bottom Navigation (Mobile) */}
      {!hideNav && <BottomNav />}
    </div>
  );
}
