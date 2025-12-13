package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

const (
	version = "1.0.0"
	// This will be replaced during build with the actual API URL
	defaultAPIURL = "https://your-app.vercel.app"
)

var apiURL = defaultAPIURL

type InstallResponse struct {
	ClusterID   string `json:"cluster_id"`
	ClusterName string `json:"cluster_name"`
	Manifest    string `json:"manifest"`
	Error       string `json:"error,omitempty"`
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "install":
		if len(os.Args) < 3 {
			fmt.Println("Error: Missing installation token")
			fmt.Println("Usage: kubervise install <TOKEN>")
			os.Exit(1)
		}
		token := os.Args[2]
		install(token)

	case "uninstall":
		uninstall()

	case "status":
		status()

	case "version":
		fmt.Printf("Kubervise CLI v%s\n", version)
		fmt.Printf("OS: %s/%s\n", runtime.GOOS, runtime.GOARCH)

	case "help", "--help", "-h":
		printUsage()

	default:
		// Assume it's a token for backward compatibility
		install(command)
	}
}

func printUsage() {
	fmt.Println(`
Kubervise CLI - Kubernetes Cluster Agent Installer

Usage:
  kubervise install <TOKEN>   Install the Kubervise agent using the provided token
  kubervise uninstall         Remove the Kubervise agent from the cluster
  kubervise status            Check the status of the Kubervise agent
  kubervise version           Show version information
  kubervise help              Show this help message

Examples:
  kubervise install abc123def456...
  kubervise uninstall
  kubervise status

Prerequisites:
  - kubectl must be installed and configured
  - You must have cluster-admin permissions

For more information, visit: https://kubervise.io/docs
`)
}

func install(token string) {
	fmt.Println("╔════════════════════════════════════════╗")
	fmt.Println("║     Kubervise Agent Installer          ║")
	fmt.Println("╚════════════════════════════════════════╝")
	fmt.Println()

	// Check kubectl
	fmt.Print("Checking kubectl... ")
	if !checkKubectl() {
		fmt.Println("FAILED")
		fmt.Println("\nError: kubectl is not installed or not in PATH")
		fmt.Println("Please install kubectl: https://kubernetes.io/docs/tasks/tools/")
		os.Exit(1)
	}
	fmt.Println("OK")

	// Check cluster connection
	fmt.Print("Checking cluster connection... ")
	if !checkClusterConnection() {
		fmt.Println("FAILED")
		fmt.Println("\nError: Cannot connect to Kubernetes cluster")
		fmt.Println("Make sure your kubeconfig is configured correctly")
		os.Exit(1)
	}
	fmt.Println("OK")

	// Fetch manifest from API
	fmt.Print("Fetching installation manifest... ")
	response, err := fetchManifest(token)
	if err != nil {
		fmt.Println("FAILED")
		fmt.Printf("\nError: %s\n", err)
		os.Exit(1)
	}
	fmt.Println("OK")

	fmt.Printf("\nCluster: %s\n", response.ClusterName)
	fmt.Printf("Cluster ID: %s\n\n", response.ClusterID)

	// Apply manifest
	fmt.Print("Applying Kubernetes manifests... ")
	if err := applyManifest(response.Manifest); err != nil {
		fmt.Println("FAILED")
		fmt.Printf("\nError: %s\n", err)
		os.Exit(1)
	}
	fmt.Println("OK")

	// Wait for deployment
	fmt.Print("Waiting for agent to start... ")
	if err := waitForDeployment(); err != nil {
		fmt.Println("TIMEOUT")
		fmt.Println("\nWarning: Agent deployment is taking longer than expected")
		fmt.Println("Check status with: kubectl -n kubervise get pods")
	} else {
		fmt.Println("OK")
	}

	fmt.Println()
	fmt.Println("╔════════════════════════════════════════╗")
	fmt.Println("║     Installation Complete!             ║")
	fmt.Println("╚════════════════════════════════════════╝")
	fmt.Println()
	fmt.Println("The Kubervise agent is now running in your cluster.")
	fmt.Println("It will automatically sync data to your dashboard.")
	fmt.Println()
	fmt.Println("Useful commands:")
	fmt.Println("  kubectl -n kubervise get pods      # Check agent status")
	fmt.Println("  kubectl -n kubervise logs -f deployment/kubervise-agent  # View logs")
	fmt.Println("  kubervise status                   # Quick status check")
	fmt.Println("  kubervise uninstall                # Remove the agent")
}

