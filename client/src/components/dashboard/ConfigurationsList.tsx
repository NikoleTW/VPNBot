import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { vpnConfigApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const ConfigurationsList = () => {
  const { data: configs, isLoading } = useQuery({
    queryKey: ["/api/vpn-configs"],
    queryFn: vpnConfigApi.getActiveVpnConfigs,
  });

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle>Последние конфигурации</CardTitle>
        <a href="/vpn-configs" className="text-[#2B5278] text-sm font-medium hover:text-[#1F3C5C]">
          Управление
        </a>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
          </div>
        ) : configs && configs.length > 0 ? (
          <div className="space-y-3">
            {configs.slice(0, 3).map((config) => (
              <div key={config.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{config.name}</p>
                  <p className="text-xs text-gray-500">
                    {config.configType.toUpperCase()} • Создан: {new Date(config.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button className="p-1 text-blue-600 hover:text-blue-800">
                    <i className="bi bi-download"></i>
                  </button>
                  <button className="p-1 text-gray-600 hover:text-gray-800">
                    <i className="bi bi-eye"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            Нет активных конфигураций
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConfigurationsList;
