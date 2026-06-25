type FiltersProps = {
  categories: Array<{ label: string; count: number }>;
  selectedCategory: string;
  packageStates: Array<{ label: string; count: number }>;
  selectedPackageState: string;
  onSelectCategory: (category: string) => void;
  onSelectPackageState: (state: string) => void;
};

export function Filters({
  categories,
  selectedCategory,
  packageStates,
  selectedPackageState,
  onSelectCategory,
  onSelectPackageState,
}: FiltersProps) {
  return (
    <aside className="filters-col" aria-label="Report filters">
      <div className="filter-group">
        <div className="filter-group-header">
          <span className="eyebrow">Category</span>
          <span className="meta-text">01.</span>
        </div>
        <ul className="filter-list">
          {categories.map((category) => (
            <li key={category.label}>
              <button className="filter-item" type="button" onClick={() => onSelectCategory(category.label)}>
                <span
                  className={category.label === selectedCategory ? "checkbox checked" : "checkbox"}
                  aria-hidden="true"
                >
                  {category.label === selectedCategory ? (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#f4ece3" strokeWidth="1.5" />
                    </svg>
                  ) : null}
                </span>
                <span>{category.label}</span>
                <span className="filter-count">{category.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="filter-group">
        <div className="filter-group-header">
          <span className="eyebrow">Input Policy</span>
          <span className="meta-text">02.</span>
        </div>
        <ul className="filter-list muted">
          <li>Local genome evidence</li>
          <li>No raw genome in Convex</li>
          <li>Manifest hash only</li>
        </ul>
      </div>

      <div className="filter-group">
        <div className="filter-group-header">
          <span className="eyebrow">Package State</span>
          <span className="meta-text">03.</span>
        </div>
        <p className="filter-note">States can overlap; counts are unique named packages.</p>
        <ul className="filter-list">
          {packageStates.map((state) => (
            <li key={state.label}>
              <button className="filter-item" type="button" onClick={() => onSelectPackageState(state.label)}>
                <span className={state.label === selectedPackageState ? "checkbox checked" : "checkbox"} aria-hidden="true">
                  {state.label === selectedPackageState ? (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#f4ece3" strokeWidth="1.5" />
                    </svg>
                  ) : null}
                </span>
                <span>{state.label}</span>
                <span className="filter-count">{state.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
