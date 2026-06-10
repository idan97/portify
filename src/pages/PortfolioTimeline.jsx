
import React, { useState, useEffect } from "react";
import { Holding, AssetClass, Instrument, ManualAsset, ManualAssetValue } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, BarChart3, Activity } from "lucide-react";
import { format, endOfMonth, eachMonthOfInterval, parseISO, subMonths, startOfYear } from "date-fns";
import { TimelineSkeleton } from "../components/shared/LoadingSkeletons";

const TIME_PERIODS = [
  { label: '1M', value: '1M', months: 1 },
  { label: '3M', value: '3M', months: 3 },
  { label: '6M', value: '6M', months: 6 },
  { label: 'YTD', value: 'YTD', isYTD: true },
  { label: '1Y', value: '1Y', months: 12 },
  { label: '3Y', value: '3Y', months: 36 },
  { label: 'All', value: 'All', isAll: true }
];

export default function PortfolioTimeline() {
  const [timelineData, setTimelineData] = useState([]);
  const [assetClasses, setAssetClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [totalStats, setTotalStats] = useState({
    currentValue: 0,
    totalReturn: 0,
    annualGrowthRate: 0,
    volatility: 0,
    bestAsset: null,
    worstAsset: null
  });
  const [manualAssets, setManualAssets] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (timelineData.length > 0) {
      const filteredData = getFilteredData(timelineData, selectedPeriod);
      calculateStats(filteredData);
    }
  }, [selectedPeriod, timelineData]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [holdings, assetClassesData, instruments, manualAssetsData, manualAssetValuesData] = await Promise.all([
        Holding.list(),
        AssetClass.list(),
        Instrument.list(),
        ManualAsset.list(),
        ManualAssetValue.list()
      ]);

      setAssetClasses(assetClassesData || []);
      setManualAssets(manualAssetsData || []);
      const timeline = generateTimelineData(holdings || [], assetClassesData || [], instruments || [], manualAssetValuesData || []);
      setTimelineData(timeline);
    } catch (error) {
      console.error("Error loading timeline data:", error);
    }
    setIsLoading(false);
  };

  const generateTimelineData = (holdings, assetClasses, instruments, manualAssetValues) => {
    if (holdings.length === 0 && manualAssetValues.length === 0) return [];

    const sortedHoldings = [...holdings].sort((a, b) => parseISO(a.date) - parseISO(b.date));
    const sortedManualValues = [...manualAssetValues].sort((a, b) => parseISO(a.date) - parseISO(b.date));
    
    const firstHoldingDate = sortedHoldings.length > 0 ? parseISO(sortedHoldings[0].date) : null;
    const firstManualDate = sortedManualValues.length > 0 ? parseISO(sortedManualValues[0].date) : null;
    
    let firstDate;
    if (firstHoldingDate && firstManualDate) {
      firstDate = firstHoldingDate < firstManualDate ? firstHoldingDate : firstManualDate;
    } else {
      firstDate = firstHoldingDate || firstManualDate || new Date();
    }
    
    const lastDate = new Date();
    const months = eachMonthOfInterval({ start: firstDate, end: lastDate });
    const timeline = [];

    months.forEach(month => {
      const monthEnd = endOfMonth(month);
      const dataPoint = { date: format(month, "MMM yyyy"), totalValue: 0 };

      // Process Holdings
      const holdingsUpToMonth = sortedHoldings.filter(h => parseISO(h.date) <= monthEnd);
      const latestHoldings = new Map();
      holdingsUpToMonth.forEach(h => latestHoldings.set(h.instrument_id, h));
      
      assetClasses.forEach(ac => {
        const classInstruments = instruments.filter(i => i.asset_class_id === ac.id);
        const classValue = classInstruments.reduce((sum, i) => {
            const holding = latestHoldings.get(i.id);
            return sum + (holding ? holding.total_value_ils || 0 : 0);
        }, 0);
        dataPoint[ac.name] = classValue;
        dataPoint.totalValue += classValue;
      });

      // Process Manual Assets
      const manualValuesUpToMonth = sortedManualValues.filter(v => parseISO(v.date) <= monthEnd);
      const latestManualValues = new Map();
      manualValuesUpToMonth.forEach(v => latestManualValues.set(v.manual_asset_id, v));
      const manualTotal = Array.from(latestManualValues.values()).reduce((sum, v) => sum + (v.value_ils || 0), 0);
      
      dataPoint['Manual Assets'] = manualTotal;
      dataPoint.totalValue += manualTotal;
      
      timeline.push(dataPoint);
    });

    return timeline;
  };

  const getFilteredData = (data, period) => {
    if (!data || data.length === 0) return [];
    
    const now = new Date();
    let startDate;

    const periodConfig = TIME_PERIODS.find(p => p.value === period);
    
    if (periodConfig?.isAll) {
      return data;
    } else if (periodConfig?.isYTD) {
      startDate = startOfYear(now);
    } else if (periodConfig?.months) {
      startDate = subMonths(now, periodConfig.months);
    } else {
      return data;
    }

    const startIndex = data.findIndex(item => {
      const itemDate = new Date(item.date + " 1");
      return itemDate >= startDate;
    });

    return startIndex >= 0 ? data.slice(startIndex) : data;
  };

  const calculateStats = (timeline) => {
    if (timeline.length === 0) return;

    const currentValue = timeline[timeline.length - 1]?.totalValue || 0;
    const initialValue = timeline[0]?.totalValue || 0;
    const totalReturn = currentValue - initialValue;

    // Calculate annualized growth rate
    const yearsElapsed = timeline.length / 12; // Assuming monthly data
    const annualGrowthRate = yearsElapsed > 0 && initialValue > 0 
      ? (Math.pow(currentValue / initialValue, 1 / yearsElapsed) - 1) * 100 
      : 0;

    // Calculate volatility (standard deviation of monthly returns)
    const returns = [];
    for (let i = 1; i < timeline.length; i++) {
      const prevValue = timeline[i - 1].totalValue;
      const currentValue = timeline[i].totalValue;
      if (prevValue > 0) {
        returns.push((currentValue - prevValue) / prevValue);
      }
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(12) * 100; // Annualized volatility

    // Find best and worst performing assets
    let bestAsset = null;
    let worstAsset = null;
    let bestPerformance = -Infinity;
    let worstPerformance = Infinity;

    // Check each asset class performance
    [...assetClasses, { name: 'Manual Assets' }].forEach(asset => {
      const assetName = asset.name;
      if (!timeline[0].hasOwnProperty(assetName)) return;

      const initialAssetValue = timeline[0][assetName] || 0;
      const currentAssetValue = timeline[timeline.length - 1][assetName] || 0;
      
      if (initialAssetValue > 0) {
        const performance = ((currentAssetValue - initialAssetValue) / initialAssetValue) * 100;
        
        if (performance > bestPerformance) {
          bestPerformance = performance;
          bestAsset = { name: assetName, performance };
        }
        
        if (performance < worstPerformance) {
          worstPerformance = performance;
          worstAsset = { name: assetName, performance };
        }
      }
    });

    setTotalStats({
      currentValue,
      totalReturn,
      annualGrowthRate: isFinite(annualGrowthRate) ? annualGrowthRate : 0,
      volatility: isFinite(volatility) ? volatility : 0,
      bestAsset,
      worstAsset
    });
  };

  const formatCurrency = (value) => `₪${Math.round(value || 0).toLocaleString()}`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
        <p className="font-semibold text-slate-900 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-slate-600">{entry.dataKey}:</span>
            <span className="text-sm font-medium text-slate-900">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const getAssetColor = (assetName) => {
    if (assetName === 'Manual Assets') return '#8b5cf6'; // Dedicated color for manual assets
    const assetClass = assetClasses.find(ac => ac.name === assetName);
    return assetClass?.color || "#3b82f6";
  };

  const filteredTimelineData = getFilteredData(timelineData, selectedPeriod);

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Portfolio Timeline</h1>
          <p className="text-slate-600 mt-1">Track your portfolio value over time</p>
        </div>
        <div className="flex gap-2">
          {TIME_PERIODS.map(period => (
            <Button
              key={period.value}
              variant={selectedPeriod === period.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period.value)}
              className={selectedPeriod === period.value ? "bg-slate-900 hover:bg-slate-800" : ""}
            >
              {period.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Current Value</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totalStats.currentValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Annual Growth</p>
                <p className={`text-2xl font-bold ${
                  totalStats.annualGrowthRate >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {totalStats.annualGrowthRate >= 0 ? '+' : ''}{totalStats.annualGrowthRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Volatility</p>
                <p className="text-2xl font-bold text-blue-600">
                  {totalStats.volatility.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Best Performer</p>
                <p className="text-lg font-bold text-purple-600">
                  {totalStats.bestAsset ? `${totalStats.bestAsset.performance >= 0 ? '+' : ''}${totalStats.bestAsset.performance.toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-xs text-slate-500">
                  {totalStats.bestAsset?.name || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900">Portfolio Value Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTimelineData.length === 0 ? (
            <div className="h-96 flex items-center justify-center"><div className="text-center"><BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4"/><h3 className="text-lg font-semibold">No Data Available</h3><p className="text-slate-600">Add some instrument values to see your portfolio timeline.</p></div></div>
          ) : (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12}/>
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={formatCurrency}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="totalValue" stroke="#1e293b" strokeWidth={3} dot={{ fill: "#1e293b", r: 4 }} name="Total Portfolio"/>
                  {Object.keys(filteredTimelineData[0] || {}).filter(key => key !== 'date' && key !== 'totalValue').map((assetName) => (<Line key={assetName} type="monotone" dataKey={assetName} stroke={getAssetColor(assetName)} strokeWidth={2} dot={{r:3}} name={assetName}/>))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
