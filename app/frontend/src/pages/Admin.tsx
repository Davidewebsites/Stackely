import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Search, Sparkles, AlertTriangle } from 'lucide-react';
import { client, CATEGORIES, findDuplicateTool, type Tool } from '@/lib/api';
import { validateAdminAccess } from '@/lib/admin-auth';
import { toast } from 'sonner';
import StackelyLogo from '@/components/StackelyLogo';

const EMPTY_TOOL: Partial<Tool> = {
  name: '', slug: '', short_description: '', full_description: '',
  category: 'ads', subcategory: '', tags: '', pricing_model: 'freemium',
  starting_price: '', skill_level: 'beginner', website_url: '', logo_url: '', affiliate_url: '',
  internal_score: 70, is_featured: false, pros: '', cons: '', best_use_cases: '', active: true,
  tool_type: 'traditional',
};

/**
 * Identify duplicate tool groups.
 * Returns a Map where key = normalized slug/name, value = array of tool IDs that share it.
 * Only entries with 2+ tools are included.
 */
function findDuplicateGroups(tools: Tool[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const tool of tools) {
    const key = (tool.slug || tool.name.toLowerCase()).trim();
    const existing = groups.get(key) || [];
    existing.push(tool.id);
    groups.set(key, existing);
  }
  // Keep only groups with duplicates
  const dupes = new Map<string, number[]>();
  for (const [key, ids] of groups) {
    if (ids.length > 1) {
      dupes.set(key, ids);
    }
  }
  return dupes;
}

/**
 * Build a set of tool IDs that are "inferior" duplicates (should be suppressed).
 * For each duplicate group, keep the best record based on:
 * 1. higher internal_score
 * 2. valid website_url
 * 3. valid logo_url
 * 4. active = true
 */
