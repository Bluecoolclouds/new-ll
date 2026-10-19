package model

import (
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func budgetTestDB(t *testing.T, token Token) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "budget.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	old := DB
	DB = db
	t.Cleanup(func() { DB = old })
	if err := db.AutoMigrate(&Token{}, &GatewayRequestLease{}); err != nil {
		t.Fatal(err)
	}
	token.Id, token.UserId, token.Key, token.GatewayEnabled = 1, 1, "budget-test", true
	if err := db.Create(&token).Error; err != nil {
		t.Fatal(err)
	}
	return db
}

func TestGatewayBudgetConcurrentReservationsAndRefund(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayDailyLimit: 30, GatewayMonthlyLimit: 40, GatewayConcurrencyLimit: 3})
	const n = 16
	results := make(chan *GatewayBudgetReservation, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r := &GatewayBudgetReservation{TokenID: 1}
			if r.Reserve(10) == nil {
				results <- r
			}
		}()
	}
	wg.Wait()
	close(results)
	var winners []*GatewayBudgetReservation
	for r := range results {
		winners = append(winners, r)
	}
	if len(winners) != 3 {
		t.Fatalf("expected three winners, got %d", len(winners))
	}
	var token Token
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayDailyUsed != 30 || token.GatewayMonthlyUsed != 30 || token.GatewayActiveRequests != 3 {
		t.Fatalf("unexpected reserved counters: %+v", token)
	}
	if err := winners[0].Finish(0); err != nil {
		t.Fatal(err)
	}
	if err := winners[0].Finish(0); err != nil {
		t.Fatal(err)
	}
	replacement := &GatewayBudgetReservation{TokenID: 1}
	if err := replacement.Reserve(10); err != nil {
		t.Fatalf("refunded reservation must be reusable: %v", err)
	}
	if err := replacement.Reserve(20); !errors.Is(err, ErrGatewayBudgetExceeded) {
		t.Fatalf("increase over daily cap must fail: %v", err)
	}
	if err := replacement.Finish(15); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayDailyUsed != 35 || token.GatewayMonthlyUsed != 35 || token.GatewayActiveRequests != 2 {
		t.Fatalf("unexpected settled counters: %+v", token)
	}
}

func TestGatewayBudgetDayAndMonthRollover(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayDailyLimit: 10, GatewayMonthlyLimit: 15})
	jan31 := time.Date(2026, 1, 31, 23, 59, 0, 0, time.UTC)
	feb1 := jan31.Add(2 * time.Minute)
	a := &GatewayBudgetReservation{TokenID: 1}
	if err := a.reserveAt(10, jan31); err != nil {
		t.Fatal(err)
	}
	b := &GatewayBudgetReservation{TokenID: 1}
	if err := b.reserveAt(10, feb1); err != nil {
		t.Fatal(err)
	}
	// Completing the previous period must not subtract from the new period.
	if err := a.Finish(0); err != nil {
		t.Fatal(err)
	}
	var token Token
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	// AfterFind presents current-date counters as zero; inspect persisted
	// counters directly because this test uses a synthetic historical date.
	var used struct {
		Day, Month             int64
		DailyUsed, MonthlyUsed int64
		Active                 int
	}
	if err := db.Raw("SELECT gateway_day AS day, gateway_month AS month, gateway_daily_used AS daily_used, gateway_monthly_used AS monthly_used, gateway_active_requests AS active FROM tokens WHERE id = 1").Scan(&used).Error; err != nil {
		t.Fatal(err)
	}
	if used.Day != gatewayDay(feb1) || used.Month != gatewayMonth(feb1) || used.DailyUsed != 10 || used.MonthlyUsed != 10 || used.Active != 1 {
		t.Fatalf("new period corrupted by late refund: %+v", used)
	}
	if err := b.reserveAt(15, feb1); !errors.Is(err, ErrGatewayBudgetExceeded) {
		t.Fatalf("daily cap must still apply after rollover: %v", err)
	}
}

