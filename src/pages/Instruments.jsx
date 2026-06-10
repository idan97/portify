
import React, { useState, useEffect } from "react";
import { Instrument, AssetClass, Holding, User, ManualAsset, ManualAssetValue } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, History, Calendar, PiggyBank } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from 'date-fns';
import { InstrumentsSkeleton } from "../components/shared/LoadingSkeletons";

export default function Instruments() {
  const [instruments, setInstruments] = useState([]);
  const [assetClasses, setAssetClasses] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [manualAssets, setManualAssets] = useState([]);
  const [manualAssetValues, setManualAssetValues] = useState([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHoldingFormOpen, setIsHoldingFormOpen] = useState(false);
  const [isManualAssetFormOpen, setIsManualAssetFormOpen] = useState(false);
  const [isManualAssetValueFormOpen, setIsManualAssetValueFormOpen] = useState(false);

  const [editingInstrument, setEditingInstrument] = useState(null);
  const [editingHolding, setEditingHolding] = useState(null);
  const [editingManualAsset, setEditingManualAsset] = useState(null);
  const [editingManualAssetValue, setEditingManualAssetValue] = useState(null);

  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [selectedManualAsset, setSelectedManualAsset] = useState(null);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [formData, setFormData] = useState({ name: "", symbol: "", asset_class_id: "" });
  const [holdingData, setHoldingData] = useState({ date: format(new Date(), "yyyy-MM-dd"), total_value_ils: "" });
  const [manualAssetData, setManualAssetData] = useState({ name: "" });
  const [manualAssetValueData, setManualAssetValueData] = useState({ date: format(new Date(), "yyyy-MM-dd"), value_ils: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      if (!user) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }
      setCurrentUser(user);

      const [instrumentsData, assetClassesData, holdingsData, manualAssetsData, manualAssetValuesData] = await Promise.all([
        Instrument.list(),
        AssetClass.list(),
        Holding.list("-date"),
        ManualAsset.list(),
        ManualAssetValue.list("-date")
      ]);
      setInstruments(instrumentsData || []);
      setAssetClasses(assetClassesData || []);
      setHoldings(holdingsData || []);
      setManualAssets(manualAssetsData || []);
      setManualAssetValues(manualAssetValuesData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      setCurrentUser(null);
    }
    setIsLoading(false);
  };

  const resetAllForms = () => {
    setFormData({ name: "", symbol: "", asset_class_id: "" });
    setHoldingData({ date: format(new Date(), "yyyy-MM-dd"), total_value_ils: "" });
    setManualAssetData({ name: "" });
    setManualAssetValueData({ date: format(new Date(), "yyyy-MM-dd"), value_ils: "" });
    setEditingInstrument(null);
    setEditingHolding(null);
    setEditingManualAsset(null);
    setEditingManualAssetValue(null);
    setSelectedInstrument(null);
    setSelectedManualAsset(null);
  };

  const handleInstrumentSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.asset_class_id) return;
    try {
      if (editingInstrument) {
        await Instrument.update(editingInstrument.id, formData);
      } else {
        await Instrument.create(formData);
      }
      resetAllForms();
      setIsFormOpen(false);
      loadData();
    } catch (error) { console.error("Error saving instrument:", error); }
  };

  const handleHoldingSubmit = async (e) => {
    e.preventDefault();
    if (!holdingData.date || !holdingData.total_value_ils || !selectedInstrument) return;
    try {
      const dataToSave = {
        instrument_id: selectedInstrument.id,
        date: holdingData.date,
        total_value_ils: parseFloat(holdingData.total_value_ils) || 0
      };
      if (editingHolding) {
        await Holding.update(editingHolding.id, dataToSave);
      } else {
        await Holding.create(dataToSave);
      }
      resetAllForms();
      setIsHoldingFormOpen(false);
      loadData();
    } catch (error) { console.error("Error saving holding:", error); }
  };

  const handleManualAssetSubmit = async (e) => {
    e.preventDefault();
    if (!manualAssetData.name) return;
    try {
      if (editingManualAsset) {
        await ManualAsset.update(editingManualAsset.id, manualAssetData);
      } else {
        await ManualAsset.create(manualAssetData);
      }
      resetAllForms();
      setIsManualAssetFormOpen(false);
      loadData();
    } catch (error) { console.error("Error saving manual asset:", error); }
  };
  
  const handleManualAssetValueSubmit = async (e) => {
    e.preventDefault();
    if (!manualAssetValueData.date || !manualAssetValueData.value_ils || !selectedManualAsset) return;
    try {
      const dataToSave = {
        manual_asset_id: selectedManualAsset.id,
        date: manualAssetValueData.date,
        value_ils: parseFloat(manualAssetValueData.value_ils) || 0
      };
      if (editingManualAssetValue) {
        await ManualAssetValue.update(editingManualAssetValue.id, dataToSave);
      } else {
        await ManualAssetValue.create(dataToSave);
      }
      resetAllForms();
      setIsManualAssetValueFormOpen(false);
      loadData();
    } catch (error) { console.error("Error saving manual asset value:", error); }
  };

  const handleEditInstrument = (instrument) => {
    resetAllForms();
    setEditingInstrument(instrument);
    setFormData({ name: instrument.name, symbol: instrument.symbol, asset_class_id: instrument.asset_class_id });
    setIsFormOpen(true);
  };
  
  const handleDeleteInstrument = async (id) => {
    if (window.confirm("Delete instrument and all its holdings?")) {
      const toDelete = holdings.filter(h => h.instrument_id === id);
      await Promise.all(toDelete.map(h => Holding.delete(h.id)));
      await Instrument.delete(id);
      loadData();
    }
  };

  const handleAddValueClick = (instrument) => {
    resetAllForms();
    setSelectedInstrument(instrument);
    setIsHoldingFormOpen(true);
  };
  
  const handleEditHoldingClick = (holding, instrument) => {
    resetAllForms();
    setEditingHolding(holding);
    setSelectedInstrument(instrument);
    setHoldingData({ date: format(new Date(holding.date), "yyyy-MM-dd"), total_value_ils: holding.total_value_ils.toString() });
    setIsHoldingFormOpen(true);
  };

  const handleDeleteHoldingClick = async (id) => {
    if(window.confirm("Delete this value entry?")) {
      await Holding.delete(id);
      loadData();
    }
  };

  const handleEditManualAsset = (asset) => {
    resetAllForms();
    setEditingManualAsset(asset);
    setManualAssetData({ name: asset.name });
    setIsManualAssetFormOpen(true);
  };

  const handleDeleteManualAsset = async (id) => {
    if (window.confirm("Delete manual asset and all its values?")) {
      const toDelete = manualAssetValues.filter(v => v.manual_asset_id === id);
      await Promise.all(toDelete.map(v => ManualAssetValue.delete(v.id)));
      await ManualAsset.delete(id);
      loadData();
    }
  };
  
  const handleAddManualAssetValueClick = (asset) => {
    resetAllForms();
    setSelectedManualAsset(asset);
    setIsManualAssetValueFormOpen(true);
  };
  
  const handleEditManualAssetValueClick = (value, asset) => {
    resetAllForms();
    setEditingManualAssetValue(value);
    setSelectedManualAsset(asset);
    setManualAssetValueData({ date: format(new Date(value.date), "yyyy-MM-dd"), value_ils: value.value_ils.toString() });
    setIsManualAssetValueFormOpen(true);
  };

  const handleDeleteManualAssetValueClick = async (id) => {
      if(window.confirm("Delete this value entry?")) {
          await ManualAssetValue.delete(id);
          loadData();
      }
  };

  const getInstrumentHoldings = (id) => holdings.filter(h => h.instrument_id === id);
  const getManualAssetValues = (id) => manualAssetValues.filter(v => v.manual_asset_id === id);
  const formatCurrency = (amount) => `₪${Math.round(parseFloat(amount) || 0).toLocaleString()}`;
  const groupedInstruments = instruments.reduce((acc, i) => {
    if (!acc[i.asset_class_id]) acc[i.asset_class_id] = [];
    acc[i.asset_class_id].push(i);
    return acc;
  }, {});

  if (isLoading) {
    return <InstrumentsSkeleton />;
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Instruments & Assets</h1>
          <p className="text-slate-600 mt-1">Manage your instruments and manual assets</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}><DialogTrigger asChild><Button onClick={resetAllForms} variant="outline"><Plus className="w-4 h-4 mr-2"/>Add Instrument</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{editingInstrument ? "Edit" : "Add"} Instrument</DialogTitle></DialogHeader><form onSubmit={handleInstrumentSubmit} className="space-y-4 pt-4"><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="name">Instrument Name</Label><Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Apple Inc." required/></div><div><Label htmlFor="symbol">Symbol (Optional)</Label><Input id="symbol" value={formData.symbol} onChange={(e) => setFormData({...formData, symbol: e.target.value})} placeholder="e.g., AAPL"/></div></div><div><Label htmlFor="asset_class_id">Asset Class</Label><Select value={String(formData.asset_class_id)} onValueChange={(val) => setFormData({...formData, asset_class_id: val})} required><SelectTrigger><SelectValue placeholder="Select asset class"/></SelectTrigger><SelectContent>{assetClasses.map(ac => (<SelectItem key={ac.id} value={String(ac.id)}>{ac.name}</SelectItem>))}</SelectContent></Select></div><div className="flex gap-3 pt-4"><Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="flex-1">Cancel</Button><Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800">{editingInstrument ? "Update" : "Create"}</Button></div></form></DialogContent></Dialog>
          <Dialog open={isManualAssetFormOpen} onOpenChange={setIsManualAssetFormOpen}><DialogTrigger asChild><Button onClick={resetAllForms} className="bg-slate-900 hover:bg-slate-800"><PiggyBank className="w-4 h-4 mr-2"/>Add Manual Asset</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{editingManualAsset ? "Edit" : "Add"} Manual Asset</DialogTitle></DialogHeader><form onSubmit={handleManualAssetSubmit} className="space-y-4 pt-4"><div><Label htmlFor="asset_name">Asset Name</Label><Input id="asset_name" value={manualAssetData.name} onChange={(e) => setManualAssetData({name: e.target.value})} placeholder="e.g., Bank Savings" required/></div><div className="flex gap-3 pt-4"><Button type="button" variant="outline" onClick={() => setIsManualAssetFormOpen(false)} className="flex-1">Cancel</Button><Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800">{editingManualAsset ? "Update" : "Create"}</Button></div></form></DialogContent></Dialog>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2"><PiggyBank className="w-6 h-6"/>Manual Assets</h2>
        <div className="grid gap-6">
          {manualAssets.map(asset => {
            const values = getManualAssetValues(asset.id);
            const latestValue = values.length > 0 ? values[0] : null;
            return (<Card key={asset.id} className="bg-white shadow-sm border-slate-200"><CardHeader><div className="flex justify-between items-start"><div><CardTitle>{asset.name}</CardTitle>{latestValue && (<div className="mt-2"><p className="text-sm text-slate-600">Current Value: <span className="font-bold">{formatCurrency(latestValue.value_ils)}</span></p><p className="text-xs text-slate-500">as of {format(new Date(latestValue.date), "MMM d, yyyy")}</p></div>)}</div><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => handleAddManualAssetValueClick(asset)}><Calendar className="w-4 h-4 mr-2"/>Add Value</Button><Button variant="ghost" size="icon" onClick={() => handleEditManualAsset(asset)}><Edit className="w-4 h-4"/></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteManualAsset(asset.id)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4"/></Button></div></div></CardHeader><CardContent>{values.length > 0 ? (<div><h4 className="font-semibold mb-3">Value History</h4><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{values.map(v => (<TableRow key={v.id}><TableCell>{format(new Date(v.date), "MMM d, yyyy")}</TableCell><TableCell className="text-right">{formatCurrency(v.value_ils)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => handleEditManualAssetValueClick(v, asset)}><Edit className="w-4 h-4"/></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteManualAssetValueClick(v.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button></div></TableCell></TableRow>))}</TableBody></Table></div></div>) : (<div className="text-center py-8 text-slate-500"><History className="w-12 h-12 mx-auto mb-4"/>No values recorded yet</div>)}</CardContent></Card>);
          })}
        </div>
      </div>

      <div className="space-y-8">
        {assetClasses.map(assetClass => (<div key={assetClass.id}><h2 className="text-2xl font-bold text-slate-800 mb-4">{assetClass.name}</h2><div className="grid gap-6">{(groupedInstruments[assetClass.id] || []).map(instrument => { const holdings = getInstrumentHoldings(instrument.id); const latestHolding = holdings.length > 0 ? holdings[0] : null; return (<Card key={instrument.id} className="bg-white shadow-sm"><CardHeader><div className="flex justify-between items-start"><div><CardTitle>{instrument.name}</CardTitle>{instrument.symbol && (<span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">{instrument.symbol}</span>)}{latestHolding && (<div className="mt-2"><p className="text-sm text-slate-600">Current Value: <span className="font-bold">{formatCurrency(latestHolding.total_value_ils)}</span></p><p className="text-xs text-slate-500">as of {format(new Date(latestHolding.date), "MMM d, yyyy")}</p></div>)}</div><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => handleAddValueClick(instrument)}><Calendar className="w-4 h-4 mr-2"/>Add Value</Button><Button variant="ghost" size="icon" onClick={() => handleEditInstrument(instrument)}><Edit className="w-4 h-4"/></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteInstrument(instrument.id)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4"/></Button></div></div></CardHeader><CardContent>{holdings.length > 0 ? (<div><h4 className="font-semibold mb-3">Value History</h4><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{holdings.map(h => (<TableRow key={h.id}><TableCell>{format(new Date(h.date), "MMM d, yyyy")}</TableCell><TableCell className="text-right">{formatCurrency(h.total_value_ils)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => handleEditHoldingClick(h, instrument)}><Edit className="w-4 h-4"/></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteHoldingClick(h.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button></div></TableCell></TableRow>))}</TableBody></Table></div></div>) : (<div className="text-center py-8 text-slate-500"><History className="w-12 h-12 mx-auto mb-4"/>No values recorded yet</div>)}</CardContent></Card>); })}</div></div>))}
      </div>

      {(instruments.length === 0 && manualAssets.length === 0) && (<Card className="bg-white shadow-sm"><CardContent className="p-12 text-center"><History className="w-12 h-12 text-slate-400 mx-auto mb-4"/><h3 className="text-xl font-semibold mb-2">No Assets Yet</h3><p className="text-slate-600 mb-6">Create your first instrument or manual asset to start tracking.</p><div className="flex gap-3 justify-center"><Button onClick={() => {resetAllForms(); setIsFormOpen(true);}} variant="outline"><Plus className="w-4 h-4 mr-2"/>Add Instrument</Button><Button onClick={() => {resetAllForms(); setIsManualAssetFormOpen(true);}} className="bg-slate-900 hover:bg-slate-800"><PiggyBank className="w-4 h-4 mr-2"/>Add Manual Asset</Button></div></CardContent></Card>)}
      
      <Dialog open={isHoldingFormOpen} onOpenChange={(isOpen) => { if(!isOpen) resetAllForms(); setIsHoldingFormOpen(isOpen); }}><DialogContent><DialogHeader><DialogTitle>{editingHolding ? 'Edit' : 'Add'} Value for {selectedInstrument?.name}</DialogTitle></DialogHeader><form onSubmit={handleHoldingSubmit} className="space-y-4 pt-4"><div><Label htmlFor="date">Date</Label><Input id="date" type="date" value={holdingData.date} onChange={(e) => setHoldingData({...holdingData, date: e.target.value})} required/></div><div><Label htmlFor="total_value_ils">Total Value (₪)</Label><Input id="total_value_ils" type="number" step="0.01" value={holdingData.total_value_ils} onChange={(e) => setHoldingData({...holdingData, total_value_ils: e.target.value})} required/></div><div className="flex gap-3 pt-4"><Button type="button" variant="outline" onClick={() => setIsHoldingFormOpen(false)} className="flex-1">Cancel</Button><Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800">{editingHolding ? 'Update' : 'Add'} Value</Button></div></form></DialogContent></Dialog>
      <Dialog open={isManualAssetValueFormOpen} onOpenChange={(isOpen) => { if(!isOpen) resetAllForms(); setIsManualAssetValueFormOpen(isOpen); }}><DialogContent><DialogHeader><DialogTitle>{editingManualAssetValue ? 'Edit' : 'Add'} Value for {selectedManualAsset?.name}</DialogTitle></DialogHeader><form onSubmit={handleManualAssetValueSubmit} className="space-y-4 pt-4"><div><Label htmlFor="value_date">Date</Label><Input id="value_date" type="date" value={manualAssetValueData.date} onChange={(e) => setManualAssetValueData({...manualAssetValueData, date: e.target.value})} required/></div><div><Label htmlFor="value_ils">Value (₪)</Label><Input id="value_ils" type="number" step="0.01" value={manualAssetValueData.value_ils} onChange={(e) => setManualAssetValueData({...manualAssetValueData, value_ils: e.target.value})} required/></div><div className="flex gap-3 pt-4"><Button type="button" variant="outline" onClick={() => setIsManualAssetValueFormOpen(false)} className="flex-1">Cancel</Button><Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800">{editingManualAssetValue ? 'Update' : 'Add'} Value</Button></div></form></DialogContent></Dialog>
    </div>
  );
}
