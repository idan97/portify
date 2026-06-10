import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus } from "lucide-react";
import { Holding } from "@/entities/all";
import { format } from "date-fns";

export default function BuySellWidget({ instruments = [], holdings = [], onActionCompleted, currentUser }) {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (type) => {
    if (!selectedInstrumentId || !amount || !currentUser) return;

    setIsSubmitting(true);
    try {
      const instrumentHoldings = holdings
        .filter(h => h.instrument_id === selectedInstrumentId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const latestValue = instrumentHoldings.length > 0 ? (instrumentHoldings[0].total_value_ils || 0) : 0;
      const amountFloat = parseFloat(amount) || 0;
      const newValue = type === 'buy' ? latestValue + amountFloat : Math.max(0, latestValue - amountFloat);

      await Holding.create({
        instrument_id: selectedInstrumentId,
        date: format(new Date(), "yyyy-MM-dd"),
        total_value_ils: newValue,
        created_by: currentUser.email
      });

      setSelectedInstrumentId("");
      setAmount("");
      
      if (onActionCompleted) {
        onActionCompleted();
      }
    } catch (error) {
      console.error(`Error processing ${type} action:`, error);
    }
    setIsSubmitting(false);
  };
  
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString();
  }

  return (
    <Card className="bg-white shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-900">Quick Buy/Sell</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Select value={selectedInstrumentId} onValueChange={setSelectedInstrumentId}>
            <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
            <SelectContent>
              {instruments.map((instrument) => (
                <SelectItem key={instrument.id} value={instrument.id}>
                  {instrument.name || "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input 
            type="number" 
            placeholder="Amount (₪)" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            min="0"
          />

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleAction('buy')}
              disabled={!selectedInstrumentId || !amount || isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Buy
            </Button>
            <Button
              onClick={() => handleAction('sell')}
              disabled={!selectedInstrumentId || !amount || isSubmitting}
              className="bg-red-500 hover:bg-red-600"
            >
              <Minus className="w-4 h-4 mr-2" /> Sell
            </Button>
          </div>
          {isSubmitting && <p className="text-sm text-center text-slate-500">Processing...</p>}
        </div>
      </CardContent>
    </Card>
  );
}