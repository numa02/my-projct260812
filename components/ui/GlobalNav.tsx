import type { ComponentType } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

export interface GlobalNavProps {
  navItems: NavItem[];
  currentPath: string;
  onLogout: () => void;
}

/**
 * 画面全体の高さに固定されたサイドバー。メインコンテンツとは独立にスクロールする
 * (サイドバー自体はh-screen+overflow-y-autoで、中身が収まらない場合のみサイドバー内でスクロールする)。
 * グローバルな「選択中のクラス」は持たない(F1参照)。
 */
export function GlobalNav({ navItems, currentPath, onLogout }: GlobalNavProps) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white">
      <nav aria-label="メインナビゲーション" className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map((item) => {
          const active =
            currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden />}
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
