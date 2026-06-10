
import React, { useState, useEffect } from "react";
import { AssetClass, Instrument, User } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AssetClassesSkeleton } from "../components/shared/LoadingSkeletons";

const ASSET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", 
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1"
];

export default function AssetClasses() {
  const [assetClasses, setAssetClasses] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    target_percent: "",
    color: ASSET_COLORS[0]
  });

  // State for the new instrument modal
  const [isInstrumentModalOpen, setIsInstrumentModalOpen] = useState(false);
  const [selectedAssetClass, setSelectedAssetClass] = useState(null);
  const [instrumentFormData, setInstrumentFormData] = useState({ name: "", symbol: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      if (!user) {
        setCurrentUser(null);
        setAssetClasses([]); // Clear data if no user
        setInstruments([]);
        setIsLoading(false);
        return;
      }
      setCurrentUser(user);

      // Concurrently load asset classes and instruments
      const [assetClassesData, instrumentsData] = await Promise.all([
        AssetClass.list(),
        Instrument.list(),
      ]);
      
      setAssetClasses(assetClassesData || []);
      setInstruments(instrumentsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      // Optionally reset states or show error message
      setCurrentUser(null); 
      setAssetClasses([]);
      setInstruments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.target_percent || !currentUser) return;

    try {
      const baseAssetData = { // Base data common for both create and update
        name: formData.name,
        target_percent: parseFloat(formData.target_percent),
        color: formData.color,
      };

      if (editingAsset) {
        await AssetClass.update(editingAsset.id, baseAssetData);
      } else {
        // For creation, add created_by
        await AssetClass.create({ ...baseAssetData, created_by: currentUser.email });
      }

      resetForm();
      setIsDialogOpen(false);
      loadData(); // Reload all data after submit
    } catch (error) {
      console.error("Error saving asset class:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      target_percent: "",
      color: ASSET_COLORS[0]
    });
    setEditingAsset(null);
  };

  const handleEdit = (asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      target_percent: asset.target_percent.toString(),
      color: asset.color || ASSET_COLORS[0]
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this asset class? This will not delete its associated instruments.")) {
      await AssetClass.delete(id);
      loadData(); // Reload all data after delete
    }
  };

  const getInstrumentCount = (assetClassId) => {
    return instruments.filter(i => i.asset_class_id === assetClassId).length;
  };

  const totalTarget = assetClasses.reduce((sum, asset) => sum + (parseFloat(asset.target_percent) || 0), 0);

  // Handlers for the new instrument modal
  const handleAddInstrumentClick = (asset) => {
    setSelectedAssetClass(asset);
    setInstrumentFormData({ name: "", symbol: "" });
    setIsInstrumentModalOpen(true);
  };

  const handleInstrumentSubmit = async (e) => {
    e.preventDefault();
    if (!instrumentFormData.name || !selectedAssetClass || !currentUser) return;
    
    try {
      await Instrument.create({
        ...instrumentFormData,
        asset_class_id: selectedAssetClass.id,
        created_by: currentUser.email
      });
      setIsInstrumentModalOpen(false);
      loadData(); // Reload data to update instrument count
    } catch (error) {
      console.error("Error creating instrument:", error);
    }
  };

  // Conditional rendering for skeleton while loading
  if (isLoading) {
    return <AssetClassesSkeleton />;
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Asset Classes</h1>
          <p className="text-slate-600 mt-1">Manage your investment categories and target allocations</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Asset Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAsset ? "Edit Asset Class" : "Add New Asset Class"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Asset Class Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., US Equities, Europe ETF"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="target_percent">Target Allocation (%)</Label>
                <Input
                  id="target_percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.target_percent}
                  onChange={(e) => setFormData({...formData, target_percent: e.target.value})}
                  placeholder="25"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="color">Chart Color</Label>
                <div className="flex gap-2 mt-2">
                  {ASSET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color ? 'border-slate-400 scale-110' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({...formData, color})}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800">
                  {editingAsset ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-white shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Target Allocation Summary</span>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-slate-600" />
              <span className={`text-lg font-bold ${
                totalTarget === 100 ? 'text-emerald-600' : 
                totalTarget > 100 ? 'text-red-500' : 'text-amber-500'
              }`}>
                {totalTarget}%
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalTarget !== 100 && (
            <div className={`p-3 rounded-lg mb-4 ${
              totalTarget > 100 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {totalTarget > 100 
                ? `Over-allocated by ${(totalTarget - 100).toFixed(1)}%` 
                : `Under-allocated by ${(100 - totalTarget).toFixed(1)}%`
              }
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assetClasses.map((asset) => (
          <Card key={asset.id} className="bg-white shadow-sm border-slate-200 hover:shadow-md transition-shadow flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: asset.color }}
                  />
                  <span className="text-lg">{asset.name}</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(asset)}
                    className="hover:bg-slate-100"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(asset.id)}
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="text-3xl font-bold text-slate-900">
                {asset.target_percent}%
              </div>
              <p className="text-sm text-slate-600 mt-1">Target allocation</p>
              <p className="text-sm text-slate-500 mt-2">{getInstrumentCount(asset.id)} instruments</p>
            </CardContent>
            <CardFooter className="p-4 border-t border-slate-100">
              <Button variant="outline" size="sm" className="w-full" onClick={() => handleAddInstrumentClick(asset)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Instrument
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {assetClasses.length === 0 && !isLoading && (
        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-12 text-center">
            <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Asset Classes Yet</h3>
            <p className="text-slate-600 mb-6">Create your first asset class to start tracking your portfolio allocation.</p>
            <Button 
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Asset Class
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Instrument Modal */}
      <Dialog open={isInstrumentModalOpen} onOpenChange={setIsInstrumentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Instrument to {selectedAssetClass?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInstrumentSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="inst_name">Instrument Name</Label>
                <Input
                  id="inst_name"
                  value={instrumentFormData.name}
                  onChange={(e) => setInstrumentFormData({...instrumentFormData, name: e.target.value})}
                  placeholder="e.g., Apple Inc."
                  required
                />
              </div>
              <div>
                <Label htmlFor="inst_symbol">Symbol (Optional)</Label>
                <Input
                  id="inst_symbol"
                  value={instrumentFormData.symbol}
                  onChange={(e) => setInstrumentFormData({...instrumentFormData, symbol: e.target.value})}
                  placeholder="e.g., AAPL"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInstrumentModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800">
                Create Instrument
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
