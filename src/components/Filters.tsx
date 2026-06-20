type FiltersProps = {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
};

export function Filters({ categories, selectedCategory, onSelectCategory }: FiltersProps) {
  return (
    <aside className="filters-col" aria-label="Report filters">
      <div className="filter-group">
        <div className="filter-group-header">
          <span className="eyebrow">Category</span>
          <span className="meta-text">01.</span>
        </div>
        <ul className="filter-list">
          {categories.map((category) => (
            <li key={category}>
              <button className="filter-item" type="button" onClick={() => onSelectCategory(category)}>
                <span className={category === selectedCategory ? "checkbox checked" : "checkbox"} aria-hidden="true">
                  {category === selectedCategory ? (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#f4ece3" strokeWidth="1.5" />
                    </svg>
                  ) : null}
                </span>
                {category}
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
        <ul className="filter-list muted">
          <li>Direct fields</li>
          <li>Curated references</li>
          <li>Inferred prompt gaps</li>
        </ul>
      </div>
    </aside>
  );
}
