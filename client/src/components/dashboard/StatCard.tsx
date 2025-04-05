import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: string;
  iconBgColor: string;
  change?: {
    value: string;
    isPositive: boolean;
  };
  subtitle?: string;
};

const StatCard = ({ title, value, icon, iconBgColor, change, subtitle }: StatCardProps) => {
  return (
    <div className="bg-white rounded-lg shadow p-5 transition-all hover:shadow-md">
      <div className="flex items-center">
        <div className={cn("flex-shrink-0 rounded-md p-3", iconBgColor)}>
          <i className={`${icon} text-xl`}></i>
        </div>
        <div className="ml-5">
          <p className="text-gray-500 text-sm">{title}</p>
          <h2 className="text-2xl font-bold font-sans">{value}</h2>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
      </div>
      {change && (
        <div className="mt-3">
          <span
            className={cn(
              "text-sm font-medium",
              change.isPositive ? "text-[#34C759]" : "text-[#E74C3C]"
            )}
          >
            <i className={`bi bi-arrow-${change.isPositive ? "up" : "down"}`}></i>{" "}
            {change.value}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
