import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orderApi, userApi, productApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Order, User, Product } from "@shared/schema";
import { cn } from "@/lib/utils";

const RecentSales = () => {
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/orders/recent"],
    queryFn: () => orderApi.getRecentOrders(5),
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: userApi.getUsers,
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: productApi.getProducts,
  });

  // Helper function to get user name by ID
  const getUserName = (userId: number): string => {
    if (!users) return "Загрузка...";
    const user = users.find((u) => u.id === userId);
    return user ? user.firstName + (user.lastName ? ` ${user.lastName}` : "") : "Неизвестный пользователь";
  };

  // Helper function to get product name by ID
  const getProductName = (productId: number): string => {
    if (!products) return "Загрузка...";
    const product = products.find((p) => p.id === productId);
    return product ? product.name : "Неизвестный продукт";
  };

  // Helper function to format order status
  const getStatusBadge = (status: string) => {
    let bgColor = "";
    let textColor = "";
    let label = "";

    switch (status) {
      case "completed":
        bgColor = "bg-green-100";
        textColor = "text-green-800";
        label = "Выполнен";
        break;
      case "pending":
        bgColor = "bg-yellow-100";
        textColor = "text-yellow-800";
        label = "Ожидает оплаты";
        break;
      case "awaiting_confirmation":
        bgColor = "bg-blue-100";
        textColor = "text-blue-800";
        label = "Ожидает подтверждения";
        break;
      case "cancelled":
        bgColor = "bg-red-100";
        textColor = "text-red-800";
        label = "Отменен";
        break;
      default:
        bgColor = "bg-gray-100";
        textColor = "text-gray-800";
        label = status;
    }

    return (
      <span className={cn("px-2 inline-flex text-xs leading-5 font-semibold rounded-full", bgColor, textColor)}>
        {label}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle>Последние продажи</CardTitle>
        <Link href="/sales" className="text-[#2B5278] text-sm font-medium hover:text-[#1F3C5C]">
          Смотреть все
        </Link>
      </CardHeader>
      <CardContent>
        {ordersLoading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Продукт</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/orders/${order.id}`} className="text-[#2B5278] hover:underline">
                          #{order.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getUserName(order.userId)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getProductName(order.productId)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{(order.amount / 100).toFixed(2)}₽</td>
                      <td className="px-6 py-4 whitespace-nowrap">{new Date(order.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Нет данных о продажах
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentSales;
