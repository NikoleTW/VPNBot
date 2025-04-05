import DashboardLayout from "@/components/layout/DashboardLayout";
import UserList from "@/components/users/UserList";

const Users = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-[#2C3E50] font-sans">
            Пользователи
          </h1>
        </div>

        <UserList />
      </div>
    </DashboardLayout>
  );
};

export default Users;
