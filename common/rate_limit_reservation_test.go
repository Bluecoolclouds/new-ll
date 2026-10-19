package common

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestRateLimitReservationConcurrentAdmissionAndCompletion(t *testing.T) {
	var limiter InMemoryRateLimiter
	limiter.Init(time.Minute)
	var admitted atomic.Int32
	const workers = 40
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			if limiter.Reserve("same-user", 1, 60) != nil {
				admitted.Add(1)
			}
		}()
	}
	close(start)
	wg.Wait()
	if admitted.Load() != 1 {
		t.Fatalf("admitted %d concurrent requests, want 1", admitted.Load())
	}
	// A separate reservation verifies that failure frees a slot and the
	// first settlement wins if Complete is called more than once.
	r := limiter.Reserve("another-user", 1, 60)
	if r == nil {
		t.Fatal("could not reserve")
	}
	r.Complete(false)
	r.Complete(true)
	r = limiter.Reserve("another-user", 1, 60)
	if r == nil {
		t.Fatal("failed attempt consumed success quota")
	}
	r.Complete(true)
	if limiter.Reserve("another-user", 1, 60) != nil {
		t.Fatal("success did not consume quota")
	}
}

func TestRateLimitReservationSurvivesIdleCleanup(t *testing.T) {
	var limiter InMemoryRateLimiter
	limiter.Init(0)
	r := limiter.Reserve("running", 1, 60)
	limiter.mutex.Lock()
	// Simulate an idle-key eviction to ensure settlement recreates its bucket.
	delete(limiter.store, "running")
	limiter.mutex.Unlock()
	if limiter.Reserve("running", 1, 60) != nil {
		t.Fatal("lost an in-flight reservation after eviction")
	}
	r.Complete(true)
	if limiter.Reserve("running", 1, 60) != nil {
		t.Fatal("successful settlement not counted after eviction")
	}
}
