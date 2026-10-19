package model

import (
        "errors"
        "fmt"

        "github.com/QuantumNous/new-api/common"
        "gorm.io/gorm"
)

const (
        WithdrawalStatusPending  = "pending"
        WithdrawalStatusApproved = "approved"
        WithdrawalStatusRejected = "rejected"
)

type WithdrawalRequest struct {
        Id          int    `json:"id"`
        UserId      int    `json:"user_id" gorm:"index"`
        Username    string `json:"username" gorm:"-"`
        Amount      int64  `json:"amount"`
        Method      string `json:"method" gorm:"type:varchar(20)"`
        Details     string `json:"details" gorm:"type:text"`
        Status      string `json:"status" gorm:"type:varchar(20);default:'pending'"`
        Note        string `json:"note" gorm:"type:text"`
        CreatedTime int64  `json:"created_time"`
        UpdatedTime int64  `json:"updated_time"`
}

const MinWithdrawalUSD = 10

func SubmitWithdrawalRequest(userId int, amount int64, method, details string) (*WithdrawalRequest, error) {
        minAmount := int64(MinWithdrawalUSD * common.QuotaPerUnit)
        if amount < minAmount {
                return nil, fmt.Errorf("minimum withdrawal amount is $%d", MinWithdrawalUSD)
        }

        var req *WithdrawalRequest
        err := DB.Transaction(func(tx *gorm.DB) error {
                var user User
                if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&user, userId).Error; err != nil {
                        return err
                }
                if int64(user.AffQuota) < amount {
                        return errors.New("insufficient affiliate balance")
                }
                user.AffQuota -= int(amount)
                if err := tx.Save(&user).Error; err != nil {
                        return err
                }
                now := common.GetTimestamp()
                req = &WithdrawalRequest{
                        UserId:      userId,
                        Amount:      amount,
                        Method:      method,
                        Details:     details,
                        Status:      WithdrawalStatusPending,
                        CreatedTime: now,
                        UpdatedTime: now,
                }
                return tx.Create(req).Error
        })
        if err != nil {
                return nil, err
        }
        return req, nil
}

func GetWithdrawalsByUserId(userId int) ([]*WithdrawalRequest, error) {
        var list []*WithdrawalRequest
        err := DB.Where("user_id = ?", userId).Order("id desc").Find(&list).Error
        return list, err
}

func GetAllWithdrawals(offset, limit int, status string) ([]*WithdrawalRequest, int64, error) {
        var list []*WithdrawalRequest
        var total int64
        q := DB.Model(&WithdrawalRequest{})
        if status != "" {
                q = q.Where("status = ?", status)
        }
        if err := q.Count(&total).Error; err != nil {
                return nil, 0, err
        }
        if err := q.Order("id desc").Limit(limit).Offset(offset).Find(&list).Error; err != nil {
                return nil, 0, err
        }
        for _, r := range list {
                if u, err := GetUserById(r.UserId, false); err == nil {
                        r.Username = u.Username
                }
        }
        return list, total, nil
}

func GetWithdrawalById(id int) (*WithdrawalRequest, error) {
        var w WithdrawalRequest
        err := DB.First(&w, "id = ?", id).Error
        return &w, err
}

func (w *WithdrawalRequest) RejectAndRefund() error {
        return DB.Transaction(func(tx *gorm.DB) error {
                var user User
                if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&user, w.UserId).Error; err != nil {
                        return err
                }
                user.AffQuota += int(w.Amount)
                if err := tx.Save(&user).Error; err != nil {
                        return err
                }
                w.Status = WithdrawalStatusRejected
                w.UpdatedTime = common.GetTimestamp()
                return tx.Model(w).Select("status", "note", "updated_time").Updates(w).Error
        })
}

func (w *WithdrawalRequest) Approve(note string) error {
        w.Status = WithdrawalStatusApproved
        w.Note = note
        w.UpdatedTime = common.GetTimestamp()
        return DB.Model(w).Select("status", "note", "updated_time").Updates(w).Error
}
