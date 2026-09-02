package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"iogame-go/game"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	ID     string
	Conn   *websocket.Conn
	SendCh chan []byte
}

type Hub struct {
	clients map[*websocket.Conn]*Client
	mutex   sync.RWMutex
}

var hub = &Hub{
	clients: make(map[*websocket.Conn]*Client),
}

func main() {
	port := "3000"
	room := game.NewGameRoom(6000, 6000, 14)

	// API endpoint for planes
	http.HandleFunc("/api/planes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(game.PlaneClasses)
	})

	// WebSocket handler
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(room, w, r)
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") == "websocket" {
			handleWebSocket(room, w, r)
			return
		}
		// Serve static frontend assets
		http.FileServer(http.Dir(filepath.Join("..", "public"))).ServeHTTP(w, r)
	})

	// Game Simulation Ticker (~45 TPS)
	go func() {
		ticker := time.NewTicker(time.Second / 45)
		defer ticker.Stop()
		for range ticker.C {
			room.Tick()
		}
	}()

	// Broadcast Ticker (~30 TPS)
	go func() {
		ticker := time.NewTicker(time.Second / 30)
		defer ticker.Stop()
		for range ticker.C {
			hub.mutex.RLock()
			for _, client := range hub.clients {
				state := room.GetClientState(client.ID)
				msg := map[string]interface{}{
					"type": "state",
					"data": state,
				}
				data, err := json.Marshal(msg)
				if err == nil {
					select {
					case client.SendCh <- data:
					default:
					}
				}
			}
			hub.mutex.RUnlock()
			room.FlushEvents()
		}
	}()

	fmt.Println("=========================================")
	fmt.Printf(" Wings of War .io (Go Server) running!\n")
	fmt.Printf(" Local URL: http://localhost:%s\n", port)
	fmt.Println("=========================================")

	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func handleWebSocket(room *game.GameRoom, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return
	}

	clientID := fmt.Sprintf("pilot_%x", time.Now().UnixNano()%0xFFFFFF)
	client := &Client{
		ID:     clientID,
		Conn:   conn,
		SendCh: make(chan []byte, 64),
	}

	hub.mutex.Lock()
	hub.clients[conn] = client
	hub.mutex.Unlock()

	// Write pump
	go func() {
		defer conn.Close()
		for msg := range client.SendCh {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				break
			}
		}
	}()

	// Read pump
	defer func() {
		room.RemovePlayer(clientID)
		hub.mutex.Lock()
		delete(hub.clients, conn)
		hub.mutex.Unlock()
		close(client.SendCh)
		conn.Close()
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var raw map[string]interface{}
		if err := json.Unmarshal(message, &raw); err != nil {
			continue
		}

		msgType, _ := raw["type"].(string)
		switch msgType {
		case "join":
			name, _ := raw["name"].(string)
			if name == "" {
				name = "Ace Pilot"
			}
			planeClass, _ := raw["planeClass"].(string)
			if planeClass == "" {
				planeClass = "biplane_scout"
			}
			room.AddPlayer(clientID, name, planeClass)

			initMsg := map[string]interface{}{
				"type": "init",
				"id":   clientID,
				"world": map[string]float64{
					"width":  room.WorldWidth,
					"height": room.WorldHeight,
				},
				"clouds":      room.Clouds,
				"islands":     room.Islands,
				"planeConfig": game.PlaneClasses,
			}
			initBytes, _ := json.Marshal(initMsg)
			client.SendCh <- initBytes

		case "input":
			if data, ok := raw["data"].(map[string]interface{}); ok {
				targetAngle, _ := data["targetAngle"].(float64)
				shooting, _ := data["shooting"].(bool)
				boosting, _ := data["boosting"].(bool)
				braking, _ := data["braking"].(bool)
				special, _ := data["special"].(bool)

				room.HandlePlayerInput(clientID, game.PlayerInput{
					TargetAngle: targetAngle,
					Shooting:    shooting,
					Boosting:    boosting,
					Braking:     braking,
					Special:     special,
				})
			}

		case "upgrade":
			if stat, ok := raw["stat"].(string); ok {
				room.HandleUpgradeRequest(clientID, stat)
			}

		case "evolve":
			if classKey, ok := raw["classKey"].(string); ok {
				room.HandleEvolveRequest(clientID, classKey)
			}

		case "respawn":
			planeClass, _ := raw["planeClass"].(string)
			if planeClass == "" {
				planeClass = "biplane_scout"
			}
			room.AddPlayer(clientID, "Ace Pilot", planeClass)

		case "ping":
			tVal := raw["time"]
			pongMsg := map[string]interface{}{
				"type": "pong",
				"time": tVal,
			}
			pongBytes, _ := json.Marshal(pongMsg)
			client.SendCh <- pongBytes
		}
	}
}
