package game

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"sync"
	"time"
)

type GameRoom struct {
	WorldWidth  float64
	WorldHeight float64
	MaxBots     int

	Players     map[string]*Player
	Projectiles []*Projectile
	Crates      []*Crate
	Zeppelins   []*Zeppelin
	FlakTowers  []*FlakTower
	Clouds      []Cloud
	Islands     []Island

	SpatialGrid *SpatialGrid
	KillFeed    []KillFeedItem
	Events      []GameEvent

	Mutex        sync.RWMutex
	NextCrateID  int
	NextProjID   int
	LastTickTime time.Time
	BotNames     []string
}

func NewGameRoom(width, height float64, maxBots int) *GameRoom {
	r := &GameRoom{
		WorldWidth:   width,
		WorldHeight:  height,
		MaxBots:      maxBots,
		Players:      make(map[string]*Player),
		Projectiles:  make([]*Projectile, 0, 512),
		Crates:       make([]*Crate, 0, 64),
		Zeppelins:    make([]*Zeppelin, 0, 4),
		FlakTowers:   make([]*FlakTower, 0, 8),
		Clouds:       make([]Cloud, 0, 32),
		Islands:      make([]Island, 0, 8),
		SpatialGrid:  NewSpatialGrid(width, height, 400),
		KillFeed:     make([]KillFeedItem, 0, 10),
		Events:       make([]GameEvent, 0, 64),
		NextCrateID:  1,
		NextProjID:   1,
		LastTickTime: time.Now(),
		BotNames: []string{
			"Red Baron", "Viper", "Ghost", "Maverick", "Iceman",
			"Eagle", "Falcon", "Thunder", "Shadow", "Reaper",
			"Blackbird", "Skywalker", "Corsair", "Havoc", "Warthog",
		},
	}
	r.initWorld()
	return r
}

func (r *GameRoom) initWorld() {
	// Clouds
	for i := 0; i < 22; i++ {
		r.Clouds = append(r.Clouds, Cloud{
			ID:        fmt.Sprintf("cloud_%d", i),
			X:         400 + rand.Float64()*(r.WorldWidth-800),
			Y:         400 + rand.Float64()*(r.WorldHeight-800),
			Radius:    120 + rand.Float64()*80,
			PuffCount: 5 + rand.Intn(4),
		})
	}

	// Islands & Flak Towers
	islandPositions := [][2]float64{
		{1200, 1200},
		{4800, 1200},
		{3000, 3000},
		{1200, 4800},
		{4800, 4800},
	}

	for idx, pos := range islandPositions {
		r.Islands = append(r.Islands, Island{
			ID:     fmt.Sprintf("island_%d", idx),
			X:      pos[0],
			Y:      pos[1],
			Radius: 140,
		})

		r.FlakTowers = append(r.FlakTowers, &FlakTower{
			ID:       fmt.Sprintf("flak_%d", idx),
			X:        pos[0],
			Y:        pos[1],
			Radius:   35,
			Angle:    0,
			HP:       700,
			MaxHP:    700,
			IsDead:   false,
			Cooldown: 0,
		})
	}

	// Zeppelins
	for i := 0; i < 2; i++ {
		r.spawnZeppelin(i + 1)
	}

	// Initial Crates
	for i := 0; i < 35; i++ {
		r.spawnCrate("", 0, 0, false)
	}
}

func (r *GameRoom) spawnZeppelin(level int) {
	z := &Zeppelin{
		ID:        fmt.Sprintf("zep_%d", rand.Intn(99999)),
		X:         800 + rand.Float64()*(r.WorldWidth-1600),
		Y:         800 + rand.Float64()*(r.WorldHeight-1600),
		Angle:     rand.Float64() * math.Pi * 2,
		HP:        1400 * float64(level),
		MaxHP:     1400 * float64(level),
		Radius:    75,
		IsDead:    false,
		Speed:     45,
		Waypoints: [][2]float64{},
		TargetWP:  0,
		Turrets: []ZeppelinTurret{
			{Angle: 0, Cooldown: 0},
			{Angle: math.Pi / 2, Cooldown: 0},
			{Angle: math.Pi, Cooldown: 0},
			{Angle: -math.Pi / 2, Cooldown: 0},
		},
	}

	// Generate 4 patrol waypoints
	for i := 0; i < 4; i++ {
		z.Waypoints = append(z.Waypoints, [2]float64{
			1000 + rand.Float64()*(r.WorldWidth-2000),
			1000 + rand.Float64()*(r.WorldHeight-2000),
		})
	}

	r.Zeppelins = append(r.Zeppelins, z)
}

