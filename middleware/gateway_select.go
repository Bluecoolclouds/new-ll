package middleware

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

type gatewayCandidate struct {
	name   string
	price  float64
	fixed  bool
	priced bool
}

type gatewayChoice struct {
	candidate gatewayCandidate
	channel   *model.Channel
	group     string
	score     float64
	reason    string
}

// weightedGatewayChoice preserves the channel weights inside the highest
// available priority tier. A zero-weight tier is sampled uniformly.
func weightedGatewayChoice(choices []gatewayChoice, randomInt func(int) int) gatewayChoice {
	total := 0
	for _, c := range choices {
		if c.channel.GetWeight() > 0 {
			total += c.channel.GetWeight()
		}
	}
	if total == 0 {
		return choices[randomInt(len(choices))]
	}
	n := randomInt(total)
	for _, c := range choices {
		n -= c.channel.GetWeight()
		if n < 0 {
			return c
		}
	}
	return choices[len(choices)-1]
}

func selectGatewayChoice(choices []gatewayChoice, profile string, randomInt func(int) int) gatewayChoice {
	// Keep only the highest currently healthy priority for each model/group.
	// Within auto groups, prefer the first usable group as before.
	eligible := make([]gatewayChoice, 0, len(choices))
	for _, c := range choices {
		firstGroup := ""
		maxPriority := c.channel.GetPriority()
		for _, other := range choices {
			if other.candidate.name == c.candidate.name {
				firstGroup = other.group
				break
			}
		}
		if c.group != firstGroup {
			continue
		}
		for _, other := range choices {
			if other.candidate.name == c.candidate.name && other.group == c.group && other.channel.GetPriority() > maxPriority {
				maxPriority = other.channel.GetPriority()
			}
		}
		if c.channel.GetPriority() == maxPriority {
			eligible = append(eligible, c)
		}
	}
	baseline := eligible[0]
	modelChoices := make([]gatewayChoice, 0, len(eligible))
	for _, c := range eligible {
		if c.candidate.name == baseline.candidate.name {
			modelChoices = append(modelChoices, c)
		}
	}
	if profile != "speed" && profile != "reliable" {
		return weightedGatewayChoice(modelChoices, randomInt)
	}
	// One in ten calls explores the configured candidate set, weighted within
	// its priority tier. This allows cold healthy channels to reach eight
	// observations without letting a few lucky fast calls dominate traffic.
	if randomInt(10) == 0 {
		return weightedGatewayChoice(eligible, randomInt)
	}
	best := baseline
	for _, c := range eligible {
		if c.score > best.score {
			best = c
		}
	}
	if best.score > baseline.score*1.15+0.01 {
		nearBest := make([]gatewayChoice, 0, len(eligible))
		for _, c := range eligible {
			if c.score >= best.score/1.15-0.01 {
				nearBest = append(nearBest, c)
			}
		}
		return weightedGatewayChoice(nearBest, randomInt)
	}
	return weightedGatewayChoice(modelChoices, randomInt)
}

type gatewayModelStats struct {
	score float64
	until time.Time
}

var gatewayStatsCache = struct {
	sync.Mutex
	values map[string]gatewayModelStats
}{values: make(map[string]gatewayModelStats)}

// Aggregate model metrics are a weak prior; live per-channel observations
// decide the route once there is enough evidence.
func gatewayModelScore(name, group, profile string) float64 {
	key := group + "\x00" + name + "\x00" + profile
	gatewayStatsCache.Lock()
	if entry, ok := gatewayStatsCache.values[key]; ok && time.Now().Before(entry.until) {
		gatewayStatsCache.Unlock()
		return entry.score
	}
	gatewayStatsCache.Unlock()
	rows, err := model.GetPerfMetrics(name, group, time.Now().Add(-2*time.Hour).Unix(), time.Now().Unix())
	var n, okCount, latency, ttft, ttftCount int64
	if err == nil {
		for _, row := range rows {
			n += row.RequestCount
			okCount += row.SuccessCount
			latency += row.TotalLatencyMs
			ttft += row.TtftSumMs
			ttftCount += row.TtftCount
		}
	}
	score := 0.0
	if n >= 20 {
		delay := float64(latency) / float64(n)
		if profile == "speed" && ttftCount >= 8 {
			delay = float64(ttft) / float64(ttftCount)
		}
		if delay < 100 {
			delay = 100
		}
		if delay > 30000 {
			delay = 30000
		}
		score = (float64(okCount+8) / float64(n+10)) * 1000 / (500 + delay)
	}
	gatewayStatsCache.Lock()
	if len(gatewayStatsCache.values) > 2048 {
		gatewayStatsCache.values = make(map[string]gatewayModelStats)
	}
	gatewayStatsCache.values[key] = gatewayModelStats{score, time.Now().Add(30 * time.Second)}
	gatewayStatsCache.Unlock()
	return score
}

// Cost ordering compares only like-for-like billing modes. Fixed-price calls
// and per-token ratios cannot be compared without knowing the response length.
func orderGatewayCandidates(names []string, profile string) []gatewayCandidate {
	candidates := make([]gatewayCandidate, 0, len(names))
	for _, raw := range names {
		name := strings.TrimSpace(raw)
		if name == "" || name == "auto" {
			continue
		}
		price, fixed, ok := ratio_setting.GetModelRatioOrPrice(name)
		if !ok && billing_setting.GetBillingMode(name) == billing_setting.BillingModeTieredExpr {
			expr, exists := billing_setting.GetBillingExpr(name)
			ok = exists && strings.TrimSpace(expr) != ""
		}
		candidates = append(candidates, gatewayCandidate{name: name, price: price, fixed: fixed, priced: ok})
	}
	comparable := gatewayCandidatesComparable(candidates)
	if profile == "cost" && comparable {
		sort.SliceStable(candidates, func(i, j int) bool {
			return candidates[i].price < candidates[j].price
		})
	}
	return candidates
}