func uninstall() {
	fmt.Println("Removing Kubervise agent...")
	fmt.Println()

	// Check kubectl
	if !checkKubectl() {
		fmt.Println("Error: kubectl is not installed")
		os.Exit(1)
	}

	// Delete resources
	resources := []string{
		"deployment/kubervise-agent -n kubervise",
		"secret/kubervise-agent-secrets -n kubervise",
		"serviceaccount/kubervise-agent -n kubervise",
		"clusterrolebinding/kubervise-agent",
		"clusterrole/kubervise-agent",
		"namespace/kubervise",
	}

	for _, resource := range resources {
		fmt.Printf("Deleting %s... ", resource)
		cmd := exec.Command("kubectl", append([]string{"delete"}, strings.Split(resource, " ")...)...)
		cmd.Stderr = io.Discard
		if err := cmd.Run(); err != nil {
			fmt.Println("skipped")
		} else {
			fmt.Println("OK")
		}
	}

	fmt.Println()
	fmt.Println("Kubervise agent has been removed.")
}

func status() {
	fmt.Println("Kubervise Agent Status")
	fmt.Println("======================")
	fmt.Println()

	// Check namespace
	cmd := exec.Command("kubectl", "get", "namespace", "kubervise", "-o", "jsonpath={.status.phase}")
	output, err := cmd.Output()
	if err != nil {
		fmt.Println("Status: NOT INSTALLED")
		fmt.Println("\nThe Kubervise agent is not installed in this cluster.")
		return
	}

	fmt.Printf("Namespace: %s\n", string(output))

	// Check deployment
	cmd = exec.Command("kubectl", "-n", "kubervise", "get", "deployment", "kubervise-agent",
		"-o", "jsonpath={.status.readyReplicas}/{.status.replicas}")
	output, err = cmd.Output()
	if err != nil {
		fmt.Println("Deployment: ERROR")
	} else {
		fmt.Printf("Deployment: %s replicas ready\n", string(output))
	}

	// Check pods
	fmt.Println("\nPods:")
	cmd = exec.Command("kubectl", "-n", "kubervise", "get", "pods", "-o", "wide")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
}

func checkKubectl() bool {
	cmd := exec.Command("kubectl", "version", "--client", "--short")
	return cmd.Run() == nil
}

func checkClusterConnection() bool {
	cmd := exec.Command("kubectl", "cluster-info")
	cmd.Stderr = io.Discard
	cmd.Stdout = io.Discard
	return cmd.Run() == nil
}

func fetchManifest(token string) (*InstallResponse, error) {
	url := fmt.Sprintf("%s/api/install/%s", apiURL, token)

	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to server: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != 200 {
		var errResp InstallResponse
		json.Unmarshal(body, &errResp)
		if errResp.Error != "" {
			return nil, fmt.Errorf("%s", errResp.Error)
		}
		return nil, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	var response InstallResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("invalid response from server: %v", err)
	}

	return &response, nil
}

func applyManifest(manifest string) error {
	cmd := exec.Command("kubectl", "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(manifest)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %s", err, string(output))
	}

	return nil
}

func waitForDeployment() error {
	cmd := exec.Command("kubectl", "-n", "kubervise", "rollout", "status",
		"deployment/kubervise-agent", "--timeout=60s")
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	return cmd.Run()
}
