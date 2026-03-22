package capsule

import (
	"context"
	"os/exec"
	"strings"
)

// ExecuteCLICommand führt einen kubectl-Befehl aus und erzwingt die Impersonation des Users
func (m *Manager) ExecuteCLICommand(ctx context.Context, userEmail string, args []string) (string, error) {
	// WICHTIG: Wir erzwingen kubectl und stellen IMMER die Impersonation an den Anfang!
	// Wenn es am Ende steht, würde es bei Befehlen wie "exec pod -- ls" als Befehl an den Container durchgereicht werden.
	finalArgs := append([]string{"--as=" + userEmail}, args...)

	// Da wir exec.Command nutzen, ist das sicher vor Command-Injection (; rm -rf / funktioniert hier nicht)
	cmd := exec.CommandContext(ctx, "kubectl", finalArgs...)

	outputBytes, err := cmd.CombinedOutput()
	outputStr := strings.TrimSpace(string(outputBytes))

	return outputStr, err
}
