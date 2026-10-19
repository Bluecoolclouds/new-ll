package controller

import (
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type submitWithdrawalRequest struct {
	Amount  int64  `json:"amount" binding:"required,min=1"`
	Method  string `json:"method" binding:"required,oneof=sbp crypto"`
	Details string `json:"details" binding:"required"`
}

type adminUpdateWithdrawalRequest struct {
	Status string `json:"status" binding:"required,oneof=approved rejected"`
	Note   string `json:"note"`
}

func SubmitWithdrawal(c *gin.Context) {
	userId := c.GetInt("id")

	var req submitWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"success": false, "message": err.Error()})
		return
	}

	wr, err := model.SubmitWithdrawalRequest(userId, req.Amount, req.Method, req.Details)
	if err != nil {
		c.JSON(200, gin.H{"success": false, "message": err.Error()})
		return
	}

	user, _ := model.GetUserById(userId, false)
	username := ""
	if user != nil {
		username = user.Username
	}

	amountUSD := float64(req.Amount) / common.QuotaPerUnit
	subject := fmt.Sprintf("New withdrawal request #%d", wr.Id)
	content := fmt.Sprintf(
		"User: %s (ID: %d)\nAmount: $%.2f\nMethod: %s\nDetails: %s",
		username, userId, amountUSD, req.Method, req.Details,
	)
	go service.NotifyRootUser("withdrawal_request", subject, content)

	c.JSON(200, gin.H{"success": true, "message": "Withdrawal request submitted", "data": wr})
}

func GetUserWithdrawals(c *gin.Context) {
	userId := c.GetInt("id")
	list, err := model.GetWithdrawalsByUserId(userId)
	if err != nil {
		c.JSON(500, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"success": true, "data": list})
}

func AdminGetWithdrawals(c *gin.Context) {
	status := c.Query("status")
	pageStr := c.DefaultQuery("p", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")

	page, _ := strconv.Atoi(pageStr)
	pageSize, _ := strconv.Atoi(pageSizeStr)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	list, total, err := model.GetAllWithdrawals(offset, pageSize, status)
	if err != nil {
		c.JSON(500, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"success": true, "data": list, "total": total})
}

func AdminUpdateWithdrawal(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(400, gin.H{"success": false, "message": "invalid id"})
		return
	}

	var req adminUpdateWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"success": false, "message": err.Error()})
		return
	}

	wr, err := model.GetWithdrawalById(id)
	if err != nil {
		c.JSON(404, gin.H{"success": false, "message": "not found"})
		return
	}
	if wr.Status != model.WithdrawalStatusPending {
		c.JSON(400, gin.H{"success": false, "message": "only pending requests can be updated"})
		return
	}

	if req.Status == model.WithdrawalStatusRejected {
		wr.Note = req.Note
		if err := wr.RejectAndRefund(); err != nil {
			c.JSON(500, gin.H{"success": false, "message": err.Error()})
			return
		}
	} else {
		if err := wr.Approve(req.Note); err != nil {
			c.JSON(500, gin.H{"success": false, "message": err.Error()})
			return
		}
	}

	c.JSON(200, gin.H{"success": true, "message": "updated", "data": wr})
}
