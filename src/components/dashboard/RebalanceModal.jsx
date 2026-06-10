import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, TrendingUp, Check } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { calculateBuyOnlyRebalance } from "../../lib/buyOnlyRebalance";
import { Progress } from "@/components/ui/progress";

export default function RebalanceModal({ isOpen, onClose, assetData = [], freeCash = 0 }) {
  const result = useMemo(() => {
    return calculateBuyOnlyRebalance(assetData, freeCash);
  }, [assetData, freeCash]);

  if (!isOpen) return null;

  const formatCurrency = (amount) => {
    const value = amount || 0;
    return `₪${Math.round(value).toLocaleString()}`;
  };

  const { allocations, totalAfter, cashInvested } = result;
  const hasCash = freeCash > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Buy-Only Rebalance Plan
          </DialogTitle>
          {hasCash ? (
            <p className="text-sm text-slate-500">
              Distributing <span className="font-semibold text-slate-700">{formatCurrency(freeCash)}</span> of free cash to get closer to your target allocations. No selling required.
            </p>
          ) : (
            <p className="text-sm text-amber-600">
              Enter free cash on the dashboard to see a buy-only rebalance plan.
            </p>
          )}
        </DialogHeader>

        {hasCash && (
          <div className="py-4 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Current Holdings</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(result.totalBefore)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-xs text-emerald-600">Cash to Invest</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(cashInvested)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600">New Total</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(totalAfter)}</p>
              </div>
            </div>

            {/* Allocation table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Class</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Buy</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="w-32">Alignment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map(asset => {
                  const deviation = Math.abs(asset.gapFromTarget);
                  const isClose = deviation < 1;
                  const alignment = Math.max(0, 100 - deviation * 10);
                  
                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color || "#3b82f6" }} />
                          <span className="font-medium">{asset.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">
                        {formatCurrency(asset.currentValue)}
                        <div className="text-xs text-slate-400">{asset.currentPercent.toFixed(1)}%</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {asset.buyAmount > 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            +{formatCurrency(asset.buyAmount)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatCurrency(asset.newValue)}
                        <div className="text-xs text-slate-500">{asset.newPercent.toFixed(1)}%</div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">{asset.targetPercent}%</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={alignment} className="h-2" />
                          {isClose && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {result.remainingCash > 0.01 && (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                Note: {formatCurrency(result.remainingCash)} could not be allocated (all targets met).
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}