func (r *GameRoom) spawnCrate(cType string, x, y float64, customPos bool) {
	types := []string{"repair", "ammo", "gold", "fuel"}
	weights := []float64{0.35, 0.25, 0.25, 0.15}

	chosenType := cType
	if chosenType == "" {
		rn := rand.Float64()
		var sum float64
		for i, t := range types {
			sum += weights[i]
			if rn <= sum {
				chosenType = t
				break
			}
		}
		if chosenType == "" {
			chosenType = "gold"
		}
	}

	cx := x
	cy := y
	if !customPos {
		cx = 200 + rand.Float64()*(r.WorldWidth-400)
		cy = 200 + rand.Float64()*(r.WorldHeight-400)
	}

	xp := 30
	if chosenType == "gold" {
		xp = 80
	}

	r.Crates = append(r.Crates, &Crate{
		ID:      fmt.Sprintf("crate_%d", r.NextCrateID),
		Type:    chosenType,
		X:       cx,
		Y:       cy,
		Radius:  18,
		XPValue: xp,
	})
	r.NextCrateID++
}

func (r *GameRoom) AddPlayer(id, name, planeClass string) *Player {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	cls, ok := PlaneClasses[planeClass]
	if !ok {
		cls = PlaneClasses["biplane_scout"]
		planeClass = "biplane_scout"
	}

	p := &Player{
		ID:                     id,
		Name:                   name,
		PlaneClassKey:          planeClass,
		PlaneClass:             cls,
		IsBot:                  false,
		Level:                  1,
		XP:                     0,
		XPForNextLevel:         GetXPForLevel(1),
		Score:                  0,
		Kills:                  0,
		AvailableUpgradePoints: 0,
		AvailableEvolutions:    []string{},
		Upgrades:               make(map[string]int),
		X:                      400 + rand.Float64()*(r.WorldWidth-800),
		Y:                      400 + rand.Float64()*(r.WorldHeight-800),
		Angle:                  rand.Float64() * math.Pi * 2,
		MaxHP:                  cls.Stats.MaxHP,
		HP:                     cls.Stats.MaxHP,
		BoostMax:               cls.Stats.BoostMax,
		Boost:                  cls.Stats.BoostMax,
		Radius:                 cls.Stats.Radius,
	}

	r.Players[id] = p
	return p
}

func (r *GameRoom) RemovePlayer(id string) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	delete(r.Players, id)
}

func (r *GameRoom) HandlePlayerInput(id string, input PlayerInput) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	if p, ok := r.Players[id]; ok && !p.IsDead {
		p.Input = input
	}
}

func (r *GameRoom) HandleUpgradeRequest(id, stat string) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	p, ok := r.Players[id]
	if !ok || p.IsDead || p.AvailableUpgradePoints <= 0 {
		return
	}

	current := p.Upgrades[stat]
	if current < 8 {
		p.Upgrades[stat] = current + 1
		p.AvailableUpgradePoints--
		p.recalculateStats()
	}
}

func (r *GameRoom) HandleEvolveRequest(id, classKey string) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	p, ok := r.Players[id]
	if !ok || p.IsDead {
		return
	}

	// Check if valid evolution
	isValid := false
	for _, evo := range p.PlaneClass.Evolutions {
		if evo == classKey {
			isValid = true
			break
		}
	}

	if isValid {
		if newCls, exists := PlaneClasses[classKey]; exists {
			p.PlaneClassKey = classKey
			p.PlaneClass = newCls
			p.AvailableEvolutions = []string{}
			p.recalculateStats()
			r.Events = append(r.Events, GameEvent{
				Type:     "evolve",
				PlayerID: p.ID,
				Effect:   classKey,
			})
		}
	}
}

func (p *Player) recalculateStats() {
	p.MaxHP = p.PlaneClass.Stats.MaxHP + float64(p.Upgrades["maxHp"])*UpgradeIncrements["maxHp"]
	p.BoostMax = p.PlaneClass.Stats.BoostMax + float64(p.Upgrades["boostMax"])*UpgradeIncrements["boostMax"]
	p.Radius = p.PlaneClass.Stats.Radius
	if p.HP > p.MaxHP {
		p.HP = p.MaxHP
	}
}

