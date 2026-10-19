package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func gatewayDay(t time.Time) int64 { return t.UTC().Unix() / 86400 }
func gatewayMonth(t time.Time) int64 {
	t = t.UTC()
	return int64(t.Year()*12 + int(t.Month()))
}

const (
	gatewayLeaseTTL     = 5 * time.Minute
	gatewayLeaseRefresh = time.Minute
)

// GatewayRequestLease is persisted so a process crash cannot hold a slot forever.
// A request renews its lease while running. All changes to a token's leases are
// serialized by a write lock on the token row.
type GatewayRequestLease struct {
	ID        string `gorm:"primaryKey;type:varchar(36)"`
	TokenID   int    `gorm:"index:idx_gateway_lease_token_expiry,priority:1"`
	ExpiresAt int64  `gorm:"index:idx_gateway_lease_token_expiry,priority:2"`
	Day       int64
	Month     int64
	Amount    int64
}

// GatewayBudgetReservation belongs to one request, including all its fallback attempts.
// Amounts are quota units (the same currency-backed units used by wallet billing).
type GatewayBudgetReservation struct {
	TokenID    int
	Day, Month int64
	Amount     int64
	Active     bool
	leaseID    string
	stop       chan struct{}
}

var ErrGatewayBudgetExceeded = errors.New("AI Gateway budget or parallel request limit reached")

func lockGatewayToken(tx *gorm.DB, tokenID int) error {
	// A real write is required: MySQL reports zero affected rows for a no-op
	// UPDATE, even though it acquired the lock.
	result := tx.Exec("UPDATE tokens SET gateway_active_requests = gateway_active_requests + 1 WHERE id = ?", tokenID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return fmt.Errorf("gateway budget token not found")
	}
	return nil
}

// cleanupGatewayLeases runs only while the token row is locked. Expired
// estimates are refunded only if their original accounting period is current.
func cleanupGatewayLeases(tx *gorm.DB, tokenID int, now time.Time) error {
	var expired []GatewayRequestLease
	if err := tx.Where("token_id = ? AND expires_at <= ?", tokenID, now.UnixNano()).Find(&expired).Error; err != nil {
		return err
	}
	for _, lease := range expired {
		if err := tx.Exec(`UPDATE tokens SET
			gateway_daily_used = CASE WHEN gateway_day = ? THEN gateway_daily_used - ? ELSE gateway_daily_used END,
			gateway_monthly_used = CASE WHEN gateway_month = ? THEN gateway_monthly_used - ? ELSE gateway_monthly_used END
			WHERE id = ?`, lease.Day, lease.Amount, lease.Month, lease.Amount, tokenID).Error; err != nil {
			return err
		}
	}
	if len(expired) > 0 {
		if err := tx.Where("token_id = ? AND expires_at <= ?", tokenID, now.UnixNano()).Delete(&GatewayRequestLease{}).Error; err != nil {
			return err
		}
	}
	return nil
}

func gatewayLeaseCount(tx *gorm.DB, tokenID int) (int64, error) {
	var count int64
	err := tx.Model(&GatewayRequestLease{}).Where("token_id = ?", tokenID).Count(&count).Error
	return count, err
}

func (r *GatewayBudgetReservation) Reserve(target int64) error {
	if err := r.reserveAt(target, time.Now().UTC()); err != nil {
		return err
	}
	if r.stop == nil {
		r.stop = make(chan struct{})
		go r.renewLease(r.leaseID, r.stop)
	}
	return nil
}

func (r *GatewayBudgetReservation) renewLease(id string, stop <-chan struct{}) {
	ticker := time.NewTicker(gatewayLeaseRefresh)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			found, err := renewGatewayLease(r.TokenID, id, time.Now())
			if err != nil {
				common.SysError("gateway lease renewal error: " + err.Error())
			} else if !found {
				return // Expired and reclaimed, or already finished.
			}
		}
	}
}

func renewGatewayLease(tokenID int, id string, now time.Time) (bool, error) {
	found := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockGatewayToken(tx, tokenID); err != nil {
			return err
		}
		result := tx.Model(&GatewayRequestLease{}).Where("id = ? AND token_id = ?", id, tokenID).
			Update("expires_at", now.Add(gatewayLeaseTTL).UnixNano())
		found = result.RowsAffected != 0
		if result.Error != nil {
			return result.Error
		}
		return tx.Exec("UPDATE tokens SET gateway_active_requests = gateway_active_requests - 1 WHERE id = ?", tokenID).Error
	})
	return found, err
}

