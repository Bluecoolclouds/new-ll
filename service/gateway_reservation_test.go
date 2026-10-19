package service

import (
	"errors"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type gatewayBillingStub struct {
	reservations []int
	err          error
}

func (s *gatewayBillingStub) Settle(int) error         { return nil }
func (s *gatewayBillingStub) Refund(*gin.Context)      {}
func (s *gatewayBillingStub) NeedsRefund() bool        { return false }
func (s *gatewayBillingStub) GetPreConsumedQuota() int { return 10 }
func (s *gatewayBillingStub) Reserve(target int) error {
	s.reservations = append(s.reservations, target)
	return s.err
}

func TestGatewayReserveRequiresExistingSession(t *testing.T) {
	info := &relaycommon.RelayInfo{}
	if err := ReserveGatewayQuota(info, 50); err == nil {
		t.Fatal("missing billing session must fail rather than silently skip charge")
	}
}

func TestGatewayReserveReusesSessionAndRejectsQuotaFailure(t *testing.T) {
	billing := &gatewayBillingStub{}
	info := &relaycommon.RelayInfo{Billing: billing}
	if err := ReserveGatewayQuota(info, 50); err != nil {
		t.Fatal(err)
	}
	if len(billing.reservations) != 1 || billing.reservations[0] != 50 {
		t.Fatalf("incorrect reservation: %v", billing.reservations)
	}
	billing.err = errors.New("insufficient quota")
	if err := ReserveGatewayQuota(info, 100); err == nil || err.StatusCode != 403 {
		t.Fatalf("quota refusal must prevent fallback: %v", err)
	}
}

func TestGatewayBatchReservationsFailExplicitly(t *testing.T) {
	old := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = true
	t.Cleanup(func() { common.BatchUpdateEnabled = old })
	billing := &gatewayBillingStub{}
	info := &relaycommon.RelayInfo{Billing: billing}
	if err := ReserveGatewayQuota(info, 50); err == nil || err.StatusCode != 503 {
		t.Fatalf("batch reservation must fail as unavailable, not insufficient quota: %v", err)
	}
	if len(billing.reservations) != 0 {
		t.Fatal("unsafe reservation was dispatched")
	}
	if err := ReserveGatewayQuota(info, 5); err != nil {
		t.Fatalf("no additional reservation should be required: %v", err)
	}
}

type gatewayFundingStub struct {
	settles atomic.Int32
	refunds atomic.Int32
	delta   atomic.Int64
	done    chan struct{}
}

func (s *gatewayFundingStub) Source() string       { return BillingSourceWallet }
func (s *gatewayFundingStub) PreConsume(int) error { return nil }
func (s *gatewayFundingStub) Settle(delta int) error {
	s.settles.Add(1)
	s.delta.Add(int64(delta))
	return nil
}
func (s *gatewayFundingStub) Refund() error {
	if s.refunds.Add(1) == 1 {
		close(s.done)
	}
	return nil
}

func TestGatewayBillingSettlesOnceAndDoesNotRefundSuccess(t *testing.T) {
	funding := &gatewayFundingStub{done: make(chan struct{})}
	info := &relaycommon.RelayInfo{IsPlayground: true}
	session := &BillingSession{relayInfo: info, funding: funding, preConsumedQuota: 20, tokenConsumed: 20}
	if err := session.Settle(35); err != nil {
		t.Fatal(err)
	}
	if err := session.Settle(35); err != nil {
		t.Fatal(err)
	}
	session.Refund(nil)
	if funding.settles.Load() != 1 || funding.refunds.Load() != 0 {
		t.Fatalf("settles=%d refunds=%d", funding.settles.Load(), funding.refunds.Load())
	}
}

func TestInterruptedResponsesSpendReturnsOnlyUnusedReservation(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{IsPlayground: true}
	funding := &gatewayFundingStub{done: make(chan struct{})}
	session := &BillingSession{relayInfo: info, funding: funding, preConsumedQuota: 200, tokenConsumed: 200}
	// A created-only stream owes the estimated prompt, even without output.
	info.OriginModelName = "gpt-test"
	info.StartTime = time.Now()
	info.PriceData.ModelRatio = 1
	info.PriceData.GroupRatioInfo.GroupRatio = 1
	info.PriceData.CompletionRatio = 1
	summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{PromptTokens: 12, TotalTokens: 12})
	if summary.Quota != 12 {
		t.Fatalf("unexpected actual charge %d", summary.Quota)
	}
	if err := session.Settle(summary.Quota); err != nil {
		t.Fatal(err)
	}
	if err := session.Settle(summary.Quota); err != nil {
		t.Fatal(err)
	}
	session.Refund(ctx) // Repeated fallback cleanup must not refund a settled attempt.
	if funding.settles.Load() != 1 || funding.delta.Load() != -188 || funding.refunds.Load() != 0 {
		t.Fatalf("settles=%d delta=%d refunds=%d", funding.settles.Load(), funding.delta.Load(), funding.refunds.Load())
	}
}

