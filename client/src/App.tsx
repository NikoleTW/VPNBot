import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";
import Products from "@/pages/Products";
import Sales from "@/pages/Sales";
import PaymentMethods from "@/pages/PaymentMethods";
import TelegramBot from "@/pages/TelegramBot";
import Settings from "@/pages/Settings";
import Orders from "@/pages/Orders";
import UserDetail from "@/pages/UserDetail";
import NotFound from "@/pages/not-found";
import Checkout from "@/pages/Checkout";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";

// Компонент для защиты маршрутов
const ProtectedRoute = ({ component: Component, ...rest }: { component: React.ComponentType<any>, path?: string }) => {
  const [location, setLocation] = useLocation();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);
  
  if (!isAuthenticated) {
    return null; // Пока происходит редирект, ничего не отображаем
  }
  
  return <Component {...rest} />;
};

function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Защищенные маршруты */}
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={Users} />}
      </Route>
      <Route path="/users/:id">
        {params => <ProtectedRoute component={UserDetail} id={params.id} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={Products} />}
      </Route>
      <Route path="/sales">
        {() => <ProtectedRoute component={Sales} />}
      </Route>
      <Route path="/orders">
        {() => <ProtectedRoute component={Orders} />}
      </Route>
      <Route path="/payment-methods">
        {() => <ProtectedRoute component={PaymentMethods} />}
      </Route>
      <Route path="/telegram-bot">
        {() => <ProtectedRoute component={TelegramBot} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/checkout">
        {() => <ProtectedRoute component={Checkout} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      
      {/* Страница 404 */}
      <Route>
        {() => <ProtectedRoute component={NotFound} />}
      </Route>
    </Switch>
  );
}

export default App;
