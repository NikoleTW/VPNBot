import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { telegramBotApi, settingsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BotStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRestarting, setIsRestarting] = useState(false);

  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: settingsApi.getAllSettings,
  });

  const botToken = settings?.find(s => s.key === "telegram_bot_token")?.value;
  const botActive = Boolean(botToken);

  const restartMutation = useMutation({
    mutationFn: telegramBotApi.restartBot,
    onSuccess: () => {
      toast({ title: "Успех", description: "Бот успешно перезапущен" });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setIsRestarting(false);
    },
    onError: (error) => {
      toast({ 
        title: "Ошибка", 
        description: `Не удалось перезапустить бота: ${error}`,
        variant: "destructive"
      });
      setIsRestarting(false);
    }
  });

  const handleRestart = () => {
    setIsRestarting(true);
    restartMutation.mutate();
  };

  if (isLoadingSettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Статус Telegram бота</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle>Статус Telegram бота</CardTitle>
        <button
          className="text-[#34C759] text-sm font-medium hover:text-green-700"
          disabled={isRestarting || !botActive}
          onClick={handleRestart}
        >
          {isRestarting ? (
            <>
              <span className="inline-block animate-spin mr-1">⟳</span> Перезапуск...
            </>
          ) : (
            <>
              <i className="bi bi-play-fill"></i> Перезапустить
            </>
          )}
        </button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`w-16 h-16 flex items-center justify-center ${botActive ? 'bg-green-100' : 'bg-red-100'} rounded-full`}>
            <i className={`bi bi-robot text-3xl ${botActive ? 'text-[#34C759]' : 'text-[#E74C3C]'}`}></i>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">
              {botActive ? "Бот активен" : "Бот не настроен"}
            </h3>
            <p className="text-sm text-gray-500">
              {botActive 
                ? `Последняя активность: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
                : "Настройте токен бота в разделе Настройки"}
            </p>
          </div>
          {botActive && (
            <div className="w-full bg-gray-100 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Обработано сообщений сегодня</span>
                <span className="text-sm font-medium">156</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Активных пользователей</span>
                <span className="text-sm font-medium">43</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Новых пользователей</span>
                <span className="text-sm font-medium">12</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BotStatus;
