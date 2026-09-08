export interface OptimalGrid {
  cols: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
}

// Verilen sayıda kartı, sabit en-boy oranını koruyarak container'a
// en büyük şekilde sığdıran sütun/satır kombinasyonunu bulur.
export function computeOptimalGrid(
  count: number,
  containerWidth: number,
  containerHeight: number,
  ratio: number = 9 / 13, // genişlik / yükseklik
  gap: number = 14,
): OptimalGrid {
  if (count <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { cols: 1, rows: 1, cardWidth: 0, cardHeight: 0 };
  }

  let best: OptimalGrid = { cols: 1, rows: count, cardWidth: 0, cardHeight: 0 };

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);

    const cellWidth = (containerWidth - gap * (cols - 1)) / cols;
    const cellHeight = (containerHeight - gap * (rows - 1)) / rows;

    let cardWidth = cellWidth;
    let cardHeight = cardWidth / ratio;

    if (cardHeight > cellHeight) {
      cardHeight = cellHeight;
      cardWidth = cardHeight * ratio;
    }

    if (cardWidth > best.cardWidth) {
      best = { cols, rows, cardWidth, cardHeight };
    }
  }

  return best;
}
