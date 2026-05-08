import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Download, ShoppingCart, X } from 'lucide-react';

interface CartItem {
  id: string;
  label: string;
  price: number;
}

interface MapCartPanelProps {
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onExportJson: () => void;
  onCheckout: () => void;
  isCheckingOut?: boolean;
}

export function MapCartPanel({
  items,
  onRemoveItem,
  onClearCart,
  onExportJson,
  onCheckout,
  isCheckingOut = false
}: MapCartPanelProps) {
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="h-5 w-5" />
          Zonas Seleccionadas
          {items.length > 0 && (
            <span className="ml-auto bg-primary text-white text-xs px-2 py-1 rounded-full">
              {items.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-center p-4">
            <div>
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Haz clic en las zonas del mapa para seleccionarlas</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
                  data-testid={`cart-item-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">
                      ${item.price.toLocaleString()}
                    </span>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`remove-item-${item.id}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">${total.toLocaleString()} MXN</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearCart}
                  className="w-full"
                  data-testid="clear-cart"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Vaciar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportJson}
                  className="w-full"
                  data-testid="export-json"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
              
              <Button
                onClick={onCheckout}
                disabled={isCheckingOut}
                className="w-full"
                size="lg"
                data-testid="checkout-button"
              >
                {isCheckingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Continuar al Checkout
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
