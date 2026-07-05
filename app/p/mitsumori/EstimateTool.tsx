"use client";

import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/track";

const SLUG = "mitsumori";
const STORAGE_KEY = "mitsumori:estimate:v1";

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface EstimateState {
  issuerName: string;
  issuerAddress: string;
  issuerEmail: string;
  clientName: string;
  estimateNumber: string;
  issueDate: string;
  validUntil: string;
  items: LineItem[];
  taxRate: number;
  notes: string;
}

interface EstimateTotals {
  subtotal: number;
  tax: number;
  total: number;
}

function lineItemAmount(item: Pick<LineItem, "quantity" | "unitPrice">): number {
  return item.quantity * item.unitPrice;
}

function calculateTotals(items: LineItem[], taxRatePercent: number): EstimateTotals {
  const subtotal = items.reduce((sum, item) => sum + lineItemAmount(item), 0);
  const tax = Math.round(subtotal * (taxRatePercent / 100));
  return { subtotal, tax, total: subtotal + tax };
}

function formatYen(amount: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(amount)}円`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(baseISO: string, days: number): string {
  const date = new Date(`${baseISO}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function generateEstimateNumber(baseISO: string): string {
  return `MITSU-${baseISO.split("-").join("")}-1`;
}

function createId(): string {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function createLineItem(): LineItem {
  return { id: createId(), name: "", quantity: 1, unit: "式", unitPrice: 0 };
}

function createDefaultState(): EstimateState {
  const issueDate = todayISO();
  return {
    issuerName: "",
    issuerAddress: "",
    issuerEmail: "",
    clientName: "",
    estimateNumber: generateEstimateNumber(issueDate),
    issueDate,
    validUntil: addDaysISO(issueDate, 30),
    items: [createLineItem()],
    taxRate: 10,
    notes: "",
  };
}

function isEstimateState(value: unknown): value is EstimateState {
  return typeof value === "object" && value !== null && Array.isArray((value as EstimateState).items);
}

function loadState(): EstimateState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isEstimateState(parsed)) {
      return createDefaultState();
    }
    return { ...createDefaultState(), ...parsed };
  } catch {
    // 破損データは無視してデフォルトにフォールバック
    return createDefaultState();
  }
}

