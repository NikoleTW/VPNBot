import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { orderApi, statsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";

const Sales = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [periodLabel, setPeriodLabel] = useState('За месяц');

  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ["/api/stats/sales"],
    queryFn: statsApi.getSalesData,
  });

  const { data: popularProducts, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["/api/stats/popular-products"],
    queryFn: statsApi.getPopularProducts,
  });

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["/api/orders/recent"],
    queryFn: () => orderApi.getRecentOrders(10),
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: statsApi.getStats,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const handlePeriodChange = (newPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly', label: string) => {
    setPeriod(newPeriod);
    setPeriodLabel(label);
  };

  const handleExport = () => {
    alert('Экспорт отчета будет доступен в следующей версии.');
  };

  // Config types chart data
  const configTypeData = [
    { name: 'VLESS', value: 65 },
    { name: 'VMess', value: 25 },
    { name: 'Trojan', value: 10 },
  ];

  const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Выполнен</span>;
      case 'pending':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Ожидает</span>;
      case 'cancelled':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Отменен</span>;
      case 'awaiting_confirmation':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Ожидает подтверждения</span>;
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">Отчет по продажам</h1>
          <div className="flex space-x-2">
            <div className="btn-group">
              <Button 
                variant={period === 'daily' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => handlePeriodChange('daily', 'За день')}
              >
                День
              </Button>
              <Button 
                variant={period === 'weekly' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => handlePeriodChange('weekly', 'За неделю')}
              >
                Неделя
              </Button>
              <Button 
                variant={period === 'monthly' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => handlePeriodChange('monthly', 'За месяц')}
              >
                Месяц
              </Button>
              <Button 
                variant={period === 'yearly' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => handlePeriodChange('yearly', 'За год')}
              >
                Год
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <i className="bi bi-download mr-2"></i>
              Экспорт
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <h5 className="text-sm font-medium text-gray-500">Всего продаж</h5>
              <h2 className="text-2xl font-bold mt-1">{isLoadingStats ? "..." : stats?.totalSales}</h2>
              <p className="text-xs text-gray-500 mt-1">За всё время</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <h5 className="text-sm font-medium text-gray-500">Общий доход</h5>
              <h2 className="text-2xl font-bold mt-1">{isLoadingStats ? "..." : formatCurrency(stats?.totalRevenue || 0)}</h2>
              <p className="text-xs text-gray-500 mt-1">За всё время</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <h5 className="text-sm font-medium text-gray-500">Продажи за период</h5>
              <h2 className="text-2xl font-bold mt-1" id="periodSales">
                {isLoadingSales ? "..." : (salesData && salesData.length > 0 ? salesData[salesData.length - 1].sales : 0)}
              </h2>
              <p className="text-xs text-gray-500 mt-1" id="periodLabel">{periodLabel}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <h5 className="text-sm font-medium text-gray-500">Доход за период</h5>
              <h2 className="text-2xl font-bold mt-1" id="periodRevenue">
                {isLoadingSales ? "..." : (salesData && salesData.length > 0 ? formatCurrency(salesData[salesData.length - 1].revenue) : formatCurrency(0))}
              </h2>
              <p className="text-xs text-gray-500 mt-1" id="periodRevenueLabel">{periodLabel}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h5 className="text-lg font-medium">График продаж</h5>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoadingSales ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B5278]"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}`, "Продажи"]} />
                    <Bar dataKey="sales" fill="#36A2EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h5 className="text-lg font-medium">Продажи по типу конфигурации</h5>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={configTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={false}
                      labelLine={false}
                    >
                      {configTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <h5 className="text-lg font-medium">Продажи по продуктам</h5>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {isLoadingProducts ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B5278]"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={popularProducts}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="percentage"
                        nameKey="productName"
                        label={false}
                        labelLine={false}
                      >
                        {popularProducts?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h5 className="text-lg font-medium">Последние продажи</h5>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Продукт</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoadingOrders ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
                        </div>
                      </td>
                    </tr>
                  ) : orders && orders.length > 0 ? (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a href={`/orders/${order.id}`} className="text-[#2B5278] hover:underline">#{order.id}</a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">ID: {order.userId}</td>
                        <td className="px-6 py-4 whitespace-nowrap">ID: {order.productId}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(order.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{new Date(order.createdAt).toLocaleString('ru-RU', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(order.status || 'pending')}</td>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Sales;
