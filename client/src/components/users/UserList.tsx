import { useState, useMemo, useRef } from "react";
import { Link } from "wouter";
import { User } from "@shared/schema";
import { userApi, vpnConfigApi, telegramBotApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, User as UserIcon, Lock, Unlock, SendHorizonal, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const UserList = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: userApi.getUsers,
  });
  
  // Get user configs data
  const { data: vpnConfigs } = useQuery({
    queryKey: ["/api/vpn-configs"],
    queryFn: vpnConfigApi.getVpnConfigs,
  });

  // State for filters and dialogs
  const [statusFilter, setStatusFilter] = useState("all");
  const [configFilter, setConfigFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  
  // State for message dialog
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Block/unblock mutation
  const blockUserMutation = useMutation({
    mutationFn: ({ id, isBlocked }: { id: number; isBlocked: boolean }) => 
      userApi.blockUser(id, isBlocked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Успешно",
        description: "Статус пользователя обновлен",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось обновить статус: ${error}`,
        variant: "destructive",
      });
    }
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ userId, message }: { userId: number; message: string }) => 
      telegramBotApi.sendMessage(userId, message),
    onSuccess: () => {
      setMessageDialogOpen(false);
      setMessage("");
      toast({
        title: "Сообщение отправлено",
        description: "Пользователь получил ваше сообщение",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка отправки",
        description: `Не удалось отправить сообщение: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Get user configs count
  const getUserConfigsCount = (userId: number) => {
    if (!vpnConfigs) return 0;
    return vpnConfigs.filter(config => config.userId === userId).length;
  };
  
  // Apply filters to users list
  const filteredUsers = useMemo(() => {
    if (!users || !vpnConfigs) return [];

    return users.filter((user) => {
      // Status filter
      if (statusFilter === "active" && user.isBlocked) return false;
      if (statusFilter === "blocked" && !user.isBlocked) return false;

      // Config filter
      const configCount = getUserConfigsCount(user.id);
      if (configFilter === "with_config" && configCount === 0) return false;
      if (configFilter === "without_config" && configCount > 0) return false;

      // Search text filter
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const fullName = `${user.firstName} ${user.lastName || ""}`.toLowerCase();
        const username = user.username.toLowerCase();
        const telegramId = user.telegramId?.toLowerCase() || "";

        return (
          fullName.includes(searchLower) ||
          username.includes(searchLower) ||
          telegramId.includes(searchLower)
        );
      }

      return true;
    });
  }, [users, vpnConfigs, statusFilter, configFilter, searchText]);

  // Добавляем состояние и мутацию для массовой рассылки
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  
  const sendBroadcastMutation = useMutation({
    mutationFn: (message: string) => telegramBotApi.sendBroadcast(message),
    onSuccess: (data) => {
      toast({
        title: "Сообщение отправлено",
        description: `Успешно отправлено ${data.sent} пользователям. Не удалось отправить: ${data.failed}`,
        variant: "default",
      });
      setBroadcastDialogOpen(false);
      setBroadcastMessage("");
    },
    onError: (error) => {
      toast({
        title: "Ошибка при массовой рассылке",
        description: `Не удалось отправить сообщение: ${error}`,
        variant: "destructive",
      });
    }
  });

  const resetFilters = () => {
    setStatusFilter("all");
    setConfigFilter("all");
    setSearchText("");
  };

  return (
    <div>
      <div className="flex justify-between mb-3">
        <Button
          variant="default"
          size="sm"
          onClick={() => setBroadcastDialogOpen(true)}
          className="bg-[#2B5278] hover:bg-[#1d3c57]"
        >
          <MessageSquare className="mr-2 h-4 w-4" /> Массовая рассылка
        </Button>
      
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterVisible(!filterVisible)}
        >
          <i className="bi bi-filter mr-2"></i> Фильтр
        </Button>
      </div>

      {filterVisible && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Статус</label>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="active">Активные</SelectItem>
                    <SelectItem value="blocked">Заблокированные</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Наличие конфигураций
                </label>
                <Select
                  value={configFilter}
                  onValueChange={setConfigFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите фильтр" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="with_config">С конфигурацией</SelectItem>
                    <SelectItem value="without_config">Без конфигурации</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Поиск</label>
                <Input
                  placeholder="Имя, ID, номер телефона"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="mr-2"
              >
                Сбросить
              </Button>
              <Button size="sm">Применить</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telegram ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Имя
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Имя пользователя
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата регистрации
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Кол-во конфиг.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Заказы
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B5278]"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.telegramId || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.firstName} {user.lastName || ""}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      @{user.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(user.registrationDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isBlocked ? (
                        <Badge variant="destructive">Заблокирован</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500">
                          Активен
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getUserConfigsCount(user.id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {/* В реальном приложении здесь будет реальное количество заказов */}
                      {user.id % 3}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-1">
                        <Link href={`/users/${user.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[#2B5278]"
                          >
                            <UserIcon className="h-4 w-4" />
                          </Button>
                        </Link>
                        
                        {/* Кнопка отправки сообщения пользователю */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-blue-500"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setMessageDialogOpen(true);
                                }}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Отправить сообщение</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        {/* Кнопка блокировки/разблокировки пользователя */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={user.isBlocked ? "text-green-500" : "text-red-500"}
                                  >
                                    {user.isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {user.isBlocked ? "Разблокировать пользователя?" : "Заблокировать пользователя?"}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {user.isBlocked 
                                        ? "Пользователь сможет снова использовать бота и сервис."
                                        : "Пользователь не сможет использовать бота и сервис после блокировки."}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => blockUserMutation.mutate({ 
                                        id: user.id, 
                                        isBlocked: !user.isBlocked 
                                      })}
                                    >
                                      {user.isBlocked ? "Разблокировать" : "Заблокировать"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{user.isBlocked ? "Разблокировать" : "Заблокировать"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    Пользователи не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Диалог отправки сообщения */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отправить сообщение пользователю</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <span className="font-medium">
                  {selectedUser.firstName} {selectedUser.lastName} (@{selectedUser.username})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Введите сообщение..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending}
              onClick={() => {
                if (selectedUser && message.trim()) {
                  sendMessageMutation.mutate({
                    userId: selectedUser.id,
                    message: message.trim()
                  });
                }
              }}
            >
              {sendMessageMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <SendHorizonal className="mr-2 h-4 w-4" />
                  Отправить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Диалог массовой рассылки */}
      <Dialog open={broadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Массовая рассылка сообщений</DialogTitle>
            <DialogDescription>
              Сообщение будет отправлено всем активным пользователям.
              {users && (
                <div className="mt-2 text-sm">
                  Всего пользователей: <span className="font-medium">{users.length}</span><br />
                  Активных пользователей: <span className="font-medium">{users.filter(u => !u.isBlocked).length}</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Введите текст сообщения для массовой рассылки..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="min-h-[150px]"
            />
          </div>
          <DialogFooter className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:justify-between">
            <div className="text-sm text-gray-500">
              {broadcastMessage.length > 0 && (
                <span>Количество символов: {broadcastMessage.length}</span>
              )}
            </div>
            <Button
              type="submit"
              disabled={!broadcastMessage.trim() || sendBroadcastMutation.isPending}
              onClick={() => {
                if (broadcastMessage.trim()) {
                  sendBroadcastMutation.mutate(broadcastMessage.trim());
                }
              }}
              className="bg-[#2B5278] hover:bg-[#1d3c57]"
            >
              {sendBroadcastMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <SendHorizonal className="mr-2 h-4 w-4" />
                  Отправить всем
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserList;
