import { NextResponse } from "next/server";
import { trackerConfig } from "../../config";

async function getDailySeries() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("Missing Alpha Vantage API key");

  const params = new URLSearchParams({
    function: "TIME_SERIES_DAILY",
    symbol: trackerConfig.ticker,
    outputsize: "full",
    apikey: apiKey
  });

  const res = await fetch(`https://www.alphavantage.co/query?${params.toString()}`, {
    next: { revalidate: 300 }
  });

  const data = await res.json();
  const timeSeries = data["Time Series (Daily)"];

  if (!timeSeries) {
    throw new Error(JSON.stringify(data));
  }

  return timeSeries;
}

function getPurchasePrice(timeSeries: Record<string, any>, targetDate: string) {
  const dates = Object.keys(timeSeries).sort();

  const validDate =
    dates.find((date) => date >= targetDate) ||
    dates.filter((date) => date <= targetDate).pop();

  if (!validDate) throw new Error("No purchase price found");

  return {
    date: validDate,
    price: Number(timeSeries[validDate]["4. close"])
  };
}

function getLatestPrice(timeSeries: Record<string, any>) {
  const dates = Object.keys(timeSeries).sort();
  const latestDate = dates[dates.length - 1];

  return {
    date: latestDate,
    price: Number(timeSeries[latestDate]["4. close"])
  };
}

export async function GET() {
  try {
    const timeSeries = await getDailySeries();

    const purchase = getPurchasePrice(timeSeries, trackerConfig.purchaseDate);
    const latest = getLatestPrice(timeSeries);

    const shares = trackerConfig.settlementAmountUsd / purchase.price;
    const currentValue = shares * latest.price;
    const totalReturn = currentValue - trackerConfig.settlementAmountUsd;
    const totalReturnPercent = (totalReturn / trackerConfig.settlementAmountUsd) * 100;

    return NextResponse.json({
      ticker: trackerConfig.ticker,
      settlementAmountUsd: trackerConfig.settlementAmountUsd,
      purchaseDate: trackerConfig.purchaseDate,
      actualTradeDate: purchase.date,
      purchasePrice: purchase.price,
      currentPrice: latest.price,
      currentValue,
      shares,
      totalReturn,
      totalReturnPercent,
      dayChangePercent: 0,
      currency: "USD",
      marketTime: latest.date,
      source: "Alpha Vantage Daily"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
