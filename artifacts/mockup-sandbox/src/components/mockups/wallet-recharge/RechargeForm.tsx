import { useState } from "react";
import { ArrowRight, Receipt, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

const QUOTA_PER_DOLLAR = 500_000;
const USD_TO_RUB = 90;

const DISCOUNT_RATE = 0.88;
const BONUS_PCT = Math.round((1 / DISCOUNT_RATE - 1) * 100);

const PRESETS_RUB = [100, 300, 500, 1000, 3000, 5000, 10000, 30000];
const PRESETS_USD = [1, 5, 10, 25, 50, 100, 250, 500];
const MIN_RUB = 100;
const MIN_USD = 1;
const MAX_RUB = 50000;
const MAX_USD = 500;

function fmt(n: number, currency: "rub" | "usd") {
  if (currency === "rub") return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCredits(q: number) {
  if (q >= 1_000_000) return `${(q / 1_000_000).toFixed(2)} M`;
  if (q >= 1_000) return `${(q / 1_000).toFixed(1)} K`;
  return q.toString();
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium tabular-nums", highlight && "text-emerald-600 dark:text-emerald-400")}>{value}</span>
    </div>
  );
}

function SBPLogo() {
  return (
    <img
      src="/__mockup/images/sbp-logo.svg"
      alt="СБП"
      className="h-6 w-6 object-contain"
    />
  );
}

export function RechargeForm() {
  const [currency, setCurrency] = useState<"rub" | "usd">("rub");
  const [amount, setAmount] = useState(500);
  const [inputVal, setInputVal] = useState("500");

  const symbol = currency === "rub" ? "₽" : "$";
  const min = currency === "rub" ? MIN_RUB : MIN_USD;
  const max = currency === "rub" ? MAX_RUB : MAX_USD;
  const presets = currency === "rub" ? PRESETS_RUB : PRESETS_USD;

  const switchCurrency = (c: "rub" | "usd") => {
    setCurrency(c);
    const converted = c === "usd"
      ? Math.max(MIN_USD, Math.round((amount / USD_TO_RUB) * 100) / 100)
      : Math.max(MIN_RUB, Math.round(amount * USD_TO_RUB));
    const v = c === "usd" ? converted.toFixed(2) : String(converted);
    setAmount(Number(v));
    setInputVal(String(converted));
  };

  const handleInput = (val: string) => {
    setInputVal(val);
    const n = parseFloat(val) || 0;
    if (n >= 0) setAmount(n);
  };

  const handleSlider = (val: number) => {
    setAmount(val);
    setInputVal(currency === "usd" ? val.toFixed(2) : String(val));
  };

  const handlePreset = (p: number) => {
    setAmount(p);
    setInputVal(currency === "usd" ? p.toFixed(2) : String(p));
  };

  const amountRub = currency === "rub" ? amount : amount * USD_TO_RUB;
  const amountUsd = currency === "usd" ? amount : amount / USD_TO_RUB;

  const paymentAmount = Math.round(amountRub * DISCOUNT_RATE);
  const paymentAmountUsd = amountUsd * DISCOUNT_RATE;
  const withoutDiscount = amountRub;
  const withoutDiscountUsd = amountUsd;

  const totalCredits = Math.round(amountUsd * QUOTA_PER_DOLLAR);
  const ratePerMillion = totalCredits > 0 && paymentAmount > 0
    ? paymentAmount / (totalCredits / 1_000_000)
    : null;

  const sliderVal = Math.min(Math.max(amount, min), max);

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-8">
      <Card className="w-full max-w-3xl gap-0 overflow-hidden py-0">
        {/* Header */}
        <CardHeader className="border-b px-5 py-4 flex flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <WalletCards className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Пополнить баланс</CardTitle>
              <CardDescription className="text-xs">Выберите сумму и способ оплаты</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0 mt-0.5">
            <Receipt className="h-4 w-4" />
            История заказов
          </Button>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {/* Payment Method — FreeKassa only */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Способ оплаты
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center min-w-[80px] border-foreground bg-foreground/5 ring-1 ring-foreground/20 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60">
                  <SBPLogo />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-semibold leading-tight">FreeKassa</span>
                  <span className="text-muted-foreground text-[10px] leading-tight">Карты / СБП</span>
                </div>
              </button>
            </div>
          </div>

          {/* Currency selector */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Валюта
            </Label>
            <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
              {(["rub", "usd"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => switchCurrency(c)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                    currency === c
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c === "rub" ? "₽ Рубли" : "$ Доллары"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount + Summary */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
            {/* LEFT */}
            <div className="space-y-3">
              <Label htmlFor="topup-amount" className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Сумма пополнения
              </Label>

              {/* Input */}
              <div className="relative">
                <Input
                  id="topup-amount"
                  type="number"
                  value={inputVal}
                  onChange={(e) => handleInput(e.target.value)}
                  min={min}
                  placeholder={`Минимум ${min}`}
                  className="h-10 pr-8 text-base font-medium"
                />
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                  {symbol}
                </span>
              </div>

              {/* Compact slider */}
              <div className="px-0.5 max-w-xs">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={currency === "usd" ? 1 : 10}
                  value={sliderVal}
                  onChange={(e) => handleSlider(Number(e.target.value))}
                  className="w-full cursor-pointer accent-foreground"
                  style={{ height: "4px" }}
                />
                <div className="text-muted-foreground mt-0.5 flex justify-between text-[10px]">
                  <span>{min}{symbol}</span>
                  <span>{max.toLocaleString()}{symbol}</span>
                </div>
              </div>

              {/* Preset chips */}
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePreset(p)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      amount === p
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    {currency === "rub" ? p.toLocaleString() : `$${p}`}
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT: Summary */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              {/* Total */}
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase mb-1">Итого</p>
                <p className="text-2xl font-bold leading-none tabular-nums">
                  {currency === "rub"
                    ? fmt(paymentAmount, "rub")
                    : fmt(paymentAmountUsd, "usd")}
                  <span className="text-base font-normal text-muted-foreground ml-1">{symbol}</span>
                </p>
              </div>

              <div className="border-t pt-2.5 space-y-2">
                {/* Выгода */}
                <SummaryRow
                  label="Выгода"
                  value={`+${BONUS_PCT}%`}
                  highlight
                />

                {/* Без скидки */}
                <SummaryRow
                  label="Без скидки"
                  value={currency === "rub"
                    ? `${fmt(withoutDiscount, "rub")} ₽`
                    : `$${fmt(withoutDiscountUsd, "usd")}`}
                />

                {/* Курс */}
                {ratePerMillion != null && ratePerMillion > 0 && (
                  <SummaryRow
                    label="Курс"
                    value={`${fmt(ratePerMillion, "rub")} ₽ / 1M`}
                  />
                )}

                {/* Всего получите */}
                {totalCredits > 0 && (
                  <SummaryRow
                    label="Всего получите"
                    value={fmtCredits(totalCredits)}
                  />
                )}
              </div>

              <Button
                className="w-full gap-2 mt-1"
                onClick={() => alert(`Оплата: ${paymentAmount} ₽ через FreeKassa`)}
              >
                <ArrowRight className="h-4 w-4" />
                Перейти к оплате
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
