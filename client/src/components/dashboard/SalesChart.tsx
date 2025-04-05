import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const SalesChart = () => {
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["/api/stats/sales"],
    queryFn: () => statsApi.getSalesData(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Обзор продаж</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B5278]"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Обзор продаж</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={salesData}
              margin={{
                top: 10,
                right: 10,
                left: 0,
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                formatter={(value: number) => [`${value}`, "Продажи"]}
                labelFormatter={(label) => `Месяц: ${label}`}
              />
              <Bar
                dataKey="sales"
                fill="#2B5278"
                radius={[4, 4, 0, 0]}
                barSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesChart;
