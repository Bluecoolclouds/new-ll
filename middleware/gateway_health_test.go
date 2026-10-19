package middleware

import (
	"strings"
	"testing"
	"time"
)

func TestGatewayHealthCooldownAndRecoveryProbe(t *testing.T) {
	id := 987654321
	defer func() {
		gatewayHealthStore.Lock()
		delete(gatewayHealthStore.channels, id)
		gatewayHealthStore.Unlock()
	}()
	for i := 0; i < 3; i++ {
		RecordGatewayChannel(id, false, 400, 0)
	}
	_, reason, blocked := gatewayChannelScore(id, "reliable")
	if !blocked || !strings.HasPrefix(reason, "cooldown_until_") {
		t.Fatalf("expected cooldown, got %s blocked=%v", reason, blocked)
	}
	gatewayHealthStore.Lock()
	gatewayHealthStore.channels[id].coolUntil = time.Now().Add(-time.Second)
	gatewayHealthStore.Unlock()
	if _, reason, blocked := gatewayChannelScore(id, "reliable"); blocked || reason != "recovery_probe" {
		t.Fatalf("expected recovery probe, got %s blocked=%v", reason, blocked)
	}
	if !ReserveGatewayProbe(id) || ReserveGatewayProbe(id) {
		t.Fatal("recovery probe must be single-flight")
	}
	RecordGatewayChannel(id, true, 100, 40)
	if _, _, blocked := gatewayChannelScore(id, "reliable"); blocked {
		t.Fatal("successful recovery should reopen channel")
	}
}

func TestGatewayHealthNeedsEnoughObservations(t *testing.T) {
	id := 987654322
	defer func() {
		gatewayHealthStore.Lock()
		delete(gatewayHealthStore.channels, id)
		gatewayHealthStore.Unlock()
	}()
	for i := 0; i < 7; i++ {
		RecordGatewayChannel(id, true, 250, 100)
	}
	if score, reason, blocked := gatewayChannelScore(id, "speed"); blocked || score != 0 || reason != "insufficient_samples" {
		t.Fatalf("small sample should not steer routing: %v %s %v", score, reason, blocked)
	}
	RecordGatewayChannel(id, true, 250, 100)
	if score, _, blocked := gatewayChannelScore(id, "speed"); blocked || score <= 0 {
		t.Fatalf("sampled healthy route should have score: %v %v", score, blocked)
	}
}
