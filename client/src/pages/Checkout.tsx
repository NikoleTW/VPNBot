import { useState, useEffect } from 'react';
import { useStripe, useElements, Elements, PaymentElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error("Missing Stripe public key (VITE_STRIPE_PUBLIC_KEY)");
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ amount }: { amount: number }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
    });

    if (error) {
      toast({
        title: "Ошибка оплаты",
        description: error.message || "Произошла ошибка при обработке платежа",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Платеж выполнен",
        description: "Спасибо за оплату!",
      });
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      <div className="pt-4">
        <Button 
          type="submit" 
          disabled={!stripe || isLoading} 
          className="w-full bg-[#2B5278] hover:bg-[#1F3C5C]"
        >
          {isLoading ? (
            <>
              <span className="inline-block animate-spin mr-1">⟳</span> Обработка...
            </>
          ) : (
            `Оплатить ${(amount / 100).toFixed(2)} ₽`
          )}
        </Button>
      </div>
    </form>
  );
};

const Checkout = () => {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // For demonstration, we'll use a fixed amount
  const amount = 1500; // 1500 rubles

  useEffect(() => {
    // Create PaymentIntent as soon as the page loads
    const createPaymentIntent = async () => {
      try {
        setIsLoading(true);
        const response = await apiRequest("POST", "/api/create-payment-intent", { amount });
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error("Error creating payment intent:", error);
        setError("Не удалось инициализировать платеж. Пожалуйста, попробуйте позже.");
        toast({
          title: "Ошибка",
          description: "Не удалось инициализировать платеж",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-[#2B5278] text-white">
          <CardTitle className="text-center">Оплата VPN сервиса</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B5278]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-6 text-red-500">
              <p>{error}</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mt-4 bg-[#2B5278] hover:bg-[#1F3C5C]"
              >
                Попробовать снова
              </Button>
            </div>
          ) : clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
              <div className="space-y-4">
                <div className="mb-6 border-b pb-4">
                  <h3 className="font-medium text-lg">Детали заказа</h3>
                  <div className="flex justify-between items-center mt-2">
                    <span>VPN Премиум (30 дней)</span>
                    <span className="font-semibold">{(amount / 100).toFixed(2)} ₽</span>
                  </div>
                </div>
                
                <CheckoutForm amount={amount} />
                
                <div className="text-center text-sm text-gray-500 pt-4">
                  <p>Оплачивая услугу, вы соглашаетесь с условиями предоставления сервиса</p>
                  <div className="flex justify-center items-center gap-2 mt-4">
                    <i className="bi bi-shield-lock"></i>
                    <span>Безопасная оплата через Stripe</span>
                  </div>
                </div>
              </div>
            </Elements>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p>Не удалось загрузить форму оплаты</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Checkout;