func (r *GameRoom) AddXP(p *Player, amount int) {
	p.XP += amount
	p.Score += amount

	for p.XP >= p.XPForNextLevel && p.Level < 45 {
		p.XP -= p.XPForNextLevel
		p.Level++
		p.XPForNextLevel = GetXPForLevel(p.Level)
		p.AvailableUpgradePoints++

		// Check tier evolutions
		if p.Level == 10 || p.Level == 20 {
			p.AvailableEvolutions = p.PlaneClass.Evolutions
		}

		r.Events = append(r.Events, GameEvent{
			Type:     "level_up",
			PlayerID: p.ID,
			Damage:   float64(p.Level),
		})
	}
}

// Tick executes simulation frame (~45 TPS)
func (r *GameRoom) Tick() {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	now := time.Now()
	dt := now.Sub(r.LastTickTime).Seconds()
	if dt > 0.1 {
		dt = 0.1
	}
	r.LastTickTime = now

	// 1. Maintain Bot Count
	r.maintainBots()

	// 2. Spatial Grid Broadphase Populate
	r.SpatialGrid.Clear()
	for _, p := range r.Players {
		if !p.IsDead {
			r.SpatialGrid.Insert(p)
		}
	}

	// 3. Update Players & Bots
	for _, p := range r.Players {
		if p.IsDead {
			continue
		}
		if p.IsBot {
			r.updateBotAI(p, dt)
		}
		r.updatePlayerPhysics(p, dt)
	}

	// 4. Update Projectiles
	r.updateProjectiles(dt)

	// 5. Update Zeppelins & Flak Towers
	r.updateZeppelins(dt)
	r.updateFlakTowers(dt)

	// 6. Crate pickups
	r.updateCratePickups()

	// 7. Respawn Crates
	for len(r.Crates) < 35 {
		r.spawnCrate("", 0, 0, false)
	}
}

func (r *GameRoom) maintainBots() {
	botCount := 0
	for _, p := range r.Players {
		if p.IsBot && !p.IsDead {
			botCount++
		}
	}

	for botCount < r.MaxBots {
		id := fmt.Sprintf("bot_%d", rand.Intn(90000)+10000)
		name := r.BotNames[rand.Intn(len(r.BotNames))]
		cls := "biplane_scout"
		if rand.Float64() > 0.5 {
			cls = "spitfire_ace"
		}

		bot := &Player{
			ID:                     id,
			Name:                   name,
			PlaneClassKey:          cls,
			PlaneClass:             PlaneClasses[cls],
			IsBot:                  true,
			Level:                  rand.Intn(15) + 1,
			Score:                  rand.Intn(500),
			Upgrades:               make(map[string]int),
			X:                      400 + rand.Float64()*(r.WorldWidth-800),
			Y:                      400 + rand.Float64()*(r.WorldHeight-800),
			Angle:                  rand.Float64() * math.Pi * 2,
			MaxHP:                  PlaneClasses[cls].Stats.MaxHP,
			HP:                     PlaneClasses[cls].Stats.MaxHP,
			BoostMax:               PlaneClasses[cls].Stats.BoostMax,
			Boost:                  PlaneClasses[cls].Stats.BoostMax,
			Radius:                 PlaneClasses[cls].Stats.Radius,
		}
		r.Players[id] = bot
		botCount++
	}
}

func (r *GameRoom) updateBotAI(b *Player, dt float64) {
	b.BotStateTimer -= dt
	if b.BotStateTimer <= 0 {
		b.BotStateTimer = 0.5 + rand.Float64()*1.0

		// Find nearest target
		nearby := r.SpatialGrid.GetNearby(b.X, b.Y, 1200)
		var closest *Player
		minDist := 1200.0
		for _, p := range nearby {
			if p.ID != b.ID && !p.IsDead {
				d := math.Hypot(p.X-b.X, p.Y-b.Y)
				if d < minDist {
					minDist = d
					closest = p
				}
			}
		}

		if closest != nil {
			b.BotTargetID = closest.ID
			b.Input.TargetAngle = math.Atan2(closest.Y-b.Y, closest.X-b.X)
			b.Input.Shooting = minDist < 700
			b.Input.Boosting = minDist > 400 && b.Boost > 30
		} else {
			// Wander
			b.Input.TargetAngle = b.Angle + (rand.Float64()-0.5)*0.8
			b.Input.Shooting = false
			b.Input.Boosting = false
		}
	}
}

