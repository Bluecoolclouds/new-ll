import { useState } from "react";
import { ArrowRight, Receipt, WalletCards, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function cn(...classes: (string | undefined | false | null)[]) {
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

function fmt(n: number, d = 0) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: d });
}
function fmtCredits(q: number) {
  if (q >= 1_000_000) return `${(q / 1_000_000).toFixed(2)} M`;
  if (q >= 1_000) return `${(q / 1_000).toFixed(1)} K`;
  return q.toString();
}

function SBPLogo() {
  return (
    <img src="/__mockup/images/sbp-logo.svg" alt="СБП" className="h-5 w-5 object-contain" />
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
        {n}
      </span>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function VariantA() {
  const [currency, setCurrency] = useState<"rub" | "usd">("rub");
  const [amount, setAmount] = useState(500);
  const [inputVal, setInputVal] = useState("500");
  const [selectedMethod, setSelectedMethod] = useState<string>("freekassa");

  const symbol = currency === "rub" ? "₽" : "$";
  const min = currency === "rub" ? MIN_RUB : MIN_USD;
  const max = currency === "rub" ? MAX_RUB : MAX_USD;
  const presets = currency === "rub" ? PRESETS_RUB : PRESETS_USD;

  const switchCurrency = (c: "rub" | "usd") => {
    setCurrency(c);
    const converted =
      c === "usd"
        ? Math.max(MIN_USD, Math.round((amount / USD_TO_RUB) * 100) / 100)
        : Math.max(MIN_RUB, Math.round(amount * USD_TO_RUB));
    setAmount(converted);
    setInputVal(c === "usd" ? converted.toFixed(2) : String(converted));
  };

  const handleInput = (val: string) => {
    setInputVal(val);
    const n = parseFloat(val) || 0;
    if (n >= 0) setAmount(n);
  };

  const handlePreset = (p: number) => {
    setAmount(p);
    setInputVal(currency === "usd" ? p.toFixed(2) : String(p));
  };

  const amountUsd = currency === "usd" ? amount : amount / USD_TO_RUB;
  const paymentAmount = currency === "rub"
    ? Math.round(amount * DISCOUNT_RATE)
    : amountUsd * DISCOUNT_RATE;
  const withoutDiscount = amount;
  const totalCredits = Math.round(amountUsd * QUOTA_PER_DOLLAR);

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-6 pt-8">
      <Card className="w-full max-w-2xl gap-0 overflow-hidden py-0 shadow-md">
        {/* ── Header ───────────────────────────────────────────────── */}
        <CardHeader className="border-b px-5 py-4 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <WalletCards className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Добавить средства</p>
              <p className="text-xs text-muted-foreground mt-0.5">Выберите сумму и способ оплаты</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground shrink-0">
            <Receipt className="h-3.5 w-3.5" />
            <span className="text-xs">История</span>
          </Button>
        </CardHeader>

        <CardContent className="p-5 space-y-6">
          {/* ── Step 1: Method ───────────────────────────────────────── */}
          <div>
            <StepLabel n={1} label="Способ оплаты" />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod("freekassa")}
                className={cn(
                  "inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all",
                  selectedMethod === "freekassa"
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : "border-border bg-background text-foreground hover:border-foreground/30"
                )}
              >
                <span className={cn(
                  "flex h-5 w-5 items-center justify-center",
                  selectedMethod === "freekassa" ? "[&>img]:brightness-0 [&>img]:invert" : ""
                )}>
                  <SBPLogo />
                </span>
                FreeKassa
                <span className={cn(
                  "text-xs leading-none",
                  selectedMethod === "freekassa" ? "text-background/60" : "text-muted-foreground"
                )}>
                  · Карты / СБП
                </span>
              </button>
            </div>
          </div>

          {/* ── Step 2: Amount ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <StepLabel n={2} label="Сумма пополнения" />
              {/* Currency toggle */}
              <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 gap-0.5 -mt-2.5">
                {(["rub", "usd"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => switchCurrency(c)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                      currency === c
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c === "rub" ? "₽" : "$"}
                  </button>
                ))}
              </div>
            </div>

            {/* Big input */}
            <div className="relative mb-3">
              <input
                type="number"
                value={inputVal}
                onChange={(e) => handleInput(e.target.value)}
                min={min}
                placeholder={`Минимум ${min}`}
                className={cn(
                  "w-full h-14 rounded-xl border bg-background px-4 pr-12",
                  "text-2xl font-bold tabular-nums tracking-tight",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                  "placeholder:text-muted-foreground/40 placeholder:text-base placeholder:font-normal"
                )}
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                {symbol}
              </span>
            </div>

            {/* Slider */}
            <div className="px-0.5 mb-3">
              <input
                type="range"
                min={min}
                max={max}
                step={currency === "usd" ? 1 : 10}
                value={Math.min(Math.max(amount, min), max)}
                onChange={(e) => handlePreset(Number(e.target.value))}
                className="w-full cursor-pointer accent-foreground"
                style={{ height: "3px" }}
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{min.toLocaleString()}{symbol}</span>
                <span>{max.toLocaleString()}{symbol}</span>
              </div>
            </div>

            {/* Preset chips — larger, with discount badge on selected */}
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const active = amount === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePreset(p)}
                    className={cn(
                      "relative rounded-lg border px-3 py-1.5 text-sm font-medium transition-all leading-tight",
                      active
                        ? "border-foreground bg-foreground text-background shadow-sm"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    {currency === "rub" ? p.toLocaleString() : `$${p}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Step 3: Summary + CTA ────────────────────────────────── */}
          <div>
            <StepLabel n={3} label="Итог" />
            <div className="rounded-xl border overflow-hidden">
              {/* Rows */}
              <div className="divide-y">
                {/* Bonus */}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Выгода
                  </span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    +{BONUS_PCT}%
                  </span>
                </div>

                {/* Without discount */}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">Без скидки</span>
                  <span className="text-sm font-medium text-muted-foreground tabular-nums line-through decoration-muted-foreground/40">
                    {fmt(withoutDiscount)}{symbol}
                  </span>
                </div>

                {/* Credits */}
                {totalCredits > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">Получите кредитов</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmtCredits(totalCredits)}
                    </span>
                  </div>
                )}
              </div>

              {/* Total + CTA row */}
              <div className="flex items-center justify-between gap-4 bg-muted/30 border-t px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">К оплате</p>
                  <p className="text-xl font-bold tabular-nums leading-tight">
                    {fmt(paymentAmount as number)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">{symbol}</span>
                  </p>
                </div>
                <Button
                  className="gap-2 shrink-0"
                  disabled={!selectedMethod || amount < min}
                  onClick={() => alert(`Оплата ${paymentAmount} через FreeKassa`)}
                >
                  Перейти к оплате
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