func TestGatewayBudgetFallbackReusesOneReservation(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayDailyLimit: 30, GatewayMonthlyLimit: 30, GatewayConcurrencyLimit: 1})
	r := &GatewayBudgetReservation{TokenID: 1}
	for _, target := range []int64{10, 10, 20, 12} {
		if err := r.Reserve(target); err != nil {
			t.Fatal(err)
		}
	}
	if err := r.Finish(15); err != nil {
		t.Fatal(err)
	}
	var token Token
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayDailyUsed != 15 || token.GatewayMonthlyUsed != 15 || token.GatewayActiveRequests != 0 {
		t.Fatalf("fallback double-counted: %+v", token)
	}
}

func TestGatewayBudgetReclaimsCrashAndRejectsLateFinish(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayDailyLimit: 10, GatewayMonthlyLimit: 10, GatewayConcurrencyLimit: 1})
	now := time.Now().UTC()
	crashed := &GatewayBudgetReservation{TokenID: 1}
	if err := crashed.reserveAt(10, now.Add(-gatewayLeaseTTL-time.Second)); err != nil {
		t.Fatal(err)
	}
	// Simulate a process restart: no in-memory reservation survives, but its
	// persisted lease and counters do.
	recovered := &GatewayBudgetReservation{TokenID: 1}
	if err := recovered.reserveAt(10, now); err != nil {
		t.Fatalf("expired estimate and slot must be reusable: %v", err)
	}
	if err := crashed.Finish(0); err == nil {
		t.Fatal("a late finish must not release a replacement's slot")
	}
	var token Token
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayActiveRequests != 1 || token.GatewayDailyUsed != 10 || token.GatewayMonthlyUsed != 10 {
		t.Fatalf("recovery lost active reservation: %+v", token)
	}
	if err := recovered.Finish(5); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayActiveRequests != 0 || token.GatewayDailyUsed != 5 {
		t.Fatalf("recovered reservation did not settle: %+v", token)
	}
}

func TestGatewayBudgetConcurrentRecovery(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayConcurrencyLimit: 1})
	now := time.Now().UTC()
	stale := &GatewayBudgetReservation{TokenID: 1}
	if err := stale.reserveAt(1, now.Add(-gatewayLeaseTTL-time.Second)); err != nil {
		t.Fatal(err)
	}
	const n = 20
	results := make(chan *GatewayBudgetReservation, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r := &GatewayBudgetReservation{TokenID: 1}
			if r.reserveAt(1, now) == nil {
				results <- r
			}
		}()
	}
	wg.Wait()
	close(results)
	var winner *GatewayBudgetReservation
	for r := range results {
		if winner != nil {
			t.Fatal("concurrent recovery admitted multiple requests")
		}
		winner = r
	}
	if winner == nil {
		t.Fatal("no request recovered the slot")
	}
	var token Token
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayActiveRequests != 1 || token.GatewayDailyUsed != 1 {
		t.Fatalf("concurrent cleanup double-counted: %+v", token)
	}
	if err := winner.Finish(1); err != nil {
		t.Fatal(err)
	}
}

func TestGatewayBudgetExpiredPreviousPeriodDoesNotRefundCurrentPeriod(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayConcurrencyLimit: 1})
	jan31 := time.Date(2026, 1, 31, 23, 59, 0, 0, time.UTC)
	old := &GatewayBudgetReservation{TokenID: 1}
	if err := old.reserveAt(10, jan31); err != nil {
		t.Fatal(err)
	}
	feb1 := jan31.Add(gatewayLeaseTTL + time.Second)
	fresh := &GatewayBudgetReservation{TokenID: 1}
	if err := fresh.reserveAt(7, feb1); err != nil {
		t.Fatal(err)
	}
	var counters struct{ Daily, Monthly int64 }
	if err := db.Raw("SELECT gateway_daily_used AS daily, gateway_monthly_used AS monthly FROM tokens WHERE id = 1").Scan(&counters).Error; err != nil {
		t.Fatal(err)
	}
	if counters.Daily != 7 || counters.Monthly != 7 {
		t.Fatalf("expired old period affected new one: %+v", counters)
	}
}

