import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function AllocationTable({ assetData = [], totalValue = 0 }) {
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatCurrency = (amount) => {
    const value = amount || 0;
    return `₪${Math.round(value).toLocaleString()}`;
  };
  
  const getRebalanceInfo = (currentValue = 0, targetPercent = 0) => {
    const targetValue = totalValue * (targetPercent / 100);
    const gapAmount = targetValue - currentValue;
    const color = Math.abs(gapAmount) < 1 ? "text-slate-600" : gapAmount > 0 ? "text-emerald-600" : "text-red-500";
    const badge = Math.abs(gapAmount) < 1 ? null : gapAmount > 0 ? "Buy" : "Sell";
    return { gapAmount, color, badge };
  };

  if (!assetData || assetData.length === 0) {
    return (
      <div className="bg-white shadow-sm border border-slate-200 rounded-lg">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Asset Allocation</h2>
        </div>
        <div className="p-12 text-center">
          <p className="text-slate-500">No asset classes found. Add some asset classes to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Asset Allocation</h2>
      </div>
      <div className="p-6 pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b-slate-200 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-700 w-1/3">Asset/Instrument</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Current Value</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Current %</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Target %</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Rebalance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assetData.map((asset) => {
                const isExpanded = expandedRows[asset.id];
                const currentValue = asset.currentValue || 0;
                const targetPercent = asset.target_percent || 0;
                const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
                const rebalance = getRebalanceInfo(currentValue, targetPercent);
                
                return (
                  <React.Fragment key={asset.id}>
                    <TableRow className="border-t border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => toggleRow(asset.id)}>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color || "#3b82f6" }} />
                          <span className="font-bold text-slate-900">{asset.name || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{formatCurrency(currentValue)}</TableCell>
                      <TableCell className="text-right font-medium">{currentPercent.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-medium">{targetPercent}%</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {rebalance.badge && <Badge variant="outline" className={`${rebalance.badge === 'Buy' ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-600'}`}>{rebalance.badge}</Badge>}
                          <span className={`font-medium ${rebalance.color}`}>{formatCurrency(Math.abs(rebalance.gapAmount))}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (asset.instruments || []).map(instrument => {
                      const instrumentValue = instrument.currentValue || 0;
                      const instrumentPercent = totalValue > 0 ? (instrumentValue / totalValue) * 100 : 0;
                      return (
                        <TableRow key={instrument.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <TableCell className="pl-14">
                             <div className="flex items-center gap-3">
                              <span className="font-medium text-slate-800">{instrument.name || "Unknown"}</span>
                              {instrument.symbol && <Badge variant="secondary">{instrument.symbol}</Badge>}
                              {instrument.lastUpdated && (
                                <span className="text-xs text-slate-500">
                                  Updated {format(new Date(instrument.lastUpdated), "MMM d")}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(instrumentValue)}</TableCell>
                          <TableCell className="text-right">{instrumentPercent.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}