func (r *GatewayBudgetReservation) reserveAt(target int64, now time.Time) error {
	if target < 0 {
		return errors.New("negative gateway reservation")
	}
	day, month := gatewayDay(now), gatewayMonth(now)
	sameDay, sameMonth := r.Active && r.Day == day, r.Active && r.Month == month
	dayDelta, monthDelta := target, target
	if sameDay {
		dayDelta -= r.Amount
	}
	if sameMonth {
		monthDelta -= r.Amount
	}
	if r.Active && sameDay && sameMonth && target <= r.Amount {
		return nil
	}
	id := r.leaseID
	if !r.Active {
		id = uuid.NewString()
	}
	rejected := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockGatewayToken(tx, r.TokenID); err != nil {
			return err
		}
		if err := cleanupGatewayLeases(tx, r.TokenID, now); err != nil {
			return err
		}
		count, err := gatewayLeaseCount(tx, r.TokenID)
		if err != nil {
			return err
		}
		if r.Active {
			var existing int64
			if err := tx.Model(&GatewayRequestLease{}).Where("id = ? AND token_id = ?", id, r.TokenID).Count(&existing).Error; err != nil {
				return err
			}
			if existing == 0 {
				return fmt.Errorf("gateway request lease expired")
			}
		}
		acquire := int64(0)
		if !r.Active {
			acquire = 1
		}
		// The token row is locked across cleanup, count, budget check and
		// insertion. CASE uses the old period for MySQL assignment semantics.
		result := tx.Exec(`UPDATE tokens SET
			gateway_daily_used = (CASE WHEN gateway_day = ? THEN gateway_daily_used ELSE 0 END) + ?,
			gateway_monthly_used = (CASE WHEN gateway_month = ? THEN gateway_monthly_used ELSE 0 END) + ?,
			gateway_day = ?, gateway_month = ?,
			gateway_active_requests = ?
			WHERE id = ? AND deleted_at IS NULL AND gateway_enabled = ?
			AND (gateway_concurrency_limit = 0 OR ? <= gateway_concurrency_limit)
			AND (gateway_daily_limit = 0 OR (CASE WHEN gateway_day = ? THEN gateway_daily_used ELSE 0 END) + ? <= gateway_daily_limit)
			AND (gateway_monthly_limit = 0 OR (CASE WHEN gateway_month = ? THEN gateway_monthly_used ELSE 0 END) + ? <= gateway_monthly_limit)`,
			day, dayDelta, month, monthDelta, day, month, count+acquire, r.TokenID, true,
			count+acquire, day, dayDelta, month, monthDelta)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			// Commit cleanup even when this reservation is over budget.
			rejected = true
			return tx.Exec("UPDATE tokens SET gateway_active_requests = ? WHERE id = ?", count, r.TokenID).Error
		}
		lease := GatewayRequestLease{ID: id, TokenID: r.TokenID, ExpiresAt: now.Add(gatewayLeaseTTL).UnixNano(), Day: day, Month: month, Amount: target}
		if r.Active {
			return tx.Model(&GatewayRequestLease{}).Where("id = ? AND token_id = ?", id, r.TokenID).
				Updates(map[string]interface{}{"expires_at": lease.ExpiresAt, "day": day, "month": month, "amount": target}).Error
		}
		return tx.Create(&lease).Error
	})
	if err != nil {
		return err
	}
	if rejected {
		return ErrGatewayBudgetExceeded
	}
	r.Active, r.Day, r.Month, r.Amount, r.leaseID = true, day, month, target, id
	return nil
}

// Finish reconciles the reservation against actual cost and releases its slot
// exactly once. A late finish cannot decrement another request's slot.
func (r *GatewayBudgetReservation) Finish(actual int64) error {
	if !r.Active {
		return nil
	}
	// The request has ended even if settlement fails. Never keep renewing an
	// orphaned lease after the caller has stopped trying to finish it.
	if r.stop != nil {
		close(r.stop)
		r.stop = nil
	}
	if actual < 0 {
		return fmt.Errorf("negative gateway charge")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockGatewayToken(tx, r.TokenID); err != nil {
			return err
		}
		var lease GatewayRequestLease
		if err := tx.Where("id = ? AND token_id = ?", r.leaseID, r.TokenID).First(&lease).Error; err != nil {
			return fmt.Errorf("gateway request lease unavailable: %w", err)
		}
		if err := tx.Delete(&lease).Error; err != nil {
			return err
		}
		count, err := gatewayLeaseCount(tx, r.TokenID)
		if err != nil {
			return err
		}
		delta := actual - lease.Amount
		return tx.Exec(`UPDATE tokens SET
			gateway_daily_used = CASE WHEN gateway_day = ? THEN gateway_daily_used + ? ELSE gateway_daily_used END,
			gateway_monthly_used = CASE WHEN gateway_month = ? THEN gateway_monthly_used + ? ELSE gateway_monthly_used END,
			gateway_active_requests = ?
			WHERE id = ?`, lease.Day, delta, lease.Month, delta, count, r.TokenID).Error
	})
	if err != nil {
		return err
	}
	r.Active = false
	return nil
}
