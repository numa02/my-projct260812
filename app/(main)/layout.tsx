"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Users,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  KeyRound,
  NotebookPen,
  Download,
} from "lucide-react";
import { GlobalNav, type NavItem } from "@/components/ui/GlobalNav";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

// 実装済みの画面のみを掲載する。今後の画面実装タスクで追加していく
const NAV_ITEMS: NavItem[] = [
  { href: "/classes", label: "クラス管理", icon: LayoutGrid },
  { href: "/students", label: "生徒名簿", icon: Users },
  { href: "/subjects", label: "科目管理", icon: BookOpen },
  { href: "/timetable/master", label: "時間割マスタ設定", icon: CalendarDays },
  { href: "/timetable/weekly", label: "週次時間割", icon: CalendarRange },
  { href: "/memos/students", label: "生徒別メモ一覧", icon: ClipboardList },
  { href: "/settings/ai-provider", label: "AIプロバイダ設定", icon: KeyRound },
  { href: "/settings/prompt-template", label: "プロンプトひな形編集", icon: NotebookPen },
  { href: "/settings/export", label: "データエクスポート", icon: Download },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex h-screen">
      <GlobalNav navItems={NAV_ITEMS} currentPath={pathname} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
