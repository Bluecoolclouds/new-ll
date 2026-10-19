package controller

import (
        "encoding/json"
        "fmt"
        "math"
        "net/http"
        "strconv"
        "sync"
        "time"

        "github.com/QuantumNous/new-api/common"
        "github.com/QuantumNous/new-api/logger"
        "github.com/QuantumNous/new-api/model"
        "github.com/QuantumNous/new-api/setting"

        "github.com/gin-gonic/gin"
)

type cbrDailyResp struct {
        Valute map[string]struct {
                Value float64 `json:"Value"`
        } `json:"Valute"`
}

var (
        cbrMu          sync.RWMutex
        lastCBRRate    float64
        lastCBRFetchAt time.Time
)

func fetchCBRRate() (float64, error) {
        client := &http.Client{Timeout: 10 * time.Second}
        resp, err := client.Get("https://www.cbr-xml-daily.ru/daily_json.js")
        if err != nil {
                return 0, fmt.Errorf("CBR request failed: %w", err)
        }
        defer resp.Body.Close()

        var data cbrDailyResp
        if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
                return 0, fmt.Errorf("CBR response decode failed: %w", err)
        }

        usd, ok := data.Valute["USD"]
        if !ok {
                return 0, fmt.Errorf("USD not found in CBR response")
        }
        return usd.Value, nil
}

func GetLiveCBRRate() (float64, error) {
        rate, err := fetchCBRRate()
        if err != nil {
                return 0, err
        }

        cbrMu.Lock()
        lastCBRRate = rate
        lastCBRFetchAt = time.Now()
        cbrMu.Unlock()

        return rate, nil
}

func applyCBRRateInternal() error {
        rate, err := GetLiveCBRRate()
        if err != nil {
                return err
        }

        unitPrice := math.Ceil(rate) + setting.FreeKassaCBRMarkup
        if unitPrice <= 0 {
                unitPrice = math.Ceil(rate)
        }

        unitPriceStr := strconv.FormatFloat(unitPrice, 'f', 2, 64)

        if err := model.UpdateOption("FreeKassaUnitPrice", unitPriceStr); err != nil {
                return fmt.Errorf("failed to update FreeKassaUnitPrice: %w", err)
        }

        if err := model.UpdateOption("general_setting.custom_currency_exchange_rate", unitPriceStr); err != nil {
                common.SysLog("CBR: failed to sync custom_currency_exchange_rate: " + err.Error())
        }

        return nil
}

func StartCBRAutoSync() {
        go func() {
                time.Sleep(10 * time.Second)
                // Always fetch once at startup to populate lastCBRRate for display purposes
                if _, err := GetLiveCBRRate(); err != nil {
                        common.SysLog("CBR initial fetch failed (display only): " + err.Error())
                } else {
                        cbrMu.RLock()
                        common.SysLog(fmt.Sprintf("CBR initial fetch: USD/RUB=%.4f", lastCBRRate))
                        cbrMu.RUnlock()
                }
                for {
                        if setting.FreeKassaCBRAutoSync {
                                if err := applyCBRRateInternal(); err != nil {
                                        common.SysLog("CBR auto-sync error: " + err.Error())
                                } else {
                                        cbrMu.RLock()
                                        common.SysLog(fmt.Sprintf("CBR auto-sync applied: USD/RUB=%.4f unitPrice=%.2f", lastCBRRate, setting.FreeKassaUnitPrice))
                                        cbrMu.RUnlock()
                                }
                        }
                        time.Sleep(6 * time.Hour)
                }
        }()
}

func GetCBRRateHandler(c *gin.Context) {
        rate, err := GetLiveCBRRate()
        if err != nil {
                logger.LogError(c.Request.Context(), "CBR rate fetch failed: "+err.Error())
                c.JSON(http.StatusServiceUnavailable, gin.H{
                        "success": false,
                        "message": "Не удалось получить курс ЦБ РФ: " + err.Error(),
                })
                return
        }

        cbrMu.RLock()
        fetchedAt := lastCBRFetchAt
        cbrMu.RUnlock()

        c.JSON(http.StatusOK, gin.H{
                "success":   true,
                "rate":      rate,
                "fetchedAt": fetchedAt.Unix(),
        })
}

func ApplyCBRRateHandler(c *gin.Context) {
        if err := applyCBRRateInternal(); err != nil {
                logger.LogError(c.Request.Context(), "CBR rate apply failed: "+err.Error())
                c.JSON(http.StatusServiceUnavailable, gin.H{
                        "success": false,
                        "message": "Не удалось применить курс ЦБ РФ: " + err.Error(),
                })
                return
        }

        cbrMu.RLock()
        rate := lastCBRRate
        cbrMu.RUnlock()

        logger.LogInfo(c.Request.Context(), fmt.Sprintf("CBR rate applied: USD/RUB=%.4f unitPrice=%.2f", rate, setting.FreeKassaUnitPrice))

        c.JSON(http.StatusOK, gin.H{
                "success":   true,
                "message":   fmt.Sprintf("Курс применён: USD/RUB = %.4f, цена единицы = %.2f ₽", rate, setting.FreeKassaUnitPrice),
                "rate":      rate,
                "unitPrice": setting.FreeKassaUnitPrice,
        })
}
