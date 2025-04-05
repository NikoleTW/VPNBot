import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { productApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Product } from "@shared/schema";

// Schema for the product form
const productSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  price: z.coerce.number().min(1, "Цена должна быть больше 0"),
  configType: z.enum(["vless", "vmess", "trojan"], {
    errorMap: () => ({ message: "Выберите тип конфигурации" }),
  }),
  durationDays: z.coerce.number().min(1, "Длительность должна быть больше 0"),
  isActive: z.boolean().default(true),
});

type ProductFormValues = z.infer<typeof productSchema>;

type ProductFormProps = {
  open: boolean;
  onClose: () => void;
  product?: Product;
};

const ProductForm = ({ open, onClose, product }: ProductFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Setup form with default values based on existing product or empty defaults
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      price: product ? product.price / 100 : 0, // Convert from cents to rubles for display
      configType: product?.configType || "vless",
      durationDays: product?.durationDays || 30,
      isActive: product?.isActive !== undefined ? product.isActive : true,
    },
  });

  const createMutation = useMutation({
    mutationFn: productApi.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Продукт создан",
        description: "Продукт успешно создан",
      });
      setIsSubmitting(false);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось создать продукт: ${error}`,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) =>
      productApi.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Продукт обновлен",
        description: "Продукт успешно обновлен",
      });
      setIsSubmitting(false);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось обновить продукт: ${error}`,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (values: ProductFormValues) => {
    setIsSubmitting(true);
    
    // Convert price from rubles to cents
    const productData = {
      ...values,
      price: Math.round(values.price * 100),
    };
    
    if (product) {
      // Update existing product
      updateMutation.mutate({ id: product.id, data: productData });
    } else {
      // Create new product
      createMutation.mutate(productData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {product ? "Редактировать продукт" : "Добавить продукт"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="VPN Базовый 30 дней" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Опишите продукт..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Цена (руб.)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="800"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="configType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип конфигурации</FormLabel>
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
                      <SelectItem value="vless">VLESS</SelectItem>
                      <SelectItem value="vmess">VMess</SelectItem>
                      <SelectItem value="trojan">Trojan</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="durationDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Длительность (дней)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="30"
                      {...field}
                    />
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
              <Button onClick={onClose} type="button" variant="outline">
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⟳</span>
                    {product ? "Обновление..." : "Сохранение..."}
                  </>
                ) : (
                  product ? "Обновить" : "Сохранить"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;
