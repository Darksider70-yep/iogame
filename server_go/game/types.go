package game

import "math"

type PlaneStats struct {
	MaxHP                float64 `json:"maxHp"`
	HPRegen              float64 `json:"hpRegen"`
	Speed                float64 `json:"speed"`
	TurnRate             float64 `json:"turnRate"`
	BulletDamage         float64 `json:"bulletDamage"`
	BulletSpeed          float64 `json:"bulletSpeed"`
	FireRate             float64 `json:"fireRate"`
	BulletSpread         float64 `json:"bulletSpread"`
	BulletCount          int     `json:"bulletCount"`
	GunOffset            float64 `json:"gunOffset"`
	HasHeavyCenter       bool    `json:"hasHeavyCenter,omitempty"`
	HasRearTurret        bool    `json:"hasRearTurret,omitempty"`
	RearTurretDamage     float64 `json:"rearTurretDamage,omitempty"`
	RearTurretRange      float64 `json:"rearTurretRange,omitempty"`
	RearTurretFireRate   float64 `json:"rearTurretFireRate,omitempty"`
	BoostMax             float64 `json:"boostMax"`
	BoostDrain           float64 `json:"boostDrain"`
	BoostRegen           float64 `json:"boostRegen"`
	BoostSpeedMultiplier float64 `json:"boostSpeedMultiplier"`
	Radius               float64 `json:"radius"`
	IsJet                bool    `json:"isJet,omitempty"`
}

type SpecialConfig struct {
	Type        string  `json:"type"`
	Name        string  `json:"name"`
	Cooldown    float64 `json:"cooldown"`
	Description string  `json:"description"`
}

type PlaneClass struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Nickname    string        `json:"nickname"`
	Tier        int           `json:"tier"`
	MinLevel    int           `json:"minLevel"`
	Description string        `json:"description"`
	Evolutions  []string      `json:"evolutions"`
	Stats       PlaneStats    `json:"stats"`
	Special     SpecialConfig `json:"special"`
}

type PlayerInput struct {
	TargetAngle float64 `json:"targetAngle"`
	Shooting    bool    `json:"shooting"`
	Boosting    bool    `json:"boosting"`
	Braking     bool    `json:"braking"`
	Special     bool    `json:"special"`
}

type Player struct {
	ID                     string             `json:"id"`
	Name                   string             `json:"n"`
	PlaneClassKey          string             `json:"cls"`
	PlaneClass             PlaneClass         `json:"-"`
	IsBot                  bool               `json:"bot"`
	Level                  int                `json:"lvl"`
	XP                     int                `json:"xp"`
	XPForNextLevel         int                `json:"nxp"`
	Score                  int                `json:"sc"`
	Kills                  int                `json:"k"`
	Deaths                 int                `json:"-"`
	AvailableUpgradePoints int                `json:"pts"`
	AvailableEvolutions    []string           `json:"evos"`
	Upgrades               map[string]int     `json:"upg"`
	X                      float64            `json:"x"`
	Y                      float64            `json:"y"`
	VX                     float64            `json:"vx"`
	VY                     float64            `json:"vy"`
	Angle                  float64            `json:"a"`
	BankAngle              float64            `json:"bk"`
	HP                     float64            `json:"hp"`
	MaxHP                  float64            `json:"mhp"`
	IsDead                 bool               `json:"-"`
	InCloud                bool               `json:"cld"`
	Boost                  float64            `json:"bstVal"`
	BoostMax               float64            `json:"bstMax"`
	IsBoosting             bool               `json:"bst"`
	IsBraking              bool               `json:"-"`
	Heat                   float64            `json:"heat"`
	IsOverheated           bool               `json:"ovh"`
	ShootCooldown          float64            `json:"-"`
	RearTurretCooldown     float64            `json:"-"`
	SpecialCooldown        float64            `json:"spCd"`
	SpecialActiveTimer     float64            `json:"-"`
	IsInvulnerable         bool               `json:"inv"`
	Input                  PlayerInput        `json:"-"`
	Radius                 float64            `json:"r"`
	BotTargetID            string             `json:"-"`
	BotStateTimer          float64            `json:"-"`
}

