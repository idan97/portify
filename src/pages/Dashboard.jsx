import React, { useState, useEffect } from "react";
import {
  AssetClass,
  Holding,
  Instrument,
  ManualAsset,
  ManualAssetValue,
} from "@/entities/all";
import { client } from "@/api/client";
import PortfolioSummary from "../components/dashboard/PortfolioSummary";
import AllocationTable from "../components/dashboard/AllocationTable";
import BuySellWidget from "../components/shared/BuySellWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlidersHorizontal, PiggyBank } from "lucide-react";
import RebalanceModal from "../components/dashboard/RebalanceModal";
import { parseISO, format } from "date-fns";
import { DashboardSkeleton } from "../components/shared/LoadingSkeletons";
import { useUsdRate } from "@/lib/useUsdRate";
import { convertHoldings, convertManualValues } from "@/lib/currency";

const ASSET_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#6366f1",
];

export default function Dashboard() {
  const [portfolioData, setPortfolioData] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [holdingsValue, setHoldingsValue] = useState(0);
  const [freeCash, setFreeCash] = useState(0);
  const [manualAssetsValue, setManualAssetsValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);
  const [totalReturn, setTotalReturn] = useState(0);
  const [totalReturnPercent, setTotalReturnPercent] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [manualAssets, setManualAssets] = useState([]);
  const [manualAssetValues, setManualAssetValues] = useState([]);

  // For Buy/Sell widget (raw holdings — dollars for USD instruments)
  const [instruments, setInstruments] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [assetClasses, setAssetClasses] = useState([]);
  const {
    rate: usdRate,
    date: usdRateDate,
    error: usdRateError,
  } = useUsdRate();

  useEffect(() => {
    loadData();

    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Re-process portfolio totals whenever data or the USD rate changes, so the
  // shekel value of USD holdings tracks the live rate.
  useEffect(() => {
    const converted = convertHoldings(holdings, instruments, usdRate);
    processPortfolioData(assetClasses, instruments, converted);
  }, [holdings, instruments, assetClasses, usdRate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await client.auth.me();
      if (!user) {
        setIsLoading(false);
        return;
      }
      setCurrentUser(user);

      const [
        assetClassesData,
        instrumentsData,
        holdingsData,
        manualAssetsData,
        manualAssetValuesData,
      ] = await Promise.all([
        AssetClass.list(),
        Instrument.list(),
        Holding.list(),
        ManualAsset.list(),
        ManualAssetValue.list(),
      ]);
      setInstruments(instrumentsData || []);
      setHoldings(holdingsData || []);
      setAssetClasses(assetClassesData || []);
      setManualAssets(manualAssetsData || []);
      setManualAssetValues(manualAssetValuesData || []);
      // processPortfolioData runs in the rate-aware effect above.
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const processPortfolioData = (assetClasses, instruments, holdings) => {
    const latestHoldings = new Map();
    holdings.forEach((holding) => {
      const instrumentId = holding.instrument_id;
      if (
        !latestHoldings.has(instrumentId) ||
        parseISO(holding.date) > parseISO(latestHoldings.get(instrumentId).date)
      ) {
        latestHoldings.set(instrumentId, holding);
      }
    });

    const currentHoldingsValue = Array.from(latestHoldings.values()).reduce(
      (sum, h) => sum + (h.total_value_ils || 0),
      0,
    );

    // Calculate Total Return
    if (holdings.length > 0) {
      const sortedHoldings = [...holdings].sort(
        (a, b) => parseISO(a.date) - parseISO(b.date),
      );
      const firstDate = sortedHoldings[0].date;
      const initialValue = sortedHoldings
        .filter((h) => h.date === firstDate)
        .reduce((sum, h) => sum + (h.total_value_ils || 0), 0);

      const returnAmount = currentHoldingsValue - initialValue;
      const returnPercent =
        initialValue > 0 ? (returnAmount / initialValue) * 100 : 0;
      setTotalReturn(returnAmount);
      setTotalReturnPercent(returnPercent);
    } else {
      setTotalReturn(0);
      setTotalReturnPercent(0);
    }

    const processedInstruments = instruments.map((instrument) => {
      const latestHolding = latestHoldings.get(instrument.id);
      return {
        ...instrument,
        currentValue: latestHolding?.total_value_ils || 0,
        lastUpdated: latestHolding?.date,
      };
    });

    const processedAssetClasses = assetClasses.map((ac, index) => {
      const classInstruments = processedInstruments.filter(
        (i) => i.asset_class_id === ac.id,
      );
      const currentValue = classInstruments.reduce(
        (sum, i) => sum + i.currentValue,
        0,
      );

      return {
        ...ac,
        currentValue,
        instruments: classInstruments,
        color: ac.color || ASSET_COLORS[index % ASSET_COLORS.length],
      };
    });

    setPortfolioData(processedAssetClasses);
    setHoldingsValue(currentHoldingsValue);
  };

  useEffect(() => {
    const converted = convertManualValues(
      manualAssetValues,
      manualAssets,
      usdRate,
    );
    const latestManualValues = new Map();
    converted.forEach((v) => {
      if (
        !latestManualValues.has(v.manual_asset_id) ||
        parseISO(v.date) >
          parseISO(latestManualValues.get(v.manual_asset_id).date)
      ) {
        latestManualValues.set(v.manual_asset_id, v);
      }
    });
    const manualTotal = Array.from(latestManualValues.values()).reduce(
      (sum, v) => sum + (v.value_ils || 0),
      0,
    );
    setManualAssetsValue(manualTotal);

    setTotalValue(holdingsValue + freeCash + manualTotal);
  }, [holdingsValue, freeCash, manualAssetValues, manualAssets, usdRate]);

  const handleFreeCashChange = (e) => {
    const value = parseFloat(e.target.value);
    setFreeCash(isNaN(value) ? 0 : value);
  };

  const formatCurrency = (amount) => {
    const value = amount || 0;
    return `₪${Math.round(value).toLocaleString()}`;
  };

  const getManualAssetsDisplay = () => {
    const converted = convertManualValues(
      manualAssetValues,
      manualAssets,
      usdRate,
    );
    const latestManualValues = new Map();
    converted.forEach((v) => {
      if (
        !latestManualValues.has(v.manual_asset_id) ||
        parseISO(v.date) >
          parseISO(latestManualValues.get(v.manual_asset_id).date)
      ) {
        latestManualValues.set(v.manual_asset_id, v);
      }
    });

    return manualAssets.map((asset) => {
      const latestValue = latestManualValues.get(asset.id);
      return {
        ...asset,
        currentValue: latestValue?.value_ils || 0,
        lastUpdated: latestValue?.date,
      };
    });
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const investmentPortfolioValue = holdingsValue + freeCash; // Only investments + cash for allocation calculations

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Portfolio Dashboard
          </h1>
          <p className="text-slate-600 mt-1">
            Track your investments and allocation targets
          </p>
          <p className="text-xs text-slate-400 mt-1">
            USD→ILS {usdRate.toFixed(2)}
            {usdRateDate ? ` · ${usdRateDate}` : ""}
            {usdRateError ? ` · ${usdRateError}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-56">
            <Label
              htmlFor="free-cash"
              className="text-sm font-medium text-slate-700"
            >
              Free Cash (₪)
            </Label>
            <Input
              id="free-cash"
              type="number"
              placeholder="e.g. 10000"
              onChange={handleFreeCashChange}
              className="mt-1"
            />
          </div>
          <Button
            onClick={() => setIsRebalanceModalOpen(true)}
            className="self-end bg-slate-900 hover:bg-slate-800"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Rebalance
          </Button>
        </div>
      </div>

      <PortfolioSummary
        totalValue={totalValue}
        totalReturn={totalReturn}
        totalReturnPercent={totalReturnPercent}
      />

      <div className="space-y-8">
        <AllocationTable
          assetData={portfolioData}
          totalValue={investmentPortfolioValue}
        />

        {manualAssetsValue > 0 && (
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <PiggyBank className="w-5 h-5" />
                Other Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getManualAssetsDisplay().map((asset) => (
                  <div
                    key={asset.id}
                    className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"
                  >
                    <span className="font-medium text-slate-800">
                      {asset.name}
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">
                        {formatCurrency(asset.currentValue)}
                      </span>
                      {asset.lastUpdated && (
                        <p className="text-xs text-slate-500">
                          as of{" "}
                          {format(new Date(asset.lastUpdated), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-semibold text-slate-900">
                    Total Other Assets
                  </span>
                  <span className="font-bold text-lg text-slate-900">
                    {formatCurrency(manualAssetsValue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6">
          <BuySellWidget
            instruments={instruments}
            holdings={holdings}
            onActionCompleted={loadData}
            currentUser={currentUser}
          />
        </div>
      </div>

      <RebalanceModal
        isOpen={isRebalanceModalOpen}
        onClose={() => setIsRebalanceModalOpen(false)}
        assetData={portfolioData}
        freeCash={freeCash}
      />
    </div>
  );
}