func TestGatewayBudgetRepairsLegacyCounterOnFirstRequest(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayConcurrencyLimit: 1, GatewayActiveRequests: 1})
	r := &GatewayBudgetReservation{TokenID: 1}
	if err := r.Reserve(0); err != nil {
		t.Fatalf("counter left by a previous version must not block the key: %v", err)
	}
	var token Token
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayActiveRequests != 1 {
		t.Fatalf("active counter not reconciled: %d", token.GatewayActiveRequests)
	}
	if err := r.Finish(0); err != nil {
		t.Fatal(err)
	}
}

func TestGatewayBudgetUnexpiredLeaseSurvivesRecovery(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayConcurrencyLimit: 1})
	now := time.Now().UTC()
	first := &GatewayBudgetReservation{TokenID: 1}
	if err := first.reserveAt(0, now); err != nil {
		t.Fatal(err)
	}
	second := &GatewayBudgetReservation{TokenID: 1}
	if err := second.reserveAt(0, now.Add(gatewayLeaseTTL-time.Second)); !errors.Is(err, ErrGatewayBudgetExceeded) {
		t.Fatalf("restart must not release a live lease: %v", err)
	}
	if err := first.Finish(0); err != nil {
		t.Fatal(err)
	}
	var token Token
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayActiveRequests != 0 {
		t.Fatalf("rejected request left a slot occupied: %+v", token)
	}
}

func TestGatewayBudgetRenewalKeepsLongRequestActive(t *testing.T) {
	budgetTestDB(t, Token{GatewayConcurrencyLimit: 1})
	now := time.Now().UTC()
	r := &GatewayBudgetReservation{TokenID: 1}
	if err := r.reserveAt(0, now); err != nil {
		t.Fatal(err)
	}
	renewed, err := renewGatewayLease(1, r.leaseID, now.Add(gatewayLeaseTTL-time.Second))
	if err != nil || !renewed {
		t.Fatalf("renewal failed: renewed=%v err=%v", renewed, err)
	}
	other := &GatewayBudgetReservation{TokenID: 1}
	if err := other.reserveAt(0, now.Add(gatewayLeaseTTL+time.Second)); !errors.Is(err, ErrGatewayBudgetExceeded) {
		t.Fatalf("renewed request must still hold its slot: %v", err)
	}
	if err := r.Finish(0); err != nil {
		t.Fatal(err)
	}
	renewed, err = renewGatewayLease(1, r.leaseID, now.Add(2*gatewayLeaseTTL))
	if err != nil || renewed {
		t.Fatalf("finished request must not be revived: renewed=%v err=%v", renewed, err)
	}
}

func TestGatewayBudgetFailedFinishStopsRenewalAndRecovers(t *testing.T) {
	db := budgetTestDB(t, Token{GatewayConcurrencyLimit: 1})
	r := &GatewayBudgetReservation{TokenID: 1}
	if err := r.Reserve(1); err != nil {
		t.Fatal(err)
	}
	stop := r.stop

	// Simulate a temporary database outage at settlement, then restore the
	// original database. The request is over, so its heartbeat must be stopped.
	unavailable, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "unavailable.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := unavailable.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatal(err)
	}
	DB = unavailable
	finishErr := r.Finish(1)
	DB = db
	if finishErr == nil {
		t.Fatal("expected settlement to fail while database is unavailable")
	}
	select {
	case <-stop:
	default:
		t.Fatal("failed settlement left the renewal goroutine running")
	}

	recovered := &GatewayBudgetReservation{TokenID: 1}
	if err := recovered.reserveAt(1, time.Now().Add(gatewayLeaseTTL+time.Second)); err != nil {
		t.Fatalf("abandoned lease must expire after settlement failure: %v", err)
	}
	var token Token
	if err := db.First(&token, 1).Error; err != nil {
		t.Fatal(err)
	}
	if token.GatewayActiveRequests != 1 || token.GatewayDailyUsed != 1 {
		t.Fatalf("failed settlement left an extra reservation: %+v", token)
	}
}
