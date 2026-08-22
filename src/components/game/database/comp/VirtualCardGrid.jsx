import { useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

function columnCount(width, maxColumns = 4, mobileColumns = 2) {
  const available = width >= 1536 ? 5 : width >= 1280 ? 4 : width >= 1024 ? 3 : width >= 640 ? 2 : mobileColumns;
  return Math.max(1, Math.min(maxColumns, available));
}

function GridRow({ index, style, data }) {
  const { columns, items, renderItem, getKey } = data;
  const start = index * columns;
  const rowItems = items.slice(start, start + columns);

  return (
    <div style={style} className="box-border px-1 pb-3">
      <div className="grid h-full items-stretch gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {rowItems.map((item, offset) => {
          const itemIndex = start + offset;
          return (
            <div key={getKey?.(item, itemIndex) || itemIndex} className="h-full min-w-0">
              {renderItem(item, itemIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VirtualCardGrid({ items, renderItem, getKey, className = '', rowHeight = 390, rowHeightMobile, maxColumns = 4, mobileColumns = 2, overscanRowCount = 2 }) {
  return (
    <div className={className}>
      <AutoSizer>
        {({ height, width }) => (
          <FixedGrid
            getKey={getKey}
            height={height || 1}
            items={items}
            overscanRowCount={overscanRowCount}
            renderItem={renderItem}
            rowHeight={(width || 0) < 640 && rowHeightMobile ? rowHeightMobile : rowHeight}
            maxColumns={maxColumns}
            mobileColumns={mobileColumns}
            width={width || 1}
          />
        )}
      </AutoSizer>
    </div>
  );
}

function FixedGrid({ items, renderItem, getKey, rowHeight, maxColumns, mobileColumns, overscanRowCount, height, width }) {
  const columns = columnCount(width || 0, maxColumns, mobileColumns);
  const rows = Math.ceil(items.length / columns);
  const itemData = useMemo(() => ({
    columns,
    items,
    renderItem,
    getKey,
  }), [columns, items, renderItem, getKey]);

  return (
    <FixedSizeList
      className="app-scrollbar"
      height={height}
      itemCount={rows}
      itemData={itemData}
      itemSize={rowHeight}
      overscanCount={overscanRowCount}
      width={width}
    >
      {GridRow}
    </FixedSizeList>
  );
}
