/**
 * High-performance 1D Flat Spatial Grid for zero-allocation broadphase collision checks.
 */
class SpatialGrid {
  constructor(worldWidth, worldHeight, cellSize = 400) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.cellCount = this.cols * this.rows;
    this.cells = new Array(this.cellCount);
    for (let i = 0; i < this.cellCount; i++) {
      this.cells[i] = [];
    }
  }

  _getCellIndex(cx, cy) {
    return cy * this.cols + cx;
  }

  _getCellCoords(x, y) {
    const cx = Math.max(0, Math.min(this.cols - 1, (x / this.cellSize) | 0));
    const cy = Math.max(0, Math.min(this.rows - 1, (y / this.cellSize) | 0));
    return { cx, cy };
  }

  clear() {
    for (let i = 0; i < this.cellCount; i++) {
      this.cells[i].length = 0;
    }
  }

  insert(entity) {
    const cx = Math.max(0, Math.min(this.cols - 1, (entity.x / this.cellSize) | 0));
    const cy = Math.max(0, Math.min(this.rows - 1, (entity.y / this.cellSize) | 0));
    this.cells[cy * this.cols + cx].push(entity);
  }

  getNearby(x, y, radius = 400) {
    const minCx = Math.max(0, Math.min(this.cols - 1, ((x - radius) / this.cellSize) | 0));
    const minCy = Math.max(0, Math.min(this.rows - 1, ((y - radius) / this.cellSize) | 0));
    const maxCx = Math.max(0, Math.min(this.cols - 1, ((x + radius) / this.cellSize) | 0));
    const maxCy = Math.max(0, Math.min(this.rows - 1, ((y + radius) / this.cellSize) | 0));
    const results = [];

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = this.cells[rowOffset + cx];
        for (let i = 0; i < list.length; i++) {
          results.push(list[i]);
        }
      }
    }
    return results;
  }
}

module.exports = SpatialGrid;