func TestGatewayBillingRefundsFailedAttemptOnce(t *testing.T) {
	funding := &gatewayFundingStub{done: make(chan struct{})}
	info := &relaycommon.RelayInfo{IsPlayground: true}
	session := &BillingSession{relayInfo: info, funding: funding, preConsumedQuota: 20, tokenConsumed: 20}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	session.Refund(c)
	session.Refund(c)
	select {
	case <-funding.done:
	case <-time.After(time.Second):
		t.Fatal("refund was not issued")
	}
	if funding.refunds.Load() != 1 || funding.settles.Load() != 0 {
		t.Fatalf("settles=%d refunds=%d", funding.settles.Load(), funding.refunds.Load())
	}
}

func TestConcurrentGatewayReservationsDoNotOverdraw(t *testing.T) {
	for _, tc := range []struct {
		name                               string
		wallet                             bool
		userQuota, tokenQuota, wantSuccess int
	}{
		{"wallet exhausted first", true, 20, 100, 2},
		{"token exhausted first", true, 100, 13, 1},
		{"subscription token limit", false, 100, 13, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "gateway.db")), &gorm.Config{})
			if err != nil {
				t.Fatal(err)
			}
			sqlDB, err := db.DB()
			if err != nil {
				t.Fatal(err)
			}
			// SQLite serializes writers; the condition is still checked inside
			// each transaction, after preceding requests have committed.
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() { _ = sqlDB.Close() })
			oldDB, oldRedis, oldBatch := model.DB, common.RedisEnabled, common.BatchUpdateEnabled
			model.DB, common.RedisEnabled, common.BatchUpdateEnabled = db, false, false
			t.Cleanup(func() {
				model.DB, common.RedisEnabled, common.BatchUpdateEnabled = oldDB, oldRedis, oldBatch
			})
			if err := db.AutoMigrate(&model.User{}, &model.Token{}); err != nil {
				t.Fatal(err)
			}
			if err := db.Create(&model.User{Id: 1, Quota: tc.userQuota}).Error; err != nil {
				t.Fatal(err)
			}
			if err := db.Create(&model.Token{Id: 1, UserId: 1, Key: "gateway-test", RemainQuota: tc.tokenQuota}).Error; err != nil {
				t.Fatal(err)
			}
			const requests, delta = 12, 7
			results := make(chan error, requests)
			for range requests {
				go func() { results <- model.ReserveGatewayQuota(1, 1, "gateway-test", delta, tc.wallet, false) }()
			}
			success := 0
			for range requests {
				if <-results == nil {
					success++
				}
			}
			var user model.User
			var token model.Token
			if err := db.First(&user, 1).Error; err != nil {
				t.Fatal(err)
			}
			if err := db.First(&token, 1).Error; err != nil {
				t.Fatal(err)
			}
			wantWallet := tc.userQuota
			if tc.wallet {
				wantWallet -= success * delta
			}
			if success != tc.wantSuccess || user.Quota != wantWallet ||
				token.RemainQuota != tc.tokenQuota-success*delta || user.Quota < 0 || token.RemainQuota < 0 {
				t.Fatalf("success=%d wallet=%d token=%d", success, user.Quota, token.RemainQuota)
			}
		})
	}
}
