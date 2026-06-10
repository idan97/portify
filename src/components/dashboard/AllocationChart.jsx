import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export default function AllocationChart({ assetData = [], totalValue = 0 }) {
  const chartData = assetData
    .filter(asset => (asset?.currentValue || 0) > 0)
    .map(asset => ({
      name: asset?.name || "Unknown",
      value: asset?.currentValue || 0,
      percent: totalValue > 0 ? (((asset?.currentValue || 0) / totalValue) * 100) : 0,
      color: asset?.color || "#3b82f6",
      target: parseFloat(asset?.target_percent) || 0
    }));

  const formatCurrency = (amount) => {
    const value = amount || 0;
    return `₪${Math.round(value).toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="font-medium text-slate-900">{data?.name || "Unknown"}</p>
        <p className="text-sm text-slate-600">
          Value: {formatCurrency(data?.value || 0)}
        </p>
        <p className="text-sm text-slate-600">
          Current: {(data?.percent || 0).toFixed(1)}% | Target: {data?.target || 0}%
        </p>
      </div>
    );
  };

  const CustomLegend = ({ payload = [] }) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-slate-700">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <Card className="bg-white shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900">Portfolio Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-slate-500">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900">Portfolio Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                dataKey="value"
                stroke="#ffffff"
                strokeWidth={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}