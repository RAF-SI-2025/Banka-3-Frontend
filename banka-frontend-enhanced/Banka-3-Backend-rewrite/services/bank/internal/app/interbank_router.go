package app

import (
	"strings"
)

// EnvInterbankRouter implements service.InterbankRouter using a
// comma-separated environment variable of the form:
//
//	INTERBANK_ROUTES=111:https://banka1.example.com,222:https://banka2.example.com
//
// Each entry is BANK_CODE:BASE_URL. Unknown codes return ("", false).
type EnvInterbankRouter struct {
	routes map[string]string
}

// ParseInterbankRoutes parses the INTERBANK_ROUTES env string.
// Empty string → empty router (no foreign payments possible).
func ParseInterbankRoutes(raw string) *EnvInterbankRouter {
	r := &EnvInterbankRouter{routes: make(map[string]string)}
	for _, entry := range strings.Split(raw, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		parts := strings.SplitN(entry, ":", 2)
		if len(parts) != 2 {
			continue
		}
		code := strings.TrimSpace(parts[0])
		url := strings.TrimSpace(parts[1])
		if code != "" && url != "" {
			r.routes[code] = url
		}
	}
	return r
}

func (r *EnvInterbankRouter) URLForBankCode(code string) (string, bool) {
	url, ok := r.routes[code]
	return url, ok
}
