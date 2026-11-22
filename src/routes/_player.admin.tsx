function AppSettingsTab() {
  const { fb, settings } = useApp();
  const [ghostWaitSeconds, setGhostWaitSeconds] = useState(settings?.ghostWaitSeconds ?? 20);
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(settings?.voiceChatEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [savingVoiceChat, setSavingVoiceChat] = useState(false);

  useEffect(() => {
    if (settings?.ghostWaitSeconds) setGhostWaitSeconds(settings.ghostWaitSeconds);
  }, [settings?.ghostWaitSeconds]);

  useEffect(() => {
    setVoiceChatEnabled(settings?.voiceChatEnabled ?? true);
  }, [settings?.voiceChatEnabled]);

  async function saveGhostWait(secs: number) {
    if (!fb) return;
    const clamped = Math.max(5, Math.min(120, secs));
    setSaving(true);
    try {
      await setDoc(doc(fb.db, "settings", "app"), { ghostWaitSeconds: clamped }, { merge: true });
      setGhostWaitSeconds(clamped);
      toast.success(`Ghost rival button will appear after ${clamped}s`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveVoiceChat(enabled: boolean) {
    if (!fb) return;

    const previousValue = voiceChatEnabled;
    setVoiceChatEnabled(enabled);
    setSavingVoiceChat(true);

    try {
      await setDoc(doc(fb.db, "settings", "app"), { voiceChatEnabled: enabled }, { merge: true });
      toast.success(enabled ? "Voice chat enabled" : "Voice chat disabled");
    } catch (e) {
      setVoiceChatEnabled(previousValue);
      toast.error((e as Error).message);
    } finally {
      setSavingVoiceChat(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-card space-y-3 p-4 border border-border/40">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Mic className="text-primary size-5" />
            <div>
              <div className="font-semibold text-base">Match Voice Chat</div>
              <div className="text-muted-foreground text-xs">
                Allow players to join optional voice chat during eligible battles.
              </div>
            </div>
          </div>
          <Switch
            checked={voiceChatEnabled}
            onCheckedChange={saveVoiceChat}
            disabled={savingVoiceChat || !fb}
            aria-label="Enable match voice chat"
          />
        </div>
      </div>

      <div className="surface-card space-y-3 p-4 border border-border/40">
        <div className="flex items-center gap-2">
          <Clock className="text-primary size-5" />
          <div>
            <div className="font-semibold text-base">Ghost Rivals Matchmaking Delay</div>
            <div className="text-muted-foreground text-xs">
              Time to wait in queue before the "Ghost Rival" solo-battle option appears.
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20, 30, 45, 60].map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={ghostWaitSeconds === preset ? "default" : "outline"}
                disabled={saving}
                onClick={() => saveGhostWait(preset)}
                className="text-xs"
              >
                {preset}s {preset === 20 ? "(Default)" : ""}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Label className="text-xs shrink-0">Custom timer (5s – 120s):</Label>
            <Input
              type="number"
              min={5}
              max={120}
              className="w-24 h-9"
              value={ghostWaitSeconds}
              onChange={(e) => setGhostWaitSeconds(Number(e.target.value))}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => saveGhostWait(ghostWaitSeconds)}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      <PaymentDetailsCard />
    </div>
  );
}
