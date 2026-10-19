package middleware

import (
	"fmt"
	"sync"
	"time"
)

const (
	gatewayWindow   = 15 * time.Minute
	gatewayCooldown = 2 * time.Minute
	gatewayMaxKeys  = 2048
)

type gatewaySample struct {
	at      time.Time
	ok      bool
	latency int64
	ttft    int64
}

type gatewayHealth struct {
	samples   []gatewaySample
	coolUntil time.Time
	probing   bool
}

var gatewayHealthStore = struct {
	sync.Mutex
	channels map[int]*gatewayHealth
}{channels: make(map[int]*gatewayHealth)}

// RecordGatewayChannel records only real upstream outcomes, never local quota
// or validation failures. No sensitive request data is kept in memory.
func RecordGatewayChannel(id int, ok bool, latency, ttft int64) {
	if id <= 0 {
		return
	}
	now := time.Now()
	store := &gatewayHealthStore
	store.Lock()
	defer store.Unlock()
	h := store.channels[id]
	if h == nil {
		if len(store.channels) >= gatewayMaxKeys {
			for key, value := range store.channels {
				if len(value.samples) == 0 || now.Sub(value.samples[len(value.samples)-1].at) > gatewayWindow {
					delete(store.channels, key)
				}
			}
			if len(store.channels) >= gatewayMaxKeys {
				return
			}
		}
		h = &gatewayHealth{}
		store.channels[id] = h
	}
	h.samples = append(h.samples, gatewaySample{now, ok, latency, ttft})
	if len(h.samples) > 40 {
		h.samples = h.samples[len(h.samples)-40:]
	}
	h.probing = false
	if ok {
		h.coolUntil = time.Time{}
	} else if len(h.samples) >= 3 {
		last := h.samples[len(h.samples)-3:]
		if !last[0].ok && !last[1].ok && !last[2].ok && last[0].at.After(now.Add(-gatewayWindow)) {
			h.coolUntil = now.Add(gatewayCooldown)
		}
	}
}

// gatewayChannelScore returns a conservative score. A channel after cooldown
// gets one recovery probe; until that probe finishes other requests avoid it.
func gatewayChannelScore(id int, profile string) (float64, string, bool) {
	store := &gatewayHealthStore
	store.Lock()
	defer store.Unlock()
	h := store.channels[id]
	if h == nil {
		return 0, "insufficient_samples", false
	}
	now := time.Now()
	if now.Before(h.coolUntil) {
		return 0, fmt.Sprintf("cooldown_until_%d", h.coolUntil.Unix()), true
	}
	if !h.coolUntil.IsZero() {
		if h.probing {
			return 0, "recovery_probe_in_progress", true
		}
		return 100, "recovery_probe", false
	}
	var count, success int
	var latency, ttft int64
	for _, s := range h.samples {
		if s.at.Before(now.Add(-gatewayWindow)) {
			continue
		}
		count++
		if s.ok {
			success++
		}
		latency += s.latency
		if s.ttft > 0 {
			ttft += s.ttft
		} else {
			ttft += s.latency
		}
	}
	if count < 8 {
		return 0, "insufficient_samples", false
	}
	// Shrink small windows towards neutral and cap outliers so one fast call
	// cannot dominate. Reliability also penalizes slow routes.
	rate := float64(success+8) / float64(count+10)
	delay := float64(latency) / float64(count)
	if profile == "speed" {
		delay = float64(ttft) / float64(count)
	}
	if delay < 100 {
		delay = 100
	}
	if delay > 30000 {
		delay = 30000
	}
	return rate * 1000 / (500 + delay), fmt.Sprintf("observed_%s_n%d", profile, count), false
}

func ReserveGatewayProbe(id int) bool {
	gatewayHealthStore.Lock()
	defer gatewayHealthStore.Unlock()
	h := gatewayHealthStore.channels[id]
	if h == nil || h.coolUntil.IsZero() {
		return true
	}
	if h.probing || time.Now().Before(h.coolUntil) {
		return false
	}
	h.probing = true
	return true
}

func ReleaseGatewayProbe(id int) {
	gatewayHealthStore.Lock()
	if h := gatewayHealthStore.channels[id]; h != nil {
		h.probing = false
	}
	gatewayHealthStore.Unlock()
}
