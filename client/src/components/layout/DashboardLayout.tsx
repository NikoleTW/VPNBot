import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA]">
      {/* Sidebar for desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={toggleSidebar}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#2B5278]">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none max-h-[calc(100vh-4rem)] overflow-x-hidden">
          <div className="py-6 mx-auto px-4 sm:px-6 md:px-8">
            {children}
          </div>
          <footer className="bg-white border-t border-gray-200 py-4 px-4 sm:px-6 md:px-8 mt-6">
            <div className="text-center text-sm text-gray-500">
              © 2025 VPN Service. Все права защищены.
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
