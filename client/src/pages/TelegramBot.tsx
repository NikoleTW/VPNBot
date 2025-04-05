import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { telegramBotApi, settingsApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { validateBotToken, generateBotLink } from "@/lib/telegram";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

const TelegramBot = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [isRestartingBot, setIsRestartingBot] = useState(false);
  const [tokenToTest, setTokenToTest] = useState("");
  const [showRestartDialog, setShowRestartDialog] = useState(false);

  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: settingsApi.getAllSettings,
  });

  const botToken = settings?.find(s => s.key === "telegram_bot_token")?.value || "";
  const adminIds = settings?.find(s => s.key === "telegram_admin_ids")?.value || "";
  const welcomeMessage = settings?.find(s => s.key === "welcome_message")?.value || "";
  const helpMessage = settings?.find(s => s.key === "help_message")?.value || "";
  const paymentConfirmationMessage = settings?.find(s => s.key === "payment_confirmation_message")?.value || "";
  const orderCompletedMessage = settings?.find(s => s.key === "order_completed_message")?.value || "";
  const botLink = settings?.find(s => s.key === "telegram_bot_link")?.value || "";

  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Настройки сохранены",
        description: "Настройки бота успешно обновлены",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось сохранить настройки: ${error}`,
        variant: "destructive",
      });
    },
  });

  const checkTokenMutation = useMutation({
    mutationFn: (token: string) => telegramBotApi.checkToken(token),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Токен действителен",
          description: `Имя бота: ${data.bot_name}`,
        });
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Токен недействителен",
          variant: "destructive",
        });
      }
      setIsTestingToken(false);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Произошла ошибка: ${error}`,
        variant: "destructive",
      });
      setIsTestingToken(false);
    },
  });

  const restartBotMutation = useMutation({
    mutationFn: telegramBotApi.restartBot,
    onSuccess: () => {
      toast({
        title: "Бот перезапущен",
        description: "Telegram бот успешно перезапущен",
      });
      setIsRestartingBot(false);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось перезапустить бота: ${error}`,
        variant: "destructive",
      });
      setIsRestartingBot(false);
    },
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formEl = e.target as HTMLFormElement;
    const formData = new FormData(formEl);
    
    const settingsToUpdate = [
      { key: "telegram_bot_token", value: formData.get("telegram_bot_token") as string },
      { key: "telegram_admin_ids", value: formData.get("telegram_admin_ids") as string },
      { key: "welcome_message", value: formData.get("welcome_message") as string },
      { key: "help_message", value: formData.get("help_message") as string },
      { key: "payment_confirmation_message", value: formData.get("payment_confirmation_message") as string },
      { key: "order_completed_message", value: formData.get("order_completed_message") as string },
      { key: "telegram_bot_link", value: formData.get("telegram_bot_link") as string || botLink },
    ];
    
    updateSettingsMutation.mutate(settingsToUpdate);
  };

  const handleTestToken = () => {
    const token = tokenToTest || botToken;
    if (!token) {
      toast({
        title: "Ошибка",
        description: "Введите токен для проверки",
        variant: "destructive",
      });
      return;
    }
    
    if (!validateBotToken(token)) {
      toast({
        title: "Ошибка",
        description: "Формат токена некорректен",
        variant: "destructive",
      });
      return;
    }
    
    setIsTestingToken(true);
    checkTokenMutation.mutate(token);
  };

  const handleRestartBot = () => {
    setShowRestartDialog(false);
    setIsRestartingBot(true);
    restartBotMutation.mutate();
  };

  if (isLoadingSettings) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B5278]"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Для кнопки "Открыть бота" используем ссылку на бота из настроек
  const botLinkToUse = botLink || "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Telegram Бот
          </h1>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowRestartDialog(true)}
              disabled={!botToken || isRestartingBot}
            >
              {isRestartingBot ? (
                <>
                  <span className="inline-block animate-spin mr-1">⟳</span> Перезапуск...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat mr-2"></i> Перезапустить бота
                </>
              )}
            </Button>
            
            {botToken && (
              <Button 
                variant="outline" 
                onClick={() => window.open(botLinkToUse, "_blank")}
                disabled={!botLinkToUse}
              >
                <i className="bi bi-telegram mr-2"></i> Открыть бота
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">Основные настройки</TabsTrigger>
                <TabsTrigger value="messages">Сообщения бота</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handleSaveSettings}>
                <TabsContent value="general" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Настройки Telegram бота</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label htmlFor="telegram_bot_token" className="block text-sm font-medium text-gray-700 mb-1">
                          Токен Telegram бота
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="telegram_bot_token"
                            name="telegram_bot_token"
                            defaultValue={botToken}
                            placeholder="Токен от @BotFather"
                            onChange={(e) => setTokenToTest(e.target.value)}
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={handleTestToken}
                            disabled={isTestingToken}
                          >
                            {isTestingToken ? (
                              <>
                                <span className="inline-block animate-spin mr-1">⟳</span> Проверка...
                              </>
                            ) : (
                              "Проверить"
                            )}
                          </Button>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Токен можно получить у @BotFather в Telegram
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="telegram_admin_ids" className="block text-sm font-medium text-gray-700 mb-1">
                          ID администраторов (через запятую)
                        </label>
                        <Input
                          id="telegram_admin_ids"
                          name="telegram_admin_ids"
                          defaultValue={adminIds}
                          placeholder="12345678,87654321"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Список Telegram ID администраторов, которые имеют доступ к управлению через бота
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="telegram_bot_link" className="block text-sm font-medium text-gray-700 mb-1">
                          Ссылка на бота
                        </label>
                        <Input
                          id="telegram_bot_link"
                          name="telegram_bot_link"
                          defaultValue={botLink}
                          placeholder="https://t.me/your_bot_username"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Укажите полную ссылку на вашего бота в Telegram (например, https://t.me/your_bot_username)
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="messages" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Сообщения бота</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label htmlFor="welcome_message" className="block text-sm font-medium text-gray-700 mb-1">
                          Приветственное сообщение
                        </label>
                        <Textarea
                          id="welcome_message"
                          name="welcome_message"
                          rows={3}
                          defaultValue={welcomeMessage}
                          placeholder="Добро пожаловать в VPN бот! Используйте меню ниже для навигации."
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="help_message" className="block text-sm font-medium text-gray-700 mb-1">
                          Сообщение помощи
                        </label>
                        <Textarea
                          id="help_message"
                          name="help_message"
                          rows={3}
                          defaultValue={helpMessage}
                          placeholder="Этот бот позволяет приобрести доступ к VPN сервису. Используйте кнопки меню для навигации."
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="payment_confirmation_message" className="block text-sm font-medium text-gray-700 mb-1">
                          Сообщение подтверждения оплаты
                        </label>
                        <Textarea
                          id="payment_confirmation_message"
                          name="payment_confirmation_message"
                          rows={3}
                          defaultValue={paymentConfirmationMessage}
                          placeholder="Пожалуйста, отправьте скриншот или квитанцию об оплате. Администратор проверит оплату и активирует ваш доступ."
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="order_completed_message" className="block text-sm font-medium text-gray-700 mb-1">
                          Сообщение завершения заказа
                        </label>
                        <Textarea
                          id="order_completed_message"
                          name="order_completed_message"
                          rows={3}
                          defaultValue={orderCompletedMessage}
                          placeholder="Ваш заказ выполнен! Ваша VPN конфигурация готова к использованию. Нажмите 'Мои конфигурации', чтобы получить доступ."
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <div className="mt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    className="bg-[#2B5278] hover:bg-[#1F3C5C]"
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <span className="inline-block animate-spin mr-1">⟳</span> Сохранение...
                      </>
                    ) : (
                      "Сохранить настройки"
                    )}
                  </Button>
                </div>
              </form>
            </Tabs>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Статус бота</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className={`w-16 h-16 flex items-center justify-center ${botToken ? 'bg-green-100' : 'bg-red-100'} rounded-full`}>
                    <i className={`bi bi-robot text-3xl ${botToken ? 'text-[#34C759]' : 'text-[#E74C3C]'}`}></i>
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {botToken ? "Бот активен" : "Бот не настроен"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {botToken 
                        ? `Последняя активность: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
                        : "Добавьте токен бота в настройках"}
                    </p>
                  </div>
                  
                  {botToken && (
                    <div className="w-full bg-gray-100 rounded-lg p-4">
                      <div className="text-center mb-2 text-gray-600 italic">
                        <span>Статистика будет доступна после первого запуска бота</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Проблемы и решения</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Бот не отвечает</h4>
                  <p className="text-sm text-gray-500">
                    Попробуйте перезапустить бота кнопкой выше. Если проблема не решена, проверьте токен и убедитесь, что он действителен.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Как настроить меню бота?</h4>
                  <p className="text-sm text-gray-500">
                    Меню настраивается автоматически при запуске бота. Если вы хотите изменить команды, используйте @BotFather в Telegram.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Как получить Telegram ID?</h4>
                  <p className="text-sm text-gray-500">
                    Используйте бота @userinfobot, чтобы узнать ваш Telegram ID.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Restart Bot Confirmation Dialog */}
      <AlertDialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перезапустить бота?</AlertDialogTitle>
            <AlertDialogDescription>
              Текущие соединения будут прерваны. Бот будет перезапущен с текущими настройками.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestartBot}>Перезапустить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TelegramBot;
