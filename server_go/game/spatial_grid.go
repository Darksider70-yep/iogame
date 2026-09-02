package game

import "math"

type SpatialGrid struct {
	WorldWidth  float64
	WorldHeight float64
	CellSize    float64
	Cols        int
	Rows        int
	CellCount   int
	Cells       [][]*Player
}

func NewSpatialGrid(worldWidth, worldHeight, cellSize float64) *SpatialGrid {
	cols := int(math.Ceil(worldWidth / cellSize))
	rows := int(math.Ceil(worldHeight / cellSize))
	cellCount := cols * rows

	cells := make([][]*Player, cellCount)
	for i := range cells {
		cells[i] = make([]*Player, 0, 16)
	}

	return &SpatialGrid{
		WorldWidth:  worldWidth,
		WorldHeight: worldHeight,
		CellSize:    cellSize,
		Cols:        cols,
		Rows:        rows,
		CellCount:   cellCount,
		Cells:       cells,
	}
}

func (g *SpatialGrid) Clear() {
	for i := range g.Cells {
		g.Cells[i] = g.Cells[i][:0]
	}
}

func (g *SpatialGrid) Insert(p *Player) {
	cx := int(p.X / g.CellSize)
	cy := int(p.Y / g.CellSize)

	if cx < 0 {
		cx = 0
	} else if cx >= g.Cols {
		cx = g.Cols - 1
	}

	if cy < 0 {
		cy = 0
	} else if cy >= g.Rows {
		cy = g.Rows - 1
	}

	idx := cy*g.Cols + cx
	g.Cells[idx] = append(g.Cells[idx], p)
}

func (g *SpatialGrid) GetNearby(x, y, radius float64) []*Player {
	minCx := int((x - radius) / g.CellSize)
	maxCx := int((x + radius) / g.CellSize)
	minCy := int((y - radius) / g.CellSize)
	maxCy := int((y + radius) / g.CellSize)

	if minCx < 0 {
		minCx = 0
	}
	if maxCx >= g.Cols {
		maxCx = g.Cols - 1
	}
	if minCy < 0 {
		minCy = 0
	}
	if maxCy >= g.Rows {
		maxCy = g.Rows - 1
	}

	results := make([]*Player, 0, 32)
	for cy := minCy; cy <= maxCy; cy++ {
		rowOffset := cy * g.Cols
		for cx := minCx; cx <= maxCx; cx++ {
			list := g.Cells[rowOffset+cx]
			results = append(results, list...)
		}
	}
	return results
}
