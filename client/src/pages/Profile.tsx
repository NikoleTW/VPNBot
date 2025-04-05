import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { auth } from "@/lib/auth";

const Profile = () => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentTab, setCurrentTab] = useState("personal");
  const [, setLocation] = useLocation();
  
  const handleLogout = async () => {
    try {
      await auth.logout();
      
      toast({
        title: "Выход выполнен",
        description: "Вы вышли из системы",
      });
      
      // Перенаправление на страницу логина
      setLocation("/login");
    } catch (error) {
      console.error("Ошибка при выходе:", error);
      
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить выход. Попробуйте еще раз.",
        variant: "destructive",
      });
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Профиль обновлен",
        description: "Ваши данные профиля успешно обновлены",
      });
    }, 1000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPasswordDialog(false);
    
    // Simulate API call
    toast({
      title: "Пароль изменен",
      description: "Ваш пароль был успешно изменен",
    });
  };

  const handleDeleteAccount = () => {
    setShowDeleteAccountDialog(false);
    
    // Simulate API call
    toast({
      title: "Аккаунт удален",
      description: "Ваш аккаунт был успешно удален",
      variant: "destructive",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Профиль администратора
          </h1>
        </div>

        <Tabs defaultValue="personal" value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Личные данные</TabsTrigger>
            <TabsTrigger value="security">Безопасность</TabsTrigger>
            <TabsTrigger value="activity">Активность</TabsTrigger>
          </TabsList>
          
          <TabsContent value="personal" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-24 h-24 bg-[#2B5278] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        А
                      </div>
                      <button className="absolute bottom-0 right-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center border border-gray-300">
                        <i className="bi bi-pencil"></i>
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium mb-1">
                        Имя пользователя
                      </label>
                      <Input
                        id="username"
                        name="username"
                        defaultValue="admin"
                        placeholder="Имя пользователя"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-1">
                        Email
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue="admin@example.com"
                        placeholder="Ваш email"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                        Имя
                      </label>
                      <Input
                        id="firstName"
                        name="firstName"
                        defaultValue="Администратор"
                        placeholder="Ваше имя"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                        Фамилия
                      </label>
                      <Input
                        id="lastName"
                        name="lastName"
                        defaultValue="Системы"
                        placeholder="Ваша фамилия"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium mb-1">
                        Телефон
                      </label>
                      <Input
                        id="phone"
                        name="phone"
                        defaultValue="+7 (999) 123-45-67"
                        placeholder="Ваш телефон"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="telegramId" className="block text-sm font-medium mb-1">
                        Telegram ID
                      </label>
                      <Input
                        id="telegramId"
                        name="telegramId"
                        defaultValue="12345678"
                        placeholder="Ваш Telegram ID"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <Button 
                      type="submit" 
                      className="bg-[#2B5278] hover:bg-[#1F3C5C]"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <span className="inline-block animate-spin mr-1">⟳</span> Сохранение...
                        </>
                      ) : (
                        "Сохранить изменения"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Безопасность</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Изменение пароля</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Регулярно меняйте пароль для повышения безопасности вашего аккаунта
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPasswordDialog(true)}
                  >
                    Изменить пароль
                  </Button>
                </div>
                
                <hr />
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Двухфакторная аутентификация</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Защитите свой аккаунт с помощью дополнительного уровня безопасности
                  </p>
                  <Button>
                    Настроить 2FA
                  </Button>
                </div>
                
                <hr />
                
                <div>
                  <h3 className="text-lg font-medium mb-2 text-red-600">Опасная зона</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Необратимые действия, которые могут повлиять на ваш аккаунт
                  </p>
                  <Button 
                    variant="destructive" 
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Выйти из системы
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="activity" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>История активности</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">Вход в систему</h4>
                        <p className="text-sm text-gray-500">IP: 192.168.1.1</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">05.04.2025 17:30</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">Изменение настроек</h4>
                        <p className="text-sm text-gray-500">IP: 192.168.1.1</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">05.04.2025 15:45</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">Вход в систему</h4>
                        <p className="text-sm text-gray-500">IP: 192.168.1.1</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">04.04.2025 09:12</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">Управление пользователями</h4>
                        <p className="text-sm text-gray-500">IP: 192.168.1.1</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">04.04.2025 08:30</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Активные сессии</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <i className="bi bi-laptop text-xl mr-3"></i>
                      <div>
                        <h4 className="font-medium">Текущая сессия</h4>
                        <p className="text-sm text-gray-500">Chrome на Windows • IP: 192.168.1.1</p>
                      </div>
                    </div>
                    <span className="text-sm text-green-600 font-medium">Активна</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="flex items-center">
                      <i className="bi bi-phone text-xl mr-3"></i>
                      <div>
                        <h4 className="font-medium">Мобильная сессия</h4>
                        <p className="text-sm text-gray-500">Safari на iOS • IP: 192.168.1.2</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Завершить
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Диалоги */}
        <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удаление аккаунта</AlertDialogTitle>
              <AlertDialogDescription>
                Вы действительно хотите удалить свой аккаунт? Это действие необратимо и приведет к потере всех ваших данных.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700">
                Удалить аккаунт
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Изменение пароля</AlertDialogTitle>
            </AlertDialogHeader>
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4 py-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
                    Текущий пароль
                  </label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                    Новый пароль
                  </label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                    Подтверждение пароля
                  </label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Отмена</AlertDialogCancel>
                <AlertDialogAction type="submit">Изменить пароль</AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Profile;