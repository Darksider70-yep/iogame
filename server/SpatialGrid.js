/**
 * Spatial Grid for fast 2D broadphase collision checks and AOI queries.
 */
class SpatialGrid {
  constructor(worldWidth, worldHeight, cellSize = 400) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.cells = new Map();
  }

  _getKey(cellX, cellY) {
    return `${cellX},${cellY}`;
  }

  _getCellCoords(x, y) {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)));
    return { cx, cy };
  }

  clear() {
    this.cells.clear();
  }

  insert(entity) {
    const { cx, cy } = this._getCellCoords(entity.x, entity.y);
    const key = this._getKey(cx, cy);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key).push(entity);
  }

  getNearby(x, y, radius = 400) {
    const minC = this._getCellCoords(x - radius, y - radius);
    const maxC = this._getCellCoords(x + radius, y + radius);
    const results = [];

    for (let cy = minC.cy; cy <= maxC.cy; cy++) {
      for (let cx = minC.cx; cx <= maxC.cx; cx++) {
        const key = this._getKey(cx, cy);
        const list = this.cells.get(key);
        if (list) {
          for (let i = 0; i < list.length; i++) {
            results.push(list[i]);
          }
        }
      }
    }
    return results;
  }
}

module.exports = SpatialGrid;
