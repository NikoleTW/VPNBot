import { useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import SalesChart from "@/components/dashboard/SalesChart";
import ConfigurationsList from "@/components/dashboard/ConfigurationsList";
import BotStatus from "@/components/dashboard/BotStatus";
import RecentSales from "@/components/dashboard/RecentSales";
import PopularPlans from "@/components/dashboard/PopularPlans";
import { statsApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: stats, isLoading, isRefetching } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: statsApi.getStats,
  });

  // Format currency in Russian rubles
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // Function to refresh all dashboard data
  const refreshData = useCallback(async () => {
    toast({
      title: "Обновление данных",
      description: "Получение актуальной информации...",
    });
    
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/stats/sales"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/stats/popular-products"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/vpn-configs"] }),
    ]);
    
    toast({
      title: "Данные обновлены",
      description: "Статистика актуализирована",
    });
  }, [queryClient, toast]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Панель управления
          </h1>
          <div>
            <Button 
              onClick={refreshData}
              variant="default"
              className="bg-[#2B5278] hover:bg-[#1F3C5C]"
              disabled={isRefetching}
            >
              {isRefetching ? (
                <>
                  <i className="bi bi-arrow-repeat mr-1 animate-spin"></i> Обновление...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat mr-1"></i> Обновить данные
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Пользователи"
            value={isLoading ? "Загрузка..." : stats?.totalUsers.toString() || "0"}
            icon="bi-people"
            iconBgColor="bg-blue-100"
            subtitle="Всего зарегистрированных"
          />
          <StatCard
            title="Продажи"
            value={isLoading ? "Загрузка..." : stats?.totalSales.toString() || "0"}
            icon="bi-cart"
            iconBgColor="bg-green-100"
            subtitle="Количество выполненных заказов"
          />
          <StatCard
            title="Активные VPN"
            value={isLoading ? "Загрузка..." : stats?.activeVpns.toString() || "0"}
            icon="bi-hdd-stack"
            iconBgColor="bg-purple-100"
            subtitle="Действующие конфигурации"
          />
          <StatCard
            title="Доход"
            value={isLoading ? "Загрузка..." : formatCurrency((stats?.totalRevenue || 0) / 100)}
            icon="bi-currency-dollar"
            iconBgColor="bg-amber-100"
            subtitle="Общая сумма продаж"
          />
        </div>

        {/* Recent Sales Table */}
        <RecentSales />

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <SalesChart />
          </div>
          <div>
            <PopularPlans />
          </div>
        </div>

        {/* Configuration Management and Bot Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConfigurationsList />
          <BotStatus />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
