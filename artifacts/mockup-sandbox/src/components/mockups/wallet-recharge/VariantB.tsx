import { useState } from "react";
import { ArrowRight, Receipt, WalletCards, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

const QUOTA_PER_DOLLAR = 500_000;
const USD_TO_RUB = 90;
const DISCOUNT_RATE = 0.88;
const BONUS_PCT = Math.round((1 / DISCOUNT_RATE - 1) * 100);
const PRESETS_RUB = [100, 300, 500, 1000, 3000, 5000, 10000];
const PRESETS_USD = [1, 5, 10, 25, 50, 100];
const MIN_RUB = 100;
const MIN_USD = 1;
const MAX_RUB = 50000;
const MAX_USD = 500;

function fmt(n: number, d = 0) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: d });
}
function fmtCredits(q: number) {
  if (q >= 1_000_000) return `${(q / 1_000_000).toFixed(2)}M`;
  if (q >= 1_000) return `${(q / 1_000).toFixed(1)}K`;
  return q.toString();
}

function SBPLogo({ invert = false }: { invert?: boolean }) {
  return (
    <img
      src="/__mockup/images/sbp-logo.svg"
      alt="СБП"
      className={cn("h-5 w-5 object-contain", invert && "brightness-0 invert")}
    />
  );
}

export function VariantB() {
  const [currency, setCurrency] = useState<"rub" | "usd">("rub");
  const [amount, setAmount] = useState(1000);
  const [inputVal, setInputVal] = useState("1000");

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
  const payRub = currency === "rub" ? Math.round(amount * DISCOUNT_RATE) : Math.round(amountUsd * DISCOUNT_RATE * USD_TO_RUB);
  const payDisplay = currency === "rub" ? payRub : amountUsd * DISCOUNT_RATE;
  const totalCredits = Math.round(amountUsd * QUOTA_PER_DOLLAR);
  const sliderVal = Math.min(Math.max(amount, min), max);

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center p-6 pt-8">
      <div className="w-full max-w-lg space-y-3">
        {/* ── Header strip ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
              <WalletCards className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="font-semibold text-sm">Пополнение баланса</span>
          </div>
          <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Receipt className="h-3.5 w-3.5" />
            История
          </button>
        </div>

        {/* ── Amount card ───────────────────────────────────────────── */}
        <Card className="overflow-hidden gap-0 py-0 shadow-sm">
          {/* Dark gradient top band */}
          <div className="bg-gradient-to-br from-foreground to-foreground/80 px-5 pt-5 pb-4">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-medium text-background/60 uppercase tracking-wider">Сумма</p>
              {/* Currency toggle */}
              <div className="inline-flex rounded-lg bg-background/10 p-0.5 gap-0.5">
                {(["rub", "usd"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => switchCurrency(c)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                      currency === c
                        ? "bg-background text-foreground shadow-sm"
                        : "text-background/60 hover:text-background"
                    )}
                  >
                    {c === "rub" ? "₽" : "$"}
                  </button>
                ))}
              </div>
            </div>

            {/* Big editable amount */}
            <div className="relative flex items-baseline gap-1 mb-5">
              <input
                type="number"
                value={inputVal}
                onChange={(e) => handleInput(e.target.value)}
                min={min}
                className={cn(
                  "w-full bg-transparent text-4xl font-bold text-background tabular-nums tracking-tight",
                  "focus:outline-none placeholder:text-background/30 placeholder:font-light placeholder:text-2xl",
                  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                )}
                placeholder="0"
              />
              <span className="text-xl font-semibold text-background/70 shrink-0">{symbol}</span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={min}
              max={max}
              step={currency === "usd" ? 1 : 10}
              value={sliderVal}
              onChange={(e) => handlePreset(Number(e.target.value))}
              className="w-full cursor-pointer"
              style={{
                height: "3px",
                accentColor: "white",
                opacity: 0.8,
              }}
            />
            <div className="mt-1 flex justify-between text-[10px] text-background/40">
              <span>{min.toLocaleString()}{symbol}</span>
              <span>{max.toLocaleString()}{symbol}</span>
            </div>
          </div>

          {/* Preset chips */}
          <CardContent className="px-5 py-3.5">
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const active = amount === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePreset(p)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                      active
                        ? "border-foreground bg-foreground text-background shadow-sm"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {currency === "rub" ? p.toLocaleString() : `$${p}`}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Method card ───────────────────────────────────────────── */}
        <Card className="gap-0 py-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Способ оплаты</p>
            <button
              type="button"
              className="w-full flex items-center gap-3 rounded-xl border border-foreground bg-foreground/5 ring-1 ring-foreground/10 px-4 py-3 text-left transition-all"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <SBPLogo />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">FreeKassa</p>
                <p className="text-xs text-muted-foreground">Карты / СБП</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                Выбрано
              </Badge>
            </button>
          </CardContent>
        </Card>

        {/* ── Summary + CTA card ───────────────────────────────────── */}
        <Card className="gap-0 py-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x border-b">
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Выгода</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  +{BONUS_PCT}%
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Кредитов</p>
                <p className="text-sm font-bold flex items-center justify-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" />
                  {fmtCredits(totalCredits)}
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Курс</p>
                <p className="text-sm font-bold flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  {fmt(USD_TO_RUB)}
                </p>
              </div>
            </div>

            {/* Total + button */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="text-xs text-muted-foreground">К оплате</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold tabular-nums leading-none">
                    {fmt(payDisplay as number, currency === "usd" ? 2 : 0)}
                  </span>
                  <span className="text-base font-medium text-muted-foreground">{symbol}</span>
                </div>
              </div>
              <Button
                size="lg"
                className="gap-2 rounded-xl px-6 h-11"
                disabled={amount < min}
                onClick={() => alert(`Оплата ${payDisplay} ${symbol} через FreeKassa`)}
              >
                Перейти к оплате
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