func (r *GameRoom) updatePlayerPhysics(p *Player, dt float64) {
	stats := p.PlaneClass.Stats
	turnRate := stats.TurnRate + float64(p.Upgrades["turnRate"])*UpgradeIncrements["turnRate"]
	baseSpeed := stats.Speed + float64(p.Upgrades["speed"])*UpgradeIncrements["speed"]
	hpRegen := stats.HPRegen + float64(p.Upgrades["hpRegen"])*UpgradeIncrements["hpRegen"]

	// Turn Angle shortest path
	diff := p.Input.TargetAngle - p.Angle
	for diff < -math.Pi {
		diff += math.Pi * 2
	}
	for diff > math.Pi {
		diff -= math.Pi * 2
	}

	maxTurn := turnRate * dt
	if diff > maxTurn {
		diff = maxTurn
	} else if diff < -maxTurn {
		diff = -maxTurn
	}
	p.Angle += diff
	p.BankAngle = diff / (turnRate * dt + 0.001)

	// Boost handling
	speedMult := 1.0
	p.IsBoosting = false
	if p.Input.Boosting && p.Boost > 0 {
		p.IsBoosting = true
		speedMult = stats.BoostSpeedMultiplier
		p.Boost = math.Max(0, p.Boost-stats.BoostDrain*dt)
	} else {
		p.Boost = math.Min(p.BoostMax, p.Boost+stats.BoostRegen*dt)
	}

	// Speed & Velocity
	currentSpeed := baseSpeed * speedMult
	p.VX = math.Cos(p.Angle) * currentSpeed
	p.VY = math.Sin(p.Angle) * currentSpeed

	p.X += p.VX * dt
	p.Y += p.VY * dt

	// World boundary clamps
	if p.X < 50 {
		p.X = 50
	} else if p.X > r.WorldWidth-50 {
		p.X = r.WorldWidth - 50
	}
	if p.Y < 50 {
		p.Y = 50
	} else if p.Y > r.WorldHeight-50 {
		p.Y = r.WorldHeight - 50
	}

	// Passive HP Regen
	if p.HP < p.MaxHP {
		p.HP = math.Min(p.MaxHP, p.HP+hpRegen*dt)
	}

	// Cloud stealth check
	p.InCloud = false
	for _, c := range r.Clouds {
		if math.Hypot(c.X-p.X, c.Y-p.Y) < c.Radius {
			p.InCloud = true
			break
		}
	}

	// Weapons Fire
	p.ShootCooldown -= dt
	if p.Input.Shooting && p.ShootCooldown <= 0 && !p.IsOverheated {
		fireRate := stats.FireRate + float64(p.Upgrades["fireRate"])*UpgradeIncrements["fireRate"]
		p.ShootCooldown = 1.0 / fireRate
		dmg := stats.BulletDamage + float64(p.Upgrades["bulletDamage"])*UpgradeIncrements["bulletDamage"]
		bSpeed := stats.BulletSpeed + float64(p.Upgrades["bulletSpeed"])*UpgradeIncrements["bulletSpeed"]

		// Gun offsets
		offset := stats.GunOffset
		perpX := -math.Sin(p.Angle)
		perpY := math.Cos(p.Angle)

		for i := 0; i < stats.BulletCount; i++ {
			side := 1.0
			if i%2 == 0 {
				side = -1.0
			}
			spread := (rand.Float64() - 0.5) * stats.BulletSpread

			r.Projectiles = append(r.Projectiles, &Projectile{
				ID:          fmt.Sprintf("proj_%d", r.NextProjID),
				ShooterID:   p.ID,
				Type:        "bullet",
				X:           p.X + perpX*offset*side + math.Cos(p.Angle)*18,
				Y:           p.Y + perpY*offset*side + math.Sin(p.Angle)*18,
				Angle:       p.Angle + spread,
				Speed:       bSpeed,
				VX:          math.Cos(p.Angle+spread)*bSpeed + p.VX*0.25,
				VY:          math.Sin(p.Angle+spread)*bSpeed + p.VY*0.25,
				Damage:      dmg,
				Radius:      4,
				Range:       1200,
				MaxLifeTime: 1.8,
			})
			r.NextProjID++
		}

		p.Heat += 4.5
		if p.Heat >= 100 {
			p.IsOverheated = true
			p.Heat = 100
		}
	}

	// Heat cooldown
	if p.Heat > 0 {
		p.Heat = math.Max(0, p.Heat-28*dt)
		if p.Heat <= 20 {
			p.IsOverheated = false
		}
	}
}