export function EstimateTool() {
  const [state, setState] = useState<EstimateState>(createDefaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // localStorage 復元はマウント後 1 回だけの外部システム同期のため許容する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const totals = useMemo(() => calculateTotals(state.items, state.taxRate), [state.items, state.taxRate]);

  function updateField<K extends keyof EstimateState>(key: K, value: EstimateState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function addItem() {
    setState((prev) => ({ ...prev, items: [...prev.items, createLineItem()] }));
  }

  function removeItem(id: string) {
    setState((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((item) => item.id !== id) : prev.items,
    }));
  }

  function handlePrint() {
    track("tool_use", SLUG, { action: "print" });
    window.print();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 print:grid-cols-1 print:gap-0">
      <section className="flex flex-col gap-6 print:hidden">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-zinc-300">自社情報</legend>
          <TextField
            label="事業者名"
            value={state.issuerName}
            onChange={(value) => updateField("issuerName", value)}
          />
          <TextField
            label="住所（任意）"
            value={state.issuerAddress}
            onChange={(value) => updateField("issuerAddress", value)}
          />
          <TextField
            label="メール（任意）"
            value={state.issuerEmail}
            onChange={(value) => updateField("issuerEmail", value)}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-zinc-300">宛先・見積情報</legend>
          <TextField
            label="宛先（会社名・氏名）"
            value={state.clientName}
            onChange={(value) => updateField("clientName", value)}
          />
          <TextField
            label="見積番号"
            value={state.estimateNumber}
            onChange={(value) => updateField("estimateNumber", value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="発行日"
              type="date"
              value={state.issueDate}
              onChange={(value) => updateField("issueDate", value)}
            />
            <TextField
              label="有効期限"
              type="date"
              value={state.validUntil}
              onChange={(value) => updateField("validUntil", value)}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-zinc-300">明細</legend>
          {state.items.map((item, index) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-md border border-zinc-800 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">明細 {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={state.items.length === 1}
                  className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-30"
                >
                  削除
                </button>
              </div>
              <TextField
                label="項目名"
                value={item.name}
                onChange={(value) => updateItem(item.id, { name: value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <NumberField
                  label="数量"
                  value={item.quantity}
                  onChange={(value) => updateItem(item.id, { quantity: value })}
                />
                <TextField
                  label="単位"
                  value={item.unit}
                  onChange={(value) => updateItem(item.id, { unit: value })}
                />
                <NumberField
                  label="単価"
                  value={item.unitPrice}
                  onChange={(value) => updateItem(item.id, { unitPrice: value })}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="rounded-md border border-dashed border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            + 明細行を追加
          </button>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-zinc-300">税・備考</legend>
          <NumberField
            label="消費税率（%）"
            value={state.taxRate}
            onChange={(value) => updateField("taxRate", value)}
          />
          <label className="flex flex-col gap-1 text-sm text-zinc-300">
            備考
            <textarea
              value={state.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={3}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </label>
        </fieldset>
      </section>

      <section>
        <div className="mb-4 flex justify-end print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
          >
            印刷・PDF保存
          </button>
        </div>
        <EstimatePreview state={state} totals={totals} />
      </section>
    </div>
  );
}

interface EstimatePreviewProps {
  state: EstimateState;
  totals: EstimateTotals;
}

function EstimatePreview({ state, totals }: EstimatePreviewProps) {
  return (
    <div className="mx-auto w-full max-w-[210mm] rounded-lg border border-zinc-300 bg-white p-8 text-zinc-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="mb-8 flex items-start justify-between border-b border-zinc-300 pb-4">
        <div className="text-sm text-zinc-500">
          <p>見積番号: {state.estimateNumber || "-"}</p>
          <p>発行日: {state.issueDate || "-"}</p>
          <p>有効期限: {state.validUntil || "-"}</p>
        </div>
        <h2 className="text-2xl font-bold tracking-widest">御見積書</h2>
      </div>

      <div className="mb-8 flex items-end justify-between">
        <p className="text-lg font-semibold">{state.clientName || "-"} 御中</p>
        <div className="text-right text-sm text-zinc-600">
          <p className="font-medium text-zinc-900">{state.issuerName || "-"}</p>
          {state.issuerAddress ? <p>{state.issuerAddress}</p> : null}
          {state.issuerEmail ? <p>{state.issuerEmail}</p> : null}
        </div>
      </div>

      <div className="mb-8 rounded-md bg-zinc-100 p-4">
        <p className="text-sm text-zinc-600">御見積金額</p>
        <p className="text-3xl font-bold">{formatYen(totals.total)}</p>
        <p className="text-xs text-zinc-500">（消費税込）</p>
      </div>

      <table className="mb-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-300 text-left text-zinc-600">
            <th className="py-2 font-medium">項目</th>
            <th className="py-2 text-right font-medium">数量</th>
            <th className="py-2 text-right font-medium">単位</th>
            <th className="py-2 text-right font-medium">単価</th>
            <th className="py-2 text-right font-medium">金額</th>
          </tr>
        </thead>
        <tbody>
          {state.items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200">
              <td className="py-2">{item.name || "-"}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{item.unit}</td>
              <td className="py-2 text-right">{formatYen(item.unitPrice)}</td>
              <td className="py-2 text-right">{formatYen(lineItemAmount(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-600">小計</span>
          <span>{formatYen(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">消費税（{state.taxRate}%）</span>
          <span>{formatYen(totals.tax)}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-300 pt-1 font-semibold">
          <span>合計</span>
          <span>{formatYen(totals.total)}</span>
        </div>
      </div>

      {state.notes ? (
        <div className="mt-8 border-t border-zinc-200 pt-4 text-sm text-zinc-600">
          <p className="mb-1 font-medium text-zinc-900">備考</p>
          <p className="whitespace-pre-wrap">{state.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
}

function TextField({ label, value, onChange, type = "text" }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
      />
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, onChange }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:border-zinc-500 focus:outline-none"
      />
    </label>
  );
}
