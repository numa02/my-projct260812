"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { Table } from "@/components/ui/Table";
import { CardList } from "@/components/ui/CardList";
import { CollapsibleList } from "@/components/ui/CollapsibleList";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner, FullScreenLoading } from "@/components/ui/LoadingSpinner";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { PasteOrUploadArea } from "@/components/ui/PasteOrUploadArea";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { GlobalNav } from "@/components/ui/GlobalNav";
import { TimetableGrid, type TimetableCell } from "@/components/timetable/TimetableGrid";

const sampleRows = [
  { id: "1", name: "1年1組", count: 28 },
  { id: "2", name: "1年2組", count: 30 },
];
const tableColumns = [
  { key: "name", header: "クラス名", render: (r: (typeof sampleRows)[number]) => r.name },
  {
    key: "count",
    header: "人数",
    render: (r: (typeof sampleRows)[number]) => `${r.count}人`,
  },
];

const timetableCells: TimetableCell[] = [
  { weekday: 1, period: 1, subjectLabel: "国語", classLabel: "1年1組" },
  { weekday: 1, period: 2, subjectLabel: null, classLabel: null },
  { weekday: 2, period: 1, subjectLabel: "算数", classLabel: "1年1組", changed: true },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-gray-200 pb-10">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

function Demo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {children}
    </div>
  );
}

