export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-gray-50 px-4 py-12">
      <div className="flex w-full max-w-[400px] flex-col gap-8">
        <p className="text-center text-lg font-semibold text-gray-900">
          週間時間割・生徒メモ・所見自動生成ツール
        </p>
        <div className="flex flex-col gap-6 rounded-md bg-white p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