func (r *GameRoom) updateProjectiles(dt float64) {
	for _, proj := range r.Projectiles {
		if proj.IsDead {
			continue
		}

		proj.LifeTime += dt
		dx := proj.VX * dt
		dy := proj.VY * dt
		proj.X += dx
		proj.Y += dy
		proj.DistanceTraveled += math.Hypot(dx, dy)

		if proj.LifeTime >= proj.MaxLifeTime || proj.DistanceTraveled >= proj.Range {
			proj.IsDead = true
		}

		// Collide with planes
		nearby := r.SpatialGrid.GetNearby(proj.X, proj.Y, 50)
		for _, target := range nearby {
			if target.ID == proj.ShooterID || target.IsDead || target.IsInvulnerable {
				continue
			}

			if math.Hypot(target.X-proj.X, target.Y-proj.Y) < target.Radius+proj.Radius {
				proj.IsDead = true
				target.HP -= proj.Damage

				r.Events = append(r.Events, GameEvent{
					Type:     "hit",
					X:        proj.X,
					Y:        proj.Y,
					Damage:   proj.Damage,
					TargetID: target.ID,
				})

				// Award XP to shooter
				if shooter, exists := r.Players[proj.ShooterID]; exists {
					r.AddXP(shooter, int(proj.Damage*1.5))
				}

				if target.HP <= 0 {
					target.HP = 0
					target.IsDead = true
					r.handleKill(proj.ShooterID, target)
				}
				break
			}
		}
	}

	// Filter dead
	alive := r.Projectiles[:0]
	for _, proj := range r.Projectiles {
		if !proj.IsDead {
			alive = append(alive, proj)
		}
	}
	r.Projectiles = alive
}

func (r *GameRoom) handleKill(killerID string, victim *Player) {
	killer, ok := r.Players[killerID]
	killerName := "Heavy Fire"
	killerClass := "bullet"
	if ok {
		killerName = killer.Name
		killerClass = killer.PlaneClassKey
		killer.Kills++
		r.AddXP(killer, 250+victim.Level*50)
	}

	r.KillFeed = append([]KillFeedItem{{
		Killer:      killerName,
		Victim:      victim.Name,
		KillerClass: killerClass,
		VictimClass: victim.PlaneClassKey,
		Time:        time.Now().UnixMilli(),
	}}, r.KillFeed...)

	if len(r.KillFeed) > 8 {
		r.KillFeed = r.KillFeed[:8]
	}

	// Drop crates at victim position
	for i := 0; i < 3; i++ {
		r.spawnCrate("gold", victim.X+(rand.Float64()-0.5)*60, victim.Y+(rand.Float64()-0.5)*60, true)
	}
	r.spawnCrate("repair", victim.X, victim.Y, true)

	r.Events = append(r.Events, GameEvent{
		Type:       "plane_crash",
		X:          victim.X,
		Y:          victim.Y,
		VictimID:   victim.ID,
		VictimName: victim.Name,
	})

	if victim.IsBot {
		delete(r.Players, victim.ID)
	}
}

func (r *GameRoom) updateZeppelins(dt float64) {
	for _, z := range r.Zeppelins {
		if z.IsDead || len(z.Waypoints) == 0 {
			continue
		}

		wp := z.Waypoints[z.TargetWP]
		dist := math.Hypot(wp[0]-z.X, wp[1]-z.Y)
		if dist < 150 {
			z.TargetWP = (z.TargetWP + 1) % len(z.Waypoints)
		} else {
			targetAngle := math.Atan2(wp[1]-z.Y, wp[0]-z.X)
			diff := targetAngle - z.Angle
			for diff < -math.Pi {
				diff += math.Pi * 2
			}
			for diff > math.Pi {
				diff -= math.Pi * 2
			}
			z.Angle += diff * dt * 0.4
			z.X += math.Cos(z.Angle) * z.Speed * dt
			z.Y += math.Sin(z.Angle) * z.Speed * dt
		}
	}
}

