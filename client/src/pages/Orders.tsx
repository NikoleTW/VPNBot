import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { orderApi, userApi, productApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const Orders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: orderApi.getOrders,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: userApi.getUsers,
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: productApi.getProducts,
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      orderApi.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Заказ обновлен",
        description: "Статус заказа успешно обновлен",
      });
      setConfirmDialogOpen(false);
      setCancelDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось обновить заказ: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Apply filters to orders list
  const filteredOrders = orders
    ? orders.filter((order) => {
        // Status filter
        if (statusFilter !== "all" && order.status !== statusFilter) {
          return false;
        }

        // Search filter for order ID
        if (searchText && !order.id.toString().includes(searchText)) {
          return false;
        }

        return true;
      })
    : [];

  const handleConfirmOrder = (orderId: number) => {
    setSelectedOrderId(orderId);
    setConfirmDialogOpen(true);
  };

  const handleCancelOrder = (orderId: number) => {
    setSelectedOrderId(orderId);
    setCancelDialogOpen(true);
  };

  const confirmOrder = () => {
    if (selectedOrderId) {
      updateOrderMutation.mutate({
        id: selectedOrderId,
        status: "completed",
      });
    }
  };

  const cancelOrder = () => {
    if (selectedOrderId) {
      updateOrderMutation.mutate({
        id: selectedOrderId,
        status: "cancelled",
      });
    }
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setSearchText("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Выполнен</span>;
      case "pending":
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Ожидает</span>;
      case "cancelled":
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Отменен</span>;
      case "awaiting_confirmation":
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Ожидает подтверждения</span>;
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getUserName = (userId: number) => {
    if (!users) return "Загрузка...";
    const user = users.find(u => u.id === userId);
    return user ? user.firstName + (user.lastName ? ` ${user.lastName}` : "") : `ID: ${userId}`;
  };

  const getProductName = (productId: number) => {
    if (!products) return "Загрузка...";
    const product = products.find(p => p.id === productId);
    return product ? product.name : `ID: ${productId}`;
  };

  const viewOrderDetails = (order: any) => {
    setSelectedOrderDetails(order);
    setOrderDetailsOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Заказы
          </h1>
          <Button
            variant="outline"
            onClick={() => setFilterVisible(!filterVisible)}
          >
            <i className="bi bi-filter mr-2"></i> Фильтр
          </Button>
        </div>

        {filterVisible && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Статус</label>
                  <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="pending">Ожидает оплаты</SelectItem>
                      <SelectItem value="awaiting_confirmation">Ожидает подтверждения</SelectItem>
                      <SelectItem value="completed">Выполнен</SelectItem>
                      <SelectItem value="cancelled">Отменен</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">ID заказа</label>
                  <Input
                    placeholder="Введите ID заказа"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="mr-2"
                  >
                    Сбросить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Список заказов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Продукт</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoadingOrders ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{order.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{getUserName(order.userId)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{getProductName(order.productId)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(order.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(order.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewOrderDetails(order)}
                            >
                              <i className="bi bi-eye"></i>
                            </Button>
                            {order.status === "awaiting_confirmation" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                                onClick={() => handleConfirmOrder(order.id)}
                              >
                                <i className="bi bi-check-lg"></i>
                              </Button>
                            )}
                            {(order.status === "pending" || order.status === "awaiting_confirmation") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                                onClick={() => handleCancelOrder(order.id)}
                              >
                                <i className="bi bi-x-lg"></i>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        Заказы не найдены
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirm Order Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердить заказ</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите подтвердить заказ #{selectedOrderId}? 
              После подтверждения будет создана VPN конфигурация для пользователя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmOrder}
              className="bg-green-600 hover:bg-green-700"
            >
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заказ</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отменить заказ #{selectedOrderId}? 
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={cancelOrder}
              className="bg-red-600 hover:bg-red-700"
            >
              Отменить заказ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Details Dialog */}
      {selectedOrderDetails && (
        <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Детали заказа #{selectedOrderDetails.id}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">ID заказа</p>
                  <p className="font-medium">{selectedOrderDetails.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Статус</p>
                  <p>{getStatusBadge(selectedOrderDetails.status)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Пользователь</p>
                  <p className="font-medium">{getUserName(selectedOrderDetails.userId)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Продукт</p>
                  <p className="font-medium">{getProductName(selectedOrderDetails.productId)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Сумма</p>
                  <p className="font-medium">{formatCurrency(selectedOrderDetails.amount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Способ оплаты</p>
                  <p className="font-medium">{selectedOrderDetails.paymentMethod || "Не указан"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Дата создания</p>
                  <p className="font-medium">{formatDate(selectedOrderDetails.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Дата оплаты</p>
                  <p className="font-medium">{selectedOrderDetails.paidAt ? formatDate(selectedOrderDetails.paidAt) : "Не оплачен"}</p>
                </div>
              </div>
              
              {/* Show proof of payment if available */}
              {selectedOrderDetails.paymentProofImage && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Подтверждение оплаты</p>
                  <div className="border rounded p-2 text-center">
                    <p className="text-gray-500">Изображение с подтверждением оплаты</p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between pt-4">
                {selectedOrderDetails.status === "awaiting_confirmation" && (
                  <Button
                    onClick={() => {
                      setOrderDetailsOpen(false);
                      handleConfirmOrder(selectedOrderDetails.id);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Подтвердить заказ
                  </Button>
                )}
                
                {(selectedOrderDetails.status === "pending" || selectedOrderDetails.status === "awaiting_confirmation") && (
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => {
                      setOrderDetailsOpen(false);
                      handleCancelOrder(selectedOrderDetails.id);
                    }}
                  >
                    Отменить заказ
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  onClick={() => setOrderDetailsOpen(false)}
                >
                  Закрыть
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default Orders;
