import { useState } from "react";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type TopbarProps = {
  toggleSidebar: () => void;
};

const Topbar = ({ toggleSidebar }: TopbarProps) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  
  const handleLogout = () => {
    setShowLogoutDialog(false);
    // Здесь будет обработка выхода из системы
    console.log("Выход из системы");
  };
  
  return (
    <div className="flex justify-between items-center px-4 py-2 bg-white shadow sm:px-6 md:px-8">
      <button
        className="md:hidden p-2 rounded-md text-[#2B5278] hover:bg-gray-100"
        onClick={toggleSidebar}
      >
        <i className="bi bi-list text-2xl"></i>
      </button>
      <div className="flex items-center">
        <div className="relative">
          <button
            className="p-2 rounded-md text-[#2B5278] hover:bg-gray-100 mr-2"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
          >
            <i className="bi bi-bell"></i>
          </button>
          
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-20">
              <div className="py-2 px-3 bg-gray-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-900">Уведомления</h3>
                  <button className="text-xs text-[#2B5278]">Отметить все как прочитанные</button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="p-3 hover:bg-gray-50 border-b border-gray-100">
                  <p className="text-sm text-gray-800">У вас нет новых уведомлений</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-md text-[#2B5278] hover:bg-gray-100 flex items-center">
              <i className="bi bi-person-circle mr-2"></i>
              <span className="hidden md:inline">Администратор</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <i className="bi bi-person mr-2"></i> Мой профиль
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <i className="bi bi-gear mr-2"></i> Настройки
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShowLogoutDialog(true)} className="text-red-600 cursor-pointer">
              <i className="bi bi-box-arrow-right mr-2"></i> Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выход из системы</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите выйти из системы?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Выйти</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Topbar;
