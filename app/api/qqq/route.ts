import { NextResponse } from "next/server";
import { trackerConfig } from "../../config";

async function alphaVantage(functionName: string, extra: Record<string, string>) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Alpha Vantage API key");
  }

  const params = new URLSearchParams({
    function: functionName,
    symbol: trackerConfig.ticker,
    apikey: apiKey,
    ...extra
  });

  const res = await fetch(`https://www.alphavantage.co/query?${params.toString()}`, {
    next: { revalidate: 60 }
  });

  if (!res.ok) throw new Error("Alpha Vantage request failed");

  return res.json();
}

function findPurchasePrice(timeSeries: Record<string, any>, targetDate: string) {
  const dates = Object.keys(timeSeries).sort();

  const validDate = dates
    .filter((date) => date <= targetDate)
    .pop();

  if (!validDate) throw new Error("No historical price found");

  return {
    price: Number(timeSeries[validDate]["4. close"]),
    actualTradeDate: validDate
  };
}

export async function GET() {
  try {
    const [quoteData, historicalData] = await Promise.all([
      alphaVantage("GLOBAL_QUOTE", {}),
      alphaVantage("TIME_SERIES_DAILY", { outputsize: "full" })
    ]);

    const currentPrice = Number(quoteData["Global Quote"]?.["05. price"]);
    const timeSeries = historicalData["Time Series (Daily)"];

    if (!currentPrice || !timeSeries) {
      throw new Error("Market data unavailable");
    }

    const historical = findPurchasePrice(timeSeries, trackerConfig.purchaseDate);

    const shares = trackerConfig.settlementAmountUsd / historical.price;
    const currentValue = shares * currentPrice;
    const totalReturn = currentValue - trackerConfig.settlementAmountUsd;
    const totalReturnPercent = (totalReturn / trackerConfig.settlementAmountUsd) * 100;

    return NextResponse.json({
      ticker: trackerConfig.ticker,
      settlementAmountUsd: trackerConfig.settlementAmountUsd,
      purchaseDate: trackerConfig.purchaseDate,
      actualTradeDate: historical.actualTradeDate,
      purchasePrice: historical.price,
      currentPrice,
      currentValue,
      shares,
      totalReturn,
      totalReturnPercent,
      dayChangePercent: Number(quoteData["Global Quote"]?.["10. change percent"]?.replace("%", "") || 0),
      currency: "USD",
      marketTime: new Date().toISOString(),
      source: "Alpha Vantage"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
