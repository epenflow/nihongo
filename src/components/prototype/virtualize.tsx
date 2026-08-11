// --- 1. STABLE VIRTUAL STORE DENGAN UPDATER ---
class SimpleVirtualStore {
  private data: string[] = [];
  private offset = 0;
  private listeners = new Set<() => void>();
  private cachedSnapshot: { data: string[]; offset: number; order: string[] };

  constructor(initialData: string[]) {
    this.data = initialData;
    this.cachedSnapshot = this.createSnapshot();
  }

  setItems(newItems: string[]) {
    this.data = newItems;
    // Pastikan offset tidak out of bounds jika data berubah
    if (this.offset >= this.data.length) {
      this.offset = Math.max(0, this.data.length - 1);
    }
    this.updateCache();
    this.emit();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => {
    return this.cachedSnapshot;
  };

  next = () => {
    if (this.data.length === 0) return;
    this.offset = (this.offset + 1) % this.data.length;
    this.updateCache();
    this.emit();
  };

  prev = () => {
    if (this.data.length === 0) return;
    this.offset = (this.offset - 1 + this.data.length) % this.data.length;
    this.updateCache();
    this.emit();
  };

  private createSnapshot() {
    return {
      data: this.data,
      offset: this.offset,
      order:
        this.data.length > 0
          ? [
              ...this.data.slice(this.offset),
              ...this.data.slice(0, this.offset),
            ]
          : [],
    };
  }

  private updateCache() {
    this.cachedSnapshot = this.createSnapshot();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const StoreContext = createContext<SimpleVirtualStore | null>(null);

// --- 2. PURE VIRTUAL CAROUSEL COMPONENT ---
export function PureVirtualCarousel({
  items,
  maxVisible = 3,
  overscan = 1,
}: {
  items: string[];
  maxVisible?: number;
  overscan?: number;
}) {
  const [store] = useState(() => new SimpleVirtualStore(items));

  // Sinkronkan items baru ke dalam store jika prop items berubah
  useEffect(() => {
    store.setItems(items);
  }, [items, store]);

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const renderDistance = maxVisible + overscan;
  const visibleOrder = snapshot.order.slice(0, renderDistance);

  return (
    <StoreContext.Provider value={store}>
      <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
        <h3>Demo Pure Virtualization Carousel</h3>
        <p>
          Total Data Global: <b>{items.length}</b> | Total DOM Dirender saat
          ini: <b>{visibleOrder.length}</b> (Virtual)
        </p>

        {/* Viewport Container */}
        <div
          style={{
            border: "2px solid #333",
            height: "180px",
            position: "relative",
            marginBottom: "10px",
            overflow: "hidden",
            background: "#f9f9f9",
          }}>
          {visibleOrder.map((id, stackIndex) => {
            return (
              <div
                key={id}
                style={{
                  position: "absolute",
                  top: `${stackIndex * 15 + 20}px`,
                  left: `${stackIndex * 15 + 20}px`,
                  width: "250px",
                  height: "80px",
                  background: stackIndex === 0 ? "#fffae6" : "#ffffff",
                  border: "1px solid #ccc",
                  padding: "10px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  zIndex: visibleOrder.length - stackIndex,
                }}>
                <div>
                  <b>Item ID:</b> {id}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  Stack Index: {stackIndex}{" "}
                  {stackIndex === 0 ? "(Aktif)" : "(Di tumpukan belakang)"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Kontrol Navigasi */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={() => store.prev()}>Prev</button>
          <button onClick={() => store.next()}>Next</button>
          <span>Offset Aktif: {snapshot.offset}</span>
        </div>
      </div>
    </StoreContext.Provider>
  );
}
