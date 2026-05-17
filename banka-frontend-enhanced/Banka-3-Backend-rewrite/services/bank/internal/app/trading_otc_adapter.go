package app

import (
	"context"
	"strings"

	tradingpb "github.com/RAF-SI-2025/Banka-3-Backend/gen/proto/trading/v1"
	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/auth"
	"github.com/RAF-SI-2025/Banka-3-Backend/pkg/permissions"
	"github.com/RAF-SI-2025/Banka-3-Backend/services/bank/internal/service"
)

type tradingOTCAdapter struct {
	c    tradingpb.TradingServiceClient
	bank *service.Service
}

func (a *tradingOTCAdapter) ListPublicHoldingsForInterbank(ctx context.Context) (interface{}, error) {
	ctx = auth.AttachToOutgoing(ctx, auth.Principal{
		UserID:      "00000000-0000-0000-0000-000000000005",
		UserKind:    auth.KindEmployee,
		Permissions: []string{permissions.Admin},
	})
	res, err := a.c.ListPublicHoldings(ctx, &tradingpb.ListPublicHoldingsRequest{})
	if err != nil {
		return nil, err
	}

	type row struct {
		HoldingID         string `json:"holdingId"`
		Ticker            string `json:"ticker"`
		SecurityType      string `json:"securityType"`
		AvailableCount    int32  `json:"availableCount"`
		PricePerUnit      string `json:"pricePerUnit"`
		Currency          string `json:"currency"`
		SellerAccountID   string `json:"sellerAccountId"`
		SellerAccountNo   string `json:"sellerAccountNumber"`
		SellerDisplayName string `json:"sellerDisplayName"`
	}

	out := make([]row, 0, len(res.GetItems()))
	for _, item := range res.GetItems() {
		sec := item.GetSecurity()
		if sec == nil {
			continue
		}
		accountNumber := ""
		if a.bank != nil && item.GetSellerAccountId() != "" {
			if acc, err := a.bank.Store.GetAccountByID(ctx, item.GetSellerAccountId()); err == nil {
				accountNumber = acc.Number
			}
		}
		out = append(out, row{
			HoldingID:         item.GetHoldingId(),
			Ticker:            sec.GetTicker(),
			SecurityType:      enumName(sec.GetType().String(), "SECURITY_TYPE_"),
			AvailableCount:    item.GetAvailableCount(),
			PricePerUnit:      item.GetCurrentPrice(),
			Currency:          enumName(item.GetCurrency().String(), "CURRENCY_"),
			SellerAccountID:   item.GetSellerAccountId(),
			SellerAccountNo:   accountNumber,
			SellerDisplayName: item.GetSellerDisplayName(),
		})
	}
	return out, nil
}

func enumName(s, prefix string) string {
	s = strings.TrimPrefix(s, prefix)
	return strings.ToLower(s)
}
