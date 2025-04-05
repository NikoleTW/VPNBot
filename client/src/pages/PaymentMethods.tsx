import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { settingsApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Define payment method type for typescript
type PaymentMethod = {
  id: string;
  type: "bank_card" | "qiwi" | "yoomoney" | "crypto" | "sbp";
  name: string;
  details: string;
  isActive: boolean;
  icon: string;
};

// Form schema for payment method
const paymentMethodSchema = z.object({
  type: z.enum(["bank_card", "qiwi", "yoomoney", "crypto", "sbp"], {
    required_error: "Выберите тип платежного метода",
  }),
  name: z.string().min(1, "Название обязательно"),
  details: z.string().min(1, "Детали платежа обязательны"),
  isActive: z.boolean().default(true),
});

type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>;

const PaymentMethods = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [methodFormOpen, setMethodFormOpen] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<PaymentMethod | null>(null);
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);

  // Mock payment methods - in a real app, these would come from an API
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: "1",
      type: "bank_card",
      name: "Банковская карта",
      details: "5000 0000 0000 0000",
      isActive: true,
      icon: "bi-credit-card",
    },
    {
      id: "2",
      type: "sbp",
      name: "СБП",
      details: "+7 (999) 000-00-00",
      isActive: true,
      icon: "bi-phone",
    },
    {
      id: "3",
      type: "crypto",
      name: "Криптовалюта",
      details: "BTC: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      isActive: false,
      icon: "bi-currency-bitcoin",
    },
  ]);

  const form = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      type: "bank_card",
      name: "",
      details: "",
      isActive: true,
    },
  });

  const openAddDialog = () => {
    form.reset({
      type: "bank_card",
      name: "",
      details: "",
      isActive: true,
    });
    setCurrentMethod(null);
    setMethodFormOpen(true);
  };

  const openEditDialog = (method: PaymentMethod) => {
    form.reset({
      type: method.type,
      name: method.name,
      details: method.details,
      isActive: method.isActive,
    });
    setCurrentMethod(method);
    setMethodFormOpen(true);
  };

  const handleSubmit = (values: PaymentMethodFormValues) => {
    if (currentMethod) {
      // Edit existing method
      const updatedMethods = paymentMethods.map((method) =>
        method.id === currentMethod.id
          ? {
              ...method,
              ...values,
              type: values.type,
              icon: getIconForType(values.type),
            }
          : method
      );
      setPaymentMethods(updatedMethods as PaymentMethod[]);
      toast({
        title: "Способ оплаты обновлен",
        description: "Способ оплаты успешно обновлен",
      });
    } else {
      // Add new method
      const newMethod: PaymentMethod = {
        id: Date.now().toString(),
        type: values.type,
        name: values.name,
        details: values.details,
        isActive: values.isActive,
        icon: getIconForType(values.type),
      };
      setPaymentMethods([...paymentMethods, newMethod]);
      toast({
        title: "Способ оплаты добавлен",
        description: "Новый способ оплаты успешно добавлен",
      });
    }
    setMethodFormOpen(false);
  };

  const deleteMethod = (id: string) => {
    const updatedMethods = paymentMethods.filter((method) => method.id !== id);
    setPaymentMethods(updatedMethods);
    toast({
      title: "Способ оплаты удален",
      description: "Способ оплаты успешно удален",
    });
  };

  const toggleMethodStatus = (id: string) => {
    const updatedMethods = paymentMethods.map((method) =>
      method.id === id ? { ...method, isActive: !method.isActive } : method
    );
    setPaymentMethods(updatedMethods);
    toast({
      title: "Статус изменен",
      description: "Статус способа оплаты успешно изменен",
    });
  };

  const getIconForType = (type: "bank_card" | "qiwi" | "yoomoney" | "crypto" | "sbp"): string => {
    switch (type) {
      case "bank_card":
        return "bi-credit-card";
      case "qiwi":
        return "bi-wallet2";
      case "yoomoney":
        return "bi-cash";
      case "crypto":
        return "bi-currency-bitcoin";
      case "sbp":
        return "bi-phone";
      default:
        return "bi-credit-card";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Способы оплаты
          </h1>
          <Button 
            onClick={openAddDialog}
            className="bg-[#2B5278] hover:bg-[#1F3C5C]"
          >
            <i className="bi bi-plus-lg mr-2"></i>
            Добавить способ оплаты
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.map((method) => (
            <Card key={method.id}>
              <CardContent className="p-6">
                <div className="flex items-start mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <i className={`${method.icon} text-lg ${method.isActive ? 'text-green-600' : 'text-gray-500'}`}></i>
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{method.name}</h3>
                        <p className="text-sm text-gray-500">{method.details}</p>
                      </div>
                      <div>
                        {method.isActive ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Активен
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            Неактивен
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(method)}
                  >
                    <i className="bi bi-pencil mr-2"></i>
                    Редактировать
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${method.isActive ? 'text-amber-500 border-amber-200 hover:bg-amber-50' : 'text-green-500 border-green-200 hover:bg-green-50'}`}
                    onClick={() => toggleMethodStatus(method.id)}
                  >
                    {method.isActive ? (
                      <>
                        <i className="bi bi-pause-circle mr-2"></i>
                        Приостановить
                      </>
                    ) : (
                      <>
                        <i className="bi bi-play-circle mr-2"></i>
                        Активировать
                      </>
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-200 hover:bg-red-50"
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удаление способа оплаты</AlertDialogTitle>
                        <AlertDialogDescription>
                          Вы уверены, что хотите удалить способ оплаты "{method.name}"? 
                          Это действие нельзя отменить.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteMethod(method.id)}
                          className="bg-red-500 text-white hover:bg-red-600"
                        >
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stripe Integration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Интеграция со Stripe</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Подключите Stripe для приема платежей по кредитным картам, Apple Pay, Google Pay и других методов оплаты.
            </p>
            
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <label htmlFor="stripe_public_key" className="text-sm font-medium">
                  Stripe Public Key
                </label>
                <Input 
                  id="stripe_public_key" 
                  placeholder="pk_test_..." 
                  className="max-w-md"
                />
                <p className="text-xs text-gray-500">
                  Начинается с pk_test_ или pk_live_
                </p>
              </div>
              
              <div className="flex flex-col space-y-2">
                <label htmlFor="stripe_secret_key" className="text-sm font-medium">
                  Stripe Secret Key
                </label>
                <Input 
                  id="stripe_secret_key" 
                  type="password" 
                  placeholder="sk_test_..." 
                  className="max-w-md"
                />
                <p className="text-xs text-gray-500">
                  Начинается с sk_test_ или sk_live_
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="stripe_enabled" />
                <label htmlFor="stripe_enabled" className="text-sm font-medium">
                  Включить Stripe платежи
                </label>
              </div>
              
              <Button className="bg-[#2B5278] hover:bg-[#1F3C5C] mt-2">
                Сохранить настройки Stripe
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Form Dialog */}
        <Dialog open={methodFormOpen} onOpenChange={setMethodFormOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {currentMethod ? "Редактировать способ оплаты" : "Добавить способ оплаты"}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bank_card">Банковская карта</SelectItem>
                          <SelectItem value="qiwi">QIWI</SelectItem>
                          <SelectItem value="yoomoney">ЮMoney</SelectItem>
                          <SelectItem value="crypto">Криптовалюта</SelectItem>
                          <SelectItem value="sbp">СБП</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input placeholder="Банковская карта" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Детали платежа</FormLabel>
                      <FormControl>
                        <Input placeholder="5000 0000 0000 0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Активен</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setMethodFormOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button type="submit">
                    {currentMethod ? "Обновить" : "Добавить"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PaymentMethods;
