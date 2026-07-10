import { useEffect, useState } from 'react';
import { GlassOverlay, GlassPanel, GlassButton } from '@/components/glass';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { toTitleCase, byNameAsc } from '@/lib/utils';

export interface ReassignConfig {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
  emptyMessage: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Exact text the user must type to confirm. */
  itemName: string;
  warning: string;
  reassign?: ReassignConfig;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDeleteOverlay({ open, onClose, title, itemName, warning, reassign, onConfirm }: Props) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setTyped(''); setBusy(false); }
  }, [open]);

  if (!open) return null;

  const nameMatches = typed.trim().toLowerCase() === itemName.trim().toLowerCase();
  const reassignBlocked = !!reassign && reassign.options.length === 0;
  const reassignReady = !reassign || (reassign.options.length > 0 && !!reassign.value);
  const canConfirm = nameMatches && reassignReady && !reassignBlocked && !busy;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <GlassOverlay onClick={onClose} />
      <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-3 sm:px-4 animate-slide-down">
        <div className="w-full max-w-lg min-w-0">
          <GlassPanel title={title} subtitle="Confirm deletion" showClose onClose={onClose}>
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-red-500/15 border border-red-400/30 p-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-300 mt-0.5" />
                <p className="text-sm text-white/90">{warning}</p>
              </div>

              {reassign && (
                <div className="space-y-2">
                  <Label className="text-white/90">{reassign.label}</Label>
                  {reassignBlocked ? (
                    <p className="text-sm text-red-300">{reassign.emptyMessage}</p>
                  ) : (
                    <Select value={reassign.value} onValueChange={reassign.onChange}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder={reassign.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {[...reassign.options].sort(byNameAsc).map(o => (
                          <SelectItem key={o.id} value={o.id}>{toTitleCase(o.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-white/90">
                  Type <span className="font-semibold text-white">{itemName}</span> to confirm
                </Label>
                <Input
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={itemName}
                  disabled={reassignBlocked}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <GlassButton type="button" onClick={onClose} className="flex-1">Cancel</GlassButton>
                <GlassButton
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="flex-1 !bg-red-500/30 !border-red-400/40 hover:!bg-red-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy ? 'Deleting…' : 'Delete'}
                </GlassButton>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </>
  );
}