func GetXPForLevel(level int) int {
	return int(math.Floor(40.0 * math.Pow(float64(level), 1.35)))
}

type Projectile struct {
	ID               string  `json:"id"`
	ShooterID        string  `json:"s"`
	ShooterTeam      string  `json:"-"`
	Type             string  `json:"t"`
	X                float64 `json:"x"`
	Y                float64 `json:"y"`
	Angle            float64 `json:"a"`
	Speed            float64 `json:"-"`
	VX               float64 `json:"-"`
	VY               float64 `json:"-"`
	Damage           float64 `json:"-"`
	Radius           float64 `json:"r"`
	Range            float64 `json:"-"`
	DistanceTraveled float64 `json:"-"`
	MaxLifeTime      float64 `json:"-"`
	LifeTime         float64 `json:"-"`
	IsDead           bool    `json:"-"`
	SplashRadius     float64 `json:"-"`
	TargetDist       float64 `json:"-"`
}

type Crate struct {
	ID      string  `json:"id"`
	Type    string  `json:"type"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	Radius  float64 `json:"radius"`
	XPValue int     `json:"xpValue"`
}

type ZeppelinTurret struct {
	Angle    float64 `json:"angle"`
	Cooldown float64 `json:"-"`
}

type Zeppelin struct {
	ID        string           `json:"id"`
	X         float64          `json:"x"`
	Y         float64          `json:"y"`
	Angle     float64          `json:"a"`
	HP        float64          `json:"hp"`
	MaxHP     float64          `json:"maxHp"`
	Radius    float64          `json:"r"`
	Turrets   []ZeppelinTurret `json:"turrets"`
	IsDead    bool             `json:"-"`
	Speed     float64          `json:"-"`
	Waypoints [][2]float64     `json:"-"`
	TargetWP  int              `json:"-"`
}

type FlakTower struct {
	ID       string  `json:"id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Radius   float64 `json:"-"`
	Angle    float64 `json:"a"`
	HP       float64 `json:"hp"`
	MaxHP    float64 `json:"maxHp"`
	IsDead   bool    `json:"dead"`
	Cooldown float64 `json:"-"`
}

type Cloud struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Radius    float64 `json:"radius"`
	PuffCount int     `json:"puffCount"`
}

type Island struct {
	ID     string  `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Radius float64 `json:"radius"`
}

type LeaderboardEntry struct {
	Rank   int    `json:"rank"`
	ID     string `json:"id"`
	Name   string `json:"name"`
	Score  int    `json:"score"`
	Kills  int    `json:"kills"`
	Level  int    `json:"level"`
	IsKing bool   `json:"isKing"`
}

type KillFeedItem struct {
	Killer      string `json:"killer"`
	Victim      string `json:"victim"`
	KillerClass string `json:"killerClass"`
	VictimClass string `json:"victimClass"`
	Time        int64  `json:"time"`
}

type GameEvent struct {
	Type       string  `json:"type"`
	X          float64 `json:"x,omitempty"`
	Y          float64 `json:"y,omitempty"`
	Radius     float64 `json:"radius,omitempty"`
	Damage     float64 `json:"damage,omitempty"`
	TargetID   string  `json:"targetId,omitempty"`
	PlayerID   string  `json:"playerId,omitempty"`
	VictimID   string  `json:"victimId,omitempty"`
	VictimName string  `json:"victimName,omitempty"`
	ProjType   string  `json:"projType,omitempty"`
	CrateType  string  `json:"crateType,omitempty"`
	Effect     string  `json:"effect,omitempty"`
	Medal      string  `json:"medal,omitempty"`
}

type ClientState struct {
	Self        *Player            `json:"self"`
	Planes      []*Player          `json:"planes"`
	Projectiles []*Projectile      `json:"projectiles"`
	Crates      []*Crate           `json:"crates"`
	Zeppelins   []*Zeppelin        `json:"zeppelins"`
	FlakTowers  []*FlakTower       `json:"flakTowers"`
	Leaderboard []LeaderboardEntry `json:"leaderboard"`
	KillFeed    []KillFeedItem     `json:"killFeed"`
	Events      []GameEvent        `json:"events"`
}