function getInferiorDuplicateIds(tools: Tool[], dupeGroups: Map<string, number[]>): Set<number> {
  const inferior = new Set<number>();

  for (const ids of dupeGroups.values()) {
    const groupTools = ids.map((id) => tools.find((t) => t.id === id)).filter(Boolean) as Tool[];

    // Sort: best first
    groupTools.sort((a, b) => {
      // 1. Higher internal_score
      const scoreDiff = (b.internal_score || 0) - (a.internal_score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      // 2. Has website_url
      const aWeb = a.website_url ? 1 : 0;
      const bWeb = b.website_url ? 1 : 0;
      if (bWeb !== aWeb) return bWeb - aWeb;
      // 3. Has logo_url
      const aLogo = a.logo_url ? 1 : 0;
      const bLogo = b.logo_url ? 1 : 0;
      if (bLogo !== aLogo) return bLogo - aLogo;
      // 4. Active
      const aActive = a.active !== false ? 1 : 0;
      const bActive = b.active !== false ? 1 : 0;
      return bActive - aActive;
    });

    // First is the best, rest are inferior
    for (let i = 1; i < groupTools.length; i++) {
      inferior.add(groupTools[i].id);
    }
  }

  return inferior;
}

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authorized, setAuthorized] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showDupesOnly, setShowDupesOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Partial<Tool>>(EMPTY_TOOL);
  const [saving, setSaving] = useState(false);

  // Auth check — redirect if missing/invalid key
  useEffect(() => {
    if (validateAdminAccess(searchParams)) {
      setAuthorized(true);
    } else {
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate]);

  const loadTools = useCallback(async () => {
    setLoading(true);
    try {
      const response = await client.entities.tools.query({
        query: {},
        sort: '-internal_score',
        limit: 200,
      });
      setTools(response?.data?.items || []);
    } catch {
      toast.error('Failed to load tools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) loadTools();
  }, [authorized, loadTools]);

  // Duplicate detection
  const dupeGroups = useMemo(() => findDuplicateGroups(tools), [tools]);
  const inferiorIds = useMemo(() => getInferiorDuplicateIds(tools, dupeGroups), [tools, dupeGroups]);
  const dupeIdSet = useMemo(() => {
    const set = new Set<number>();
    for (const ids of dupeGroups.values()) {
      for (const id of ids) set.add(id);
    }
    return set;
  }, [dupeGroups]);

  const totalDupes = dupeGroups.size;

  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || t.category === categoryFilter;
      const matchDupe = !showDupesOnly || dupeIdSet.has(t.id);
      return matchSearch && matchCategory && matchDupe;
    });
  }, [tools, search, categoryFilter, showDupesOnly, dupeIdSet]);

  const openCreate = () => {
    setEditingTool({ ...EMPTY_TOOL });
    setDialogOpen(true);
  };

  const openEdit = (tool: Tool) => {
    setEditingTool({ ...tool });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingTool.name || !editingTool.slug || !editingTool.short_description) {
      toast.error('Name, slug, and short description are required');
      return;
    }
    setSaving(true);
    try {
      if (editingTool.id) {
        // Update existing tool — check for duplicates excluding self
        const otherTools = tools.filter((t) => t.id !== editingTool.id);
        const dupe = findDuplicateTool(otherTools, editingTool.name || '', editingTool.slug || '');
        if (dupe) {
          toast.error(`Duplicate detected: "${dupe.name}" (ID: ${dupe.id}) has the same slug or name. Please use a unique slug/name.`);
          setSaving(false);
          return;
        }
        await client.entities.tools.update({ id: String(editingTool.id), data: editingTool });
        toast.success('Tool updated');
      } else {
        // Create new tool — check for duplicates
        const dupe = findDuplicateTool(tools, editingTool.name || '', editingTool.slug || '');
        if (dupe) {
          toast.error(`Duplicate detected: "${dupe.name}" (ID: ${dupe.id}) already exists with the same slug or name. Please use a unique slug/name.`);
          setSaving(false);
          return;
        }
        await client.entities.tools.create({ data: editingTool });
        toast.success('Tool created');
      }
      setDialogOpen(false);
      loadTools();
    } catch {
      toast.error('Failed to save tool');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tool: Tool) => {
    if (!confirm(`Delete "${tool.name}"?`)) return;
    try {
      await client.entities.tools.delete({ id: String(tool.id) });
      toast.success('Tool deleted');
      loadTools();
    } catch {
      toast.error('Failed to delete tool');
    }
  };

  const updateField = (field: string, value: unknown) => {
    setEditingTool((prev) => ({ ...prev, [field]: value }));
  };

  // Don't render anything until auth is confirmed
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-8 px-2 text-slate-500 hover:text-slate-900 shadow-none">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <StackelyLogo size="sm" />
            </div>
            <span className="text-[13px] text-slate-400 font-medium">/ Admin</span>
          </div>
          <Button onClick={openCreate} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium shadow-none">
            <Plus className="w-4 h-4 mr-1" />
            Add Tool
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Duplicate warning banner */}
        {totalDupes > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[14px] font-medium text-amber-800">
                {totalDupes} duplicate tool group{totalDupes !== 1 ? 's' : ''} detected
              </p>
              <p className="text-[12px] text-amber-600 mt-0.5">
                Duplicates are highlighted with an amber border. Inferior records (lower score, missing data) are marked for cleanup.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDupesOnly(!showDupesOnly)}
              className="h-8 text-[12px] border-amber-300 text-amber-700 hover:bg-amber-100 shadow-none flex-shrink-0"
            >
              {showDupesOnly ? 'Show all' : 'Show duplicates only'}
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-[13px] border-slate-200 shadow-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 h-9 text-[13px] border-slate-200 shadow-none">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="h-9 px-4 flex items-center text-[12px] bg-slate-100 text-slate-600">
            {filteredTools.length} tools
          </Badge>
        </div>

        {/* Tools List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTools.map((tool) => {
              const cat = CATEGORIES.find((c) => c.id === tool.category);
              const isDupe = dupeIdSet.has(tool.id);
              const isInferior = inferiorIds.has(tool.id);

              return (
                <Card
                  key={tool.id}
                  className={`shadow-none transition-colors ${
                    isInferior
                      ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
                      : isDupe
                        ? 'border-amber-200 hover:border-amber-300'
                        : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[14px] text-slate-900 truncate">{tool.name}</span>
                        {(tool.tool_type === 'ai' || tool.tool_type === 'hybrid') && (
                          <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
                            <Sparkles className="w-3 h-3 mr-0.5" />
                            {tool.tool_type === 'hybrid' ? 'Hybrid' : 'AI'}
                          </Badge>
                        )}
                        {tool.is_featured && <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Featured</Badge>}
                        {!tool.active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                        {isInferior && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-0.5" />
                            Duplicate — inferior
                          </Badge>
                        )}
                        {isDupe && !isInferior && (
                          <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">
                            Duplicate — best
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-slate-500">
                        <span>{cat?.label}</span>
                        <span className="text-slate-200">·</span>
                        <span className="capitalize">{tool.pricing_model}</span>
                        <span className="text-slate-200">·</span>
                        <span className="capitalize">{tool.skill_level}</span>
                        <span className="text-slate-200">·</span>
                        <span>Score: {tool.internal_score}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-slate-400">ID: {tool.id}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 shadow-none hover:border-blue-300 hover:text-blue-600" onClick={() => openEdit(tool)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 shadow-none text-red-500 hover:text-red-700 hover:border-red-300" onClick={() => handleDelete(tool)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[16px]">{editingTool.id ? 'Edit Tool' : 'Add New Tool'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-[12px]">Name *</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.name || ''} onChange={(e) => updateField('name', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-[12px]">Slug *</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.slug || ''} onChange={(e) => updateField('slug', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-[12px]">Short Description *</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.short_description || ''} onChange={(e) => updateField('short_description', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-[12px]">Full Description</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-slate-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:ring-1 focus:ring-blue-100 focus:outline-none"
                value={editingTool.full_description || ''}
                onChange={(e) => updateField('full_description', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[12px]">Category</Label>
              <Select value={editingTool.category || 'ads'} onValueChange={(v) => updateField('category', v)}>
                <SelectTrigger className="h-9 text-[13px] border-slate-200 shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Subcategory</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.subcategory || ''} onChange={(e) => updateField('subcategory', e.target.value)} />
            </div>
            <div>
              <Label className="text-[12px]">Pricing Model</Label>
              <Select value={editingTool.pricing_model || 'freemium'} onValueChange={(v) => updateField('pricing_model', v)}>
                <SelectTrigger className="h-9 text-[13px] border-slate-200 shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="freemium">Freemium</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Starting Price</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.starting_price || ''} onChange={(e) => updateField('starting_price', e.target.value)} />
            </div>
            <div>
              <Label className="text-[12px]">Skill Level</Label>
              <Select value={editingTool.skill_level || 'beginner'} onValueChange={(v) => updateField('skill_level', v)}>
                <SelectTrigger className="h-9 text-[13px] border-slate-200 shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Internal Score (1-100)</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" type="number" min={1} max={100} value={editingTool.internal_score || 70} onChange={(e) => updateField('internal_score', parseInt(e.target.value) || 70)} />
            </div>
            <div className="col-span-2">
              <Label className="text-[12px]">Tags (comma-separated)</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.tags || ''} onChange={(e) => updateField('tags', e.target.value)} />
            </div>
            <div>
              <Label className="text-[12px]">Website URL</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.website_url || ''} onChange={(e) => updateField('website_url', e.target.value)} />
            </div>
            <div>
              <Label className="text-[12px]">Logo URL (optional override)</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" placeholder="https://example.com/logo.png" value={editingTool.logo_url || ''} onChange={(e) => updateField('logo_url', e.target.value)} />
            </div>
            <div>
              <Label className="text-[12px]">Affiliate URL</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.affiliate_url || ''} onChange={(e) => updateField('affiliate_url', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-[12px]">Pros (comma-separated)</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.pros || ''} onChange={(e) => updateField('pros', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-[12px]">Cons (comma-separated)</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.cons || ''} onChange={(e) => updateField('cons', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-[12px]">Best Use Cases (comma-separated)</Label>
              <Input className="h-9 text-[13px] border-slate-200 shadow-none" value={editingTool.best_use_cases || ''} onChange={(e) => updateField('best_use_cases', e.target.value)} />
            </div>
            <div>
              <Label className="text-[12px]">Tool Type</Label>
              <Select value={editingTool.tool_type || 'traditional'} onValueChange={(v) => updateField('tool_type', v)}>
                <SelectTrigger className="h-9 text-[13px] border-slate-200 shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="traditional">Traditional</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch checked={editingTool.is_featured || false} onCheckedChange={(v) => updateField('is_featured', v)} />
                <Label className="text-[12px]">Featured</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editingTool.active !== false} onCheckedChange={(v) => updateField('active', v)} />
                <Label className="text-[12px]">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9 text-[13px] border-slate-200 shadow-none">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-9 text-[13px] bg-blue-600 hover:bg-blue-700 text-white shadow-none">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingTool.id ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}