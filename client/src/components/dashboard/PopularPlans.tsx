import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const PopularPlans = () => {
  const { data: popularProducts, isLoading } = useQuery({
    queryKey: ["/api/stats/popular-products"],
    queryFn: statsApi.getPopularProducts,
  });

  // List of colors for the progress bars
  const colors = ["bg-[#2B5278]", "bg-[#34C759]", "bg-[#4299E1]", "bg-[#E74C3C]"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Популярные планы</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
          </div>
        ) : popularProducts && popularProducts.length > 0 ? (
          <div className="space-y-4">
            {popularProducts.slice(0, 4).map((product, index) => (
              <div key={product.productId} className="flex items-center">
                <div className="w-full">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{product.productName}</span>
                    <span className="text-sm text-gray-500">{product.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`${colors[index % colors.length]} h-2 rounded-full`} 
                      style={{ width: `${product.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            Нет данных о продуктах
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PopularPlans;
