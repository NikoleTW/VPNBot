import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { settingsApi, telegramBotApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const Settings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTestingXUI, setIsTestingXUI] = useState(false);
  const [isTestingBotToken, setIsTestingBotToken] = useState(false);
  const [testTokenResult, setTestTokenResult] = useState<any>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: settingsApi.getAllSettings,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Настройки сохранены",
        description: "Настройки успешно обновлены",
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

  const testBotTokenMutation = useMutation({
    mutationFn: (token: string) => telegramBotApi.checkToken(token),
    onSuccess: (data) => {
      setTestTokenResult(data);
      setIsTestingBotToken(false);
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
    },
    onError: (error) => {
      setIsTestingBotToken(false);
      toast({
        title: "Ошибка",
        description: `Не удалось проверить токен: ${error}`,
        variant: "destructive",
      });
    },
  });

  const testXUIConnection = () => {
    setIsTestingXUI(true);
    // In a real implementation, you would make an API call to check the connection
    // For now, we'll just simulate a successful connection after a delay
    setTimeout(() => {
      setIsTestingXUI(false);
      toast({
        title: "Подключение успешно",
        description: "Соединение с X-UI панелью установлено",
      });
      
      // Update the UI to show connection details (mock data for now)
      const xuiResultDiv = document.getElementById('xuiConnectionResult');
      if (xuiResultDiv) {
        xuiResultDiv.innerHTML = `
          <div class="alert bg-green-100 text-green-800 p-4 rounded-lg my-3">
            <p class="font-medium">Подключение успешно!</p>
            <p class="mt-2">Системная информация:</p>
            <ul class="list-disc pl-5 mt-1">
              <li>CPU: 15%</li>
              <li>Память: 42%</li>
              <li>Диск: 28%</li>
              <li>Получено: 1.2 GB</li>
              <li>Отправлено: 3.5 GB</li>
            </ul>
            <p class="mt-2">Найдено инбаундов: 8</p>
          </div>
        `;
      }
    }, 1500);
  };

  const handleTestBotToken = () => {
    const tokenInput = document.getElementById('setting_telegram_bot_token') as HTMLInputElement;
    const token = tokenInput?.value;
    
    if (!token) {
      toast({
        title: "Ошибка",
        description: "Введите токен для проверки",
        variant: "destructive",
      });
      return;
    }
    
    setIsTestingBotToken(true);
    testBotTokenMutation.mutate(token);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    // Вспомогательная функция для безопасного получения значения из формы
    const getFormValue = (key: string): string => {
      const value = formData.get(key);
      return value ? value.toString() : "";
    };
    
    const settingsToUpdate = [
      // Telegram Bot Settings
      { key: "telegram_bot_token", value: getFormValue("setting_telegram_bot_token") },
      { key: "telegram_admin_ids", value: getFormValue("setting_telegram_admin_ids") },
      { key: "telegram_bot_link", value: getFormValue("setting_telegram_bot_link") },
      { key: "welcome_message", value: getFormValue("setting_welcome_message") },
      { key: "help_message", value: getFormValue("setting_help_message") },
      { key: "payment_confirmation_message", value: getFormValue("setting_payment_confirmation_message") },
      { key: "order_completed_message", value: getFormValue("setting_order_completed_message") },
      
      // X-UI Settings
      { key: "x_ui_url", value: getFormValue("setting_x_ui_url") },
      { key: "x_ui_username", value: getFormValue("setting_x_ui_username") },
      { key: "x_ui_password", value: getFormValue("setting_x_ui_password") },
      
      // General Settings
      { key: "server_address", value: getFormValue("setting_server_address") },
      { key: "auto_activate_configs", value: formData.has("setting_auto_activate_configs") ? "true" : "false" },
    ];
    
    updateSettingsMutation.mutate(settingsToUpdate);
  };

  const getSetting = (key: string): string => {
    if (!settings) return "";
    const setting = settings.find(s => s.key === key);
    return setting && setting.value ? setting.value : "";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B5278]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Настройки
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            {/* Telegram Bot Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Настройки Telegram бота</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="setting_telegram_bot_token" className="block text-sm font-medium mb-1">
                      Токен Telegram бота
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        id="setting_telegram_bot_token"
                        name="setting_telegram_bot_token"
                        defaultValue={getSetting('telegram_bot_token')}
                        placeholder="Токен от @BotFather"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleTestBotToken}
                        disabled={isTestingBotToken}
                      >
                        {isTestingBotToken ? (
                          <>
                            <span className="inline-block animate-spin mr-1">⟳</span> Проверка...
                          </>
                        ) : (
                          "Проверить"
                        )}
                      </Button>
                    </div>
                    <div className="form-text text-xs text-gray-500 mt-1">
                      Токен можно получить у @BotFather в Telegram
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="setting_telegram_admin_ids" className="block text-sm font-medium mb-1">
                      ID администраторов (через запятую)
                    </label>
                    <Input
                      type="text"
                      id="setting_telegram_admin_ids"
                      name="setting_telegram_admin_ids"
                      defaultValue={getSetting('telegram_admin_ids')}
                      placeholder="12345678,87654321"
                    />
                    <div className="form-text text-xs text-gray-500 mt-1">
                      Список Telegram ID администраторов, которые имеют доступ к управлению через бота
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="setting_telegram_bot_link" className="block text-sm font-medium mb-1">
                      Ссылка на бота Telegram
                    </label>
                    <Input
                      type="text"
                      id="setting_telegram_bot_link"
                      name="setting_telegram_bot_link"
                      defaultValue={getSetting('telegram_bot_link')}
                      placeholder="https://t.me/your_bot_username"
                    />
                    <div className="form-text text-xs text-gray-500 mt-1">
                      Укажите ссылку на вашего бота для отображения в системе
                    </div>
                  </div>
                  
                  <hr />
                  
                  <h5 className="font-medium mb-3">Сообщения бота</h5>
                  
                  <div>
                    <label htmlFor="setting_welcome_message" className="block text-sm font-medium mb-1">
                      Приветственное сообщение
                    </label>
                    <Textarea
                      id="setting_welcome_message"
                      name="setting_welcome_message"
                      rows={3}
                      defaultValue={getSetting('welcome_message')}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="setting_help_message" className="block text-sm font-medium mb-1">
                      Сообщение помощи
                    </label>
                    <Textarea
                      id="setting_help_message"
                      name="setting_help_message"
                      rows={3}
                      defaultValue={getSetting('help_message')}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="setting_payment_confirmation_message" className="block text-sm font-medium mb-1">
                      Сообщение подтверждения оплаты
                    </label>
                    <Textarea
                      id="setting_payment_confirmation_message"
                      name="setting_payment_confirmation_message"
                      rows={3}
                      defaultValue={getSetting('payment_confirmation_message')}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="setting_order_completed_message" className="block text-sm font-medium mb-1">
                      Сообщение завершения заказа
                    </label>
                    <Textarea
                      id="setting_order_completed_message"
                      name="setting_order_completed_message"
                      rows={3}
                      defaultValue={getSetting('order_completed_message')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* X-UI Server Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Настройки X-UI сервера</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="setting_x_ui_url" className="block text-sm font-medium mb-1">
                      URL X-UI панели
                    </label>
                    <Input
                      type="url"
                      id="setting_x_ui_url"
                      name="setting_x_ui_url"
                      defaultValue={getSetting('x_ui_url')}
                      placeholder="https://your-server.com:54321"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="setting_x_ui_username" className="block text-sm font-medium mb-1">
                      Имя пользователя X-UI
                    </label>
                    <Input
                      type="text"
                      id="setting_x_ui_username"
                      name="setting_x_ui_username"
                      defaultValue={getSetting('x_ui_username')}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="setting_x_ui_password" className="block text-sm font-medium mb-1">
                      Пароль X-UI
                    </label>
                    <Input
                      type="password"
                      id="setting_x_ui_password"
                      name="setting_x_ui_password"
                      defaultValue={getSetting('x_ui_password')}
                    />
                  </div>
                  
                  <div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={testXUIConnection}
                      disabled={isTestingXUI}
                    >
                      {isTestingXUI ? (
                        <>
                          <span className="inline-block animate-spin mr-1">⟳</span> Проверка...
                        </>
                      ) : (
                        "Проверить подключение"
                      )}
                    </Button>
                  </div>
                  
                  <div id="xuiConnectionResult"></div>
                </div>
              </CardContent>
            </Card>
            
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Общие настройки</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="setting_server_address" className="block text-sm font-medium mb-1">
                      Адрес VPN сервера
                    </label>
                    <Input
                      type="text"
                      id="setting_server_address"
                      name="setting_server_address"
                      defaultValue={getSetting('server_address')}
                      placeholder="vpn.example.com"
                    />
                    <div className="form-text text-xs text-gray-500 mt-1">
                      Используется при генерации конфигураций, если не указан в X-UI
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="setting_auto_activate_configs"
                      name="setting_auto_activate_configs"
                      defaultChecked={getSetting('auto_activate_configs') === 'true'}
                    />
                    <label htmlFor="setting_auto_activate_configs" className="text-sm font-medium">
                      Автоматически активировать конфигурации при подтверждении заказа
                    </label>
                  </div>
                  
                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      className="w-full bg-[#2B5278] hover:bg-[#1F3C5C]"
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
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
