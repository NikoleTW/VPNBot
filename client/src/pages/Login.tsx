import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/auth";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  // Проверка при загрузке, если пользователь уже авторизован
  useEffect(() => {
    if (auth.isAuthenticated()) {
      setLocation("/");
    }
    
    // Здесь можно проверить, нужно ли инициализировать первого админа
    // Для упрощения пока будем исходить из того, что это не требуется
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Ошибка входа",
        description: "Пожалуйста, введите имя пользователя и пароль",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (isInitialSetup) {
        // Создание первого админа
        await auth.setupAdmin({ username, password, email });
        
        toast({
          title: "Аккаунт создан",
          description: "Аккаунт администратора успешно создан. Теперь вы можете войти.",
        });
        
        setIsInitialSetup(false);
      } else {
        // Обычный вход
        await auth.login({ username, password });
        
        toast({
          title: "Вход выполнен",
          description: "Добро пожаловать в панель управления!",
        });
        
        // Перенаправление на главную страницу
        setLocation("/");
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Произошла ошибка при попытке входа";
      
      if (errorMessage.includes("401")) {
        toast({
          title: "Ошибка входа",
          description: "Неверное имя пользователя или пароль",
          variant: "destructive",
        });
      } else if (errorMessage.includes("404") && !isInitialSetup) {
        // Возможно, сервер не настроен или нет аккаунтов админа, предложить создать первый аккаунт
        setIsInitialSetup(true);
        toast({
          title: "Первый запуск системы",
          description: "Создайте учетную запись администратора",
        });
      } else {
        toast({
          title: "Ошибка входа",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA]">
      <div className="w-full max-w-md p-4">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#2B5278] flex items-center justify-center text-white">
                <i className="bi bi-shield-lock text-2xl"></i>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">Quantum VPN</CardTitle>
            <CardDescription className="text-center">
              {isInitialSetup ? "Создание аккаунта администратора" : "Панель администратора"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Имя пользователя</Label>
                  <Input
                    id="username"
                    placeholder="Введите имя пользователя"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                
                {isInitialSetup && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (необязательно)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Введите email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Пароль</Label>
                    {!isInitialSetup && (
                      <a
                        href="#"
                        className="text-sm text-[#2B5278] hover:underline"
                      >
                        Забыли пароль?
                      </a>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-[#2B5278] hover:bg-[#1F3C5C]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <i className="bi bi-arrow-clockwise animate-spin mr-2"></i>
                      {isInitialSetup ? "Создание..." : "Вход..."}
                    </>
                  ) : (
                    isInitialSetup ? "Создать аккаунт" : "Войти"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter className="text-center text-sm text-gray-500">
            <div className="w-full">
              &copy; {new Date().getFullYear()} Quantum VPN. Все права защищены.
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;