function ComponentGallery() {
  const [toggleOn, setToggleOn] = useState(true);
  const [selectValue, setSelectValue] = useState("1");
  const [segmentValue, setSegmentValue] = useState("bulk");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullScreenLoading, setFullScreenLoading] = useState(false);
  const { showToast } = useToast();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">コンポーネントギャラリー(開発用)</h1>

      <Section title="Button">
        <Demo label="variant">
          <div className="flex gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </Demo>
        <Demo label="size">
          <div className="flex items-center gap-2">
            <Button size="sm">sm</Button>
            <Button size="md">md</Button>
            <Button size="lg">lg</Button>
          </div>
        </Demo>
        <Demo label="state">
          <div className="flex gap-2">
            <Button disabled>disabled</Button>
            <Button loading>loading</Button>
          </div>
        </Demo>
      </Section>

      <Section title="Input">
        <Demo label="text/email/password/number/date">
          <div className="flex w-64 flex-col gap-3">
            <Input label="クラス名" placeholder="1年1組" />
            <Input label="メールアドレス" type="email" />
            <Input label="パスワード" type="password" />
            <Input label="出席番号" type="number" />
            <Input label="日付" type="date" />
          </div>
        </Demo>
        <Demo label="error / disabled">
          <div className="flex w-64 flex-col gap-3">
            <Input label="クラス名" error="クラス名を入力してください" />
            <Input label="クラス名" disabled value="1年1組" onChange={() => {}} />
          </div>
        </Demo>
        <Demo label="textarea">
          <div className="w-64">
            <Textarea label="メモ" placeholder="よく発言していた" />
          </div>
        </Demo>
      </Section>

      <Section title="Select / SegmentedControl">
        <Demo label="通常セレクト">
          <div className="w-48">
            <Select
              label="クラス"
              options={[
                { value: "1", label: "1年1組" },
                { value: "2", label: "1年2組" },
              ]}
              value={selectValue}
              onChange={setSelectValue}
            />
          </div>
        </Demo>
        <Demo label="empty">
          <div className="w-48">
            <Select
              label="科目"
              options={[]}
              value=""
              onChange={() => {}}
              emptyMessage="先に科目を登録してください"
            />
          </div>
        </Demo>
        <Demo label="セグメントコントロール">
          <SegmentedControl
            aria-label="時間割入力モード"
            options={[
              { value: "bulk", label: "一括モード" },
              { value: "per-class", label: "教科担任制モード" },
            ]}
            value={segmentValue}
            onChange={setSegmentValue}
          />
        </Demo>
      </Section>

      <Section title="Toggle">
        <Demo label="on/off/disabled">
          <div className="flex items-center gap-4">
            <Toggle checked={toggleOn} onChange={setToggleOn} label="共有区分" />
            <Toggle checked={false} onChange={() => {}} disabled label="共有区分(disabled)" />
          </div>
        </Demo>
      </Section>

      <Section title="Table / CardList / CollapsibleList">
        <Demo label="Table(default)">
          <div className="w-96">
            <Table columns={tableColumns} rows={sampleRows} rowKey={(r) => r.id} />
          </div>
        </Demo>
        <Demo label="Table(loading)">
          <div className="w-96">
            <Table columns={tableColumns} rows={[]} rowKey={() => ""} loading />
          </div>
        </Demo>
        <Demo label="Table(empty)">
          <div className="w-96">
            <Table
              columns={tableColumns}
              rows={[]}
              rowKey={() => ""}
              emptyState={<EmptyState message="まだクラスがありません" actionLabel="クラスを作成" onAction={() => {}} />}
            />
          </div>
        </Demo>
        <Demo label="CardList">
          <div className="w-72">
            <CardList
              rows={sampleRows}
              rowKey={(r) => r.id}
              renderItem={(r) => <Card title={r.name} meta={`${r.count}人`} body="生徒一覧を表示" />}
            />
          </div>
        </Demo>
        <Demo label="CollapsibleList(折りたたみリスト)">
          <div className="w-96">
            <CollapsibleList
              rows={[
                { id: "1", name: "生徒A" },
                { id: "2", name: "生徒B" },
              ]}
              rowKey={(r) => r.id}
              renderSummary={(r) => r.name}
              renderExpanded={(r) => (
                <Textarea label={`${r.name}のメモ`} placeholder="よく発言していた" />
              )}
              expandedRowId={expandedRowId}
              onToggleRow={(id) => setExpandedRowId((prev) => (prev === id ? null : id))}
            />
          </div>
        </Demo>
      </Section>

      <Section title="Card">
        <Demo label="default / selected">
          <div className="flex gap-4">
            <Card title="4/10(金) 1限" meta="国語" body="よく発言していた" />
            <Card
              title="2026年度前期"
              meta="直接生成"
              body="順調に成長しています"
              selected
              onClick={() => {}}
            />
          </div>
        </Demo>
      </Section>

      <Section title="Modal / ConfirmDialog">
        <Demo label="Modal">
          <Button onClick={() => setModalOpen(true)}>マス編集モーダルを開く</Button>
          <Modal title="マス編集" open={modalOpen} onClose={() => setModalOpen(false)}>
            <Select
              label="科目"
              options={[{ value: "1", label: "国語" }]}
              value="1"
              onChange={() => {}}
            />
          </Modal>
        </Demo>
        <Demo label="ConfirmDialog(danger)">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            削除確認ダイアログを開く
          </Button>
          <ConfirmDialog
            title="生徒を削除しますか"
            body="この生徒を削除すると、記録済みのメモ・所見もすべて完全に削除され、復元できません"
            open={confirmOpen}
            variant="danger"
            confirmLabel="削除する"
            onConfirm={() => setConfirmOpen(false)}
            onCancel={() => setConfirmOpen(false)}
          />
        </Demo>
      </Section>

      <Section title="InlineMessage">
        <Demo label="info / warning">
          <div className="flex w-96 flex-col gap-2">
            <InlineMessage
              variant="info"
              message="本文に書いた氏名等の情報はそのままAIへ送信されます"
            />
            <InlineMessage
              variant="warning"
              message="過去にAIへ送信済みの内容そのものは取り消せません"
            />
          </div>
        </Demo>
      </Section>

      <Section title="Toast">
        <Demo label="success / error">
          <div className="flex gap-2">
            <Button onClick={() => showToast("success", "保存しました")}>成功トースト</Button>
            <Button variant="danger" onClick={() => showToast("error", "保存に失敗しました")}>
              失敗トースト
            </Button>
          </div>
        </Demo>
      </Section>

      <Section title="EmptyState">
        <Demo label="案内文のみ / アクション付き">
          <div className="flex gap-4">
            <div className="w-64">
              <EmptyState message="メモがまだありません" />
            </div>
            <div className="w-64">
              <EmptyState
                message="まだクラスがありません"
                actionLabel="クラスを作成"
                onAction={() => {}}
              />
            </div>
          </div>
        </Demo>
      </Section>

      <Section title="LoadingSpinner / Skeleton">
        <Demo label="インライン / ラベル付き">
          <div className="flex items-center gap-4">
            <LoadingSpinner />
            <LoadingSpinner label="所見を生成しています..." />
          </div>
        </Demo>
        <Demo label="Skeleton">
          <div className="flex w-64 flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <SkeletonRow columns={3} />
          </div>
        </Demo>
      </Section>

      <Section title="Badge / Tag">
        <Demo label="バリエーション">
          <div className="flex flex-wrap gap-2">
            <Badge variant="shared" label="共有する" />
            <Badge variant="private" label="共有しない" />
            <Badge variant="direct_ai" label="直接生成" />
            <Badge variant="prompt_copy" label="プロンプトコピー運用" />
            <Badge variant="manual" label="手動作成" />
            <Badge variant="changed" label="変更あり" />
            <Badge variant="recorded" label="入力済み" />
          </div>
        </Demo>
      </Section>

      <Section title="PasteOrUploadArea">
        <div className="w-[28rem]">
          <PasteOrUploadArea
            onImport={() => {}}
            reasonLabels={{
              MISSING_FIELD: "出席番号または氏名が空です",
              DUPLICATE_IN_BATCH: "取り込みデータ内で出席番号が重複しています",
            }}
            pasteLabel="出席番号,氏名 の形式で貼り付けてください(ヘッダー行なし)"
            fileInputAriaLabel="生徒名簿CSVファイル"
            segmentedControlAriaLabel="生徒名簿の取り込み方法"
            errorRows={[
              { rowIndex: 3, reason: "MISSING_FIELD", name: null },
              { rowIndex: 5, reason: "DUPLICATE_IN_BATCH", name: "生徒C" },
            ]}
          />
        </div>
      </Section>

      <Section title="CodeBadge">
        <div className="flex items-center gap-2">
          <span>山田太郎</span>
          <CodeBadge code="1-03-10" />
        </div>
      </Section>

      <Section title="TimetableGrid">
        <Demo label="master">
          <TimetableGrid mode="master" cells={timetableCells} onCellClick={() => {}} />
        </Demo>
        <Demo label="weekly(変更あり表示)">
          <TimetableGrid mode="weekly" cells={timetableCells} onCellClick={() => {}} />
        </Demo>
      </Section>

      <Section title="GlobalNav">
        <div className="h-96 overflow-hidden rounded-md border border-gray-200">
          <GlobalNav
            navItems={[
              { href: "/classes", label: "クラス管理" },
              { href: "/students", label: "生徒名簿" },
              { href: "/subjects", label: "科目管理" },
            ]}
            currentPath="/students"
            onLogout={() => {}}
          />
        </div>
      </Section>

      <Section title="FullScreenLoading">
        <Demo label="AI生成待ちなど時間のかかる処理向け">
          <Button
            onClick={() => {
              setFullScreenLoading(true);
              setTimeout(() => setFullScreenLoading(false), 2000);
            }}
          >
            2秒間表示する
          </Button>
        </Demo>
      </Section>
      {fullScreenLoading && <FullScreenLoading label="所見を生成しています..." />}
    </div>
  );
}

export default function ComponentGalleryPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ComponentGallery />;
}