func selectGatewayModel(c *gin.Context, group string) (string, *model.Channel, string, error) {
	return selectGatewayModelExcluding(c, group, nil)
}

// SelectGatewayFallback selects another explicitly permitted, priced model.
func SelectGatewayFallback(c *gin.Context, group string, excluded map[string]bool) (string, *model.Channel, string, error) {
	return selectGatewayModelExcluding(c, group, excluded)
}

// selectGatewayModelExcluding rechecks both token permissions and live channel
// availability on every transition; a failed model is never selected twice.
func selectGatewayModelExcluding(c *gin.Context, group string, excluded map[string]bool) (string, *model.Channel, string, error) {
	names := c.GetStringSlice("gateway_models")
	if len(names) == 0 {
		return "", nil, "", fmt.Errorf("AI Gateway key has no allowed models")
	}
	groups := []string{group}
	if group == "auto" {
		groups = service.GetUserAutoGroup(common.GetContextKeyString(c, constant.ContextKeyUserGroup))
	}
	profile := c.GetString("gateway_profile")
	reason := "configured_order"
	if profile == "cost" && gatewayPricesComparable(names) {
		reason = "lower_configured_price"
	}
	var choices []gatewayChoice
	var exclusions []string
	needed, _ := c.Value("gateway_features").(gatewayFeatures)
	for _, candidate := range orderGatewayCandidates(names, profile) {
		if !candidate.priced || excluded[candidate.name] {
			continue
		}
		limits, ok := c.Get("token_model_limit")
		if !ok {
			// Gateway keys always have explicit model limits.
			return "", nil, "", fmt.Errorf("AI Gateway key has no model permissions")
		}
		allowed, ok := limits.(map[string]bool)
		if !ok || !allowed[candidate.name] {
			continue
		}
		// The token's model limit is the entire candidate set; never expand it
		// to all group models, even when the group has broader access.
		for _, availableGroup := range groups {
			channels, err := model.GetGatewayChannels(availableGroup, candidate.name, c.Request.URL.Path)
			if err != nil {
				return "", nil, "", err
			}
			for _, channel := range channels {
				if !gatewaySupports(channel, candidate.name, needed) {
					exclusions = append(exclusions, fmt.Sprintf("%s/#%d:unsupported_%s", candidate.name, channel.Id, needed))
					continue
				}
				score, why, blocked := gatewayChannelScore(channel.Id, profile)
				if blocked {
					exclusions = append(exclusions, fmt.Sprintf("%s/#%d:%s", candidate.name, channel.Id, why))
					continue
				}
				// No observations: preserve configured priority. Model-level
				// metrics only supply a bounded prior, not a hard exclusion.
				if profile == "speed" || profile == "reliable" {
					score += gatewayModelScore(candidate.name, availableGroup, profile) * 0.2
				}
				choices = append(choices, gatewayChoice{candidate, channel, availableGroup, score, why})
			}
		}
	}
	if previous, ok := c.Value("gateway_exclusions").([]string); ok {
		exclusions = append(previous, exclusions...)
	}
	c.Set("gateway_exclusions", exclusions)
	if len(exclusions) > 0 {
		common.SysLog(fmt.Sprintf("AI Gateway excluded routes: %v", exclusions))
	}
	for len(choices) > 0 {
		selected := selectGatewayChoice(choices, profile, rand.Intn)
		for i, c := range choices {
			if c.channel.Id == selected.channel.Id && c.candidate.name == selected.candidate.name {
				choices = append(choices[:i], choices[i+1:]...)
				break
			}
		}
		if !ReserveGatewayProbe(selected.channel.Id) {
			continue
		}
		if setupErr := SetupContextForSelectedChannel(c, selected.channel, selected.candidate.name); setupErr != nil {
			ReleaseGatewayProbe(selected.channel.Id)
			continue
		}
		if group == "auto" {
			common.SetContextKey(c, constant.ContextKeyAutoGroup, selected.group)
		}
		if profile == "speed" || profile == "reliable" {
			reason = selected.reason
			if reason == "insufficient_samples" {
				reason = "configured_order_insufficient_samples"
			}
		}
		return selected.candidate.name, selected.channel, reason, nil
	}
	if needed != 0 {
		return "", nil, "", fmt.Errorf("no available compatible AI Gateway model/channel for required capabilities: %s", needed)
	}
	return "", nil, "", fmt.Errorf("no available billable model for this AI Gateway key in its allowed group")
}

func gatewayPricesComparable(names []string) bool {
	return gatewayCandidatesComparable(orderGatewayCandidates(names, "ordered"))
}

func gatewayCandidatesComparable(candidates []gatewayCandidate) bool {
	if len(candidates) == 0 {
		return false
	}
	for _, candidate := range candidates {
		if !candidate.priced || candidate.fixed != candidates[0].fixed ||
			(billing_setting.GetBillingMode(candidate.name) == billing_setting.BillingModeTieredExpr) {
			return false
		}
	}
	return true
}
