package main

import (
	"flag"
	"fmt"
	"log"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/giulian-coding/kubervise/internal/api"
	"github.com/giulian-coding/kubervise/internal/capsule"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

func main() {
	// 1. K8s Client Setup mit automatischer Pfad-Ermittlung
	var kubeconfig *string
	if home := homedir.HomeDir(); home != "" {
		// Sucht automatisch in C:\Users\DeinName\.kube\config (Windows) oder ~/.kube/config (Linux/Mac)
		kubeconfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "(optional) absolute path to the kubeconfig file")
	} else {
		kubeconfig = flag.String("kubeconfig", "", "absolute path to the kubeconfig file")
	}
	flag.Parse()

	// Config laden und FEHLER PRÜFEN (verhindert den Panic)
	config, err := clientcmd.BuildConfigFromFlags("", *kubeconfig)
	if err != nil {
		log.Fatalf("Fehler beim Laden der Kubeconfig unter %s: %v", *kubeconfig, err)
	}

	// Client erstellen und FEHLER PRÜFEN
	client, err := dynamic.NewForConfig(config)
	if err != nil {
		log.Fatalf("Fehler beim Erstellen des K8s Clients: %v", err)
	}

	// Manager initialisieren
	mgr := capsule.NewManager(client)

	// Handler initialisieren
	tenantHandler := &api.TenantHandler{
		Manager: mgr,
	}

	r := gin.Default()

	// Ein sehr robuster CORS Middleware-Block
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	fmt.Println("🚀 API-Server läuft auf http://localhost:8080")

	// 3. Die Route für das "Railway" Board
	r.GET("/api/v1/my-tenants", tenantHandler.ListMyTenants)

	// Viel sauberer: Wir rufen einfach die Funktion aus dem Handler auf!
	r.POST("/api/v1/create-tenant", tenantHandler.CreateTenant)

	// --- Namespace Routen ---
	r.GET("/api/v1/tenants/:tenantName/namespaces", tenantHandler.ListNamespaces)
	r.POST("/api/v1/tenants/:tenantName/namespaces", tenantHandler.CreateNamespace)
	r.DELETE("/api/v1/namespaces/:namespaceName", tenantHandler.DeleteNamespace)

	// --- Deployment & Pod Routen ---
	r.GET("/api/v1/namespaces/:namespaceName/deployments", tenantHandler.ListDeployments)
	r.POST("/api/v1/namespaces/:namespaceName/deployments", tenantHandler.CreateDeployment)
	r.DELETE("/api/v1/namespaces/:namespaceName/deployments/:deploymentName", tenantHandler.DeleteDeployment)
	r.GET("/api/v1/namespaces/:namespaceName/pods", tenantHandler.ListPods)

	// --- Service Routen ---
	r.GET("/api/v1/namespaces/:namespaceName/services", tenantHandler.ListServices)
	r.POST("/api/v1/namespaces/:namespaceName/services", tenantHandler.CreateService)
	r.DELETE("/api/v1/namespaces/:namespaceName/services/:serviceName", tenantHandler.DeleteService)

	// --- NetworkPolicy Routen ---
	r.GET("/api/v1/namespaces/:namespaceName/networkpolicies", tenantHandler.ListNetworkPolicies)
	r.POST("/api/v1/namespaces/:namespaceName/networkpolicies", tenantHandler.CreateNetworkPolicy)
	r.DELETE("/api/v1/namespaces/:namespaceName/networkpolicies/:policyName", tenantHandler.DeleteNetworkPolicy)

	r.Run(":8080")
}
