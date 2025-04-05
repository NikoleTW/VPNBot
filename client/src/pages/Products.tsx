import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { productApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import ProductForm from "@/components/products/ProductForm";
import { Product } from "@shared/schema";

const Products = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | undefined>(undefined);

  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: productApi.getProducts,
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Продукт удален",
        description: "Продукт был успешно удален",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось удалить продукт: ${error}`,
        variant: "destructive",
      });
    },
  });

  const openEditForm = (product: Product) => {
    setSelectedProduct(product);
    setProductFormOpen(true);
  };

  const openAddForm = () => {
    setSelectedProduct(undefined);
    setProductFormOpen(true);
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete.id);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price / 100);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Продукты
          </h1>
          <Button 
            onClick={openAddForm}
            className="bg-[#2B5278] hover:bg-[#1F3C5C]"
          >
            <i className="bi bi-plus-lg mr-2"></i>
            Добавить продукт
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B5278]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products && products.length > 0 ? (
              products.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold mb-1">{product.name}</h3>
                          <p className="text-sm text-gray-500 mb-3">
                            {product.description || "Нет описания"}
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 w-28">Цена:</span>
                              <span className="text-sm font-bold">{formatPrice(product.price)}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 w-28">Тип:</span>
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                {product.configType.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 w-28">Срок:</span>
                              <span className="text-sm">{product.durationDays} дней</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 w-28">Статус:</span>
                              {product.isActive ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                  Активен
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                  Неактивен
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => openEditForm(product)}
                        className="flex-1 py-3 px-4 text-center text-[#2B5278] hover:bg-gray-50 transition-colors duration-150"
                      >
                        <i className="bi bi-pencil-square mr-2"></i>
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="flex-1 py-3 px-4 text-center text-[#E74C3C] hover:bg-gray-50 transition-colors duration-150"
                      >
                        <i className="bi bi-trash mr-2"></i>
                        Удалить
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-10 text-gray-500">
                <i className="bi bi-box text-4xl mb-3 block"></i>
                <p>Нет доступных продуктов. Нажмите "Добавить продукт" для создания нового.</p>
              </div>
            )}
          </div>
        )}

        {/* Product form dialog */}
        {productFormOpen && (
          <ProductForm
            open={productFormOpen}
            onClose={() => setProductFormOpen(false)}
            product={selectedProduct}
          />
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие нельзя отменить. Продукт "{productToDelete?.name}" будет безвозвратно удален.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Products;
