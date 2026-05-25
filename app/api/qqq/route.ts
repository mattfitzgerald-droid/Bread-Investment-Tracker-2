import { NextResponse } from "next/server";
import { trackerConfig } from "../../config";

const FALLBACK_CURRENT_QQQ_PRICE = 450;
const FALLBACK_PURCHASE_QQQ_PRICE = 370;

async function getCurrentPriceFromStooq(symbol: string) {
  const stooqSymbol = symbol.toLowerCase() + ".us";
  const url = `https://stooq.com/q/l/?s=${stooqSymbol}&f=sd2t2ohlcv&h&e=csv`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Could not fetch Stooq quote");

  const text = await res.text();
  const lines = text.trim().split("\n");
  const values = lines[1]?.split(",");

  const close = Number(values?.[6]);

  if (!Number.isFinite(close) || close <= 0) {
    throw new Error("Stooq price unavailable");
  }

  return {
    price: close,
    marketTime: new Date().toISOString(),
    currency: "USD"
  };
}

export async function GET() {
  try {
    let currentPrice = FALLBACK_CURRENT_QQQ_PRICE;
    let source = "fallback";

    try {
      const quote = await getCurrentPriceFromStooq(trackerConfig.ticker);
      currentPrice = quote.price;
      source = "stooq";
    } catch {
      currentPrice = FALLBACK_CURRENT_QQQ_PRICE;
      source = "fallback";
    }

    const purchasePrice = FALLBACK_PURCHASE_QQQ_PRICE;
    const shares = trackerConfig.settlementAmountUsd / purchasePrice;
    const currentValue = shares * currentPrice;
    const totalReturn = currentValue - trackerConfig.settlementAmountUsd;
    const totalReturnPercent = (totalReturn / trackerConfig.settlementAmountUsd) * 100;

    return NextResponse.json({
      ticker: trackerConfig.ticker,
      settlementAmountUsd: trackerConfig.settlementAmountUsd,
      purchaseDate: trackerConfig.purchaseDate,
      actualTradeDate: trackerConfig.purchaseDate,
      purchasePrice,
      currentPrice,
      currentValue,
      shares,
      totalReturn,
      totalReturnPercent,
      dayChangePercent: 0,
      currency: "USD",
      marketTime: new Date().toISOString(),
      source
    });
  } catch {
    return NextResponse.json({
      ticker: "QQQ",
      settlementAmountUsd: 49.11,
      purchaseDate: "2024-01-01",
      actualTradeDate: "2024-01-01",
      purchasePrice: FALLBACK_PURCHASE_QQQ_PRICE,
      currentPrice: FALLBACK_CURRENT_QQQ_PRICE,
      currentValue: (49.11 / FALLBACK_PURCHASE_QQQ_PRICE) * FALLBACK_CURRENT_QQQ_PRICE,
      shares: 49.11 / FALLBACK_PURCHASE_QQQ_PRICE,
      totalReturn: ((49.11 / FALLBACK_PURCHASE_QQQ_PRICE) * FALLBACK_CURRENT_QQQ_PRICE) - 49.11,
      totalReturnPercent: ((((49.11 / FALLBACK_PURCHASE_QQQ_PRICE) * FALLBACK_CURRENT_QQQ_PRICE) - 49.11) / 49.11) * 100,
      dayChangePercent: 0,
      currency: "USD",
      marketTime: new Date().toISOString(),
      source: "hard-fallback"
    });
  }
}
