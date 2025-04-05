import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SidebarLink = {
  href: string;
  label: string;
  icon: string;
};

const links: SidebarLink[] = [
  { href: "/", label: "Дашборд", icon: "bi-speedometer2" },
  { href: "/users", label: "Пользователи", icon: "bi-people" },
  { href: "/products", label: "Продукты", icon: "bi-box" },
  { href: "/sales", label: "Продажи", icon: "bi-cart" },
  { href: "/payment-methods", label: "Способы оплаты", icon: "bi-credit-card" },
  { href: "/telegram-bot", label: "Telegram Бот", icon: "bi-robot" },
];

const Sidebar = () => {
  const [location, setLocation] = useLocation();
  const [username, setUsername] = useState<string>("Админ");
  const { toast } = useToast();

  useEffect(() => {
    // Получение имени пользователя из localStorage при монтировании компонента
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const handleLogout = async () => {
    try {
      // Используем API для выхода
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
  
  return (
    <div className="flex flex-col w-64 bg-[#2B5278]">
      <div className="flex items-center justify-center h-16 bg-[#1F3C5C]">
        <span className="font-sans text-white text-xl font-semibold">
          Quantum VPN
        </span>
      </div>
      <div className="flex flex-col flex-grow overflow-y-auto">
        <nav className="flex-1 px-2 py-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center px-4 py-2 text-sm font-medium text-white rounded-md",
                location === link.href
                  ? "bg-[#3D6A94]"
                  : "hover:bg-[#3D6A94]"
              )}
            >
              <i className={`${link.icon} mr-3`}></i>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t border-[#3D6A94] p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center w-full cursor-pointer focus:outline-none">
            <div className="flex items-center">
              <div>
                <i className="bi bi-person-circle text-xl text-white"></i>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">{username}</p>
                <Link href="/profile" className="text-xs text-gray-300 flex items-center hover:text-white">
                  <span>Профиль</span>
                  <i className="bi bi-chevron-down ml-1"></i>
                </Link>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/profile">
                <i className="bi bi-person mr-2"></i>
                <span>Профиль</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings">
                <i className="bi bi-gear mr-2"></i>
                <span>Настройки</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-red-500" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right mr-2"></i>
              <span>Выйти</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default Sidebar;
