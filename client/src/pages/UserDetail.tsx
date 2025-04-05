import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { userApi, orderApi, vpnConfigApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

type UserDetailProps = {
  id: string;
};

const UserDetail = ({ id }: UserDetailProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const userId = parseInt(id, 10);

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: () => userApi.getUser(userId),
  });

  const { data: configs, isLoading: isLoadingConfigs } = useQuery({
    queryKey: [`/api/vpn-configs`, { userId }],
    queryFn: () => vpnConfigApi.getUserVpnConfigs(userId),
    enabled: !!userId,
  });

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: [`/api/orders`, { userId }],
    queryFn: () => orderApi.getUserOrders(userId),
    enabled: !!userId,
  });

  const blockUserMutation = useMutation({
    mutationFn: ({ id, isBlocked }: { id: number; isBlocked: boolean }) =>
      userApi.blockUser(id, isBlocked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      toast({
        title: user?.isBlocked ? "Пользователь разблокирован" : "Пользователь заблокирован",
        description: user?.isBlocked 
          ? "Пользователь успешно разблокирован" 
          : "Пользователь успешно заблокирован",
      });
      setIsBlocking(false);
      setIsUnblocking(false);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось изменить статус пользователя: ${error}`,
        variant: "destructive",
      });
      setIsBlocking(false);
      setIsUnblocking(false);
    },
  });

  const clearCacheMutation = useMutation({
    mutationFn: (telegramId: string) => {
      // In a real app, this would call an actual API endpoint
      // This is just a mock implementation for demonstration
      return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 1000);
      });
    },
    onSuccess: () => {
      toast({
        title: "Кэш очищен",
        description: "Кэш конфигураций пользователя успешно очищен",
      });
      setIsClearingCache(false);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось очистить кэш: ${error}`,
        variant: "destructive",
      });
      setIsClearingCache(false);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => {
      // In a real app, this would call an actual API endpoint
      // This is just a mock implementation for demonstration
      return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 1000);
      });
    },
    onSuccess: () => {
      toast({
        title: "Сообщение отправлено",
        description: "Сообщение успешно отправлено пользователю",
      });
      setMessageDialogOpen(false);
      setMessage("");
      setIsSendingMessage(false);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось отправить сообщение: ${error}`,
        variant: "destructive",
      });
      setIsSendingMessage(false);
    },
  });

  const handleToggleBlock = () => {
    if (!user) return;
    
    if (user.isBlocked) {
      setIsUnblocking(true);
    } else {
      setIsBlocking(true);
    }
    
    blockUserMutation.mutate({ id: user.id, isBlocked: !user.isBlocked });
  };

  const handleClearCache = () => {
    if (!user || !user.telegramId) return;
    
    setIsClearingCache(true);
    clearCacheMutation.mutate(user.telegramId);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;
    
    setIsSendingMessage(true);
    sendMessageMutation.mutate(message);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Выполнен</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Ожидает</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Отменен</Badge>;
      case "awaiting_confirmation":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Ожидает подтверждения</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoadingUser) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B5278]"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-xl font-semibold mb-2">Пользователь не найден</h2>
          <p className="text-gray-500 mb-4">Пользователь с ID {id} не существует или был удален</p>
          <Link href="/users">
            <Button variant="outline">Вернуться к списку пользователей</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Профиль пользователя
          </h1>
          <div>
            <Link href="/users">
              <Button variant="outline">
                <i className="bi bi-arrow-left mr-2"></i> Назад к списку
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Информация о пользователе</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <tbody>
                  <tr>
                    <th className="py-2 text-left text-gray-500 w-[30%]">ID:</th>
                    <td>{user.id}</td>
                  </tr>
                  <tr>
                    <th className="py-2 text-left text-gray-500">Telegram ID:</th>
                    <td>{user.telegramId || '-'}</td>
                  </tr>
                  <tr>
                    <th className="py-2 text-left text-gray-500">Имя:</th>
                    <td>{user.firstName}</td>
                  </tr>
                  <tr>
                    <th className="py-2 text-left text-gray-500">Фамилия:</th>
                    <td>{user.lastName || '-'}</td>
                  </tr>
                  <tr>
                    <th className="py-2 text-left text-gray-500">Имя пользователя:</th>
                    <td>@{user.username || '-'}</td>
                  </tr>
                  <tr>
                    <th className="py-2 text-left text-gray-500">Дата регистрации:</th>
                    <td>{formatDate(user.registrationDate)}</td>
                  </tr>
                  <tr>
                    <th className="py-2 text-left text-gray-500">Статус:</th>
                    <td>
                      {user.isBlocked ? (
                        <Badge variant="destructive">Заблокирован</Badge>
                      ) : (
                        <Badge className="bg-green-500">Активен</Badge>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  variant={user.isBlocked ? "success" : "destructive"}
                  onClick={handleToggleBlock}
                  disabled={isBlocking || isUnblocking}
                >
                  {isBlocking || isUnblocking ? (
                    <>
                      <span className="inline-block animate-spin mr-1">⟳</span>
                      {user.isBlocked ? "Разблокировка..." : "Блокировка..."}
                    </>
                  ) : (
                    <>
                      <i className={`bi bi-${user.isBlocked ? 'unlock' : 'lock'} mr-2`}></i>
                      {user.isBlocked ? "Разблокировать" : "Заблокировать"}
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setMessageDialogOpen(true)}
                >
                  <i className="bi bi-message-square mr-2"></i> Отправить сообщение
                </Button>
                
                {user.telegramId && (
                  <Button
                    variant="outline"
                    onClick={handleClearCache}
                    disabled={isClearingCache}
                  >
                    {isClearingCache ? (
                      <>
                        <span className="inline-block animate-spin mr-1">⟳</span> Очистка...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-refresh-cw mr-2"></i> Очистить кэш конфигураций
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* VPN Configurations Card */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>VPN-конфигурации</CardTitle>
              <Badge className="bg-gray-200 text-gray-800">
                {isLoadingConfigs ? "..." : configs?.length || 0}
              </Badge>
            </CardHeader>
            <CardContent>
              {isLoadingConfigs ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
                </div>
              ) : configs && configs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">ID</th>
                        <th className="px-4 py-2 text-left">Название</th>
                        <th className="px-4 py-2 text-left">Тип</th>
                        <th className="px-4 py-2 text-left">Срок действия</th>
                        <th className="px-4 py-2 text-left">Статус</th>
                        <th className="px-4 py-2 text-left">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {configs.map((config) => (
                        <tr key={config.id}>
                          <td className="px-4 py-2">{config.id}</td>
                          <td className="px-4 py-2">{config.name}</td>
                          <td className="px-4 py-2">{config.configType}</td>
                          <td className="px-4 py-2">
                            {new Date(config.validUntil).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            {config.isActive ? (
                              <Badge className="bg-green-100 text-green-800">Активна</Badge>
                            ) : (
                              <Badge variant="destructive">Неактивна</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <Link href={`/configs/${config.id}`}>
                              <Button size="sm" variant="outline">
                                <i className="bi bi-eye"></i>
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-6 text-gray-500">
                  У пользователя нет активных VPN-конфигураций
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order History Card */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>История заказов</CardTitle>
            <Badge className="bg-gray-200 text-gray-800">
              {isLoadingOrders ? "..." : orders?.length || 0}
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoadingOrders ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      <th className="px-4 py-2 text-left">Продукт</th>
                      <th className="px-4 py-2 text-left">Сумма</th>
                      <th className="px-4 py-2 text-left">Статус</th>
                      <th className="px-4 py-2 text-left">Дата создания</th>
                      <th className="px-4 py-2 text-left">Дата оплаты</th>
                      <th className="px-4 py-2 text-left">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-2">{order.id}</td>
                        <td className="px-4 py-2">ID: {order.productId}</td>
                        <td className="px-4 py-2">{(order.amount / 100).toFixed(2)} руб.</td>
                        <td className="px-4 py-2">{getStatusBadge(order.status)}</td>
                        <td className="px-4 py-2">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-2">{order.paidAt ? formatDate(order.paidAt) : '-'}</td>
                        <td className="px-4 py-2">
                          <Link href={`/orders/${order.id}`}>
                            <Button size="sm" variant="outline">
                              <i className="bi bi-eye"></i>
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-6 text-gray-500">
                У пользователя нет истории заказов
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить сообщение пользователю</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendMessage}>
            <div className="mb-4">
              <label htmlFor="message" className="block text-sm font-medium mb-1">
                Текст сообщения
              </label>
              <textarea
                id="message"
                className="w-full p-2 border rounded-md focus:ring-[#2B5278] focus:border-[#2B5278]"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Отмена
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={isSendingMessage || !message.trim()}
              >
                {isSendingMessage ? (
                  <>
                    <span className="inline-block animate-spin mr-1">⟳</span> Отправка...
                  </>
                ) : (
                  "Отправить"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UserDetail;