func (r *GameRoom) updateFlakTowers(dt float64) {
	for _, f := range r.FlakTowers {
		if f.IsDead {
			continue
		}
		f.Cooldown -= dt

		nearby := r.SpatialGrid.GetNearby(f.X, f.Y, 650)
		var target *Player
		minDist := 650.0
		for _, p := range nearby {
			if !p.IsDead && !p.InCloud {
				d := math.Hypot(p.X-f.X, p.Y-f.Y)
				if d < minDist {
					minDist = d
					target = p
				}
			}
		}

		if target != nil {
			f.Angle = math.Atan2(target.Y-f.Y, target.X-f.X)
			if f.Cooldown <= 0 {
				f.Cooldown = 1.4
				r.Projectiles = append(r.Projectiles, &Projectile{
					ID:           fmt.Sprintf("flak_%d", r.NextProjID),
					ShooterID:    f.ID,
					ShooterTeam:  "boss",
					Type:         "flak",
					X:            f.X,
					Y:            f.Y,
					Angle:        f.Angle,
					Speed:        550,
					VX:           math.Cos(f.Angle) * 550,
					VY:           math.Sin(f.Angle) * 550,
					Damage:       18,
					Radius:       6,
					Range:        minDist,
					MaxLifeTime:  2.0,
					SplashRadius: 80,
				})
				r.NextProjID++
			}
		}
	}
}

func (r *GameRoom) updateCratePickups() {
	for _, p := range r.Players {
		if p.IsDead {
			continue
		}

		for i := len(r.Crates) - 1; i >= 0; i-- {
			c := r.Crates[i]
			if math.Hypot(p.X-c.X, p.Y-c.Y) < p.Radius+c.Radius {
				// Pickup crate
				r.AddXP(p, c.XPValue)
				if c.Type == "repair" {
					p.HP = math.Min(p.MaxHP, p.HP+p.MaxHP*0.45)
				} else if c.Type == "ammo" {
					p.Boost = p.BoostMax
					p.Heat = 0
					p.IsOverheated = false
				} else if c.Type == "fuel" {
					p.Boost = p.BoostMax
				}

				r.Events = append(r.Events, GameEvent{
					Type:      "crate_pickup",
					X:         c.X,
					Y:         c.Y,
					CrateType: c.Type,
					PlayerID:  p.ID,
				})

				r.Crates = append(r.Crates[:i], r.Crates[i+1:]...)
			}
		}
	}
}

func (r *GameRoom) GetLeaderboard() []LeaderboardEntry {
	list := make([]*Player, 0, len(r.Players))
	for _, p := range r.Players {
		if !p.IsDead {
			list = append(list, p)
		}
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].Score > list[j].Score
	})

	if len(list) > 10 {
		list = list[:10]
	}

	res := make([]LeaderboardEntry, len(list))
	for i, p := range list {
		res[i] = LeaderboardEntry{
			Rank:   i + 1,
			ID:     p.ID,
			Name:   p.Name,
			Score:  p.Score,
			Kills:  p.Kills,
			Level:  p.Level,
			IsKing: i == 0,
		}
	}
	return res
}

func (r *GameRoom) GetClientState(playerID string) ClientState {
	r.Mutex.RLock()
	defer r.Mutex.RUnlock()

	self := r.Players[playerID]
	px := r.WorldWidth / 2
	py := r.WorldHeight / 2
	if self != nil {
		px = self.X
		py = self.Y
	}

	viewRadiusX := 1400.0
	viewRadiusY := 900.0

	visiblePlanes := make([]*Player, 0, 16)
	for _, p := range r.Players {
		if !p.IsDead && math.Abs(p.X-px) < viewRadiusX && math.Abs(p.Y-py) < viewRadiusY {
			visiblePlanes = append(visiblePlanes, p)
		}
	}

	visibleProjectiles := make([]*Projectile, 0, 64)
	for _, proj := range r.Projectiles {
		if math.Abs(proj.X-px) < viewRadiusX && math.Abs(proj.Y-py) < viewRadiusY {
			visibleProjectiles = append(visibleProjectiles, proj)
		}
	}

	visibleCrates := make([]*Crate, 0, 32)
	for _, c := range r.Crates {
		if math.Abs(c.X-px) < viewRadiusX && math.Abs(c.Y-py) < viewRadiusY {
			visibleCrates = append(visibleCrates, c)
		}
	}

	return ClientState{
		Self:        self,
		Planes:      visiblePlanes,
		Projectiles: visibleProjectiles,
		Crates:      visibleCrates,
		Zeppelins:   r.Zeppelins,
		FlakTowers:  r.FlakTowers,
		Leaderboard: r.GetLeaderboard(),
		KillFeed:    r.KillFeed,
		Events:      r.Events,
	}
}

func (r *GameRoom) FlushEvents() {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	r.Events = r.Events[:0]
}
